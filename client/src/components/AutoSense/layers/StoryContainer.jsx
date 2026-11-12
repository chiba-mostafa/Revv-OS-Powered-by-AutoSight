import React from "react";
import { useStoryStore } from "../../../store/useStoryStore";
import { X } from "lucide-react";
import { cn } from "../../../lib/utils";

import { SceneLayer } from "./SceneLayer";
import { CanvasWrapper } from "../3d/CanvasWrapper";
import { SlideContentLayer } from "./SlideContentLayer";
import { Subtitles } from "../playback/Subtitles";
import { AudioPlayer } from "../playback/AudioPlayer";

// 1. ADD PROP DEFAULT TRUE
export const StoryContainer = ({
  enableAudio = true,
  hideContent = false,
  editorMode = false,
  freezeAnimation = false,
}) => {
  const { storyData, isFreeRoam, setFreeRoam, getCurrentScene } =
    useStoryStore();
  const currentScene = getCurrentScene();
  const isMinimalTech =
    currentScene?.layout?.theme != null
      ? currentScene.layout.theme === "minimal_tech"
      : (storyData?.meta?.template || "")
          .toLowerCase()
          .replace(/[\s-]/g, "") === "minimaltech";

  if (!storyData || !storyData.scenes)
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-red-500 z-[300]">
        ERROR: NO STORY DATA FOUND
      </div>
    );

  return (
    <div className="relative w-full h-full overflow-hidden bg-black text-white">
      {/* 3D Engine */}
      <CanvasWrapper editorMode={editorMode} />

      {/* 2D Layers */}
      <SceneLayer editorMode={editorMode} freezeAnimation={freezeAnimation} />

      {!hideContent && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          <SlideContentLayer />
        </div>
      )}

      <Subtitles />

      {/* Free roam exit control */}
      {isFreeRoam && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4">
          <button
            onClick={() => setFreeRoam(false)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 border text-sm font-bold transition-colors",
              isMinimalTech
                ? "bg-white border-zinc-200 rounded-sm font-mono tracking-widest text-zinc-900 shadow-sm hover:bg-zinc-900 hover:text-white"
                : "bg-black/60 backdrop-blur-xl border-white/20 rounded-full shadow-2xl hover:bg-white hover:text-black",
            )}
          >
            <X size={16} /> Exit Explore Mode
          </button>
        </div>
      )}

      {/* 2. CONDITIONAL RENDER */}
      {enableAudio && <AudioPlayer />}
    </div>
  );
};
