import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShieldCheck,
  Zap,
  Leaf,
  Award,
  Smartphone,
  Bluetooth,
  Wifi,
  Circle,
  Trophy,
  Rotate3d,
  Check,
  CheckCircle2,
  X as XIcon,
} from "lucide-react";
import { useStoryStore } from "../../../store/useStoryStore";
import { cn } from "../../../lib/utils";
import { useEditorStore } from "../store/useEditorStore";

// ---------------------------------------------------------------------------
// Content‑entrance presets – driven by scene.layout.motion.content
// ---------------------------------------------------------------------------
const CONTENT_ENTRANCE_PRESETS = {
  "fade-up": {
    initial: { opacity: 0, y: 30, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.95 },
    transition: { duration: 0.6, ease: "circOut", delay: 0.2 },
  },
  "slide-in-left": {
    initial: { opacity: 0, x: -60 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 60 },
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.15 },
  },
  "slide-in-right": {
    initial: { opacity: 0, x: 60 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 },
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.15 },
  },
};

const MINIMAL_TECH_ENTRANCE = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 8 },
  transition: { duration: 0.18, ease: "easeOut" },
};

// Fallback for cinematic when no explicit content entrance is set
const DEFAULT_CINEMATIC_ENTRANCE = CONTENT_ENTRANCE_PRESETS["fade-up"];

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

// Map badge IDs/categories to icons
const getBadgeIcon = (badge) => {
  const id = badge.id?.toUpperCase() || "";
  const cat = badge.category?.toUpperCase() || "";

  if (id.includes("CARPLAY") || id.includes("ANDROID")) return Smartphone;
  if (id.includes("BLUETOOTH")) return Bluetooth;
  if (id.includes("WIFI")) return Wifi;
  if (id.includes("NHTSA") || id.includes("NCAP")) return ShieldCheck;
  if (id.includes("JDPOWER") || id.includes("KBB")) return Trophy;

  if (cat === "SAFETY") return ShieldCheck;
  if (
    cat === "PERFORMANCE" ||
    cat === "SPORT" ||
    cat === "POWER" ||
    id.includes("HP")
  )
    return Zap;
  if (cat === "ECO" || cat === "EFFICIENCY" || id.includes("EV")) return Leaf;
  if (cat === "AWARD") return Award;
  if (cat === "TECHNOLOGY") return Smartphone;

  return Circle;
};

// Badge color helper
const getBadgeColor = (badge, isLight = false) => {
  const cat = badge.category?.toUpperCase() || "";

  if (cat === "SAFETY")
    return isLight
      ? "text-blue-700 border-blue-200 bg-blue-50"
      : "text-blue-400 border-blue-500/30 bg-blue-500/10";
  if (cat === "ECO" || cat === "EFFICIENCY")
    return isLight
      ? "text-emerald-700 border-emerald-200 bg-emerald-50"
      : "text-green-400 border-green-500/30 bg-green-500/10";
  if (cat === "PERFORMANCE")
    return isLight
      ? "text-red-700 border-red-200 bg-red-50"
      : "text-red-400 border-red-500/30 bg-red-500/10";
  if (cat === "AWARD")
    return isLight
      ? "text-amber-700 border-amber-200 bg-amber-50"
      : "text-amber-400 border-amber-500/30 bg-amber-500/10";

  return isLight
    ? "text-zinc-700 border-zinc-200 bg-zinc-100"
    : "text-white border-white/20 bg-white/5";
};

// Get badge image URL from Supabase storage
const getBadgeImageUrl = (badge) => {
  if (!badge.visuals?.image_path) return null;

  const SUPABASE_URL = "https://lvodepwdbesxputvetnk.supabase.co";
  return `${SUPABASE_URL}/storage/v1/object/public/badges/${badge.visuals.image_path}`;
};

