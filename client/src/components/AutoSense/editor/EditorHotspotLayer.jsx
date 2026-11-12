import React, { useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion"; // eslint-disable-line no-unused-vars
import { useStoryStore } from "../../../store/useStoryStore";
import { useEditorStore } from "../store/useEditorStore";
import { cn } from "../../../lib/utils";
import { X, Move } from "lucide-react";
import * as Icons from "lucide-react";
import { PearlyHoverCard } from "../interactive/PearlyHoverCard";

const toPascalCase = (str) => {
  if (!str) return "Circle";
  return str.replace(/(^\w|-\w)/g, (g) => g.replace(/-/, "").toUpperCase());
};

/**
 * EditorHotspotLayer
 * Renders draggable hotspot dots in the editor preview.
 * When a hotspot is selected (draggingHotspotId), the glass info card hides
 * and the user can drag the hotspot to reposition it.
 */
export const EditorHotspotLayer = () => {
  const { getCurrentScene, updateCurrentScene, currentSceneIndex } =
    useStoryStore();
  const {
    draggingHotspotId,
    setDraggingHotspot,
    markDirty,
    batchLoadingScenes,
    regeneratingScenes,
  } = useEditorStore();
  const { setActiveHotspot } = useStoryStore();
  const containerRef = useRef(null);
  const scene = getCurrentScene();

  if (!scene || scene.type !== "slide_view") return null;

  // Hide hotspots while batch regen (theme/translate) or per-scene regen is active
  if (
    batchLoadingScenes.has(currentSceneIndex) ||
    regeneratingScenes.has(currentSceneIndex)
  )
    return null;

  const hotspots = scene.hotspots || [];
  if (hotspots.length === 0) return null;

  const { storyData } = useStoryStore.getState();
  const isMinimalTech =
    scene.layout?.theme != null
      ? scene.layout.theme === "minimal_tech"
      : (storyData?.meta?.template || "")
          .toLowerCase()
          .replace(/[\s-]/g, "") === "minimaltech";

  const updateHotspotPosition = (id, x, y) => {
    const clamped = {
      x: Math.round(Math.max(2, Math.min(98, x))),
      y: Math.round(Math.max(2, Math.min(98, y))),
    };
    const updated = hotspots.map((h) =>
      h.id === id ? { ...h, ...clamped } : h,
    );
    updateCurrentScene({ hotspots: updated });
    markDirty();
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-none"
    >
      {hotspots.map((hotspot) => (
        <DraggableHotspot
          key={hotspot.id}
          hotspot={hotspot}
          containerRef={containerRef}
          isSelected={draggingHotspotId === hotspot.id}
          isDragMode={!!draggingHotspotId}
          isMinimalTech={isMinimalTech}
          onSelect={() =>
            setDraggingHotspot(
              draggingHotspotId === hotspot.id ? null : hotspot.id,
            )
          }
          onUpdatePosition={(x, y) => updateHotspotPosition(hotspot.id, x, y)}
          onHover={(id) => setActiveHotspot(id)}
        />
      ))}
    </div>
  );
};

/**
 * HotspotDragBar
 * Instruction bar shown in EditorView (fixed, not inside Ken Burns).
 * Separated so it doesn't move with the image animation.
 */
export const HotspotDragBar = () => {
  const { draggingHotspotId, clearDraggingHotspot } = useEditorStore();

  return (
    <AnimatePresence>
      {draggingHotspotId && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
        >
          <div className="flex items-center gap-3 px-4 py-2 bg-black/80 backdrop-blur-2xl border border-primary/30 rounded-xl shadow-2xl">
            <Move size={14} className="text-primary" />
            <span className="text-xs text-white font-medium">
              Drag to reposition hotspot
            </span>
            <button
              onClick={clearDraggingHotspot}
              className="ml-2 p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Individual Draggable Hotspot ─────────────────────────────────────────────
const DraggableHotspot = ({
  hotspot,
  containerRef,
  isSelected,
  isDragMode,
  isMinimalTech = false,
  onSelect,
  onUpdatePosition,
  onHover,
}) => {
  const dragRef = useRef(null);
  const isDragging = useRef(false);
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = Icons[toPascalCase(hotspot.icon)] || Icons.Circle;

  // Determine hover card position based on hotspot location
  let cardPosition = "right";
  if (hotspot.y > 75) cardPosition = "top";
  else if (hotspot.x < 30) cardPosition = "right";
  else if (hotspot.x > 70) cardPosition = "left";

  const handlePointerDown = useCallback(
    (e) => {
      if (!isSelected) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;

      const container = containerRef.current;
      if (!container) return;

      const onPointerMove = (moveEvent) => {
        if (!isDragging.current || !container) return;
        const rect = container.getBoundingClientRect();
        const x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
        const y = ((moveEvent.clientY - rect.top) / rect.height) * 100;
        onUpdatePosition(x, y);
      };

      const onPointerUp = () => {
        isDragging.current = false;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [isSelected, containerRef, onUpdatePosition],
  );

  return (
    <div
      ref={dragRef}
      className={cn(
        "absolute pointer-events-auto",
        isSelected
          ? "z-30 cursor-grab active:cursor-grabbing"
          : "z-10 cursor-pointer",
      )}
      style={{
        left: `${hotspot.x}%`,
        top: `${hotspot.y}%`,
        transform: "translate(-50%, -50%)",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={handlePointerDown}
      onMouseEnter={() => {
        if (!isDragMode) {
          setIsHovered(true);
          onHover?.(hotspot.id);
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHover?.(null);
      }}
    >
      {/* Outer ring pulse */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full border-2",
          isMinimalTech
            ? isSelected
              ? "border-blue-600"
              : "border-white"
            : isSelected
              ? "border-primary/60"
              : "border-white/40",
        )}
        style={{ margin: isMinimalTech ? "-4px" : "-4px" }}
        animate={
          isMinimalTech
            ? { scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }
            : isSelected
              ? { scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }
              : { scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }
        }
        transition={
          isMinimalTech
            ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
            : { duration: 2, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {/* Core dot — plain, no icon */}
      {isMinimalTech ? (
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-all duration-100",
            isSelected ? "bg-blue-600" : "bg-white",
          )}
        />
      ) : (
        <motion.div
          className={cn(
            "w-4 h-4 rounded-full transition-all duration-200",
            isSelected
              ? "bg-primary shadow-[0_0_15px_rgba(108,92,231,0.8)] ring-2 ring-primary/40 ring-offset-2 ring-offset-transparent"
              : "bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)]",
          )}
          whileHover={!isSelected ? { scale: 1.2 } : {}}
          whileTap={isSelected ? { scale: 0.9 } : {}}
        />
      )}

      {/* Hover card — only when NOT in drag mode */}
      <PearlyHoverCard
        isVisible={isHovered && !isDragMode}
        title={hotspot.hover_content?.title}
        body={hotspot.hover_content?.body}
        icon={IconComponent}
        position={cardPosition}
        isMinimalTech={isMinimalTech}
      />

      {/* Label + coords tooltip when selected for dragging */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <div className="px-2.5 py-1 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg text-white text-[10px] font-bold">
              {hotspot.label}
              <span className="text-zinc-500 ml-1.5">
                ({hotspot.x}%, {hotspot.y}%)
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invisible hit area for easier interaction */}
      <div className="absolute inset-0 -m-4 bg-transparent rounded-full" />
    </div>
  );
};
