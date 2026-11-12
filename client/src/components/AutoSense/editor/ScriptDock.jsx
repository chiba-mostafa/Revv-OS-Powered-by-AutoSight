import React, { useState, useRef } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import { Button, Tooltip } from "@heroui/react";
import {
  Mic,
  RefreshCw,
  Volume2,
  ChevronUp,
  Play,
  Pause,
  User,
  Check,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useStoryStore } from "../../../store/useStoryStore";
import { useEditorStore } from "../store/useEditorStore";
import { API_BASE } from "../../../config/api";
import axios from "axios";

/**
 * ScriptDock
 * A polished collapsible dock at the bottom-center of the editor
 * for voiceover script editing, voice selection, and regeneration.
 * Matches the floating toolbar / glass-card aesthetic.
 */
export const ScriptDock = () => {
  const { getCurrentScene, updateCurrentScene } = useStoryStore();
  const {
    markDirty,
    voices,
    selectedVoice,
    setSelectedVoice,
    isRegeneratingVoiceover,
    setRegeneratingVoiceover,
    isScriptDockOpen,
    toggleScriptDock,
  } = useEditorStore();

  const scene = getCurrentScene();
  const [scriptChanged, setScriptChanged] = useState(false);
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);
  const textareaRef = useRef(null);

  // Audio player state
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  if (!scene) return null;

  const hasVoiceover =
    scene.type === "slide_view" || scene.type === "tech_view";
  if (!hasVoiceover) return null;

  const voiceoverText =
    scene.raw_voiceover || scene.slide_content?.voiceover_text || "";
  const wordCount = voiceoverText.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDuration = Math.ceil(wordCount / 2.5); // ~150 wpm

  const currentVoice = voices.find((v) => v.id === selectedVoice);

  const updateScript = (text) => {
    updateCurrentScene({
      raw_voiceover: text,
      slide_content: { voiceover_text: text },
    });
    setScriptChanged(true);
    markDirty();
  };

  const handleRegenerate = async () => {
    const text = scene.raw_voiceover || scene.slide_content?.voiceover_text;
    if (!text || text.trim().length === 0) return;

    setRegeneratingVoiceover(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/editor/regenerate-voiceover`,
        {
          text,
          sceneId: scene.id || scene.scene_id,
          voice: selectedVoice,
          language: selectedVoice.includes("-fr") ? "fr" : "en",
        },
      );
      if (res.data.success) {
        updateCurrentScene({
          audio_url: res.data.audio_url,
          subtitles: res.data.subtitles || [],
        });
        setScriptChanged(false);
        markDirty();
      }
    } catch (err) {
      console.error("Failed to regenerate voiceover:", err);
    } finally {
      setRegeneratingVoiceover(false);
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const { currentTime, duration } = audioRef.current;
    if (duration) setAudioProgress((currentTime / duration) * 100);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4">
      {/* ─── Collapsed: Pill toggle ─────────────────────────────────────── */}
      {!isScriptDockOpen && (
        <div className="flex justify-center">
          <button
            onClick={toggleScriptDock}
            className={cn(
              "flex items-center gap-2 px-5 py-2",
              "bg-black/60 backdrop-blur-2xl",
              "border border-white/10 rounded-2xl",
              "shadow-2xl shadow-black/50",
              "text-zinc-400 hover:text-white",
              "transition-all duration-200 group",
            )}
          >
            <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
              <Mic size={12} className="text-primary" />
            </div>
            <span className="text-[11px] font-semibold tracking-wide">
              Voiceover
            </span>
            {wordCount > 0 && (
              <span className="text-[9px] bg-white/8 text-zinc-500 px-1.5 py-0.5 rounded-md font-medium">
                {wordCount}w &middot; ~{estimatedDuration}s
              </span>
            )}
            {/* {scene.audio_url && (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )} */}
            <ChevronUp
              size={12}
              className="text-zinc-600 group-hover:text-zinc-300 transition-colors"
            />
          </button>
        </div>
      )}

      {/* ─── Expanded: Full dock ────────────────────────────────────────── */}
      <AnimatePresence>
        {isScriptDockOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              className={cn(
                "bg-black/60 backdrop-blur-2xl",
                "border border-white/10 rounded-2xl",
                "shadow-2xl shadow-black/50",
                "overflow-hidden",
              )}
            >
              {/* ── Header bar ──────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Mic size={12} className="text-primary" />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                    Voiceover Script
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Word count + duration */}
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-medium tabular-nums",
                        wordCount > 60 ? "text-amber-400" : "text-zinc-600",
                      )}
                    >
                      {wordCount} words
                    </span>
                    <div className="w-px h-3 bg-white/10" />
                    <span className="text-[10px] text-zinc-600 font-medium tabular-nums">
                      ~{estimatedDuration}s
                    </span>
                  </div>

                  {/* Collapse */}
                  <button
                    onClick={toggleScriptDock}
                    className="text-zinc-600 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                  >
                    <ChevronUp size={14} className="rotate-180" />
                  </button>
                </div>
              </div>

              {/* ── Body ────────────────────────────────────────────────── */}
              <div className="p-4 space-y-3">
                {/* Script textarea */}
                <textarea
                  ref={textareaRef}
                  value={voiceoverText}
                  onChange={(e) => updateScript(e.target.value)}
                  placeholder="Write the narration script for this scene..."
                  rows={3}
                  className={cn(
                    "w-full bg-white/[0.03] rounded-xl px-4 py-3",
                    "border border-white/8 hover:border-white/15",
                    "focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
                    "text-sm text-white/90 leading-relaxed",
                    "placeholder:text-zinc-700",
                    "outline-none resize-none transition-all",
                  )}
                />

                {/* ── Controls row ──────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Voice selector */}
                  <div className="relative">
                    <button
                      onClick={() => setVoiceDropdownOpen(!voiceDropdownOpen)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5",
                        "bg-white/5 border border-white/8 rounded-xl",
                        "hover:bg-white/8 hover:border-white/15",
                        "transition-all text-xs",
                      )}
                    >
                      <User size={12} className="text-zinc-500" />
                      <span className="text-zinc-300 font-medium">
                        {currentVoice?.label || "Voice"}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/8 text-zinc-500 uppercase font-bold">
                        {currentVoice?.language || "EN"}
                      </span>
                    </button>

                    {/* Voice dropdown */}
                    <AnimatePresence>
                      {voiceDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className={cn(
                            "absolute bottom-full mb-2 left-0 w-52",
                            "bg-zinc-900/98 backdrop-blur-2xl",
                            "border border-white/10 rounded-xl",
                            "shadow-2xl shadow-black/60",
                            "py-1 overflow-hidden z-50",
                          )}
                        >
                          <div className="px-3 py-1.5 border-b border-white/5">
                            <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-wider">
                              Select Voice
                            </span>
                          </div>
                          <div className="max-h-48 overflow-y-auto py-1">
                            {voices.map((v) => {
                              const isSelected = v.id === selectedVoice;
                              return (
                                <button
                                  key={v.id}
                                  onClick={() => {
                                    setSelectedVoice(v.id);
                                    setVoiceDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 text-left transition-all",
                                    isSelected
                                      ? "bg-primary/10 text-primary"
                                      : "text-zinc-400 hover:bg-white/5 hover:text-white",
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold",
                                        v.gender === "female"
                                          ? "bg-pink-500/15 text-pink-400"
                                          : "bg-blue-500/15 text-blue-400",
                                      )}
                                    >
                                      {v.label[0]}
                                    </div>
                                    <span className="text-xs font-medium">
                                      {v.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-zinc-500 uppercase font-bold">
                                      {v.language}
                                    </span>
                                    {isSelected && (
                                      <Check
                                        size={12}
                                        className="text-primary"
                                      />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Center: Audio player (if audio exists) */}
                  {scene.audio_url && (
                    <div className="flex-1 flex items-center gap-2 max-w-xs mx-auto">
                      <Tooltip content={isPlaying ? "Pause" : "Play preview"}>
                        <button
                          onClick={toggleAudio}
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                            isPlaying
                              ? "bg-primary/20 text-primary"
                              : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10",
                          )}
                        >
                          {isPlaying ? (
                            <Pause size={12} />
                          ) : (
                            <Play size={12} className="ml-0.5" />
                          )}
                        </button>
                      </Tooltip>

                      {/* Progress bar */}
                      <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full transition-all duration-100"
                          style={{ width: `${audioProgress}%` }}
                        />
                      </div>

                      <span className="text-[9px] text-zinc-600 font-medium tabular-nums shrink-0">
                        {audioDuration > 0
                          ? formatTime(audioDuration)
                          : `~${estimatedDuration}s`}
                      </span>

                      {/* Hidden audio element */}
                      <audio
                        ref={audioRef}
                        src={scene.audio_url}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleAudioEnded}
                        onLoadedMetadata={handleLoadedMetadata}
                        className="hidden"
                      />
                    </div>
                  )}

                  {/* Right: Regenerate */}
                  <Button
                    size="sm"
                    radius="xl"
                    isLoading={isRegeneratingVoiceover}
                    onPress={handleRegenerate}
                    isDisabled={!voiceoverText.trim()}
                    className={cn(
                      "font-semibold text-xs px-4",
                      scriptChanged
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "bg-white/8 text-zinc-400 hover:bg-white/12 hover:text-zinc-200",
                    )}
                    startContent={
                      !isRegeneratingVoiceover && <RefreshCw size={11} />
                    }
                  >
                    {isRegeneratingVoiceover ? "Generating..." : "Regenerate"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
