/**
 * Editor LiveKit Agent
 *
 * Joins a LiveKit Cloud room as a bot participant using @livekit/rtc-node.
 * Receives user mic audio via WebRTC, pipes it to Gemini Live,
 * and publishes the TTS response back into the room.
 *
 * Architecture:
 *   Dealer (livekit-client) <-> LiveKit SFU <-> Bot (@livekit/rtc-node)
 *                                                  |
 *                                             Gemini Live
 *
 * Based on chatbotLivekitAgent.js with all production fixes:
 *   - TTS playback queue with _playbackLoop()
 *   - AbortController for Gemini Live output loop
 *   - Race condition fix in waitAndRun()
 *   - Double-stop guard
 *   - 60s timeout for zombie agent prevention
 *   - TrackSource.SOURCE_UNKNOWN for bot tracks
 */

const {
  Room,
  RoomEvent,
  AudioSource,
  AudioStream,
  AudioFrame,
  LocalAudioTrack,
  TrackPublishOptions,
  TrackSource,
  TrackKind,
} = require("@livekit/rtc-node");
const { AccessToken } = require("livekit-server-sdk");
const { startEditorVoiceSession } = require("./editorVoiceService");
require("dotenv").config();

const SAMPLE_RATE = 16000; // Gemini Live input
const OUTPUT_SAMPLE_RATE = 24000; // Gemini Live output
const NUM_CHANNELS = 1;

class EditorLivekitAgent {
  constructor(roomName, carId, storyData, currentSceneIndex = 0) {
    this.roomName = roomName;
    this.carId = carId;
    this.storyData = storyData;
    this.currentSceneIndex = currentSceneIndex;
    this.room = new Room();
    this.isClosing = false;
    this.audioQueue = [];
    this.resolveNext = null;
    this._abortController = new AbortController();

    // TTS playback queue — frames are queued by the callback and
    // drained at real-time pace by _playbackLoop()
    this._ttsQueue = [];
    this._ttsResolve = null;
  }

