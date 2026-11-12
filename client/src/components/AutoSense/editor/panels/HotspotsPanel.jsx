import React, { useState } from "react";
import { Input, Textarea, Button, Divider } from "@heroui/react";
import { Plus, Trash2, Target, GripVertical, Move } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStoryStore } from "../../../../store/useStoryStore";
import { useEditorStore } from "../../store/useEditorStore";
import { v4 as uuidv4 } from "uuid";

export const HotspotsPanel = () => {
  const { getCurrentScene, updateCurrentScene } = useStoryStore();
  const {
    markDirty,
    draggingHotspotId,
    setDraggingHotspot,
    clearDraggingHotspot,
  } = useEditorStore();
  const scene = getCurrentScene();
  const [editingId, setEditingId] = useState(null);

  if (!scene) return null;

  const hotspots = scene.hotspots || [];

  const updateHotspots = (newHotspots) => {
    updateCurrentScene({ hotspots: newHotspots });
    markDirty();
  };

  const addHotspot = () => {
    const newHotspot = {
      id: `hs_${uuidv4().slice(0, 8)}`,
      x: 50,
      y: 50,
      label: "New Hotspot",
      icon: "circle",
      hover_content: {
        title: "Feature",
        body: "Describe this feature...",
      },
    };
    updateHotspots([...hotspots, newHotspot]);
    setEditingId(newHotspot.id);
    // Auto-enter drag mode so user can place it immediately
    setDraggingHotspot(newHotspot.id);
  };

  const removeHotspot = (id) => {
    updateHotspots(hotspots.filter((h) => h.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const updateHotspot = (id, updates) => {
    updateHotspots(
      hotspots.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    );
  };

  const updateHoverContent = (id, field, value) => {
    updateHotspots(
      hotspots.map((h) =>
        h.id === id
          ? { ...h, hover_content: { ...h.hover_content, [field]: value } }
          : h,
      ),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionLabel>Hotspots</SectionLabel>
        <Button
          size="sm"
          variant="flat"
          radius="full"
          className="bg-white/5 text-zinc-400 hover:bg-white/10 text-xs"
          startContent={<Plus size={12} />}
          onPress={addHotspot}
        >
          Add Hotspot
        </Button>
      </div>

      {hotspots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-white/10 rounded-xl">
          <Target size={28} className="text-zinc-600 mb-2" />
          <p className="text-xs text-zinc-500">No hotspots on this scene</p>
          <p className="text-[10px] text-zinc-600 mt-1">
            Add interactive points of interest
          </p>
        </div>
      )}

      {hotspots.map((hotspot, i) => {
        const isEditing = editingId === hotspot.id;
        return (
          <div
            key={hotspot.id}
            className={cn(
              "rounded-xl border transition-all overflow-hidden",
              isEditing
                ? "bg-primary/5 border-primary/30"
                : "bg-white/[0.03] border-white/10",
            )}
          >
            {/* Header */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
              onClick={() => setEditingId(isEditing ? null : hotspot.id)}
            >
              <GripVertical size={14} className="text-zinc-600" />
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">
                  {hotspot.label}
                </p>
                <p className="text-[10px] text-zinc-500">
                  x: {hotspot.x}% · y: {hotspot.y}%
                </p>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="text-zinc-500 hover:text-red-400"
                onPress={() => removeHotspot(hotspot.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>

            {/* Expanded Editor */}
            {isEditing && (
              <div className="px-3 pb-3 space-y-4 border-t border-white/5 pt-3">
                <Input
                  size="sm"
                  variant="bordered"
                  label="Label"
                  value={hotspot.label || ""}
                  onChange={(e) =>
                    updateHotspot(hotspot.id, { label: e.target.value })
                  }
                  classNames={{
                    inputWrapper: "bg-white/5 border-white/10 h-10",
                    input: "text-sm text-white",
                    label: "text-[10px] text-zinc-500",
                  }}
                />

                <Input
                  size="sm"
                  variant="bordered"
                  label="Icon (lucide name)"
                  value={hotspot.icon || "circle"}
                  onChange={(e) =>
                    updateHotspot(hotspot.id, { icon: e.target.value })
                  }
                  classNames={{
                    inputWrapper: "bg-white/5 border-white/10 h-10",
                    input: "text-sm text-white",
                    label: "text-[10px] text-zinc-500",
                  }}
                />

                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    Position
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (draggingHotspotId === hotspot.id) {
                          clearDraggingHotspot();
                        } else {
                          setDraggingHotspot(hotspot.id);
                        }
                      }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                        draggingHotspotId === hotspot.id
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:border-white/20",
                      )}
                    >
                      <Move size={12} />
                      {draggingHotspotId === hotspot.id
                        ? "Positioning..."
                        : "Drag to Position"}
                    </button>
                    <span className="text-[10px] text-zinc-600 tabular-nums whitespace-nowrap">
                      {hotspot.x}%, {hotspot.y}%
                    </span>
                  </div>
                </div>

                <Divider className="bg-white/5" />

                <Input
                  size="sm"
                  variant="bordered"
                  label="Hover Title"
                  value={hotspot.hover_content?.title || ""}
                  onChange={(e) =>
                    updateHoverContent(hotspot.id, "title", e.target.value)
                  }
                  classNames={{
                    inputWrapper: "bg-white/5 border-white/10 h-10",
                    input: "text-sm text-white",
                    label: "text-[10px] text-zinc-500",
                  }}
                />

                <Textarea
                  size="sm"
                  variant="bordered"
                  label="Hover Body"
                  minRows={2}
                  value={hotspot.hover_content?.body || ""}
                  onChange={(e) =>
                    updateHoverContent(hotspot.id, "body", e.target.value)
                  }
                  classNames={{
                    inputWrapper: "bg-white/5 border-white/10",
                    input: "text-sm text-white",
                    label: "text-[10px] text-zinc-500",
                  }}
                />
              </div>
            )}
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
