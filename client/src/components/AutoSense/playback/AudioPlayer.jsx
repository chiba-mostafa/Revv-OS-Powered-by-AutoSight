import { useEffect, useRef } from "react";
import { useStoryStore } from "../../../store/useStoryStore";

export const AudioPlayer = () => {
  const {
    getCurrentScene,
    nextScene,
    playback,
    setAudioCurrentTime,
    setCurrentSceneAudioDuration,
  } = useStoryStore();
  const { isPlaying, isPaused, autoAdvance = true } = playback;
  const currentScene = getCurrentScene();
  const audioRef = useRef(null);

  // 1. PLAYBACK LOGIC
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const audioUrl = currentScene?.audio_url;

    // A. If no audio for this scene, ensure silence
    if (!audioUrl) {
      audio.pause();
      audio.currentTime = 0;
      setAudioCurrentTime(0);
      setCurrentSceneAudioDuration(0);
      return;
    }

    const fullUrl = audioUrl.startsWith("http")
      ? audioUrl
      : `${window.location.origin}${audioUrl}`;

    // B. Load Track (Only if different)
    // We check decodeURIComponent to avoid mismatch issues
    if (decodeURIComponent(audio.src) !== decodeURIComponent(fullUrl)) {
      audio.src = fullUrl;
      audio.load();
    }

    // C. Play/Pause
    if (isPlaying && !isPaused) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Auto-play blocked, ignore
        });
      }
    } else {
      audio.pause();
    }

    // --- 🚨 THE CRITICAL FIX: CLEANUP 🚨 ---
    // When this effect re-runs (or component unmounts), PAUSE IMMEDIATELY.
    return () => {
      if (audio) audio.pause();
    };
  }, [
    currentScene?.id,
    currentScene?.audio_url,
    isPlaying,
    isPaused,
    setAudioCurrentTime,
    setCurrentSceneAudioDuration,
  ]);

  // 2. EVENTS
  const handleEnded = () => {
    setAudioCurrentTime(0);
    if (autoAdvance) nextScene();
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setCurrentSceneAudioDuration(audioRef.current.duration);
  };

  return (
    <audio
      ref={audioRef}
      onEnded={handleEnded}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      className="hidden"
      preload="auto"
    />
  );
};
