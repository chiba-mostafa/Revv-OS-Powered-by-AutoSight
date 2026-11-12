import { useEffect, useRef, useState, useCallback } from "react";
import { useChatbotStore } from "../store/useChatbotStore";
import { API_BASE } from "../config/api";

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

function encodePcm16(float32Array) {
  const pcm = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[i] || 0));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm.buffer;
}

function resampleTo16k(channelData, sourceSampleRate) {
  if (!channelData?.length) return new Float32Array(0);
  if (sourceSampleRate === INPUT_SAMPLE_RATE) return channelData;

  const ratio = sourceSampleRate / INPUT_SAMPLE_RATE;
  const newLength = Math.max(1, Math.round(channelData.length / ratio));
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i += 1) {
    const position = i * ratio;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(leftIndex + 1, channelData.length - 1);
    const interpolation = position - leftIndex;
    result[i] =
      channelData[leftIndex] * (1 - interpolation) +
      channelData[rightIndex] * interpolation;
  }

  return result;
}

export function useVoiceChatbot(carId, carContext) {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const socketRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const inputProcessorRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const outputAudioContextRef = useRef(null);
  const playbackTimeRef = useRef(0);
  const voiceStartTimeRef = useRef(null);
  const partialUserTranscriptRef = useRef("");

  const cleanupAudio = useCallback(() => {
    if (inputProcessorRef.current) {
      try {
        inputProcessorRef.current.disconnect();
      } catch {}
      inputProcessorRef.current.onaudioprocess = null;
      inputProcessorRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }

    playbackTimeRef.current = 0;
  }, []);

  const cleanup = useCallback(() => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {}
      socketRef.current = null;
    }

    cleanupAudio();
  }, [cleanupAudio]);

  const queuePlayback = useCallback((arrayBuffer) => {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) return;

    if (!outputAudioContextRef.current) {
      outputAudioContextRef.current = new window.AudioContext({
        sampleRate: OUTPUT_SAMPLE_RATE,
      });
    }

    const context = outputAudioContextRef.current;
    const pcm16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(pcm16.length);

    for (let i = 0; i < pcm16.length; i += 1) {
      float32[i] = pcm16[i] / 0x8000;
    }

    const audioBuffer = context.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);

    const startAt = Math.max(context.currentTime, playbackTimeRef.current);
    source.start(startAt);
    playbackTimeRef.current = startAt + audioBuffer.duration;
  }, []);

  const flushPlayback = useCallback(() => {
    if (outputAudioContextRef.current) {
      playbackTimeRef.current = outputAudioContextRef.current.currentTime;
    } else {
      playbackTimeRef.current = 0;
    }
  }, []);

  const bindSocket = useCallback(
    (socket) => {
      socket.binaryType = "arraybuffer";

      socket.onmessage = (event) => {
        if (typeof event.data !== "string") {
          queuePlayback(event.data);
          return;
        }

        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "status") {
            if (payload.event === "interrupted") {
              flushPlayback();
            }
            if (payload.event === "error") {
              throw new Error(payload.message || "Voice session error");
            }
            return;
          }

          if (payload.type === "user_transcript" || payload.event === "user_transcript") {
            const text = String(payload.text || "").trim();
            if (!text) return;

            if (payload.isFinal) {
              partialUserTranscriptRef.current = "";
              useChatbotStore.getState().addVoiceUserMessage(text);
            } else {
              partialUserTranscriptRef.current = text;
            }
            return;
          }

          if (payload.type === "ai_response" || payload.event === "ai_response") {
            useChatbotStore
              .getState()
              .upsertVoiceBotMessageChunk(
                payload.streamId,
                payload.text || "",
                Boolean(payload.isFinal),
              );
            return;
          }

          if (payload.type === "tool_call" || payload.event === "tool_call") {
            if (payload.tool === "booking_draft" || payload.payload) {
              useChatbotStore
                .getState()
                .addWidgetMessage(
                  "booking_draft",
                  payload.payload || {},
                  "I'd love to help you schedule a test drive! Let me pull up the booking form.",
                );
            }
          }
        } catch (error) {
          console.error("[VoiceChatbot] Socket message parse failed:", error);
        }
      };
    },
    [flushPlayback, queuePlayback],
  );

  const startCapture = useCallback(async (socket, leanContext, chatHistory) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    mediaStreamRef.current = stream;
    const audioContext = new window.AudioContext();
    audioContextRef.current = audioContext;

    const sourceNode = audioContext.createMediaStreamSource(stream);
    sourceNodeRef.current = sourceNode;

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    inputProcessorRef.current = processor;

    processor.onaudioprocess = (event) => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const downsampled = resampleTo16k(input, audioContext.sampleRate);
      const pcmBuffer = encodePcm16(downsampled);
      socketRef.current.send(pcmBuffer);
    };

    sourceNode.connect(processor);
    processor.connect(audioContext.destination);

    socket.send(
      JSON.stringify({
        type: "start",
        car_context: leanContext,
        chat_history: chatHistory,
      }),
    );
  }, []);

  const startVoice = useCallback(async () => {
    if (isVoiceActive || isConnecting || !carId) return;
    setIsConnecting(true);

    try {
      const { messages } = useChatbotStore.getState();
      const chatHistory = messages
        .filter((m) => m.type === "user" || m.type === "bot")
        .slice(-6)
        .map((m) => ({ type: m.type, text: m.text }));

      const { _storyData, ...leanContext } = carContext || {};

      const configRes = await fetch(`${API_BASE}/api/rag/voice/config`);
      if (!configRes.ok) {
        throw new Error("Failed to fetch voice configuration");
      }

      const { websocketUrl } = await configRes.json();
      const socket = new WebSocket(`${websocketUrl}?car_id=${encodeURIComponent(carId)}`);
      socketRef.current = socket;

      bindSocket(socket);

      await new Promise((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error("Voice websocket connection failed"));
      });

      useChatbotStore.getState().startVoiceSession();
      voiceStartTimeRef.current = Date.now();

      await startCapture(socket, leanContext, chatHistory);

      socket.onclose = () => {
        const durationSecs = voiceStartTimeRef.current
          ? Math.round((Date.now() - voiceStartTimeRef.current) / 1000)
          : 0;
        voiceStartTimeRef.current = null;
        const { isWidgetActive } = useChatbotStore.getState();
        cleanup();
        setIsVoiceActive(false);
        setIsConnecting(false);
        if (!isWidgetActive) {
          useChatbotStore.getState().setWidgetActive(false);
          useChatbotStore.getState().endVoiceSession(durationSecs);
        }
      };

      setIsVoiceActive(true);
      setIsConnecting(false);

      useChatbotStore
        .getState()
        .addVoiceBotMessage(
          "Voice mode activated. I'm listening - go ahead and ask me anything!",
        );
    } catch (error) {
      console.error("[VoiceChatbot] Start failed:", error);
      cleanup();
      setIsConnecting(false);
      throw error;
    }
  }, [bindSocket, carContext, carId, cleanup, isConnecting, isVoiceActive, startCapture]);

  const stopVoice = useCallback(() => {
    const durationSecs = voiceStartTimeRef.current
      ? Math.round((Date.now() - voiceStartTimeRef.current) / 1000)
      : 0;
    voiceStartTimeRef.current = null;

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "stop" }));
    }

    cleanup();
    setIsVoiceActive(false);
    setIsConnecting(false);
    const { isWidgetActive } = useChatbotStore.getState();
    if (!isWidgetActive) {
      useChatbotStore.getState().setWidgetActive(false);
      useChatbotStore.getState().endVoiceSession(durationSecs);
    }
  }, [cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { isVoiceActive, isConnecting, startVoice, stopVoice };
}