export const SlideContentLayer = () => {
  const {
    getCurrentScene,
    startExperience,
    activeHotspotId,
    activeCameraView,
    setCameraView,
    setFreeRoam,
    isFreeRoam,
    goToScene,
    storyData,
  } = useStoryStore();
  const previewReplay = useEditorStore((s) => s.previewReplay);

  const scene = getCurrentScene();
  const [activeBadgeIndex, setActiveBadgeIndex] = React.useState(null);
  const isMinimalTech =
    scene?.layout?.theme != null
      ? scene.layout.theme === "minimal_tech"
      : (storyData?.meta?.template || "")
          .toLowerCase()
          .replace(/[\s-]/g, "") === "minimaltech";

  if (!scene || isFreeRoam) return null;

  const cardPosition = resolveCardPosition(scene);
  const isCardHidden =
    (scene.type === "slide_view" || scene.type === "tech_view") &&
    cardPosition === "hidden";

  // Resolve content entrance animation from scene data
  const contentMotionKey = scene.layout?.motion?.content;
  const entrance = isMinimalTech
    ? MINIMAL_TECH_ENTRANCE
    : contentMotionKey && CONTENT_ENTRANCE_PRESETS[contentMotionKey]
      ? CONTENT_ENTRANCE_PRESETS[contentMotionKey]
      : DEFAULT_CINEMATIC_ENTRANCE;
  const contentReplayKey = `${scene.id}-${previewReplay.content}`;

  const getViewLabels = (theme) => {
    switch ((theme || "").toUpperCase()) {
      case "SAFETY":
        return { a: "Front Sensors", b: "Rear Sensors", c: "360° Top View" };
      case "UTILITY":
        return { a: "Dimensions", b: "Cargo Volume" };
      case "PERFORMANCE":
        return { a: "Powertrain", b: "Drivetrain View" };
      default:
        return { a: "View A", b: "View B" };
    }
  };

  const labels = getViewLabels(scene.theme_tag);

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none z-30 flex flex-col justify-center p-6 md:p-20 transition-all duration-500",
        scene.type === "tech_view"
          ? isCardHidden
            ? "items-center text-center"
            : cardPosition === "center"
              ? "items-center text-center"
              : cardPosition === "left"
                ? "items-start text-left"
                : "items-end text-right"
          : cardPosition === "right"
            ? "items-end text-right"
            : cardPosition === "center"
              ? "items-center text-center"
              : "items-start text-left",
        activeHotspotId
          ? "opacity-20 blur-sm grayscale"
          : "opacity-100 blur-0 grayscale-0",
      )}
    >
      {/* Tech View Camera Controls - Above Container */}
      {scene.type === "tech_view" && (
        <div
          className={cn(
            "flex items-center gap-2 mb-4 pointer-events-auto w-full",
            isCardHidden
              ? "max-w-none justify-center"
              : cardPosition === "center"
                ? "max-w-xl justify-center"
                : cardPosition === "left"
                  ? "max-w-xl justify-start"
                  : "max-w-xl justify-end",
          )}
        >
          <div
            className={cn(
              "p-1 flex gap-1 border",
              isMinimalTech
                ? "bg-white border-zinc-200 rounded-sm shadow-sm"
                : "bg-black/80 backdrop-blur-2xl border-white/10 rounded-xl",
            )}
          >
            <button
              onClick={() => setCameraView("primary")}
              className={cn(
                "px-3 py-1.5 text-xs transition-all",
                isMinimalTech
                  ? "rounded-sm font-mono tracking-wider"
                  : "rounded-lg font-medium",
                activeCameraView === "primary"
                  ? isMinimalTech
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-black"
                  : isMinimalTech
                    ? "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                    : "text-white/50 hover:text-white hover:bg-white/10",
              )}
            >
              {labels.a}
            </button>
            <button
              onClick={() => setCameraView("secondary")}
              className={cn(
                "px-3 py-1.5 text-xs transition-all",
                isMinimalTech
                  ? "rounded-sm font-mono tracking-wider"
                  : "rounded-lg font-medium",
                activeCameraView === "secondary"
                  ? isMinimalTech
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-black"
                  : isMinimalTech
                    ? "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                    : "text-white/50 hover:text-white hover:bg-white/10",
              )}
            >
              {labels.b}
            </button>
            {labels.c && (
              <button
                onClick={() => setCameraView("tertiary")}
                className={cn(
                  "px-3 py-1.5 text-xs transition-all",
                  isMinimalTech
                    ? "rounded-sm font-mono tracking-wider"
                    : "rounded-lg font-medium",
                  activeCameraView === "tertiary"
                    ? isMinimalTech
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-black"
                    : isMinimalTech
                      ? "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                      : "text-white/50 hover:text-white hover:bg-white/10",
                )}
              >
                {labels.c}
              </button>
            )}
          </div>
          <button
            onClick={() => setFreeRoam(true)}
            className={cn(
              "p-2 border transition-colors",
              isMinimalTech
                ? "bg-white border-zinc-200 rounded-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 shadow-sm"
                : "bg-black/80 backdrop-blur-2xl border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10",
            )}
          >
            <Rotate3d size={18} />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait" key={contentReplayKey}>
        {!isCardHidden && (
          <motion.div
            key={scene.id}
            initial={entrance.initial}
            animate={entrance.animate}
            exit={entrance.exit}
            transition={entrance.transition}
            className="max-w-xl pointer-events-auto"
          >
          {/* Inner div isolates backdrop-filter from framer-motion transforms
              — fixes Chromium compositing bug where backdrop-blur breaks
              when the same element has an active CSS transform. */}
          <div
            className={cn(
              isMinimalTech
                ? "p-8 rounded-sm bg-white border border-zinc-200 shadow-sm"
                : "p-10 rounded-[2rem] bg-black/20 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50",
            )}
            style={{ WebkitBackdropFilter: isMinimalTech ? undefined : "blur(40px)" }}
          >
          {/* INTRO */}
          {scene.type === "intro_view" && scene.intro_content && (
            <div className="space-y-6">
              <h2
                className={cn(
                  "text-sm tracking-widest uppercase mb-2",
                  isMinimalTech ? "text-zinc-400 font-mono" : "text-white/50",
                )}
              >
                {scene.intro_content.subtitle}
              </h2>
              <h1
                className={cn(
                  "text-5xl md:text-7xl font-bold",
                  isMinimalTech ? "text-zinc-900 font-mono" : "text-white",
                )}
              >
                {scene.intro_content.title}
              </h1>
              <div className="flex gap-4">
                <button
                  onClick={startExperience}
                  className={cn(
                    "px-8 py-3 font-medium transition-all active:scale-[0.98]",
                    isMinimalTech
                      ? "rounded-sm font-mono tracking-widest text-sm uppercase bg-zinc-900 text-white hover:bg-zinc-800"
                      : "rounded-full tracking-wide bg-white text-black hover:bg-white/90",
                  )}
                >
                  {scene.intro_content.start_button_label || "Start"}
                </button>
              </div>
            </div>
          )}

          {/* SLIDE & TECH VIEW */}
          {(scene.type === "slide_view" || scene.type === "tech_view") &&
            scene.slide_content && (
              <div className="space-y-6">
                {/* Badges */}
                {scene.slide_content.badges &&
                  scene.slide_content.badges.length > 0 && (
                    <div
                      className={cn(
                        "flex gap-3 mb-6",
                        scene.type === "tech_view"
                          ? cardPosition === "center"
                            ? "justify-center"
                            : cardPosition === "left"
                              ? "justify-start"
                              : "justify-end"
                          : cardPosition === "center"
                            ? "justify-center"
                            : cardPosition === "right"
                              ? "justify-end"
                              : "justify-start",
                      )}
                    >
                      {scene.slide_content.badges.map((badge, i) => {
                        const Icon = getBadgeIcon(badge);
                        const colorClass = getBadgeColor(badge, isMinimalTech);
                        const isHovered = activeBadgeIndex === i;
                        const badgeImageUrl = getBadgeImageUrl(badge);

                        return (
                          <div
                            key={i}
                            className="relative group"
                            onMouseEnter={() => setActiveBadgeIndex(i)}
                            onMouseLeave={() => setActiveBadgeIndex(null)}
                          >
                            <div
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all duration-300 cursor-help border",
                                isMinimalTech
                                  ? "rounded-sm font-mono"
                                  : "rounded-full",
                                colorClass,
                              )}
                            >
                              <Icon size={14} />
                              <span>{badge.label}</span>
                            </div>

                            <AnimatePresence>
                              {isHovered && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                  className={cn(
                                    "absolute bottom-full mb-3 w-72 z-50",
                                    cardPosition === "right" ||
                                      scene.type === "tech_view"
                                      ? "right-0"
                                      : "left-0",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "p-4",
                                      isMinimalTech
                                        ? "bg-white border border-zinc-200 rounded-sm shadow-lg"
                                        : "bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl",
                                    )}
                                    style={{ WebkitBackdropFilter: isMinimalTech ? undefined : "blur(24px)" }}
                                  >
                                  {badgeImageUrl ? (
                                    <div className="flex gap-3">
                                      <div
                                        className={cn(
                                          "w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center shrink-0",
                                          isMinimalTech
                                            ? "bg-zinc-100"
                                            : "bg-white",
                                        )}
                                      >
                                        <img
                                          src={badgeImageUrl}
                                          alt={badge.label}
                                          className="w-full h-full object-contain"
                                          style={{ mixBlendMode: "multiply" }}
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <h4
                                          className={cn(
                                            "font-bold text-sm mb-1.5",
                                            isMinimalTech
                                              ? "text-zinc-900"
                                              : "text-white",
                                          )}
                                        >
                                          {badge.label}
                                        </h4>
                                        <p
                                          className={cn(
                                            "text-xs leading-relaxed flex items-center gap-1.5",
                                            isMinimalTech
                                              ? "text-zinc-500"
                                              : "text-white/60",
                                          )}
                                        >
                                          {(!badge.evidence ||
                                            badge.evidence ===
                                              "Verified Feature") && (
                                            <CheckCircle2
                                              className={cn(
                                                "size-3.5 shrink-0",
                                                isMinimalTech
                                                  ? "text-zinc-400"
                                                  : "text-white/60",
                                              )}
                                            />
                                          )}
                                          {badge.evidence || "Verified Feature"}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    // Fallback to Icon Layout
                                    <div className="flex gap-3">
                                      <div
                                        className={cn(
                                          "p-2.5 rounded-lg shrink-0",
                                          isMinimalTech
                                            ? "bg-zinc-100"
                                            : "bg-white/10",
                                        )}
                                      >
                                        <Icon
                                          size={20}
                                          className={
                                            isMinimalTech
                                              ? "text-zinc-700"
                                              : "text-white"
                                          }
                                        />
                                      </div>
                                      <div>
                                        <h4
                                          className={cn(
                                            "font-bold text-sm mb-1",
                                            isMinimalTech
                                              ? "text-zinc-900"
                                              : "text-white",
                                          )}
                                        >
                                          {badge.label}
                                        </h4>
                                        <p
                                          className={cn(
                                            "text-xs leading-snug flex items-center gap-1.5",
                                            isMinimalTech
                                              ? "text-zinc-500"
                                              : "text-white/60",
                                          )}
                                        >
                                          {(!badge.evidence ||
                                            badge.evidence ===
                                              "Verified Feature") && (
                                            <CheckCircle2
                                              className={cn(
                                                "size-3.5 shrink-0",
                                                isMinimalTech
                                                  ? "text-zinc-400"
                                                  : "text-white/60",
                                              )}
                                            />
                                          )}
                                          {badge.evidence || "Verified Feature"}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}

                <h1
                  className={cn(
                    "mb-4 text-3xl",
                    isMinimalTech
                      ? "font-mono font-bold tracking-wide uppercase text-zinc-900"
                      : "font-semibold tracking-tight text-white",
                  )}
                  style={{ lineHeight: "1.15" }}
                >
                  {scene.slide_content.headline}
                </h1>

                <p
                  className={cn(
                    "leading-relaxed font-normal text-base",
                    isMinimalTech ? "text-zinc-600" : "text-white/70",
                  )}
                >
                  {scene.slide_content.paragraph}
                </p>

                {/* --- SMART STATS RENDERER (UPDATED) --- */}
                {scene.slide_content.key_stats && (
                  <div
                    className={cn(
                      "flex justify-between flex-wrap gap-x-8 gap-y-6 mt-8 pt-6 border-t",
                      isMinimalTech ? "border-zinc-200" : "border-white/10",
                    )}
                  >
                    {scene.slide_content.key_stats.map((stat, i) => {
                      // 1. CLEANING LOGIC
                      let displayValue = String(stat.value || "--").trim();
                      let displayUnit = (stat.unit || "").trim();
                      let valueColor = isMinimalTech
                        ? "text-zinc-900"
                        : "text-white";

                      const valLower = displayValue.toLowerCase();
                      const unitLower = displayUnit.toLowerCase();

                      // A. Map Booleans / Statuses / Typos
                      if (
                        ["yes", "true", "present", "active"].includes(valLower)
                      ) {
                        displayValue = "Active";
                        valueColor = isMinimalTech
                          ? "text-emerald-600"
                          : "text-emerald-400";
                      } else if (["no", "false", "absent"].includes(valLower)) {
                        displayValue = "N/A";
                        valueColor = "text-zinc-500";
                      } else if (
                        [
                          "standard",
                          "included",
                          "std",
                          "standar",
                          "standart",
                        ].includes(valLower)
                      ) {
                        displayValue = "Standard";
                        valueColor = isMinimalTech
                          ? "text-blue-600"
                          : "text-blue-400";
                      }

                      // B. Suppress Filler Units
                      // If unit is "feature", "system", "type", or matches the value, hide it
                      const fillerUnits = [
                        "feature",
                        "features",
                        "system",
                        "type",
                        "mode",
                        "std",
                        "standard",
                        "count",
                        "units",
                        "rating",
                        "capacity",
                        "option",
                        "available",
                        "enabled",
                        "included",
                      ];
                      if (
                        fillerUnits.includes(unitLower) ||
                        unitLower === valLower ||
                        unitLower.includes(valLower)
                      ) {
                        displayUnit = "";
                      }

                      return (
                        <div
                          key={i}
                          className="flex flex-col gap-1 min-w-[80px]"
                        >
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className={cn(
                                "text-3xl font-semibold leading-none",
                                isMinimalTech && "font-mono tracking-tight",
                                valueColor,
                              )}
                            >
                              {displayValue}
                            </span>
                            {displayUnit && (
                              <span
                                className={cn(
                                  "text-sm font-medium leading-none",
                                  isMinimalTech
                                    ? "text-zinc-400"
                                    : "text-white/40",
                                )}
                              >
                                {displayUnit}
                              </span>
                            )}
                          </div>
                          <div
                            className={cn(
                              "text-xs uppercase tracking-widest font-bold leading-tight",
                              isMinimalTech
                                ? "font-mono text-zinc-500"
                                : "text-white/50",
                            )}
                          >
                            {stat.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          {/* OUTRO */}
          {scene.type === "outro_view" && scene.outro_content && (
            <div className="space-y-8 text-center w-full flex flex-col items-center">
              <h1
                className={cn(
                  "text-5xl md:text-6xl font-semibold",
                  isMinimalTech ? "text-zinc-900 font-mono" : "text-white",
                )}
              >
                {scene.outro_content.headline}
              </h1>
              <p
                className={cn(
                  "text-lg",
                  isMinimalTech ? "text-zinc-500" : "text-white/60",
                )}
              >
                {scene.outro_content.subheadline}
              </p>
              <div className="flex gap-3 mt-6">
                {scene.outro_content.cta_buttons.map((btn, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (btn.action === "REPLAY_STORY") goToScene(0);
                    }}
                    className={cn(
                      "px-8 py-3 font-medium transition-all",
                      isMinimalTech
                        ? "rounded-sm font-mono tracking-widest text-sm uppercase"
                        : "rounded-full tracking-wide",
                      btn.style === "primary"
                        ? isMinimalTech
                          ? "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]"
                          : "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
                        : isMinimalTech
                          ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                          : "bg-white/10 text-white hover:bg-white/20",
                    )}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
