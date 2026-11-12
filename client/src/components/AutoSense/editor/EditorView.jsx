import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useStoryStore } from "../../../store/useStoryStore";
import { useEditorStore } from "../store/useEditorStore";
import { supabase } from "../../../config/supabaseClient";
import { StoryContainer } from "../layers/StoryContainer";
import { AddSceneModal } from "./AddSceneModal";
import { CopilotChat } from "./CopilotChat";
import { InlineEditOverlay } from "./InlineEditOverlay";
import { HotspotDragBar } from "./EditorHotspotLayer";
import { FloatingToolbar } from "./FloatingToolbar";
import { ScriptDock } from "./ScriptDock";

import { Button, Tooltip } from "@heroui/react";
import {
  ArrowLeft,
  Save,
  Play,
  Undo2,
  Redo2,
  Plus,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Flag,
  Monitor,
  Film,
  GripVertical,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useParams } from "react-router-dom";

// ─── Icon map for scene types ─────────────────────────────────────────────────
const typeConfig = {
  intro_view: {
    icon: Clapperboard,
    label: "Intro",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
  },
  slide_view: {
    icon: Film,
    label: "Slide",
    color: "text-primary",
    bg: "bg-primary/15",
    border: "border-primary/30",
  },
  tech_view: {
    icon: Monitor,
    label: "3D Tech",
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
  },
  outro_view: {
    icon: Flag,
    label: "Outro",
    color: "text-rose-400",
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR VIEW — inline editing + floating toolbar + bottom script dock
// ═══════════════════════════════════════════════════════════════════════════════
export const EditorView = ({ onExit }) => {
  const { storyId } = useParams();
  const {
    storyData,
    scenes,
    currentSceneIndex,
    goToScene,
    getCurrentScene,
    updateStoryData,
    removeScene,
    undo,
    redo,
    history,
  } = useStoryStore();

  const {
    getAvailablePanels,
    isDirty,
    markClean,
    isSaving,
    setIsSaving,
    openAddScene,
    openCopilot,
    markDirty,
    draggingHotspotId,
    regeneratingScenes,
    ghostScene,
    revealedFields,
    cinematicSweep,
    batchLoadingScenes,
  } = useEditorStore();

  const currentScene = getCurrentScene();
  const sceneType = currentScene?.type || "slide_view";
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const availablePanels = useMemo(
    () => getAvailablePanels(sceneType),
    [sceneType, getAvailablePanels],
  );

  // ── Reorder state ───────────────────────────────────────────────────────────
  const [sceneOrder, setSceneOrder] = useState([]);
  const isReorderingRef = useRef(false);

  useEffect(() => {
    if (isReorderingRef.current) {
      isReorderingRef.current = false;
      return;
    }
    if (scenes?.length) {
      setSceneOrder(scenes.map((_, i) => i));
    }
  }, [scenes]);

  const handleReorder = (newOrder) => {
    setSceneOrder(newOrder);
    const reordered = newOrder.map((i) => scenes[i]);
    const reindexed = reordered.map((s, i) => ({ ...s, order: i + 1 }));
    isReorderingRef.current = true;
    updateStoryData({ ...storyData, scenes: reindexed });
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const latest = useStoryStore.getState().storyData;
      const { error } = await supabase
        .from("stories")
        .update({ content: latest })
        .eq("id", storyId);
      if (error) throw error;
      markClean();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = () => {
    window.open(`/experience/${storyId}`, "_blank");
  };

  if (!storyData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-400">
          <Loader2 size={14} className="animate-spin text-zinc-500" />
          Loading editor workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden relative">
      {/* ═══════════ TOP BAR ═══════════ */}
      <header className="border-b border-white/5 bg-gradient-to-b from-zinc-900/95 to-zinc-900/80 backdrop-blur-2xl h-[60px] flex items-center px-5 justify-between shrink-0 z-30">
        {/* Left */}
        <div className="flex items-center gap-4">
          <Button
            isIconOnly
            variant="light"
            radius="full"
            size="sm"
            onPress={onExit}
            className="text-zinc-500 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="h-6 w-px bg-white/10" />
          <div>
            <h1 className="text-sm font-semibold text-white flex items-center gap-2">
              {storyData.car?.year} {storyData.car?.make}{" "}
              {storyData.car?.model || storyData.title || "Untitled"}
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </h1>
            <p className="text-[10px] text-zinc-600 font-medium">
              {scenes.length} scenes &middot; AutoSight Studio
            </p>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Tooltip content="Undo" placement="bottom">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="full"
              isDisabled={!canUndo}
              onPress={() => {
                undo();
                markDirty();
              }}
              className="text-zinc-500 hover:text-white hover:bg-white/10"
            >
              <Undo2 size={16} />
            </Button>
          </Tooltip>

          <Tooltip content="Redo" placement="bottom">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="full"
              isDisabled={!canRedo}
              onPress={() => {
                redo();
                markDirty();
              }}
              className="text-zinc-500 hover:text-white hover:bg-white/10"
            >
              <Redo2 size={16} />
            </Button>
          </Tooltip>

          <Button
            size="sm"
            variant="flat"
            radius="full"
            isLoading={isSaving}
            onPress={handleSave}
            className={cn(
              "font-semibold text-xs px-5",
              isDirty
                ? "bg-white text-black hover:bg-zinc-200"
                : "bg-white/10 text-zinc-400",
            )}
            startContent={!isSaving && <Save size={13} />}
          >
            Save
          </Button>

          <Button
            size="sm"
            variant="flat"
            radius="full"
            startContent={<Play size={13} />}
            onPress={handlePreview}
            className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 font-medium text-xs px-4"
          >
            Preview
          </Button>
          <div className="h-5 w-px bg-white/10 mx-1" />

          <Tooltip content="AutoSight Copilot" placement="bottom">
            <Button
              isIconOnly
              size="sm"
              radius="full"
              onPress={openCopilot}
              className="bg-primary/15 text-primary hover:bg-primary/25"
            >
              <Sparkles size={16} />
            </Button>
          </Tooltip>
        </div>
      </header>

      {/* ═══════════ MAIN 3-COLUMN LAYOUT ═══════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT: Scene List ──────────────────────────────────────────── */}
        <aside className="w-[220px] border-r border-white/5 bg-zinc-950/60 flex flex-col shrink-0">
          <div className="p-3 border-b border-white/5 flex items-center justify-between">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
              Scenes
            </p>
            <Tooltip content="Add Scene" placement="right">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="full"
                onPress={openAddScene}
                className="text-zinc-500 hover:text-primary hover:bg-primary/10 w-7 h-7 min-w-0"
              >
                <Plus size={14} />
              </Button>
            </Tooltip>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <Reorder.Group
              axis="y"
              values={sceneOrder}
              onReorder={handleReorder}
              className="space-y-1"
            >
              {sceneOrder.map((idx) => {
                const scene = scenes[idx];
                if (!scene) return null;
                const cfg = typeConfig[scene.type] || typeConfig.slide_view;
                const Icon = cfg.icon;
                const title =
                  scene.slide_content?.headline ||
                  scene.intro_content?.title ||
                  scene.outro_content?.headline ||
                  `Scene ${idx + 1}`;
                const isSelected = idx === currentSceneIndex;
                const isLoading = batchLoadingScenes.has(idx);

                return (
                  <Reorder.Item key={idx} value={idx}>
                    <button
                      onClick={() => goToScene(idx)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all group",
                        isSelected
                          ? "bg-white/10 border border-white/15"
                          : "hover:bg-white/5 border border-transparent",
                      )}
                    >
                      <GripVertical
                        size={12}
                        className="text-zinc-700 group-hover:text-zinc-500 cursor-grab shrink-0"
                      />

                      {/* Thumbnail */}
                      <div
                        className={cn(
                          "w-12 h-8 rounded-md border flex items-center justify-center shrink-0 overflow-hidden relative",
                          isSelected ? cfg.border : "border-white/10",
                        )}
                      >
                        {scene.image_url ||
                        scene.intro_content?.background_image ? (
                          <img
                            src={
                              scene.image_url ||
                              scene.intro_content?.background_image
                            }
                            alt=""
                            className={cn(
                              "w-full h-full object-cover transition-all duration-500",
                              isLoading && "blur-sm scale-110",
                            )}
                          />
                        ) : (
                          <Icon
                            size={14}
                            className={isSelected ? cfg.color : "text-zinc-600"}
                          />
                        )}
                        {isLoading && (
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {isLoading ? (
                          <div className="space-y-1.5">
                            <div className="h-2 w-14 rounded-full bg-white/10 relative overflow-hidden">
                              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                            </div>
                            <div className="h-1.5 w-8 rounded-full bg-white/5" />
                          </div>
                        ) : (
                          <>
                            <p
                              className={cn(
                                "text-[11px] font-medium truncate",
                                isSelected ? "text-white" : "text-zinc-400",
                              )}
                            >
                              {title}
                            </p>
                            <p className="text-[9px] text-zinc-600 font-medium">
                              {cfg.label}
                            </p>
                          </>
                        )}
                      </div>

                      <span
                        className={cn(
                          "text-[9px] font-bold tabular-nums shrink-0",
                          isSelected ? cfg.color : "text-zinc-700",
                        )}
                      >
                        {idx + 1}
                      </span>
                    </button>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>

            {/* ── Ghost Card (ADD_SCENE — aurora sidebar card) ─────── */}
            <AnimatePresence>
              {ghostScene && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: "auto", scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="overflow-hidden"
                >
                  <div className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-xl border border-white/10 ghost-aurora-bg relative overflow-hidden">
                    <div className="w-3 shrink-0" />
                    {/* Iridescent thumbnail placeholder */}
                    <div className="w-12 h-8 rounded-lg overflow-hidden shrink-0 relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/15 to-sky-500/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                          <Sparkles size={8} className="text-white/40" />
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-2 w-16 rounded-full bg-white/10 relative overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      </div>
                      <div className="h-1.5 w-10 rounded-full bg-white/5" />
                    </div>
                    {/* Breathing dot */}
                    <div className="w-2 h-2 rounded-full bg-violet-400/60 dot-breathe-1 shrink-0" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add Scene Button */}
            <button
              onClick={openAddScene}
              className="w-full mt-2 p-2.5 border border-dashed border-white/10 rounded-xl text-zinc-600 text-[11px] flex items-center justify-center gap-1.5 hover:border-primary/30 hover:text-primary transition-all"
            >
              <Plus size={12} /> Add Scene
            </button>
          </div>

          {/* Bottom controls */}
          <div className="p-2 border-t border-white/5 flex items-center justify-between">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="full"
              isDisabled={currentSceneIndex === 0}
              onPress={() => goToScene(currentSceneIndex - 1)}
              className="text-zinc-600 hover:text-white w-7 h-7 min-w-0"
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-[10px] text-zinc-600 font-medium tabular-nums">
              {currentSceneIndex + 1} / {scenes.length}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="full"
                isDisabled={currentSceneIndex >= scenes.length - 1}
                onPress={() => goToScene(currentSceneIndex + 1)}
                className="text-zinc-600 hover:text-white w-7 h-7 min-w-0"
              >
                <ChevronRight size={14} />
              </Button>
              <Tooltip content="Delete Scene" placement="top">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  isDisabled={scenes.length <= 1}
                  onPress={() => removeScene(currentSceneIndex)}
                  className="text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 w-7 h-7 min-w-0"
                >
                  <Trash2 size={12} />
                </Button>
              </Tooltip>
            </div>
          </div>
        </aside>

        {/* ─── MAIN: Full Preview with Floating UI ──────────────────────── */}
        <main className="flex-1 bg-black relative overflow-hidden">
          {/* BG grid */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#666 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Live preview — fills the entire area */}
          <div className="absolute inset-0">
            <StoryContainer
              enableAudio={false}
              hideContent
              editorMode
              freezeAnimation={!!draggingHotspotId}
            />
          </div>

          {/* Inline edit overlay — click-to-edit text on top of preview */}
          <InlineEditOverlay />

          {/* Drag instruction bar — stays fixed (not inside Ken Burns) */}
          <HotspotDragBar />

          {/* Scene type badge — top left */}
          {currentScene && (
            <div className="absolute top-3 left-3 z-50 flex items-center gap-2">
              <span
                className={cn(
                  "text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border",
                  typeConfig[sceneType]?.bg,
                  typeConfig[sceneType]?.color,
                  typeConfig[sceneType]?.border,
                )}
              >
                {typeConfig[sceneType]?.label}
              </span>
            </div>
          )}

          {/* Floating toolbar — right edge */}
          <FloatingToolbar availablePanels={availablePanels} />

          {/* Script dock — bottom center */}
          <ScriptDock />

          {/* ═══ BATCH CANVAS OVERLAY — blur image + minimal-tech skeleton card ═══ */}
          <AnimatePresence>
            {batchLoadingScenes.has(currentSceneIndex) && (
              <motion.div
                initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                animate={{ opacity: 1, backdropFilter: "blur(14px)" }}
                exit={{
                  opacity: 0,
                  backdropFilter: "blur(0px)",
                  transition: { duration: 0.6 },
                }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="absolute inset-0 z-[43] pointer-events-none"
              >
                {/* Skeleton info card — positioned to match minimal tech layout */}
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col justify-center p-6 md:p-20",
                    sceneType === "tech_view" ? "items-end" : "items-start",
                  )}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.4, ease: "easeOut" }}
                    className="max-w-xl w-full p-8 rounded-sm bg-white/96 border border-zinc-200 shadow-lg"
                  >
                    {sceneType === "intro_view" ||
                    sceneType === "outro_view" ? (
                      /* ── Intro / Outro skeleton ── */
                      <div className="space-y-6">
                        {/* Subtitle line */}
                        <div className="h-3 w-28 rounded bg-zinc-100 relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                        </div>
                        {/* Title */}
                        <div className="space-y-3">
                          <div className="h-14 w-4/5 rounded-sm bg-zinc-100 relative overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite_0.1s] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                          </div>
                          <div className="h-14 w-3/5 rounded-sm bg-zinc-100 relative overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite_0.2s] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                          </div>
                        </div>
                        {/* Button skeleton */}
                        <div className="h-11 w-36 rounded-sm bg-zinc-200/70 relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite_0.3s] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                        </div>
                      </div>
                    ) : (
                      /* ── Slide / Tech view skeleton ── */
                      <div className="space-y-5">
                        {/* Badge pill skeletons */}
                        <div className="flex gap-2.5">
                          <div className="h-6 w-16 rounded-sm bg-zinc-100 relative overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                          </div>
                          <div className="h-6 w-20 rounded-sm bg-zinc-100 relative overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite_0.15s] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                          </div>
                        </div>

                        {/* Headline — tall monospace-style blocks */}
                        <div className="space-y-2.5">
                          <div className="h-8 w-4/5 rounded-sm bg-zinc-100 relative overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite_0.05s] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                          </div>
                          <div className="h-8 w-3/5 rounded-sm bg-zinc-100 relative overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite_0.2s] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                          </div>
                        </div>

                        {/* Paragraph lines */}
                        <div className="space-y-2">
                          <div className="h-3.5 w-full rounded bg-zinc-100 relative overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite_0.1s] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                          </div>
                          <div className="h-3.5 w-11/12 rounded bg-zinc-100 relative overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite_0.25s] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                          </div>
                          <div className="h-3.5 w-4/5 rounded bg-zinc-100 relative overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite_0.35s] bg-linear-to-r from-transparent via-zinc-300/60 to-transparent" />
                          </div>
                        </div>

                        {/* Stats row — mirrors border-t border-zinc-200 */}
                        <div className="flex gap-8 pt-5 border-t border-zinc-200">
                          {[
                            { vw: "w-10", lw: "w-12", d: 0 },
                            { vw: "w-8", lw: "w-16", d: 0.1 },
                            { vw: "w-12", lw: "w-10", d: 0.2 },
                          ].map((dims, i) => (
                            <div key={i} className="flex flex-col gap-1.5">
                              <div
                                className={cn(
                                  "h-9 rounded-sm bg-zinc-100 relative overflow-hidden",
                                  dims.vw,
                                )}
                              >
                                <div
                                  className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-zinc-300/60 to-transparent"
                                  style={{
                                    animation: `shimmer 2s ease-in-out infinite ${dims.d}s`,
                                  }}
                                />
                              </div>
                              <div
                                className={cn(
                                  "h-2.5 rounded bg-zinc-50 relative overflow-hidden",
                                  dims.lw,
                                )}
                              >
                                <div
                                  className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-zinc-300/60 to-transparent"
                                  style={{
                                    animation: `shimmer 2s ease-in-out infinite ${dims.d + 0.15}s`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ FROSTED MORPH — Organic blob + iridescent ring regen ═══ */}
          <AnimatePresence>
            {regeneratingScenes.has(currentSceneIndex) && !ghostScene && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.8, ease: "easeInOut" },
                }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 z-[45] pointer-events-none"
              >
                {/* Layered frosted glass — grayscale + blur + dark tint */}
                <motion.div
                  initial={{ backdropFilter: "blur(0px) grayscale(0)" }}
                  animate={{ backdropFilter: "blur(20px) grayscale(0.6)" }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="absolute inset-0 bg-black/20"
                />

                {/* Center composition */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Morphing blob background */}
                  <div
                    className="absolute w-40 h-40 opacity-30"
                    style={{
                      background:
                        "linear-gradient(135deg, #6366f1, #d946ef, #38bdf8)",
                      animation: "morph-blob 8s ease-in-out infinite",
                      filter: "blur(40px)",
                    }}
                  />

                  {/* Iridescent ring */}
                  <div className="ai-ring relative z-10" />
                  <div
                    className="ai-ring-glow absolute z-0"
                    style={{ "--size": "120px" }}
                  />

                  {/* Center icon */}
                  <div className="absolute z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl flex items-center justify-center border border-white/10">
                    <Sparkles size={18} className="text-white/80" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ GHOST SKELETON — Holographic blueprint while ADD_SCENE builds ═══ */}
          <AnimatePresence>
            {ghostScene && currentSceneIndex === ghostScene.index && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  scale: 0.98,
                  transition: { duration: 0.5 },
                }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 z-[44] pointer-events-none"
              >
                {/* Dark glass base */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

                {/* Skeleton layout */}
                <div className="absolute inset-0 flex items-center justify-center p-16">
                  <div className="w-full max-w-4xl flex gap-10 items-center">
                    {/* Image placeholder — holographic border */}
                    <div className="flex-1 aspect-video rounded-2xl relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/[0.03] border border-white/[0.06] rounded-2xl" />
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                      {/* Floating particles */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-2 h-2 rounded-full bg-violet-400/40"
                            style={{
                              animation:
                                "float-particle 3s ease-in-out infinite",
                            }}
                          />
                          <div
                            className="w-1.5 h-1.5 rounded-full bg-fuchsia-400/30"
                            style={{
                              animation:
                                "float-particle 3s ease-in-out infinite 0.5s",
                            }}
                          />
                          <div
                            className="w-2.5 h-2.5 rounded-full bg-sky-400/35"
                            style={{
                              animation:
                                "float-particle 3s ease-in-out infinite 1s",
                            }}
                          />
                        </div>
                      </div>
                      <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                        <ImageIcon size={10} className="text-white/15" />
                        <span className="text-[9px] text-white/15 font-medium tracking-wider uppercase">
                          Generating
                        </span>
                      </div>
                    </div>

                    {/* Text skeleton blocks */}
                    <div className="flex-1 space-y-8">
                      {/* Headline skeleton */}
                      <div className="space-y-3">
                        <div className="h-5 w-4/5 rounded-lg bg-white/[0.05] relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_ease-in-out_infinite_0.2s] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                        </div>
                        <div className="h-5 w-3/5 rounded-lg bg-white/[0.04] relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_ease-in-out_infinite_0.4s] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                        </div>
                      </div>
                      {/* Paragraph lines */}
                      <div className="space-y-2.5">
                        <div className="h-2.5 w-full rounded bg-white/[0.03] relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_ease-in-out_infinite_0.6s] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                        </div>
                        <div className="h-2.5 w-11/12 rounded bg-white/[0.025]" />
                        <div className="h-2.5 w-4/5 rounded bg-white/[0.02]" />
                      </div>
                      {/* Badge pills skeleton */}
                      <div className="flex gap-2">
                        <div className="h-6 w-16 rounded-full bg-white/[0.03] border border-white/[0.04]" />
                        <div className="h-6 w-20 rounded-full bg-white/[0.025] border border-white/[0.03]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom status bar */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]"
                >
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 dot-breathe-1" />
                    <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 dot-breathe-2" />
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 dot-breathe-3" />
                  </div>
                  <span className="text-[11px] text-white/50 font-medium tracking-wide">
                    Building scene
                  </span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ PROGRESS CARD — Top-center floating pill while batch ops run ═══ */}
          <AnimatePresence>
            {cinematicSweep && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: -14,
                  scale: 0.96,
                  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                }}
                transition={{ type: "spring", damping: 28, stiffness: 340 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
              >
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-zinc-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/60">
                  {/* Iridescent ring (small) */}
                  <div className="relative w-6 h-6 shrink-0">
                    <div className="ai-ring" style={{ "--size": "24px" }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles size={8} className="text-white/50" />
                    </div>
                  </div>

                  {/* Dynamic microcopy */}
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={cinematicSweep.message}
                      initial={{ opacity: 0, y: 5, filter: "blur(3px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -4, filter: "blur(3px)" }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="text-[12px] text-white/60 font-medium whitespace-nowrap"
                    >
                      {cinematicSweep.message}
                    </motion.span>
                  </AnimatePresence>

                  {/* Breathing dots */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 dot-breathe-1" />
                    <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 dot-breathe-2" />
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 dot-breathe-3" />
                  </div>
                </div>

                {/* Bottom progress line */}
                <motion.div
                  className="mt-1 h-px rounded-full bg-gradient-to-r from-violet-500/0 via-fuchsia-400/60 to-sky-500/0"
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 30, ease: "linear" }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* ═══════════ OVERLAYS ═══════════ */}
      <AddSceneModal />
      <CopilotChat />
    </div>
  );
};
