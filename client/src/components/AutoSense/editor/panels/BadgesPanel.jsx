import React from "react";
import { cn } from "../../../../lib/utils";
import { useStoryStore } from "../../../../store/useStoryStore";
import { useEditorStore } from "../../store/useEditorStore";
import {
  ShieldCheck,
  Zap,
  Leaf,
  Award,
  Smartphone,
  Trophy,
  Check,
  Circle,
} from "lucide-react";

const getCategoryIcon = (cat) => {
  const c = (cat || "").toUpperCase();
  if (c === "SAFETY") return ShieldCheck;
  if (c === "PERFORMANCE" || c === "SPORT") return Zap;
  if (c === "ECO" || c === "REGULATORY") return Leaf;
  if (c === "AWARD" || c === "VALUE") return Award;
  if (c === "TECHNOLOGY") return Smartphone;
  if (c === "RELIABILITY" || c === "LUXURY") return Trophy;
  return Circle;
};

const getCategoryColor = (cat) => {
  const c = (cat || "").toUpperCase();
  if (c === "SAFETY") return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  if (c === "PERFORMANCE")
    return "text-red-400 bg-red-500/10 border-red-500/30";
  if (c === "ECO" || c === "REGULATORY")
    return "text-green-400 bg-green-500/10 border-green-500/30";
  if (c === "AWARD" || c === "VALUE")
    return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  if (c === "TECHNOLOGY")
    return "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
  if (c === "RELIABILITY")
    return "text-purple-400 bg-purple-500/10 border-purple-500/30";
  if (c === "LUXURY")
    return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
  return "text-zinc-400 bg-white/5 border-white/10";
};

export const BadgesPanel = () => {
  const { getCurrentScene, updateCurrentScene, storyData } = useStoryStore();
  const { markDirty } = useEditorStore();
  const scene = getCurrentScene();

  if (!scene) return null;

  // All available badges from the story (populated by ingestion)
  const allBadges = storyData?.badges || [];
  // Currently selected badges for this scene
  const sceneBadges = scene.slide_content?.badges || [];
  const selectedIds = new Set(sceneBadges.map((b) => b.id));

  const toggleBadge = (badge) => {
    let newBadges;
    if (selectedIds.has(badge.id)) {
      newBadges = sceneBadges.filter((b) => b.id !== badge.id);
    } else {
      newBadges = [...sceneBadges, badge];
    }
    updateCurrentScene({ slide_content: { badges: newBadges } });
    markDirty();
  };

  // Group badges by category
  const grouped = {};
  allBadges.forEach((badge) => {
    const cat = badge.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(badge);
  });

  if (allBadges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Award size={32} className="text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-400 font-medium">No Badges Available</p>
        <p className="text-xs text-zinc-600 mt-1">
          Badges are collected during story generation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionLabel>Scene Badges</SectionLabel>
        <span className="text-[10px] text-zinc-500 font-medium">
          {sceneBadges.length} selected
        </span>
      </div>

      {Object.entries(grouped).map(([category, badges]) => {
        const Icon = getCategoryIcon(category);
        return (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon size={12} className="text-zinc-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                {category}
              </span>
            </div>
            <div className="space-y-1.5">
              {badges.map((badge) => {
                const isSelected = selectedIds.has(badge.id);
                const colorClass = getCategoryColor(badge.category);
                return (
                  <button
                    key={badge.id}
                    onClick={() => toggleBadge(badge)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                      isSelected
                        ? colorClass
                        : "bg-white/[0.03] border-white/5 text-zinc-400 hover:bg-white/5",
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "bg-white/20 border-white/30"
                          : "border-white/20",
                      )}
                    >
                      {isSelected && <Check size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {badge.label}
                      </p>
                      {badge.evidence &&
                        badge.evidence !== "Verified Feature" && (
                          <p className="text-[10px] opacity-60 truncate mt-0.5">
                            {badge.evidence}
                          </p>
                        )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
    {children}
  </h4>
);
