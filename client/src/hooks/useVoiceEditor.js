import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { useStoryStore } from "../store/useStoryStore";
import { useEditorStore } from "../components/AutoSense/store/useEditorStore";
import { API_BASE } from "../config/api";
import axios from "axios";

// Re-callable wrapper — retries up to `retries` times with linear back-off.
async function withRetry(fn, retries = 2, delayMs = 1500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
}

function buildVoiceTechScene({
  storyData,
  headline,
  paragraph,
  voiceoverText,
  techMode,
}) {
  const specs = storyData?.car_specs || {};
  const perf = specs.performance || {};
  const safety = specs.safety || {};
  const dims = specs.dimensions || {};
  const resolvedTechMode = ["PERFORMANCE", "SAFETY", "UTILITY"].includes(
    techMode,
  )
    ? techMode
    : "UTILITY";

  let techConfig = { mode: resolvedTechMode, camera_views: ["primary"] };
  let keyStats = [];
  let defaultHeadline = "";
  let defaultParagraph = "";

  switch (resolvedTechMode) {
    case "PERFORMANCE":
      techConfig = {
        ...techConfig,
        drivetrain: perf.drivetrain || "FWD",
        engine_hp: perf.hp ?? null,
        torque_nm: perf.torque_nm ?? null,
        zero_to_sixty_sec: perf.zero_to_sixty_sec ?? null,
      };
      if (perf.hp) {
        keyStats.push({
          label: "Horsepower",
          value: String(perf.hp),
          unit: "HP",
        });
      }
      if (perf.torque_nm) {
        keyStats.push({
          label: "Torque",
          value: String(perf.torque_nm),
          unit: "Nm",
        });
      }
      if (perf.zero_to_sixty_sec) {
        keyStats.push({
          label: "0-60 mph",
          value: String(perf.zero_to_sixty_sec),
          unit: "Sec",
        });
      }
      if (keyStats.length === 0) {
        keyStats.push({
          label: "Drivetrain",
          value: perf.drivetrain || "FWD",
          unit: "",
        });
      }
      defaultHeadline = "Performance Overview";
      defaultParagraph = perf.hp
        ? `Delivering ${perf.hp} horsepower${perf.torque_nm ? ` and ${perf.torque_nm} Nm of torque` : ""}, this powertrain is built for responsive driving.`
        : "Explore the powertrain and performance capabilities of this vehicle.";
      break;

    case "SAFETY":
      techConfig = {
        ...techConfig,
        airbag_count: safety.airbags ?? 6,
        has_front_sensors: true,
        has_rear_sensors: true,
        safety_rating: safety.rating_text ?? null,
        assist_systems: safety.assist_systems || ["ABS", "Traction Control"],
      };
      if (safety.airbags) {
        keyStats.push({
          label: "Airbags",
          value: String(safety.airbags),
          unit: "",
        });
      }
      if (safety.rating_text) {
        keyStats.push({
          label: "Safety Rating",
          value: safety.rating_text,
          unit: "",
        });
      }
      keyStats.push({
        label: "Assist Systems",
        value: String(
          (safety.assist_systems || ["ABS", "Traction Control"]).length,
        ),
        unit: "Systems",
      });
      defaultHeadline = "Safety Overview";
      defaultParagraph = `Equipped with ${safety.airbags ?? 6} airbags and advanced driver-assistance systems to keep you protected on every journey.`;
      break;

    case "UTILITY":
    default:
      techConfig = {
        ...techConfig,
        dimensions: {
          length_mm: dims.length_mm ?? 4500,
          width_mm: dims.width_mm ?? 1800,
          height_mm: dims.height_mm ?? 1500,
          wheelbase_mm: dims.wheelbase_mm ?? null,
        },
        trunk_capacity_liters: dims.trunk_capacity_l ?? null,
        seat_count: dims.seats ?? 5,
      };
      if (dims.trunk_capacity_l) {
        keyStats.push({
          label: "Cargo Space",
          value: String(dims.trunk_capacity_l),
          unit: "Liters",
        });
      }
      keyStats.push({
        label: "Seats",
        value: String(dims.seats ?? 5),
        unit: "",
      });
      if (dims.length_mm) {
        keyStats.push({
          label: "Length",
          value: String(dims.length_mm),
          unit: "mm",
        });
      }
      defaultHeadline = "Utility Overview";
      defaultParagraph = dims.trunk_capacity_l
        ? `With ${dims.trunk_capacity_l} liters of cargo space and seating for ${dims.seats ?? 5}, this vehicle is designed for everyday versatility.`
        : "Explore the dimensions and cargo capabilities of this vehicle.";
      break;
  }

  return {
    scene_id: `scene_voice_${Date.now()}`,
    type: "tech_view",
    theme_tag: resolvedTechMode,
    duration_seconds: 8,
    tech_config: techConfig,
    layout: {
      composition: "overlay-bottom",
      card_position: "right",
      content_alignment: "bottom-left",
      motion: { image: "static", content: "fade-up" },
    },
    slide_content: {
      headline: headline || defaultHeadline,
      paragraph: paragraph || defaultParagraph,
      alignment: "right",
      key_stats: keyStats.slice(0, 3),
      badges: [],
      theme_tag: resolvedTechMode,
    },
    voiceover_text: voiceoverText || "",
    audio_url: null,
    image_url: null,
    hotspots: [],
  };
}

