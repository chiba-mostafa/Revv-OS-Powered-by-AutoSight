import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStoryStore } from "../../../store/useStoryStore";

export const Subtitles = () => {
  const { getCurrentScene, audioCurrentTime, currentSceneAudioDuration, playback } =
    useStoryStore();
  const scene = getCurrentScene();
  const isPlaying = playback?.isPlaying && !playback?.isPaused;

  const normalizedSubtitles = useMemo(() => {
    const subtitles = scene?.subtitles || [];
    if (!subtitles.length) return [];

    const lastEnd = subtitles.reduce(
      (max, sub) => Math.max(max, Number(sub?.end) || 0),
      0,
    );
    const audioDuration = Number(currentSceneAudioDuration) || 0;

    if (!audioDuration || !lastEnd || Math.abs(audioDuration - lastEnd) < 0.35) {
      return subtitles;
    }

    const scale = audioDuration / lastEnd;

    return subtitles.map((sub, index) => {
      const start = Math.max(0, (Number(sub.start) || 0) * scale);
      const rawEnd = Math.max(start, (Number(sub.end) || 0) * scale);
      const nextStart =
        index < subtitles.length - 1
          ? Math.max(start, (Number(subtitles[index + 1]?.start) || 0) * scale)
          : audioDuration;
      const end = Math.min(rawEnd, Math.max(start + 0.05, nextStart - 0.05), audioDuration);

      return {
        ...sub,
        start,
        end: end > start ? end : Math.min(audioDuration, start + 0.4),
      };
    });
  }, [scene?.subtitles, currentSceneAudioDuration]);

  // Find the active line based on current audio time
  const activeSubtitle = useMemo(() => {
    if (!normalizedSubtitles.length) return null;
    return normalizedSubtitles.find(
      (sub) => audioCurrentTime >= sub.start && audioCurrentTime <= sub.end,
    );
  }, [normalizedSubtitles, audioCurrentTime]);

  if (!activeSubtitle || !isPlaying) return null;

  return (
    <div className="absolute bottom-32 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubtitle.text}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 max-w-3xl shadow-2xl"
        >
          <p className="text-white text-lg md:text-xl font-medium drop-shadow-md text-center leading-relaxed">
            {activeSubtitle.text}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
