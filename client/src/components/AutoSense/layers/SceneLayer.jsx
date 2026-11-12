import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStoryStore } from "../../../store/useStoryStore";
import { HotspotLayer } from "../interactive/HotspotLayer";
import { EditorHotspotLayer } from "../editor/EditorHotspotLayer";
import { useEditorStore } from "../store/useEditorStore";

// ---------------------------------------------------------------------------
// Image‑motion presets – driven by scene.layout.motion.image
// Each returns { animate, transition } for the inner <motion.div>
// ---------------------------------------------------------------------------
const IMAGE_MOTION_PRESETS = {
  "slow-zoom-in": {
    animate: { opacity: 1, scale: [1, 1.08, 1] },
    transition: {
      opacity: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
      scale: {
        duration: 20,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "loop",
      },
    },
  },
  "slow-zoom-out": {
    animate: { opacity: 1, scale: [1.08, 1, 1.08] },
    transition: {
      opacity: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
      scale: {
        duration: 20,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "loop",
      },
    },
  },
  "subtle-pan-right": {
    animate: { opacity: 1, x: [0, 30, 0] },
    transition: {
      opacity: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
      x: {
        duration: 20,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "loop",
      },
    },
  },
  static: {
    animate: { opacity: 1 },
    transition: { opacity: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } },
  },
};

const PAUSED_MOTION = {
  animate: { opacity: 1, scale: 1, x: 0 },
  transition: {
    opacity: { duration: 0.3 },
    scale: { duration: 0.25 },
    x: { duration: 0.25 },
  },
};

const MINIMAL_TECH_MOTION = {
  animate: { opacity: 1 },
  transition: { opacity: { duration: 0.25 } },
};

// ---------------------------------------------------------------------------
// Scene‑transition presets – driven by scene.animation.transition
// Each returns { initial, exit } for the outer wrapper keyed by scene.id
// ---------------------------------------------------------------------------
const SCENE_TRANSITION_PRESETS = {
  fade: {
    initial: { opacity: 0 },
    exit: (fast) => ({
      opacity: 0,
      transition: { duration: fast ? 0.2 : 0.8, ease: [0.4, 0, 0.2, 1] },
    }),
  },
  "slide-left": {
    initial: { opacity: 0, x: 80 },
    exit: (fast) => ({
      opacity: 0,
      x: -80,
      transition: { duration: fast ? 0.2 : 0.6, ease: [0.4, 0, 0.2, 1] },
    }),
  },
  "slide-right": {
    initial: { opacity: 0, x: -80 },
    exit: (fast) => ({
      opacity: 0,
      x: 80,
      transition: { duration: fast ? 0.2 : 0.6, ease: [0.4, 0, 0.2, 1] },
    }),
  },
  zoom: {
    initial: { opacity: 0, scale: 0.92 },
    exit: (fast) => ({
      opacity: 0,
      scale: 1.08,
      transition: { duration: fast ? 0.2 : 0.7, ease: [0.4, 0, 0.2, 1] },
    }),
  },
  blur: {
    initial: { opacity: 0, filter: "blur(12px)" },
    exit: (fast) => ({
      opacity: 0,
      filter: "blur(12px)",
      transition: { duration: fast ? 0.2 : 0.7, ease: [0.4, 0, 0.2, 1] },
    }),
  },
  static: {
    initial: { opacity: 1 },
    exit: () => ({ opacity: 1, transition: { duration: 0 } }),
  },
};