/**
 * useVoiceEditor Hook
 *
 * Speech-to-Speech mode for the Editor Copilot via LiveKit Cloud.
 *
 * Audio pipeline:
 *   Browser mic -> LiveKit SFU -> Bot (@livekit/rtc-node) -> Gemini Live
 *   Gemini Live TTS -> Bot -> LiveKit SFU -> Browser speakers
 *
 * State sync:
 *   SSE /api/editor/voice/events -> tool_call -> execute on useStoryStore/useEditorStore
 *
 * @param {string} carId - UUID of the car
 */
export function useVoiceEditor(carId) {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const roomRef = useRef(null);
  const eventSourceRef = useRef(null);
  const roomNameRef = useRef(null);
  const transcriptCommitTimerRef = useRef(null);
  // Accumulates all ASSISTANT text across multiple Nova content blocks within
  // a single conversational turn.  Committed into one copilot message when the
  // turn is considered finished (new user speech, tool call, or 2s silence).
  const assistantTurnBufferRef = useRef("");
  const assistantFlushTimerRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: flush the accumulated assistant turn buffer into a single message
  // ─────────────────────────────────────────────────────────────────────────
  function flushAssistantTurn() {
    if (assistantFlushTimerRef.current) {
      clearTimeout(assistantFlushTimerRef.current);
      assistantFlushTimerRef.current = null;
    }
    const raw = assistantTurnBufferRef.current;
    assistantTurnBufferRef.current = "";
    if (!raw) return;

    const fullText = raw
      .replace(/\s*\n+\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!fullText) return;

    // Upsert into the store — if the last message is an uncommitted voice
    // assistant message, APPEND this block's text (accumulate across multiple
    // Nova content blocks within one turn), otherwise create a new message.
    const { copilotMessages, addCopilotMessage } = useEditorStore.getState();
    const last = copilotMessages[copilotMessages.length - 1];
    if (last?.role === "assistant" && last?.isVoice && !last?.committed) {
      // Append new text to existing pending assistant message
      const merged = `${last.content} ${fullText}`.replace(/\s+/g, " ").trim();
      const next = [...copilotMessages];
      next[next.length - 1] = {
        ...last,
        content: merged,
        timestamp: Date.now(),
      };
      useEditorStore.setState({ copilotMessages: next });
    } else {
      addCopilotMessage({
        role: "assistant",
        content: fullText,
        timestamp: Date.now(),
        isVoice: true,
        committed: false,
      });
    }
  }

  // Mark the current pending voice assistant message as committed so future
  // turns don't overwrite it.
  function commitAssistantTurn() {
    const { copilotMessages } = useEditorStore.getState();
    const last = copilotMessages[copilotMessages.length - 1];
    if (last?.role === "assistant" && last?.isVoice && !last?.committed) {
      const next = [...copilotMessages];
      next[next.length - 1] = { ...last, committed: true };
      useEditorStore.setState({ copilotMessages: next });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────
  function cleanup() {
    if (transcriptCommitTimerRef.current) {
      clearTimeout(transcriptCommitTimerRef.current);
      transcriptCommitTimerRef.current = null;
    }
    if (assistantFlushTimerRef.current) {
      clearTimeout(assistantFlushTimerRef.current);
      assistantFlushTimerRef.current = null;
    }
    // Flush any remaining assistant text before disconnect
    flushAssistantTurn();
    commitAssistantTurn();
    assistantTurnBufferRef.current = "";

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (roomNameRef.current) {
      fetch(`${API_BASE}/api/editor/voice/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName: roomNameRef.current }),
      }).catch(() => {});
      roomNameRef.current = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // startVoice
  // ─────────────────────────────────────────────────────────────────────────
  const startVoice = useCallback(async () => {
    if (isVoiceActive || isConnecting) return;
    setIsConnecting(true);

    // Also set connecting state in the editor store so the UI can react
    useEditorStore.getState().setVoiceConnecting(true);

    try {
      const storyData = useStoryStore.getState().storyData;
      const currentSceneIndex = useStoryStore.getState().currentSceneIndex;

      // -- 1. Request a LiveKit token from the backend --
      const res = await fetch(`${API_BASE}/api/editor/voice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: carId,
          story_data: storyData,
          current_scene_index: currentSceneIndex,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start editor voice session");
      }

      const { token, url, roomName } = await res.json();
      roomNameRef.current = roomName;

      // -- 2. Connect to the LiveKit room --
      const room = new Room();
      roomRef.current = room;

      // When the bot publishes its audio track, attach for playback
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.id = `lk-audio-${participant.identity}`;
          document.body.appendChild(el);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
      });

      room.on(RoomEvent.Disconnected, () => {
        cleanup();
        setIsVoiceActive(false);
        setIsConnecting(false);
        useEditorStore.getState().setVoiceActive(false);
        useEditorStore.getState().setVoiceConnecting(false);
      });

      await room.connect(url, token);

      // -- 3. Publish local microphone --
      await room.localParticipant.setMicrophoneEnabled(true);

      // -- 4. Open SSE for editor voice events --
      const es = new EventSource(`${API_BASE}/api/editor/voice/events`);
      eventSourceRef.current = es;

      // User transcript -> copilot messages
      // Also flush+commit any pending assistant turn so the assistant message
      // appears BEFORE the next user message in the chat.
      es.addEventListener("user_transcript", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.carId === carId && data.text) {
            // Commit any accumulated assistant turn before starting user turn
            flushAssistantTurn();
            commitAssistantTurn();

            useEditorStore.getState().upsertLastVoiceUserMessage(data.text);
            if (transcriptCommitTimerRef.current) {
              clearTimeout(transcriptCommitTimerRef.current);
            }
            transcriptCommitTimerRef.current = setTimeout(() => {
              useEditorStore.getState().commitLastVoiceUserMessage();
              transcriptCommitTimerRef.current = null;
            }, 1400);
          }
        } catch {}
      });

      // AI response text -> accumulate into a single turn buffer.
      // Gemini Live can emit multiple ASSISTANT content blocks per conversational
      // turn (before tool calls, after tool results, repeated completionEnd
      // cycles).  We merge them all into one pending message and commit once
      // the turn is truly over (new user speech / tool call / 2s silence).
      es.addEventListener("ai_response", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.carId !== carId) return;
          if (data.isFinal) {
            // A content block just ended — flush accumulated text into the
            // pending assistant message, but DON'T commit yet (more blocks
            // may follow in this turn).
            flushAssistantTurn();
            // Reset the deferred commit timer — commit after 2s of silence
            if (assistantFlushTimerRef.current) {
              clearTimeout(assistantFlushTimerRef.current);
            }
            assistantFlushTimerRef.current = setTimeout(() => {
              commitAssistantTurn();
              assistantFlushTimerRef.current = null;
            }, 2000);
          } else if (data.text) {
            // Accumulate incremental text
            assistantTurnBufferRef.current += data.text;
          }
        } catch {}
      });

      // Tool calls -> execute editor actions
      // Flush+commit any pending assistant turn before processing the tool.
      es.addEventListener("tool_call", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.carId !== carId) return;
          // Commit pending assistant message
          flushAssistantTurn();
          commitAssistantTurn();
          // Commit pending user message
          if (transcriptCommitTimerRef.current) {
            clearTimeout(transcriptCommitTimerRef.current);
            transcriptCommitTimerRef.current = null;
          }
          useEditorStore.getState().commitLastVoiceUserMessage();
          executeToolCall(data.type, data.payload);
        } catch {}
      });

      // Status events (errors)
      es.addEventListener("status", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "error" && data.carId === carId) {
            stopVoice();
          }
        } catch {}
      });

      setIsVoiceActive(true);
      setIsConnecting(false);
      useEditorStore.getState().setVoiceActive(true);
      useEditorStore.getState().setVoiceConnecting(false);

      // Add a welcome message to copilot chat
      useEditorStore.getState().addCopilotMessage({
        role: "assistant",
        content:
          "Voice mode activated. I'm listening — tell me what to change in your story!",
        timestamp: Date.now(),
        isVoice: true,
        committed: true,
      });
    } catch (err) {
      console.error("[VoiceEditor] Start failed:", err);
      cleanup();
      setIsConnecting(false);
      useEditorStore.getState().setVoiceConnecting(false);
      throw err;
    }
  }, [carId, isVoiceActive, isConnecting]);

  // ─────────────────────────────────────────────────────────────────────────
  // stopVoice
  // ─────────────────────────────────────────────────────────────────────────
  const stopVoice = useCallback(() => {
    cleanup();
    setIsVoiceActive(false);
    setIsConnecting(false);
    useEditorStore.getState().setVoiceActive(false);
    useEditorStore.getState().setVoiceConnecting(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, []);

  return { isVoiceActive, isConnecting, startVoice, stopVoice };
}

// ═════════════════════════════════════════════════════════════════════════════
// Tool Call Execution — maps Gemini Live tool calls to store actions
// ═════════════════════════════════════════════════════════════════════════════
function executeToolCall(toolName, payload) {
  const store = useStoryStore.getState();
  const editorStore = useEditorStore.getState();

  console.log(`[VoiceEditor] Executing tool: ${toolName}`, payload);

  switch (toolName) {
    // ── update_scene_text ──────────────────────────────────────────────
    case "update_scene_text": {
      const { sceneIndex, field, text } = payload;
      if (sceneIndex == null || !field || !text) break;

      const updates = {};
      if (field === "voiceover") {
        updates.voiceover_text = text;
        updates.raw_voiceover = text;
        updates.slide_content = {
          ...(store.storyData?.scenes?.[sceneIndex]?.slide_content || {}),
          voiceover_text: text,
        };
      } else {
        // headline or paragraph
        const existingContent =
          store.storyData?.scenes?.[sceneIndex]?.slide_content || {};
        updates.slide_content = {
          ...existingContent,
          [field]: text,
        };
      }
      store.updateSceneAtIndex(sceneIndex, updates);
      editorStore.markDirty();
      break;
    }

    // ── change_layout ──────────────────────────────────────────────────
    case "change_layout": {
      const { sceneIndex, composition } = payload;
      if (sceneIndex == null || !composition) break;

      const scene = store.storyData?.scenes?.[sceneIndex];
      store.updateSceneAtIndex(sceneIndex, {
        layout: {
          ...(scene?.layout || {}),
          composition,
        },
      });
      editorStore.markDirty();
      break;
    }

    // ── change_theme ───────────────────────────────────────────────────
    // Delegates to update_meta with hybrid delegation for full retheme.
    case "change_theme": {
      const { theme } = payload;
      if (!theme) break;
      // Delegate to update_meta which handles hybrid delegation
      executeToolCall("update_meta", { template: theme });
      break;
    }

    // ── update_meta ─────────────────────────────────────────────────────
    // Hybrid delegation: apply meta immediately, then delegate to the text
    // copilot LLM for full per-scene rewrites (theme + translate) because
    // the live voice model should not be responsible for generating the full
    // UPDATE_ALL_SCENES payload.
    case "update_meta": {
      if (!payload || typeof payload !== "object") break;

      const updates = {};
      if (payload.template) updates.template = payload.template;
      if (payload.language) updates.language = payload.language;
      if (Object.keys(updates).length === 0) break;

      const isThemeChange = !!updates.template;
      const isLangChange = !!updates.language;
      if (isThemeChange || isLangChange) {
        const msg = isThemeChange
          ? `Applying ${updates.template === "minimaltech" ? "Minimal Tech" : "Cinematic"} aesthetics...`
          : `Switching narrative to ${updates.language === "fr" ? "French" : "English"}...`;
        editorStore.setCinematicSweep({ message: msg });
      }

      store.updateMeta(updates);
      if (updates.template) {
        const themeVal =
          updates.template === "minimaltech" ? "minimal_tech" : "cinematic";
        store.updateAllScenesTheme(themeVal);
      }
      editorStore.markDirty();

      // ── Hybrid delegation: ask the text copilot LLM to generate the
      //    full per-scene rewrite (UPDATE_ALL_SCENES) that the live voice
      //    model should not produce on its own. ──────────────────────────
      if (isThemeChange || isLangChange) {
        // Synthesize a natural-language instruction for the text copilot
        const parts = [];
        if (isThemeChange) {
          const themeName =
            updates.template === "minimaltech" ? "Minimal Tech" : "Cinematic";
          parts.push(`retheme the entire story to the ${themeName} template`);
        }
        if (isLangChange) {
          const langName = updates.language === "fr" ? "French" : "English";
          parts.push(`translate all scenes to ${langName}`);
        }
        const synthesizedMessage =
          parts.length === 2 ? `${parts[0]} and ${parts[1]}` : parts[0];

        // Build the same storySummary the text copilot expects
        const freshStory = useStoryStore.getState().storyData;
        const sceneIdx = useStoryStore.getState().currentSceneIndex;
        const storySummary = {
          car: freshStory?.car
            ? {
                year: freshStory.car.year,
                make: freshStory.car.make,
                model: freshStory.car.model,
                body_type: freshStory.car.body_type,
                color: freshStory.car.color,
                trim: freshStory.car.trim,
              }
            : null,
          title: freshStory?.title,
          language: freshStory?.language,
          totalScenes: freshStory?.scenes?.length || 0,
          currentSceneIndex: sceneIdx,
          scenes: (freshStory?.scenes || []).map((s, i) => ({
            index: i,
            type: s.type,
            theme_tag: s.theme_tag,
            headline:
              s.slide_content?.headline ||
              s.intro_content?.title ||
              s.outro_content?.headline ||
              `Scene ${i + 1}`,
            paragraph:
              s.slide_content?.paragraph ||
              s.intro_content?.subtitle ||
              s.outro_content?.subheadline ||
              "",
            layout: s.layout || null,
            has_audio: !!s.audio_url,
            has_image: !!s.image_url,
            hotspot_count: s.hotspots?.length || 0,
            badge_count: s.slide_content?.badges?.length || 0,
            key_stats: s.slide_content?.key_stats || [],
            voiceover_text: s.voiceover_text || "",
          })),
          availableBadges: (freshStory?.badges || []).map((b) => ({
            name: b.name,
            category: b.category,
          })),
        };

        editorStore.setCinematicSweep({
          message: "Delegating to copilot for full scene rewrites...",
        });

        // Fire the text copilot request asynchronously — DO NOT block the
        // SSE event loop. When the response arrives, execute its
        // UPDATE_ALL_SCENES action through the existing handler.
        axios
          .post(`${API_BASE}/api/editor/copilot`, {
            message: synthesizedMessage,
            storySummary,
            fullStory: freshStory,
            currentSceneIndex: sceneIdx,
            chatHistory: [],
          })
          .then((res) => {
            if (!res.data.success || !res.data.actions?.length) {
              console.warn(
                "[VoiceEditor] Hybrid delegation: copilot returned no actions",
              );
              useEditorStore.getState().clearCinematicSweep();
              return;
            }

            // Add the copilot's response as an assistant message
            useEditorStore.getState().addCopilotMessage({
              role: "assistant",
              content: res.data.message,
              timestamp: Date.now(),
              isVoice: true,
              committed: true,
            });

            // Find and execute the UPDATE_ALL_SCENES action
            const batchAction = res.data.actions.find(
              (a) => a.type === "UPDATE_ALL_SCENES",
            );
            if (batchAction && batchAction.sceneUpdates?.length) {
              console.log(
                `[VoiceEditor] Hybrid delegation: executing UPDATE_ALL_SCENES with ${batchAction.sceneUpdates.length} scene updates`,
              );
              executeToolCall("update_all_scenes", {
                sceneUpdates: batchAction.sceneUpdates,
                voice: batchAction.voice,
              });
            } else {
              console.warn(
                "[VoiceEditor] Hybrid delegation: no UPDATE_ALL_SCENES found in copilot response",
                res.data.actions.map((a) => a.type),
              );
              // Still clear the sweep if no batch regen is coming
              setTimeout(() => {
                useEditorStore.getState().clearCinematicSweep();
              }, 2000);
            }
          })
          .catch((err) => {
            console.error(
              "[VoiceEditor] Hybrid delegation failed:",
              err.message,
            );
            useEditorStore.getState().addCopilotMessage({
              role: "assistant",
              content:
                "I updated the settings, but couldn't generate the full scene rewrites. You can try the same request via text chat.",
              timestamp: Date.now(),
              isVoice: true,
              committed: true,
            });
            setTimeout(() => {
              useEditorStore.getState().clearCinematicSweep();
            }, 2000);
          });
      } else {
        // No theme/language change — no batch regen needed, dismiss sweep
        setTimeout(() => {
          useEditorStore.getState().clearCinematicSweep();
        }, 1500);
      }
      break;
    }

    // ── navigate_scene ─────────────────────────────────────────────────
    case "navigate_scene": {
      const { sceneIndex } = payload;
      if (typeof sceneIndex === "number") {
        store.goToScene(sceneIndex);
      }
      break;
    }

    // ── add_scene ──────────────────────────────────────────────────────
    case "add_scene": {
      const {
        sceneType,
        techMode,
        headline,
        paragraph,
        afterIndex,
        voiceover_text,
      } = payload;
      if (!headline) break;

      const insertIdx =
        typeof afterIndex === "number" ? afterIndex : store.currentSceneIndex;

      const resolvedSceneType =
        sceneType === "tech_view" ? "tech_view" : "slide_view";
      const newScene =
        resolvedSceneType === "tech_view"
          ? buildVoiceTechScene({
              storyData: store.storyData,
              headline,
              paragraph,
              voiceoverText: voiceover_text,
              techMode,
            })
          : {
              scene_id: `scene_voice_${Date.now()}`,
              type: "slide_view",
              theme_tag: "CUSTOM",
              duration_seconds: 8,
              layout: {
                composition: "split-image-right",
                card_position: "left",
                content_alignment: "middle-left",
                motion: { image: "slow-zoom-in", content: "fade-up" },
              },
              slide_content: {
                headline: headline || "New Scene",
                paragraph: paragraph || "",
                alignment: "left",
                key_stats: [],
                badges: [],
              },
              voiceover_text: voiceover_text || "",
              audio_url: null,
              image_url: null,
              hotspots: [],
            };

      // Show ghost card
      const ghostIdx =
        insertIdx >= 0 ? insertIdx + 1 : store.scenes?.length || 0;
      editorStore.setGhostScene({
        index: ghostIdx,
        type: newScene.type,
      });

      store.addScene(newScene, insertIdx);
      editorStore.markDirty();

      setTimeout(() => {
        useEditorStore.getState().clearGhostScene();
      }, 600);

      // Fire voiceover regeneration in background
      if (voiceover_text && newScene.type !== "tech_view") {
        const lang = useStoryStore.getState().storyData?.language || "en";
        const voice = editorStore.selectedVoice || "en-US-Chirp-HD-D";
        withRetry(() =>
          axios.post(`${API_BASE}/api/editor/regenerate-voiceover`, {
            text: voiceover_text,
            voice,
            sceneId: newScene.scene_id,
            language: lang,
          }),
        )
          .then((res) => {
            if (res.data.success) {
              useStoryStore.getState().updateSceneAtIndex(ghostIdx, {
                audio_url: res.data.audio_url,
                subtitles: res.data.subtitles || [],
              });
            }
          })
          .catch((err) =>
            console.error(
              "[VoiceEditor] Add scene voiceover failed:",
              err.message,
            ),
          );
      }
      break;
    }

    // ── remove_scene ───────────────────────────────────────────────────
    case "remove_scene": {
      const { sceneIndex } = payload;
      if (typeof sceneIndex === "number") {
        store.removeScene(sceneIndex);
        editorStore.markDirty();
      }
      break;
    }

    // ── regenerate_scene ───────────────────────────────────────────────
    case "regenerate_scene": {
      const { sceneIndex, headline, paragraph, voiceover_text, imagePrompt } =
        payload;
      if (sceneIndex == null) break;

      // 1. Apply text updates immediately
      const textUpdates = {};
      const existingContent =
        store.storyData?.scenes?.[sceneIndex]?.slide_content || {};
      if (headline || paragraph) {
        textUpdates.slide_content = {
          ...existingContent,
          ...(headline ? { headline } : {}),
          ...(paragraph ? { paragraph } : {}),
        };
      }
      if (voiceover_text) {
        textUpdates.voiceover_text = voiceover_text;
        textUpdates.raw_voiceover = voiceover_text;
        textUpdates.slide_content = {
          ...(textUpdates.slide_content || existingContent),
          voiceover_text,
        };
      }
      if (Object.keys(textUpdates).length > 0) {
        store.updateSceneAtIndex(sceneIndex, textUpdates);
      }

      // 2. Mark scene as regenerating
      editorStore.addRegeneratingScene(sceneIndex);
      editorStore.markDirty();

      // 3. Fire background image + voiceover regeneration
      const currentStory = useStoryStore.getState().storyData;
      const car = currentStory?.car;
      const lang = currentStory?.language || "en";
      const voice = editorStore.selectedVoice || "en-US-Chirp-HD-D";
      const sceneId =
        currentStory?.scenes?.[sceneIndex]?.scene_id || `scene_${sceneIndex}`;
      const voText =
        voiceover_text ||
        currentStory?.scenes?.[sceneIndex]?.voiceover_text ||
        "";

      const promises = [];
      const sceneType = currentStory?.scenes?.[sceneIndex]?.type;

      // Image regeneration
      if (imagePrompt && sceneType !== "tech_view") {
        const baseImageUrl =
          currentStory?.scenes?.[sceneIndex]?.image_url || null;
        promises.push(
          withRetry(() =>
            axios.post(`${API_BASE}/api/editor/regenerate-image`, {
              prompt: imagePrompt,
              image_url: baseImageUrl,
              car,
              template: currentStory?.meta?.template || "cinematic",
            }),
          )
            .then((res) => {
              if (res.data.success && res.data.image_url) {
                useStoryStore.getState().updateSceneAtIndex(sceneIndex, {
                  image_url: res.data.image_url,
                  hotspots: [],
                });
              }
            })
            .catch((err) =>
              console.error("[VoiceEditor] Regen image failed:", err.message),
            ),
        );
      }

      // Voiceover regeneration
      if (voText) {
        promises.push(
          withRetry(() =>
            axios.post(`${API_BASE}/api/editor/regenerate-voiceover`, {
              text: voText,
              voice,
              sceneId,
              language: lang,
            }),
          )
            .then((res) => {
              if (res.data.success) {
                useStoryStore.getState().updateSceneAtIndex(sceneIndex, {
                  audio_url: res.data.audio_url,
                  subtitles: res.data.subtitles || [],
                });
              }
            })
            .catch((err) =>
              console.error(
                "[VoiceEditor] Regen voiceover failed:",
                err.message,
              ),
            ),
        );
      }

      Promise.all(promises).finally(() => {
        useEditorStore.getState().removeRegeneratingScene(sceneIndex);
      });
      break;
    }

    // ── update_all_scenes ───────────────────────────────────────────────
    case "update_all_scenes": {
      if (!payload?.sceneUpdates?.length) break;

      const sweepActive = !!editorStore.cinematicSweep;
      if (!sweepActive) {
        editorStore.setCinematicSweep({ message: "Rewriting scripts..." });
      }

      for (const su of payload.sceneUpdates) {
        if (su.sceneIndex == null || !su.updates) continue;

        const normalized = { ...su.updates };
        if (normalized.voiceover_text) {
          normalized.raw_voiceover = normalized.voiceover_text;
          normalized.slide_content = {
            ...(normalized.slide_content || {}),
            voiceover_text: normalized.voiceover_text,
          };
        }
        useStoryStore.getState().updateSceneAtIndex(su.sceneIndex, normalized);
      }
      editorStore.markDirty();

      const freshStory = useStoryStore.getState().storyData;
      const batchLang = freshStory?.language || "en";
      const batchVoice =
        payload.voice || editorStore.selectedVoice || "en-US-Chirp-HD-D";
      const batchCar = freshStory?.car;

      if (payload.voice) {
        editorStore.setSelectedVoice(payload.voice);
      }

      const voiceoverScenes = payload.sceneUpdates.filter((su) => {
        const scene = freshStory?.scenes?.[su.sceneIndex];
        return (
          scene &&
          (su.updates?.voiceover_text || scene.voiceover_text) &&
          (scene.type === "slide_view" || scene.type === "tech_view")
        );
      });

      const imageScenes = payload.sceneUpdates.filter((su) => {
        if (!su.imagePrompt) return false;
        const scene = freshStory?.scenes?.[su.sceneIndex];
        return scene && scene.type !== "tech_view";
      });

      const allAffectedIndices = new Set([
        ...voiceoverScenes.map((su) => su.sceneIndex),
        ...imageScenes.map((su) => su.sceneIndex),
      ]);
      for (const idx of allAffectedIndices) {
        editorStore.addBatchLoadingScene(idx);
      }

      let voiceDone = 0;
      let imageDone = 0;
      const totalVoice = voiceoverScenes.length;
      const totalImage = imageScenes.length;
      const updateSweepProgress = () => {
        if (voiceDone < totalVoice) {
          editorStore.setCinematicSweep({
            message: `Re-rendering voiceover models... ${voiceDone}/${totalVoice}`,
          });
        } else if (imageDone < totalImage) {
          editorStore.setCinematicSweep({
            message: `Generating scene imagery... ${imageDone}/${totalImage}`,
          });
        } else {
          editorStore.setCinematicSweep({
            message: "Finalizing experience...",
          });
        }
      };

      const voicePromises = voiceoverScenes.map((su) => {
        const scene = freshStory.scenes[su.sceneIndex];
        const text = su.updates?.voiceover_text || scene.voiceover_text;
        return withRetry(() =>
          axios.post(`${API_BASE}/api/editor/regenerate-voiceover`, {
            text,
            voice: batchVoice,
            sceneId: scene.scene_id || `scene_${su.sceneIndex}`,
            language: batchLang,
          }),
        )
          .then((res) => {
            if (res.data.success) {
              useStoryStore.getState().updateSceneAtIndex(su.sceneIndex, {
                audio_url: res.data.audio_url,
                subtitles: res.data.subtitles || [],
              });
            }
            voiceDone++;
            updateSweepProgress();
          })
          .catch((err) => {
            voiceDone++;
            updateSweepProgress();
            console.error(
              `[VoiceEditor] Batch voiceover regen failed for scene ${su.sceneIndex}:`,
              err.message,
            );
          });
      });

      const imagePromises = imageScenes.map((su) => {
        const scene = freshStory?.scenes?.[su.sceneIndex];
        const baseImageUrl = scene?.image_url || null;
        return withRetry(() =>
          axios.post(`${API_BASE}/api/editor/regenerate-image`, {
            prompt: su.imagePrompt,
            image_url: baseImageUrl,
            car: batchCar,
            template: freshStory?.meta?.template || "cinematic",
          }),
        )
          .then((res) => {
            if (res.data.success && res.data.image_url) {
              useStoryStore.getState().updateSceneAtIndex(su.sceneIndex, {
                image_url: res.data.image_url,
                hotspots: [],
              });
            }
            imageDone++;
            updateSweepProgress();
          })
          .catch((err) => {
            imageDone++;
            updateSweepProgress();
            console.error(
              `[VoiceEditor] Batch image regen failed for scene ${su.sceneIndex}:`,
              err.message,
            );
          });
      });

      Promise.all([...voicePromises, ...imagePromises]).then(() => {
        useEditorStore.getState().clearBatchLoadingScenes();
        setTimeout(() => {
          useEditorStore.getState().clearCinematicSweep();
        }, 600);
      });

      break;
    }

    default:
      console.warn("[VoiceEditor] Unknown tool:", toolName);
  }
}
