import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion"; // eslint-disable-line no-unused-vars
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
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Rotate3d,
} from "lucide-react";
import { useStoryStore } from "../../../store/useStoryStore";
import { useEditorStore } from "../store/useEditorStore";
import { cn } from "../../../lib/utils";

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

// ─── Badge helpers (mirrored from SlideContentLayer) ──────────────────────────
const getBadgeIcon = (badge) => {
  const id = badge.id?.toUpperCase() || "";
  const cat = badge.category?.toUpperCase() || "";
  if (id.includes("CARPLAY") || id.includes("ANDROID")) return Smartphone;
  if (id.includes("BLUETOOTH")) return Bluetooth;
  if (id.includes("WIFI")) return Wifi;
  if (id.includes("NHTSA") || id.includes("NCAP")) return ShieldCheck;
  if (id.includes("JDPOWER") || id.includes("KBB")) return Trophy;
  if (cat === "SAFETY") return ShieldCheck;
  if (cat === "PERFORMANCE" || cat === "SPORT" || id.includes("HP")) return Zap;
  if (cat === "ECO" || cat === "EFFICIENCY" || id.includes("EV")) return Leaf;
  if (cat === "AWARD") return Award;
  if (cat === "TECHNOLOGY") return Smartphone;
  return Circle;
};

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

// ─── Stat value cleaning (mirrored from SlideContentLayer) ────────────────────
const cleanStatValue = (stat) => {
  let displayValue = String(stat.value || "--").trim();
  let displayUnit = (stat.unit || "").trim();
  let valueColor = "text-white";

  const valLower = displayValue.toLowerCase();
  const unitLower = displayUnit.toLowerCase();

  if (["yes", "true", "present", "active"].includes(valLower)) {
    displayValue = "Active";
    valueColor = "text-emerald-400";
  } else if (["no", "false", "absent"].includes(valLower)) {
    displayValue = "N/A";
    valueColor = "text-zinc-500";
  } else if (
    ["standard", "included", "std", "standar", "standart"].includes(valLower)
  ) {
    displayValue = "Standard";
    valueColor = "text-blue-400";
  }

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

  return { displayValue, displayUnit, valueColor };
};

/**
 * InlineEditOverlay
 * Renders editable fields on top of the live preview,
 * using the EXACT same glass-card layout as SlideContentLayer
 * so the editor looks identical to the final output.
 */