  /**
   * Generate a JWT for the bot to join the LiveKit room.
   */
  async generateBotToken() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error("LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set");
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: `autosense-editor-${this.carId.slice(0, 8)}`,
      name: "AutoSense Editor Copilot",
    });
    at.addGrant({
      roomJoin: true,
      room: this.roomName,
      canPublish: true,
      canSubscribe: true,
    });
    return await at.toJwt();
  }

  /**
   * Async generator feeding PCM audio chunks to Gemini Live.
   * Yields { audio: { data: Uint8Array } } matching editorVoiceService expectations.
   */
  async *audioInputGenerator() {
    while (!this.isClosing) {
      if (this.audioQueue.length > 0) {
        yield { audio: { data: this.audioQueue.shift() } };
      } else {
        await new Promise((resolve) => {
          this.resolveNext = resolve;
        });
      }
    }
  }

  /**
   * Push an audio buffer into the queue for the Gemini Live generator.
   */
  pushAudio(buffer) {
    this.audioQueue.push(buffer);
    if (this.resolveNext) {
      this.resolveNext();
      this.resolveNext = null;
    }
  }

  /**
   * Connect to the LiveKit room and publish the bot audio track.
   * Resolves once the bot is connected and ready.
   */
  async connect() {
    const url = process.env.LIVEKIT_URL;
    if (!url) throw new Error("LIVEKIT_URL missing in .env");

    const token = await this.generateBotToken();
    await this.room.connect(url, token);
    console.log(`[EditorAgent] Bot connected to room: ${this.roomName}`);

    // Publish an audio track for TTS playback
    this._audioSource = new AudioSource(OUTPUT_SAMPLE_RATE, NUM_CHANNELS);
    const track = LocalAudioTrack.createAudioTrack(
      "editor-voice-assistant",
      this._audioSource,
    );
    const publishOptions = new TrackPublishOptions();
    publishOptions.source = TrackSource.SOURCE_UNKNOWN;
    await this.room.localParticipant.publishTrack(track, publishOptions);
    console.log(`[EditorAgent] Bot audio track published`);

    this.room.on(RoomEvent.Disconnected, () => {
      console.log(`[EditorAgent] Room disconnected`);
      this.stop();
    });
  }

  /**
   * Wait for the user to join, then start the Gemini Live session.
   * Call this after connect() resolves.
   */
  async waitAndRun() {
    try {
      console.log(`[EditorAgent] Waiting for user audio track...`);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for user to join (60s)"));
        }, 60000);

        const onTrack = (remoteTrack, publication, participant) => {
          if (remoteTrack.kind !== TrackKind.KIND_AUDIO) return;
          if (participant.identity.startsWith("autosense-editor-")) return;

          console.log(
            `[EditorAgent] Subscribed to audio from: ${participant.identity}`,
          );

          const audioStream = new AudioStream(remoteTrack, SAMPLE_RATE);
          this._consumeAudioStream(audioStream);

          clearTimeout(timeout);
          resolve();
        };

        this.room.on(RoomEvent.TrackSubscribed, onTrack);

        // Race condition fix: user may have published their mic before the bot
        // registered the TrackSubscribed listener — check existing tracks now.
        for (const participant of this.room.remoteParticipants.values()) {
          if (participant.identity.startsWith("autosense-editor-")) continue;
          for (const pub of participant.trackPublications.values()) {
            if (pub.track && pub.track.kind === TrackKind.KIND_AUDIO) {
              console.log(
                `[EditorAgent] Found existing audio track from: ${participant.identity}`,
              );
              const audioStream = new AudioStream(pub.track, SAMPLE_RATE);
              this._consumeAudioStream(audioStream);
              clearTimeout(timeout);
              resolve();
              return;
            }
          }
        }
      });

      // Start Gemini Live session (user mic is now streaming)
      const audioSource = this._audioSource;
      console.log(
        `[EditorAgent] User connected — starting Gemini Live session`,
      );

      // Start the real-time playback loop (drains TTS queue at 24kHz pace)
      this._playbackLoop(audioSource);

      await startEditorVoiceSession(
        this.audioInputGenerator(),
        this.carId,
        this.storyData,
        this.currentSceneIndex,
        (audioChunk) => {
          // audioChunk is Uint8Array of PCM 24kHz 16-bit mono
          if (this.isClosing) return;
          this._ttsQueue.push(audioChunk);
          if (this._ttsResolve) {
            this._ttsResolve();
            this._ttsResolve = null;
          }
        },
        this._abortController.signal,
      );
    } catch (error) {
      console.error("[EditorAgent] CRITICAL:", error);
      this.stop();
    }
  }

  /**
   * Async playback loop — drains TTS queue at real-time pace.
   * `await audioSource.captureFrame(frame)` blocks until the frame duration
   * has elapsed, naturally pacing playback at 24kHz.
   */
  async _playbackLoop(audioSource) {
    while (!this.isClosing) {
      if (this._ttsQueue.length === 0) {
        await new Promise((resolve) => {
          this._ttsResolve = resolve;
        });
        if (this.isClosing) break;
      }
      while (this._ttsQueue.length > 0 && !this.isClosing) {
        const audioChunk = this._ttsQueue.shift();
        try {
          const int16 = new Int16Array(
            audioChunk.buffer,
            audioChunk.byteOffset,
            audioChunk.byteLength / 2,
          );
          const frame = new AudioFrame(
            int16,
            OUTPUT_SAMPLE_RATE,
            NUM_CHANNELS,
            int16.length,
          );
          await audioSource.captureFrame(frame);
        } catch (err) {
          if (!this.isClosing) {
            console.error("[EditorAgent] Playback frame error:", err.message);
          }
        }
      }
    }
  }

  /**
   * Consume audio frames from a subscribed remote track and feed to Gemini Live.
   */
  async _consumeAudioStream(audioStream) {
    try {
      for await (const frame of audioStream) {
        if (this.isClosing) break;
        const pcm = new Uint8Array(
          frame.data.buffer,
          frame.data.byteOffset,
          frame.data.byteLength,
        );
        this.pushAudio(pcm);
      }
    } catch (err) {
      if (!this.isClosing) {
        console.error("[EditorAgent] Audio stream error:", err.message);
      }
    }
  }

  /**
   * Gracefully disconnect.
   */
  stop() {
    if (this.isClosing) return; // prevent double-stop
    this.isClosing = true;
    this._abortController.abort();
    if (this.resolveNext) this.resolveNext();
    if (this._ttsResolve) this._ttsResolve(); // wake playback loop so it exits
    try {
      this.room.disconnect();
    } catch {}
    console.log(`[EditorAgent] Disconnected from: ${this.roomName}`);
  }
}

module.exports = { EditorLivekitAgent };
