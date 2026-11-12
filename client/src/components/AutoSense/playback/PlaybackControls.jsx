import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Settings,
  ArrowLeft,
  Maximize2,
  Repeat,
  Clock,
} from "lucide-react";
import { cn } from "../../../lib/utils"; // <--- FIXED IMPORT PATH
import { Timeline } from "./Timeline";

export const PlaybackControls = ({
  isPlaying,
  isPaused,
  isFrozen,
  currentScene,
  totalScenes,
  currentTime,
  audioEnabled,
  autoAdvance,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onSceneSelect,
  onToggleAudio,
  onToggleAutoAdvance,
  onFullscreen,
  onExit,
  onOpenPayPalDeposit,
}) => {
  const [showScenes, setShowScenes] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const handlePlayPause = () => {
    if (isFrozen) {
      onPlay();
    } else if (isPaused || !isPlaying) {
      onPlay();
    } else {
      onPause();
    }
  };

  return (
    <div className="bg-gradient-to-t from-black via-black/80 to-transparent z-50 pt-20 pb-6 px-6">
      {/* 1. EXPANDED TIMELINE (Toggled via Clock Icon) */}
      <AnimatePresence>
        {showTimeline && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <Timeline />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. MINI PROGRESS BAR (Always Visible) */}
      {/* This gives visual feedback even if the main timeline is hidden */}
      <div className="mb-4">
        <div className="relative h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer group">
          <motion.div
            className="absolute top-0 left-0 h-full bg-blue-500 shadow-[0_0_10px_rgba(0,136,255,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${((currentScene + 1) / totalScenes) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
          {/* Hover Highlight */}
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* 3. MAIN CONTROLS ROW */}
      <div className="flex items-center justify-between">
        {/* LEFT: Navigation */}
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            title="Exit to Editor (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onPrevious}
              disabled={currentScene === 0}
              className={cn(
                "p-2 rounded transition-colors",
                currentScene === 0
                  ? "text-zinc-700 cursor-not-allowed"
                  : "text-zinc-400 hover:text-white hover:bg-white/10",
              )}
              title="Previous Scene (←)"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={handlePlayPause}
              className={cn(
                "p-3 rounded-full transition-colors shadow-lg",
                isFrozen
                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                  : "bg-white hover:bg-gray-200 text-black",
              )}
              title={
                isFrozen
                  ? "Unfreeze (Space)"
                  : isPaused
                    ? "Play (Space)"
                    : "Pause (Space)"
              }
            >
              {isFrozen ? (
                <Clock className="w-6 h-6" />
              ) : isPaused || !isPlaying ? (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              ) : (
                <Pause className="w-6 h-6 fill-current" />
              )}
            </button>

            {/* Status Indicator (Paused/Focus) */}
            <AnimatePresence>
              {(isPaused || isFrozen) && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10"
                >
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${isFrozen ? "bg-yellow-500" : "bg-blue-500"}`}
                  />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {isFrozen ? "Focus Mode" : "Paused"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={onNext}
              disabled={currentScene >= totalScenes - 1}
              className={cn(
                "p-2 rounded transition-colors",
                currentScene >= totalScenes - 1
                  ? "text-zinc-700 cursor-not-allowed"
                  : "text-zinc-400 hover:text-white hover:bg-white/10",
              )}
              title="Next Scene (→)"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CENTER: Scene Selector */}
        <div className="flex-1 max-w-xs mx-8 relative">
          <button
            onClick={() => setShowScenes(!showScenes)}
            className="w-full p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors flex items-center justify-center gap-2 group"
          >
            <span className="text-sm font-medium">
              {totalScenes > 0 ? `Scene ${currentScene + 1}` : "No Scenes"}
            </span>
            <Settings className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
          </button>

          {/* Scene Dropdown */}
          <AnimatePresence>
            {showScenes && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full mb-2 left-0 right-0 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 max-h-48 overflow-y-auto shadow-2xl z-50"
              >
                {Array.from({ length: totalScenes }, (_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onSceneSelect(index);
                      setShowScenes(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                      index === currentScene
                        ? "bg-blue-500/20 text-blue-400"
                        : "text-zinc-300 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    Scene {index + 1}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: Tools */}
        <div className="flex items-center gap-2">
          {/* Direct PayPal Vehicle Hold Deposit Button */}
          {onOpenPayPalDeposit && (
            <button
              onClick={onOpenPayPalDeposit}
              className="px-3.5 py-1.5 bg-[#0070BA] hover:bg-[#003087] text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-lg shadow-blue-600/30 border border-blue-400/40 transition-all hover:scale-105 active:scale-95 mr-2"
              title="Hold and Reserve this vehicle with PayPal ($500 Deposit)"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.789.789 0 0 1 .778-.654h7.112c3.543 0 5.86 1.776 5.378 5.25-.403 2.91-2.484 4.542-5.32 4.542h-2.18l-1.07 6.804a.642.642 0 0 1-.632.544l-1.934.131zm8.216-12.723c.25-1.802-.916-2.614-2.764-2.614H8.79l-1.4 8.89h1.79c1.944 0 3.864-.32 4.112-2.115l.004-.035z" />
              </svg>
              <span>Reserve ($500)</span>
            </button>
          )}
          {/* Toggle Detailed Timeline */}
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={cn(
              "p-2 rounded transition-colors",
              showTimeline
                ? "text-blue-400 bg-blue-400/10"
                : "text-zinc-400 hover:text-white hover:bg-white/5",
            )}
            title={showTimeline ? "Hide Timeline" : "Show Timeline"}
          >
            <Clock className="w-5 h-5" />
          </button>

          <button
            onClick={onToggleAudio}
            className={cn(
              "p-2 rounded transition-colors",
              audioEnabled
                ? "text-white"
                : "text-zinc-400 hover:text-white hover:bg-white/5",
            )}
            title={audioEnabled ? "Mute Audio" : "Enable Audio"}
          >
            {audioEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={onToggleAutoAdvance}
            className={cn(
              "p-2 rounded transition-colors",
              autoAdvance
                ? "text-blue-400 bg-blue-400/10"
                : "text-zinc-400 hover:text-white hover:bg-white/5",
            )}
            title={autoAdvance ? "Auto-Advance On" : "Auto-Advance Off"}
          >
            <Repeat className="w-5 h-5" />
          </button>

          <button
            onClick={onFullscreen}
            className="p-2 text-zinc-400 hover:text-white transition-colors hover:bg-white/5 rounded"
            title="Fullscreen (F)"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