export const SceneLayer = ({ editorMode = false, freezeAnimation = false }) => {
  const { getCurrentScene, activeHotspotId, storyData } = useStoryStore();
  const previewReplay = useEditorStore((s) => s.previewReplay);
  const scene = getCurrentScene();
  const isMinimalTech =
    scene?.layout?.theme != null
      ? scene.layout.theme === "minimal_tech"
      : (storyData?.meta?.template || "")
          .toLowerCase()
          .replace(/[\s-]/g, "") === "minimaltech";
  const [showOverlay, setShowOverlay] = useState(false);
  const prevSceneTypeRef = useRef(null);

  // Track transitions between tech_view and other views
  const isTechView = scene?.type === "tech_view";

  useEffect(() => {
    if (scene) {
      const prevWasTechView = prevSceneTypeRef.current === "tech_view";
      const currentIsTechView = scene.type === "tech_view";

      // Show transition overlay when switching to/from tech_view
      if (
        prevSceneTypeRef.current !== null &&
        prevWasTechView !== currentIsTechView
      ) {
        setShowOverlay(true);
        const timer = setTimeout(() => setShowOverlay(false), 800);
        return () => clearTimeout(timer);
      }

      prevSceneTypeRef.current = scene.type;
    }
  }, [scene]);

  // Pause Ken Burns when hovering a hotspot or when freeze is requested (drag mode)
  const isAnimationPaused = !!activeHotspotId || freezeAnimation;

  // 1. SAFETY CHECK
  if (!scene) return null;

  // 2. 3D MODE - Fade out to reveal 3D canvas
  if (isTechView) {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div
          key="tech-fade-out"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 bg-black"
        />
      </div>
    );
  }

  // 3. IMAGE / VIDEO RESOLUTION
  // Priority: Direct Image -> Intro/Outro Backgrounds -> Placeholder
  let imageUrl = scene.image_url;
  let videoUrl = null;
  let isVideoHidden = false;

  if (scene.type === "intro_view") {
    videoUrl = scene.intro_content?.background_video || null;
    isVideoHidden = !!scene.intro_content?.hide_video;
    if (!imageUrl) imageUrl = scene.intro_content?.background_image;
  }
  if (!imageUrl && scene.type === "outro_view") {
    imageUrl = scene.outro_content?.background_image || scene.image_url;
  }

  const shouldShowVideo = !!videoUrl && !isVideoHidden;

  if (!imageUrl && !shouldShowVideo)
    imageUrl = "https://placehold.co/1920x1080/000000/FFF?text=No+Image";

  // 4. Resolve image‑motion preset from scene data
  const imageMotionKey = scene.layout?.motion?.image || "slow-zoom-in";
  const motionPreset = shouldShowVideo
    ? PAUSED_MOTION
    : isMinimalTech
      ? MINIMAL_TECH_MOTION
      : isAnimationPaused
        ? PAUSED_MOTION
        : IMAGE_MOTION_PRESETS[imageMotionKey] ||
          IMAGE_MOTION_PRESETS["slow-zoom-in"];

  // 5. Resolve scene‑transition preset from scene data
  const transitionKey = scene.animation?.transition || "fade";
  const transPreset =
    SCENE_TRANSITION_PRESETS[transitionKey] || SCENE_TRANSITION_PRESETS.fade;
  const sceneEnterTransition =
    transitionKey === "static"
      ? { duration: 0 }
      : { duration: isMinimalTech ? 0.25 : 0.6, ease: [0.4, 0, 0.2, 1] };
  const sceneReplayKey = editorMode
    ? `${scene.id}-${previewReplay.scene}`
    : scene.id;
  const imageReplayKey = editorMode
    ? `${scene.id}-${previewReplay.image}-${imageMotionKey}`
    : `${scene.id}-${imageMotionKey}`;

  return (
    <div className="absolute inset-0 z-0 bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={sceneReplayKey}
          className="absolute inset-0"
          style={{ willChange: "transform, filter" }}
          initial={{ ...transPreset.initial, scale: 1 }}
          animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
          transition={sceneEnterTransition}
          exit={transPreset.exit(isMinimalTech)}
        >
          <motion.div
            key={imageReplayKey}
            className="absolute inset-0 origin-center"
            style={{ willChange: "transform" }}
            initial={{ opacity: 1, scale: 1, x: 0 }}
            animate={motionPreset.animate}
            transition={motionPreset.transition}
          >
            {/* Background Video (intro) or Image */}
            {shouldShowVideo ? (
              <video
                src={videoUrl}
                poster={imageUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={imageUrl}
                alt="Scene Background"
                className="w-full h-full object-cover"
              />
            )}

            {/* Gradient overlays — cinematic only; Minimal Tech uses opaque content card */}
            {!isMinimalTech && (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
              </>
            )}

            {/* Hotspots - inherit the Ken Burns animation */}
            {editorMode ? <EditorHotspotLayer /> : <HotspotLayer />}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