export const InlineEditOverlay = () => {
  const {
    getCurrentScene,
    activeCameraView,
    setCameraView,
    setFreeRoam,
    storyData,
    currentSceneIndex,
    activeHotspotId,
  } = useStoryStore();
  const { clearEditingField, draggingHotspotId, batchLoadingScenes } =
    useEditorStore();
  const scene = getCurrentScene();

  if (!scene) return null;

  // Hide the entire overlay while a hotspot is being positioned
  if (draggingHotspotId) return null;

  const isLoading = batchLoadingScenes.has(currentSceneIndex);

  // Theme detection — per-scene override wins, then global template fallback
  const isMinimalTech =
    scene.layout?.theme != null
      ? scene.layout.theme === "minimal_tech"
      : (storyData?.meta?.template || "")
          .toLowerCase()
          .replace(/[\s-]/g, "") === "minimaltech";

  const cardPosition = resolveCardPosition(scene);
  const isCardHidden =
    (scene.type === "slide_view" || scene.type === "tech_view") &&
    cardPosition === "hidden";

  return (
    <div
      className={cn(
        "absolute inset-0 z-40 flex flex-col justify-center p-6 md:p-20",
        "pointer-events-none",
        isLoading
          ? "opacity-0"
          : activeHotspotId
            ? "opacity-20 blur-sm grayscale transition-all duration-300"
            : "opacity-100 blur-0 grayscale-0 transition-all duration-300",
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
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) clearEditingField();
      }}
    >
      {/* ── Tech View Camera Controls — above the glass card ── */}
      {scene.type === "tech_view" && (
        <TechCameraControls
          scene={scene}
          activeCameraView={activeCameraView}
          setCameraView={setCameraView}
          setFreeRoam={setFreeRoam}
          isMinimalTech={isMinimalTech}
          isCardHidden={isCardHidden}
          cardPosition={cardPosition}
        />
      )}

      {/* ── Glass container — matches SlideContentLayer exactly ── */}
      {!isCardHidden && (
        <div
          className={cn(
            "max-w-xl w-full pointer-events-auto",
            isMinimalTech
              ? "p-8 rounded-sm bg-white border border-zinc-200 shadow-sm"
              : "p-10 rounded-[2rem] bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50",
          )}
          style={{ WebkitBackdropFilter: isMinimalTech ? undefined : "blur(40px)" }}
        >
          {/* INTRO VIEW */}
          {scene.type === "intro_view" && scene.intro_content && (
            <IntroEditor scene={scene} isMinimalTech={isMinimalTech} />
          )}

          {/* SLIDE & TECH VIEW */}
          {(scene.type === "slide_view" || scene.type === "tech_view") &&
            scene.slide_content && (
              <SlideEditor
                scene={scene}
                alignment={cardPosition}
                isMinimalTech={isMinimalTech}
              />
            )}

          {/* OUTRO VIEW */}
          {scene.type === "outro_view" && scene.outro_content && (
            <OutroEditor scene={scene} isMinimalTech={isMinimalTech} />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Tech Camera Controls (mirrored from SlideContentLayer) ──────────────────
const TechCameraControls = ({
  scene,
  activeCameraView,
  setCameraView,
  setFreeRoam,
  isMinimalTech = false,
  isCardHidden = false,
  cardPosition = "right",
}) => {
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
  );
};

// ─── Editable Text Field ──────────────────────────────────────────────────────
const EditableField = ({
  field,
  value,
  onSave,
  placeholder,
  as = "input",
  className = "",
  inputClassName = "",
  style,
}) => {
  const { editingField, setEditingField, clearEditingField } = useEditorStore();
  const isEditing = editingField === field;
  const ref = useRef(null);
  const sizerRef = useRef(null);

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus();
      // Place cursor at end of text
      ref.current.selectionStart = ref.current.value.length;
      ref.current.selectionEnd = ref.current.value.length;
    }
  }, [isEditing]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (!isEditing) setEditingField(field);
      }}
      style={style}
      className={cn(
        "relative rounded-lg transition-all",
        isEditing
          ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-transparent"
          : "cursor-text group hover:ring-2 hover:ring-primary/40 hover:ring-offset-2 hover:ring-offset-transparent",
        className,
      )}
    >
      {/* Sizer — keeps layout stable; invisible when editing but still reserves space */}
      <span
        ref={sizerRef}
        className={cn(inputClassName, "whitespace-pre-wrap break-words")}
        aria-hidden="true"
        style={{
          ...style,
          visibility: isEditing ? "hidden" : "visible",
          display: "block",
          minHeight: as === "textarea" ? "4.5em" : undefined,
        }}
      >
        {isEditing
          ? value || placeholder || "\u00A0"
          : value || (
              <span className="text-white/20 italic">{placeholder}</span>
            )}
      </span>

      {/* Textarea overlaid exactly on top when editing (always textarea so text wraps) */}
      {isEditing && (
        <textarea
          ref={ref}
          value={value || ""}
          onChange={(e) => onSave(e.target.value)}
          onBlur={clearEditingField}
          onKeyDown={(e) => {
            if (e.key === "Enter" && as !== "textarea") {
              e.preventDefault();
              clearEditingField();
            }
            if (e.key === "Escape") clearEditingField();
          }}
          placeholder={placeholder}
          style={{
            ...style,
            // Match the wrapper's padding so text aligns with the sizer
            padding: "inherit",
          }}
          className={cn(
            "absolute inset-0 w-full h-full",
            "bg-transparent outline-none resize-none",
            "caret-primary selection:bg-primary/30",
            as !== "textarea" && "overflow-hidden",
            inputClassName,
          )}
          rows={as === "textarea" ? 3 : 1}
        />
      )}

      {/* Pencil icon on hover */}
      {!isEditing && (
        <span className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary rounded-full p-1 z-10">
          <Pencil size={10} className="text-white" />
        </span>
      )}
    </div>
  );
};

// ─── INTRO EDITOR ─────────────────────────────────────────────────────────────
const IntroEditor = ({ scene, isMinimalTech = false }) => {
  const { updateCurrentScene } = useStoryStore();
  const { markDirty } = useEditorStore();
  const c = scene.intro_content;

  const update = (field, value) => {
    updateCurrentScene({ intro_content: { [field]: value } });
    markDirty();
  };

  return (
    <div className="space-y-6">
      <EditableField
        field="subtitle"
        value={c.subtitle}
        onSave={(v) => update("subtitle", v)}
        placeholder="Subtitle..."
        className="mb-2"
        inputClassName={cn(
          "text-sm tracking-widest uppercase",
          isMinimalTech ? "text-zinc-400 font-mono" : "text-white/50",
        )}
      />
      <EditableField
        field="title"
        value={c.title}
        onSave={(v) => update("title", v)}
        placeholder="Title..."
        inputClassName={cn(
          "text-5xl md:text-7xl font-bold",
          isMinimalTech ? "text-zinc-900 font-mono" : "text-white",
        )}
      />
      <EditableField
        field="start_button_label"
        value={c.start_button_label || "Start"}
        onSave={(v) => update("start_button_label", v)}
        placeholder="Button label..."
        className={cn(
          "inline-block px-8 py-3 font-medium",
          isMinimalTech
            ? "rounded-sm font-mono tracking-widest text-sm uppercase bg-zinc-900 text-white"
            : "bg-white text-black rounded-full tracking-wide",
        )}
        inputClassName="text-base font-medium"
      />
    </div>
  );
};

