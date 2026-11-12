import React, { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useStoryStore } from "../../../store/useStoryStore";

// --- 3D COMPONENTS ---
import { CarModel } from "./CarModel";
import { Environment } from "./Environment";
import { CameraController } from "./CameraController";

// Fires one invalidation whenever the active scene changes so that demand-mode
// renders the updated background/model state without a full 60fps loop.
function InvalidateOnSceneChange() {
  const currentSceneIndex = useStoryStore((s) => s.currentSceneIndex);
  const { invalidate } = useThree();
  useEffect(() => {
    invalidate();
  }, [currentSceneIndex, invalidate]);
  return null;
}

export const CanvasWrapper = ({ editorMode = false }) => {
  const { getCurrentScene, storyData } = useStoryStore();
  const currentScene = getCurrentScene();

  // 1. Determine Logic Props
  const isTechView = currentScene?.type === "tech_view";
  const mode = isTechView ? currentScene.theme_tag || "SHOWROOM" : "SHOWROOM";

  // 2. Extract Car Data (FIXED PATHS)
  // The log shows 'car_specs' is at the root, and 'car' contains body_type
  const specs = storyData?.car_specs || {};
  const identity = storyData?.car || {};

  // Check 'performance' object inside specs, or fallback to root if flattened
  const drivetrain = specs.performance?.drivetrain || specs.drivetrain || "AWD";
  const bodyType = identity.body_type || "Sedan";

  // Debugging (Verify it works now)
  useEffect(() => {
    if (storyData) {
      console.log("✅ CanvasWrapper Fixed Data:", { bodyType, drivetrain });
    }
  }, [storyData, bodyType, drivetrain]);

  // Extract tech_config from currentScene (for tech_view)
  const techConfig = isTechView ? currentScene.tech_config : undefined;

  const isMinimalTech =
    currentScene?.layout?.theme != null
      ? currentScene.layout.theme === "minimal_tech"
      : (storyData?.meta?.template || "")
          .toLowerCase()
          .replace(/[\s-]/g, "") === "minimaltech";

  const bodyLabel = bodyType.toLowerCase().includes("suv") ? "SUV" : "Sedan";
  const modelLabel = `This is a preview of a generic ${bodyLabel} car model`;
  const labelTopSpacing = editorMode ? "top-12 left-[-2]" : "top-4";

  return (
    <>
      <div
        className={`absolute inset-0 z-0 ${isMinimalTech ? "bg-neutral-100" : "bg-black"}`}
      >
        {isTechView &&
          (isMinimalTech ? (
            <div
              className={`absolute ${labelTopSpacing} left-3 z-10 px-3 py-1.5 rounded text-xs font-mono tracking-wide pointer-events-none select-none bg-white/80 text-zinc-500 border border-zinc-200`}
            >
              {modelLabel}
            </div>
          ) : (
            <div
              className={`absolute ${labelTopSpacing} left-3 z-10 pointer-events-none select-none`}
            >
              <div className="rounded-lg relative bg-black/60 backdrop-blur-xl saturate-150 border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] px-4 py-3 overflow-hidden">
                <div className="rounded-lg absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/10 via-transparent to-transparent opacity-50" />
                <p className="relative z-10 text-xs font-sans tracking-wide text-white/70">
                  {modelLabel}
                </p>
              </div>
            </div>
          ))}
        <Canvas
          shadows
          frameloop={isTechView ? "always" : "demand"}
          camera={{ position: [4, 2, 5], fov: 35 }}
          gl={{
            antialias: false,
            preserveDrawingBuffer: true,
            toneMappingExposure: isMinimalTech ? 1.5 : 1.0,
          }}
          dpr={[1, 2]}
        >
          <color
            attach="background"
            args={[isMinimalTech ? "#f5f5f4" : "#050505"]}
          />

          <InvalidateOnSceneChange />

          <Suspense fallback={null}>
            <CameraController isTechView={isTechView} />

            <Environment isMinimalTech={isMinimalTech} />

            <CarModel
              mode={mode}
              drivetrain={drivetrain}
              bodyType={bodyType}
              techConfig={techConfig}
              isMinimalTech={isMinimalTech}
            />
          </Suspense>
        </Canvas>
      </div>
    </>
  );
};
