import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Textarea } from "@heroui/react";
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Mic,
  MicOff,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useStoryStore } from "../../../store/useStoryStore";
import { useEditorStore } from "../store/useEditorStore";
import { useVoiceEditor } from "../../../hooks/useVoiceEditor";
import { API_BASE } from "../../../config/api";
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

export const CopilotChat = () => {
  const {
    isCopilotOpen,
    closeCopilot,
    copilotMessages,
    addCopilotMessage,
    isCopilotLoading,
    setCopilotLoading,
  } = useEditorStore();

  const { storyData, updateStoryData, currentSceneIndex } = useStoryStore();

  // Voice mode — S2S editor copilot
  const carId = storyData?.car_id || storyData?.id || "";
  const {
    isVoiceActive,
    isConnecting: isVoiceConnecting,
    startVoice,
    stopVoice,
  } = useVoiceEditor(carId);

  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [copilotMessages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isCopilotOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isCopilotOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isCopilotLoading) return;

    const userMsg = { role: "user", content: text, timestamp: Date.now() };
    addCopilotMessage(userMsg);
    setInput("");
    setCopilotLoading(true);

    try {
      // Build a summary of the story for context (avoid sending huge payloads)
      const storySummary = {
        car: storyData?.car
          ? {
              year: storyData.car.year,
              make: storyData.car.make,
              model: storyData.car.model,
              body_type: storyData.car.body_type,
              color: storyData.car.color,
              trim: storyData.car.trim,
            }
          : null,
        title: storyData?.title,
        language: storyData?.language,
        totalScenes: storyData?.scenes?.length || 0,
        currentSceneIndex,
        scenes: (storyData?.scenes || []).map((s, i) => ({
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
        availableBadges: (storyData?.badges || []).map((b) => ({
          name: b.name,
          category: b.category,
        })),
      };

      // Capture history before the new user message re-renders the component
      const chatHistory = copilotMessages
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await axios.post(`${API_BASE}/api/editor/copilot`, {
        message: text,
        storySummary,
        fullStory: storyData,
        currentSceneIndex,
        chatHistory,
      });

      if (res.data.success) {
        const assistantMsg = {
          role: "assistant",
          content: res.data.message,
          timestamp: Date.now(),
          actions: res.data.actions || [],
        };
        addCopilotMessage(assistantMsg);

        // Apply actions if the copilot returned a modified story
        if (res.data.updatedStory) {
          updateStoryData(res.data.updatedStory);
        }

        // Apply individual actions
        if (res.data.actions?.length > 0) {
          applyActions(res.data.actions);
        }
      } else {
        addCopilotMessage({
          role: "assistant",
          content:
            res.data.message || "Something went wrong. Please try again.",
          timestamp: Date.now(),
          isError: true,
        });
      }
    } catch (err) {
      console.error("Copilot error:", err);
      addCopilotMessage({
        role: "assistant",
        content: "Failed to reach the copilot. Check your connection.",
        timestamp: Date.now(),
        isError: true,
      });
    } finally {
      setCopilotLoading(false);
    }
  };

  const applyActions = async (actions) => {
    const store = useStoryStore.getState();
    const editorStore = useEditorStore.getState();

    // Normalize voiceover text to everywhere ScriptDock reads from so the
    // textarea updates immediately without waiting for audio regeneration.
    const normalizeVoiceover = (updates) => {
      if (!updates?.voiceover_text) return updates;
      return {
        ...updates,
        raw_voiceover: updates.voiceover_text,
        slide_content: {
          ...(updates.slide_content || {}),
          voiceover_text: updates.voiceover_text,
        },
      };
    };

    // ── Build living status pills from the action set ──────────────────────
    const pills = [];
    for (const a of actions) {
      if (a.type === "ADD_SCENE")
        pills.push({
          id: `add-${a.afterIndex ?? "end"}`,
          label: `Building ${a.scene?.type === "tech_view" ? "3D Tech" : a.scene?.type === "intro_view" ? "Intro" : a.scene?.type === "outro_view" ? "Outro" : "Slide"} Scene`,
          status: "pending",
        });
      if (a.type === "REGENERATE_SCENE")
        pills.push({
          id: `regen-${a.sceneIndex}`,
          label: `Regenerating Scene ${(a.sceneIndex ?? 0) + 1}`,
          status: "pending",
        });
      if (a.type === "UPDATE_META" && a.updates?.template)
        pills.push({
          id: "theme",
          label: `Applying ${a.updates.template === "minimaltech" ? "Minimal Tech" : "Cinematic"} theme`,
          status: "pending",
        });
      if (a.type === "UPDATE_META" && a.updates?.language)
        pills.push({
          id: "language",
          label: `Switching to ${a.updates.language === "fr" ? "French" : "English"}`,
          status: "pending",
        });
      if (a.type === "UPDATE_ALL_SCENES")
        pills.push({
          id: "batch-regen",
          label: "Re-rendering all media",
          status: "pending",
        });
      if (a.type === "UPDATE_SCENE" && a.sceneIndex != null)
        pills.push({
          id: `update-${a.sceneIndex}`,
          label: `Updating Scene ${(a.sceneIndex ?? 0) + 1}`,
          status: "pending",
        });
      if (
        a.type === "ADD_SCENE" &&
        a.scene?.voiceover_text &&
        a.scene?.type !== "tech_view"
      )
        pills.push({
          id: `add-vo-${a.afterIndex ?? "end"}`,
          label: "Generating voiceover",
          status: "pending",
        });
      if (
        a.type === "ADD_SCENE" &&
        a.imagePrompt &&
        a.scene?.type !== "tech_view"
      )
        pills.push({
          id: `add-img-${a.afterIndex ?? "end"}`,
          label: "Generating scene image",
          status: "pending",
        });
    }
    if (pills.length > 0) editorStore.setPills(pills);

    // Helper: mark a pill done
    const donePill = (id) => useEditorStore.getState().updatePill(id, "done");

    for (const action of actions) {
      switch (action.type) {
        case "UPDATE_SCENE":
          if (action.sceneIndex != null && action.updates) {
            store.updateSceneAtIndex(action.sceneIndex, action.updates);
            donePill(`update-${action.sceneIndex}`);
          }
          break;

        case "ADD_SCENE": {
          if (!action.scene) break;
          const insertIdx = action.afterIndex ?? -1;
          const ghostIdx =
            insertIdx >= 0 ? insertIdx + 1 : store.scenes?.length || 0;

          // 1. Show ghost card in sidebar & skeleton in canvas
          useEditorStore.getState().setGhostScene({
            index: ghostIdx,
            type: action.scene.type || "slide_view",
          });
          store.goToScene(Math.min(ghostIdx, (store.scenes?.length || 1) - 1));

          // 2. Actually add the scene (store updates sidebar)
          store.addScene(action.scene, insertIdx);
          editorStore.markDirty();

          // 3. Clear ghost after a short reveal delay
          setTimeout(() => {
            useEditorStore.getState().clearGhostScene();
          }, 600);

          donePill(`add-${insertIdx ?? "end"}`);

          // 4. Fire image generation for the new scene (if the Copilot provided a prompt)
          if (action.imagePrompt && action.scene.type !== "tech_view") {
            const imgPillId = `add-img-${insertIdx ?? "end"}`;
            const addTemplate =
              useStoryStore.getState().storyData?.meta?.template || "cinematic";
            withRetry(() =>
              axios.post(`${API_BASE}/api/editor/regenerate-image`, {
                prompt: action.imagePrompt,
                car: useStoryStore.getState().storyData?.car,
                template: addTemplate,
              }),
            )
              .then((res) => {
                if (res.data.success && res.data.image_url) {
                  useStoryStore.getState().updateSceneAtIndex(ghostIdx, {
                    image_url: res.data.image_url,
                  });
                }
              })
              .catch((err) =>
                console.error("ADD_SCENE image regen failed:", err.message),
              )
              .finally(() => donePill(imgPillId));
          }

          // 5. Fire voiceover + subtitle regeneration for the new scene
          const addedVoText = action.scene.voiceover_text;
          if (addedVoText && action.scene.type !== "tech_view") {
            const voiceoverPillId = `add-vo-${insertIdx ?? "end"}`;
            const addLang =
              useStoryStore.getState().storyData?.language || "en";
            const addVoice = editorStore.selectedVoice || "en-US-Chirp-HD-D";
            const addSceneId = action.scene.scene_id || `scene_${ghostIdx}`;
            withRetry(() =>
              axios.post(`${API_BASE}/api/editor/regenerate-voiceover`, {
                text: addedVoText,
                voice: addVoice,
                sceneId: addSceneId,
                language: addLang,
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
                console.error("ADD_SCENE voiceover regen failed:", err.message),
              )
              .finally(() => donePill(voiceoverPillId));
          }
          break;
        }

        case "REMOVE_SCENE":
          if (action.sceneIndex != null) {
            store.removeScene(action.sceneIndex);
          }
          break;

        case "GO_TO_SCENE":
          if (action.sceneIndex != null) {
            store.goToScene(action.sceneIndex);
          }
          break;

        case "REGENERATE_SCENE": {
          const idx = action.sceneIndex;
          if (idx == null) break;
          const pillId = `regen-${idx}`;

          // 1. Apply text updates immediately
          if (action.updates) {
            store.updateSceneAtIndex(idx, normalizeVoiceover(action.updates));
          }
          // 2. Mark scene as regenerating (frosted morph overlay)
          editorStore.addRegeneratingScene(idx);
          editorStore.markDirty();

          // 3. Fire background image + voiceover regeneration
          const currentStory = useStoryStore.getState().storyData;
          const car = currentStory?.car;
          const lang = currentStory?.language || "en";
          const voice = editorStore.selectedVoice || "en-US-Chirp-HD-D";
          const sceneId =
            currentStory?.scenes?.[idx]?.scene_id || `scene_${idx}`;
          const voText =
            action.updates?.voiceover_text ||
            currentStory?.scenes?.[idx]?.voiceover_text ||
            "";
          const promises = [];
          const sceneType = currentStory?.scenes?.[idx]?.type;

          // Image regeneration — tech_view uses a live 3D WebGL model, never regen images for it
          if (action.imagePrompt && sceneType !== "tech_view") {
            const baseImageUrl = currentStory?.scenes?.[idx]?.image_url || null;
            promises.push(
              withRetry(() =>
                axios.post(`${API_BASE}/api/editor/regenerate-image`, {
                  prompt: action.imagePrompt,
                  image_url: baseImageUrl,
                  car,
                  template: currentStory?.meta?.template || "cinematic",
                }),
              )
                .then((res) => {
                  if (res.data.success && res.data.image_url) {
                    useStoryStore.getState().updateSceneAtIndex(idx, {
                      image_url: res.data.image_url,
                      hotspots: [],
                    });
                  }
                })
                .catch((err) =>
                  console.error("Copilot image regen failed:", err.message),
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
                    useStoryStore.getState().updateSceneAtIndex(idx, {
                      audio_url: res.data.audio_url,
                      subtitles: res.data.subtitles || [],
                    });
                  }
                })
                .catch((err) =>
                  console.error("Copilot voiceover regen failed:", err.message),
                ),
            );
          }

          // When all done, remove the frosted morph and mark pill done
          Promise.all(promises).finally(() => {
            useEditorStore.getState().removeRegeneratingScene(idx);
            donePill(pillId);
          });
          break;
        }

        case "UPDATE_META": {
          if (!action.updates) break;

          // Show cinematic sweep curtain for theme or language changes
          const isThemeChange = !!action.updates.template;
          const isLangChange = !!action.updates.language;
          if (isThemeChange || isLangChange) {
            const msg = isThemeChange
              ? `Applying ${action.updates.template === "minimaltech" ? "Minimal Tech" : "Cinematic"} aesthetics…`
              : `Switching narrative to ${action.updates.language === "fr" ? "French" : "English"}…`;
            useEditorStore.getState().setCinematicSweep({ message: msg });
          }

          store.updateMeta(action.updates);
          if (action.updates.template) {
            const themeVal =
              action.updates.template === "minimaltech"
                ? "minimal_tech"
                : "cinematic";
            store.updateAllScenesTheme(themeVal);
            donePill("theme");
          }
          if (isLangChange) donePill("language");
          editorStore.markDirty();
          // If no batch regen follows, auto-dismiss the progress card after a short beat
          const hasBatchRegen = actions.some(
            (a) => a.type === "UPDATE_ALL_SCENES",
          );
          if (!hasBatchRegen && (isThemeChange || isLangChange)) {
            setTimeout(() => {
              useEditorStore.getState().clearCinematicSweep();
            }, 2000);
          }
          break;
        }

        case "UPDATE_ALL_SCENES": {
          if (!action.sceneUpdates?.length) break;

          // Show cinematic sweep if not already shown (e.g. standalone batch regen)
          const sweepActive = !!useEditorStore.getState().cinematicSweep;
          if (!sweepActive) {
            useEditorStore
              .getState()
              .setCinematicSweep({ message: "Translating narrative…" });
          } else {
            useEditorStore
              .getState()
              .setCinematicSweep({ message: "Rewriting scripts…" });
          }

          // Apply all text updates
          for (const su of action.sceneUpdates) {
            if (su.sceneIndex != null && su.updates) {
              useStoryStore
                .getState()
                .updateSceneAtIndex(
                  su.sceneIndex,
                  normalizeVoiceover(su.updates),
                );
            }
          }
          editorStore.markDirty();

          const freshStory = useStoryStore.getState().storyData;
          const batchLang = freshStory?.language || "en";
          const batchVoice =
            action.voice || editorStore.selectedVoice || "en-US-Chirp-HD-D";
          const batchCar = freshStory?.car;

          if (action.voice) {
            useEditorStore.getState().setSelectedVoice(action.voice);
          }

          // Determine which scenes need voiceover regeneration
          const voiceoverScenes = action.sceneUpdates.filter((su) => {
            const scene = freshStory?.scenes?.[su.sceneIndex];
            return (
              scene &&
              (su.updates?.voiceover_text || scene.voiceover_text) &&
              (scene.type === "slide_view" || scene.type === "tech_view")
            );
          });

          // Determine which scenes need image regeneration
          const imageScenes = action.sceneUpdates.filter((su) => {
            if (!su.imagePrompt) return false;
            const scene = freshStory?.scenes?.[su.sceneIndex];
            return scene && scene.type !== "tech_view";
          });

          // Mark all affected scenes as batch-loading (sidebar skeleton)
          const allAffectedIndices = new Set([
            ...voiceoverScenes.map((su) => su.sceneIndex),
            ...imageScenes.map((su) => su.sceneIndex),
          ]);
          for (const idx of allAffectedIndices) {
            useEditorStore.getState().addBatchLoadingScene(idx);
          }

          // Step through microcopy as tasks progress
          let voiceDone = 0;
          let imageDone = 0;
          const totalVoice = voiceoverScenes.length;
          const totalImage = imageScenes.length;
          const updateSweepProgress = () => {
            if (voiceDone < totalVoice) {
              useEditorStore.getState().setCinematicSweep({
                message: `Re-rendering voiceover models… ${voiceDone}/${totalVoice}`,
              });
            } else if (imageDone < totalImage) {
              useEditorStore.getState().setCinematicSweep({
                message: `Generating scene imagery… ${imageDone}/${totalImage}`,
              });
            } else {
              useEditorStore.getState().setCinematicSweep({
                message: "Finalizing experience…",
              });
            }
          };

          // Fire all voiceover regen calls in parallel
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
                  `Batch voiceover regen failed for scene ${su.sceneIndex}:`,
                  err.message,
                );
              });
          });

          // Fire all image regen calls in parallel
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
                  `Batch image regen failed for scene ${su.sceneIndex}:`,
                  err.message,
                );
              });
          });

          // When all done, clear sidebar skeletons and dismiss progress card
          const allPromises = [...voicePromises, ...imagePromises];
          Promise.all(allPromises).then(() => {
            useEditorStore.getState().clearBatchLoadingScenes();
            donePill("batch-regen");
            // Dismiss cinematic sweep curtain after a brief beat
            setTimeout(() => {
              useEditorStore.getState().clearCinematicSweep();
            }, 600);
            console.log(
              `✅ Batch regen complete (${voiceoverScenes.length} voiceovers, ${imageScenes.length} images)`,
            );
          });
          break;
        }

        default:
          break;
      }
    }

    // Clear pills after all are done (with a delay so user sees checkmarks)
    if (pills.length > 0) {
      setTimeout(() => {
        useEditorStore.getState().clearPills();
      }, 4000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const SUGGESTIONS = [
    "Add a tech view showing the exact trunk capacity",
    "Make scene 2 focus on safety instead",
    "Switch the theme to minimal tech and translate everything to French",
    "Rewrite all voiceover scripts in a sportier tone",
  ];

  return (
    <AnimatePresence>
      {isCopilotOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 z-40"
            onClick={closeCopilot}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute top-0 right-0 bottom-0 w-[420px] bg-zinc-900/95 backdrop-blur-2xl border-l border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Sparkles size={16} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    AutoSight Copilot
                  </h3>
                  <p className="text-[10px] text-zinc-500">
                    {isVoiceActive
                      ? "Voice mode active"
                      : isVoiceConnecting
                        ? "Connecting voice..."
                        : "Full control over your story"}
                  </p>
                </div>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="full"
                onPress={closeCopilot}
                className="text-zinc-500 hover:text-white"
              >
                <X size={16} />
              </Button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {copilotMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Bot size={28} className="text-primary" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">
                    Hey! I&apos;m your Copilot
                  </h4>
                  <p className="text-xs text-zinc-500 mb-6 max-w-[280px]">
                    I can edit any part of your story — headlines, layouts,
                    voiceovers, scenes, badges, and more. Just tell me what you
                    need.
                  </p>

                  <div className="space-y-2 w-full">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
                      Try saying
                    </p>
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setInput(s);
                          inputRef.current?.focus();
                        }}
                        className="w-full text-left p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs text-zinc-300 transition-all"
                      >
                        &ldquo;{s}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {copilotMessages.map((msg, i) => {
                // Find index of last assistant message in the array
                const lastAssistantIdx = copilotMessages.reduce(
                  (acc, m, j) => (m.role === "assistant" ? j : acc),
                  -1,
                );
                return (
                  <MessageBubble
                    key={i}
                    message={msg}
                    isLatestAssistant={
                      msg.role === "assistant" && i === lastAssistantIdx
                    }
                  />
                );
              })}

              {isCopilotLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Bot size={14} className="text-primary" />
                  </div>
                  <div className="bg-white/5 rounded-xl rounded-tl-sm px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-violet-400 dot-breathe-1" />
                      <div className="w-2 h-2 rounded-full bg-fuchsia-400 dot-breathe-2" />
                      <div className="w-2 h-2 rounded-full bg-sky-400 dot-breathe-3" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/5">
              {/* Voice active banner */}
              {isVoiceActive && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="relative flex items-center justify-center w-5 h-5">
                    <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                    <Mic size={14} className="text-primary relative z-10" />
                  </div>
                  <span className="text-xs text-primary font-medium flex-1">
                    Voice mode active — I&apos;m listening
                  </span>
                  <button
                    onClick={stopVoice}
                    className="text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Stop
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  variant="bordered"
                  radius="xl"
                  minRows={1}
                  maxRows={4}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isVoiceActive
                      ? "Voice mode active — speak or type..."
                      : "Tell me what to change..."
                  }
                  isDisabled={isVoiceConnecting}
                  classNames={{
                    inputWrapper:
                      "bg-white/5 border-white/10 group-data-[focus=true]:border-primary",
                    input: "text-sm text-white placeholder:text-zinc-600",
                  }}
                />
                {/* Mic button */}
                <Button
                  isIconOnly
                  radius="full"
                  size="md"
                  isDisabled={isCopilotLoading}
                  onPress={isVoiceActive ? stopVoice : startVoice}
                  className={cn(
                    "shrink-0 w-10 h-10 transition-all",
                    isVoiceActive
                      ? "bg-rose-500 text-white"
                      : isVoiceConnecting
                        ? "bg-white/10 text-zinc-400"
                        : "bg-white/10 text-zinc-300 hover:bg-primary/20 hover:text-primary",
                  )}
                >
                  {isVoiceConnecting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isVoiceActive ? (
                    <MicOff size={16} />
                  ) : (
                    <Mic size={16} />
                  )}
                </Button>
                {/* Send button */}
                <Button
                  isIconOnly
                  radius="full"
                  size="md"
                  isDisabled={!input.trim() || isCopilotLoading}
                  onPress={handleSend}
                  className="bg-primary text-white shrink-0 w-10 h-10"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const MessageBubble = ({ message, isLatestAssistant }) => {
  const isUser = message.role === "user";
  const activePills = useEditorStore((s) => s.activePills);

  // Only show living pills on the most recent assistant message
  const showPills = !isUser && isLatestAssistant && activePills.length > 0;

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
          isUser ? "bg-white/10" : "bg-primary/20",
        )}
      >
        {isUser ? (
          <User size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-primary" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-3",
          isUser
            ? "bg-primary/15 text-white rounded-tr-sm"
            : message.isError
              ? "bg-rose-500/10 border border-rose-500/20 rounded-tl-sm"
              : "bg-white/5 rounded-tl-sm",
        )}
      >
        {message.isError && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle size={12} className="text-rose-400" />
            <span className="text-[10px] text-rose-400 font-medium">Error</span>
          </div>
        )}
        <p
          className={cn(
            "text-sm whitespace-pre-wrap leading-relaxed",
            isUser ? "text-white" : "text-zinc-200",
          )}
        >
          {message.content}
        </p>

        {/* ── Living Status Pills — iridescent task trackers ─────── */}
        {showPills && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-2">
            {activePills.map((pill, i) => {
              const isDone = pill.status === "done";
              const doneLabel = pill.label.replace(
                /^(Building|Regenerating|Applying|Switching|Re-rendering)/,
                (m) =>
                  ({
                    Building: "Built",
                    Regenerating: "Regenerated",
                    Applying: "Applied",
                    Switching: "Switched",
                    "Re-rendering": "Re-rendered",
                  })[m] || m,
              );

              return (
                <motion.div
                  key={pill.id}
                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    delay: i * 0.08,
                    type: "spring",
                    damping: 20,
                    stiffness: 300,
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-700",
                    isDone
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/15"
                      : "text-white/50 border border-white/[0.06] relative overflow-hidden",
                  )}
                  style={
                    !isDone
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(217,70,239,0.06), rgba(56,189,248,0.08))",
                        }
                      : undefined
                  }
                >
                  {/* Pending shimmer */}
                  {!isDone && (
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                  )}

                  {isDone ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        damping: 12,
                        stiffness: 400,
                      }}
                    >
                      <CheckCircle2 size={12} className="text-emerald-400" />
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-0.5 relative z-10">
                      <div className="w-1 h-1 rounded-full bg-violet-400 dot-breathe-1" />
                      <div className="w-1 h-1 rounded-full bg-fuchsia-400 dot-breathe-2" />
                      <div className="w-1 h-1 rounded-full bg-sky-400 dot-breathe-3" />
                    </div>
                  )}
                  <span className="relative z-10">
                    {isDone ? doneLabel : pill.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Static action summary (shown after pills clear) */}
        {!showPills && message.actions?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/5">
            <p className="text-[10px] text-zinc-500 font-medium">
              Applied {message.actions.length} change
              {message.actions.length > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