// ─── SLIDE / TECH EDITOR ──────────────────────────────────────────────────────
const SlideEditor = ({ scene, alignment, isMinimalTech = false }) => {
  const { updateCurrentScene } = useStoryStore();
  const { markDirty } = useEditorStore();
  const [activeBadgeIndex, setActiveBadgeIndex] = useState(null);
  const c = scene.slide_content;

  const update = (field, value) => {
    updateCurrentScene({ slide_content: { [field]: value } });
    markDirty();
  };

  const updateStat = (idx, key, value) => {
    const stats = [...(c.key_stats || [])];
    stats[idx] = { ...stats[idx], [key]: value };
    update("key_stats", stats);
  };

  const addStat = () => {
    const stats = [...(c.key_stats || []), { value: "0", label: "Label" }];
    update("key_stats", stats);
  };

  const removeStat = (idx) => {
    const stats = (c.key_stats || []).filter((_, i) => i !== idx);
    update("key_stats", stats);
  };

  return (
    <div className="space-y-6">
      {/* Badges — identical styling to SlideContentLayer */}
      {c.badges && c.badges.length > 0 && (
        <div
          className={cn(
            "flex gap-3 mb-6",
            scene.type === "tech_view"
              ? "justify-end"
              : alignment === "center"
                ? "justify-center"
                : alignment === "right"
                  ? "justify-end"
                  : "justify-start",
          )}
        >
          {c.badges.map((badge, i) => {
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
                    isMinimalTech ? "rounded-sm font-mono" : "rounded-full",
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
                        alignment === "right" || scene.type === "tech_view"
                          ? "right-0"
                          : "left-0",
                      )}
                    >
                      <div
                        className="p-4 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl"
                        style={{ WebkitBackdropFilter: "blur(24px)" }}
                      >
                      {badgeImageUrl ? (
                        <div className="flex gap-3">
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-white flex items-center justify-center shrink-0">
                            <img
                              src={badgeImageUrl}
                              alt={badge.label}
                              className="w-full h-full object-contain"
                              style={{ mixBlendMode: "multiply" }}
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-white font-bold text-sm mb-1.5">
                              {badge.label}
                            </h4>
                            <p className="text-xs text-white/60 leading-relaxed flex items-center gap-1.5">
                              {(!badge.evidence ||
                                badge.evidence === "Verified Feature") && (
                                <CheckCircle2 className="size-3.5 text-white/60 shrink-0" />
                              )}
                              {badge.evidence || "Verified Feature"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <div className="p-2.5 rounded-lg shrink-0 bg-white/10">
                            <Icon size={20} className="text-white" />
                          </div>
                          <div>
                            <h4 className="text-white font-bold text-sm mb-1">
                              {badge.label}
                            </h4>
                            <p className="text-xs text-white/60 leading-snug flex items-center gap-1.5">
                              {(!badge.evidence ||
                                badge.evidence === "Verified Feature") && (
                                <CheckCircle2 className="size-3.5 text-white/60 shrink-0" />
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

      {/* Headline */}
      <EditableField
        field="headline"
        value={c.headline}
        onSave={(v) => update("headline", v)}
        placeholder="Headline..."
        className="mb-4"
        inputClassName={cn(
          "text-3xl",
          isMinimalTech
            ? "font-mono font-bold tracking-wide uppercase text-zinc-900"
            : "font-semibold tracking-tight text-white",
        )}
        style={{ lineHeight: "1.15" }}
      />

      {/* Paragraph */}
      <EditableField
        field="paragraph"
        value={c.paragraph}
        onSave={(v) => update("paragraph", v)}
        placeholder="Write a paragraph..."
        as="textarea"
        inputClassName={cn(
          "leading-relaxed font-normal text-base",
          isMinimalTech ? "text-zinc-600" : "text-white/70",
        )}
      />

      {/* Stats — matches SlideContentLayer spacing */}
      {c.key_stats && c.key_stats.length > 0 && (
        <div
          className={cn(
            "flex justify-between flex-wrap gap-x-8 gap-y-6 mt-8 pt-6 border-t",
            isMinimalTech ? "border-zinc-200" : "border-white/10",
          )}
        >
          {c.key_stats.map((stat, i) => (
            <StatEditor
              key={i}
              index={i}
              stat={stat}
              isMinimalTech={isMinimalTech}
              onUpdateValue={(v) => updateStat(i, "value", v)}
              onUpdateLabel={(v) => updateStat(i, "label", v)}
              onRemove={() => removeStat(i)}
            />
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              addStat();
            }}
            className="flex items-center gap-1 text-zinc-500 hover:text-primary text-xs transition-colors self-center"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      )}

      {(!c.key_stats || c.key_stats.length === 0) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            addStat();
          }}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-primary text-xs mt-4 transition-colors"
        >
          <Plus size={14} /> Add Key Stat
        </button>
      )}
    </div>
  );
};

// ─── STAT INLINE EDITOR ──────────────────────────────────────────────────────
const StatEditor = ({
  index,
  stat,
  isMinimalTech = false,
  onUpdateValue,
  onUpdateLabel,
  onRemove,
}) => {
  const { markDirty } = useEditorStore();
  const { displayUnit, valueColor } = cleanStatValue(stat);

  const valueField = `stat-value-${index}`;
  const labelField = `stat-label-${index}`;

  return (
    <div className="flex flex-col gap-1 min-w-[80px] group relative">
      <div className="flex items-baseline gap-1.5">
        <EditableField
          field={valueField}
          value={stat.value}
          onSave={(v) => {
            onUpdateValue(v);
            markDirty();
          }}
          placeholder="Value"
          inputClassName={cn(
            "text-3xl font-semibold leading-none",
            isMinimalTech && "font-mono tracking-tight",
            isMinimalTech ? "text-zinc-900" : valueColor,
          )}
        />
        {displayUnit && (
          <span
            className={cn(
              "text-sm font-medium leading-none",
              isMinimalTech ? "text-zinc-400" : "text-white/40",
            )}
          >
            {displayUnit}
          </span>
        )}
      </div>
      <EditableField
        field={labelField}
        value={stat.label}
        onSave={(v) => {
          onUpdateLabel(v);
          markDirty();
        }}
        placeholder="Label"
        inputClassName={cn(
          "text-xs uppercase tracking-widest font-bold leading-tight",
          isMinimalTech ? "font-mono text-zinc-500" : "text-white/50",
        )}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
          markDirty();
        }}
        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 w-5 h-5 bg-rose-500/80 rounded-full flex items-center justify-center transition-opacity"
      >
        <Trash2 size={10} className="text-white" />
      </button>
    </div>
  );
};

// ─── OUTRO EDITOR ─────────────────────────────────────────────────────────────
const OutroEditor = ({ scene, isMinimalTech = false }) => {
  const { updateCurrentScene } = useStoryStore();
  const { markDirty } = useEditorStore();
  const c = scene.outro_content;

  const update = (field, value) => {
    updateCurrentScene({ outro_content: { [field]: value } });
    markDirty();
  };

  return (
    <div className="space-y-8 text-center w-full flex flex-col items-center">
      <EditableField
        field="headline"
        value={c.headline}
        onSave={(v) => update("headline", v)}
        placeholder="Headline..."
        inputClassName={cn(
          "text-5xl md:text-6xl font-semibold",
          isMinimalTech ? "text-zinc-900 font-mono" : "text-white",
        )}
      />
      <EditableField
        field="subheadline"
        value={c.subheadline}
        onSave={(v) => update("subheadline", v)}
        placeholder="Subheadline..."
        inputClassName={cn(
          "text-lg",
          isMinimalTech ? "text-zinc-500" : "text-white/60",
        )}
      />
      {/* CTA buttons — editable labels */}
      {c.cta_buttons && c.cta_buttons.length > 0 && (
        <div className="flex gap-3 mt-6">
          {c.cta_buttons.map((btn, i) => (
            <EditableField
              key={i}
              field={`cta-${i}`}
              value={btn.label}
              onSave={(v) => {
                const buttons = [...c.cta_buttons];
                buttons[i] = { ...buttons[i], label: v };
                update("cta_buttons", buttons);
              }}
              placeholder="Button..."
              className={cn(
                "px-8 py-3 font-medium",
                isMinimalTech ? "rounded-sm" : "rounded-full tracking-wide",
                btn.style === "primary"
                  ? isMinimalTech
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-black"
                  : isMinimalTech
                    ? "bg-zinc-100 text-zinc-700 border border-zinc-200"
                    : "bg-white/10 text-white",
              )}
              inputClassName="text-base font-medium"
            />
          ))}
        </div>
      )}
    </div>
  );
};
