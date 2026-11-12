import React from "react";
import { cn } from "../../../../lib/utils";
import { useStoryStore } from "../../../../store/useStoryStore";
import { useEditorStore } from "../../store/useEditorStore";

const SCENE_TRANSITIONS = [
  { value: "fade", label: "Fade" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
  { value: "zoom", label: "Zoom" },
  { value: "blur", label: "Blur" },
  { value: "static", label: "Static" },
];

export const AnimationPanel = () => {
  const { getCurrentScene, updateCurrentScene } = useStoryStore();
  const { markDirty, replayPreviewAnimation } = useEditorStore();
  const scene = getCurrentScene();

  if (!scene) return null;

  const animation = scene.animation || {
    transition: "fade",
  };

  const updateAnimation = (updates) => {
    updateCurrentScene({ animation: { ...animation, ...updates } });
    markDirty();
    replayPreviewAnimation("scene");
  };

  return (
    <div className="space-y-6">
      {/* Scene Transition */}
      <div className="space-y-3">
        <SectionLabel>Scene Transition</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {SCENE_TRANSITIONS.map((t) => {
            const isActive = (animation.transition || "fade") === t.value;
            return (
              <button
                key={t.value}
                onClick={() => updateAnimation({ transition: t.value })}
                className={cn(
                  "px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-center",
                  isActive
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
    {children}
  </h4>
);
