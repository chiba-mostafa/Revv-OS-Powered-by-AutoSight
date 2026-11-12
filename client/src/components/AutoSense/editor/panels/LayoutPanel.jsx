import React from "react";
import { cn } from "../../../../lib/utils";
import { useStoryStore } from "../../../../store/useStoryStore";
import { useEditorStore } from "../../store/useEditorStore";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  EyeOff,
  Film,
  Cpu,
} from "lucide-react";

const CARD_POSITIONS = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
  { value: "hidden", label: "Hidden", icon: EyeOff },
];

const resolveCardPosition = (scene) => {
  const explicitPosition = scene?.layout?.card_position;
  if (["left", "center", "right", "hidden"].includes(explicitPosition)) {
    return explicitPosition;
  }

  const legacyAlignment = scene?.slide_content?.alignment;
  if (["left", "center", "right"].includes(legacyAlignment)) {
    return legacyAlignment;
  }

  const contentAlignment = scene?.layout?.content_alignment || "";
  if (contentAlignment.includes("right")) return "right";
  if (contentAlignment.includes("center")) return "center";
  if (scene?.type === "tech_view") return "right";
  return "left";
};

const POSITION_TO_ALIGNMENT = {
  left: "middle-left",
  center: "middle-center",
  right: "middle-right",
  hidden: "middle-center",
};

const IMAGE_MOTIONS = [
  { value: "slow-zoom-in", label: "Zoom In" },
  { value: "slow-zoom-out", label: "Zoom Out" },
  { value: "subtle-pan-right", label: "Pan Right" },
  { value: "static", label: "Static" },
];

const CONTENT_MOTIONS = [
  { value: "fade-up", label: "Fade Up" },
  { value: "slide-in-left", label: "Slide Left" },
  { value: "slide-in-right", label: "Slide Right" },
];

export const LayoutPanel = () => {
  const {
    getCurrentScene,
    updateCurrentScene,
    updateAllScenesTheme,
    storyData,
  } = useStoryStore();
  const { markDirty, replayPreviewAnimation } = useEditorStore();
  const scene = getCurrentScene();

  if (!scene) return null;

  const activeCardPosition = resolveCardPosition(scene);

  const layout = scene.layout || {
    composition: "full-bleed",
    content_alignment: "bottom-left",
    motion: { image: "slow-zoom-in", content: "fade-up" },
  };

  // Resolve active theme: per-scene override > global template > default cinematic
  const activeTheme =
    scene.layout?.theme ||
    (storyData?.meta?.template === "minimaltech"
      ? "minimal_tech"
      : "cinematic");

  const handleThemeChange = (theme) => {
    updateAllScenesTheme(theme);
    markDirty();
  };

  const updateLayout = (updates) => {
    const newLayout = { ...layout, ...updates };
    updateCurrentScene({ layout: newLayout });
    markDirty();
  };

  const updateCardPosition = (position) => {
    const updates = {
      layout: {
        ...layout,
        card_position: position,
        content_alignment: POSITION_TO_ALIGNMENT[position],
      },
    };

    if (scene.type === "slide_view" || scene.type === "tech_view") {
      updates.slide_content = {
        alignment:
          position === "hidden"
            ? scene.slide_content?.alignment || activeCardPosition
            : position,
      };
    }

    updateCurrentScene(updates);
    markDirty();
  };

  const updateMotion = (field, value) => {
    updateLayout({
      motion: { ...(layout.motion || {}), [field]: value },
    });
    replayPreviewAnimation(field === "image" ? "image" : "content");
  };

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div className="space-y-3">
        <SectionLabel>Theme</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleThemeChange("cinematic")}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
              activeTheme === "cinematic"
                ? "bg-primary/15 border-primary/50 text-primary"
                : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white",
            )}
          >
            <Film size={20} />
            <span className="text-[10px] font-medium">Cinematic</span>
          </button>
          <button
            onClick={() => handleThemeChange("minimal_tech")}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
              activeTheme === "minimal_tech"
                ? "bg-primary/15 border-primary/50 text-primary"
                : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white",
            )}
          >
            <Cpu size={20} />
            <span className="text-[10px] font-medium">Minimal Tech</span>
          </button>
        </div>
      </div>

      {/* Composition */}
      <div className="space-y-3">
        <SectionLabel>Composition</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {CARD_POSITIONS.map((position) => {
            const Icon = position.icon;
            const isActive = activeCardPosition === position.value;
            return (
              <button
                key={position.value}
                onClick={() => updateCardPosition(position.value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                  isActive
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{position.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Image Motion */}
      <div className="space-y-3">
        <SectionLabel>Image Motion</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {IMAGE_MOTIONS.map((m) => {
            const isActive = layout.motion?.image === m.value;
            return (
              <button
                key={m.value}
                onClick={() => updateMotion("image", m.value)}
                className={cn(
                  "px-3 py-2.5 rounded-xl border text-xs font-medium transition-all",
                  isActive
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Motion */}
      <div className="space-y-3">
        <SectionLabel>Content Entrance</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {CONTENT_MOTIONS.map((m) => {
            const isActive = layout.motion?.content === m.value;
            return (
              <button
                key={m.value}
                onClick={() => updateMotion("content", m.value)}
                className={cn(
                  "px-2 py-2.5 rounded-xl border text-[11px] font-medium transition-all text-center",
                  isActive
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10",
                )}
              >
                {m.label}
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
