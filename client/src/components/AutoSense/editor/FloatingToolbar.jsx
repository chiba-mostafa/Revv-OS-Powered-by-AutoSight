import React from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip } from "@heroui/react";
import {
  LayoutGrid,
  Award,
  Target,
  Wand2,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useEditorStore } from "../store/useEditorStore";

// Panels
import { LayoutPanel } from "./panels/LayoutPanel";
import { BadgesPanel } from "./panels/BadgesPanel";
import { HotspotsPanel } from "./panels/HotspotsPanel";
import { AnimationPanel } from "./panels/AnimationPanel";
import { ImagePanel } from "./panels/ImagePanel";

const PANEL_DEFS = [
  { key: "layout", icon: LayoutGrid, label: "Layout", component: LayoutPanel },
  { key: "badges", icon: Award, label: "Badges", component: BadgesPanel },
  {
    key: "hotspots",
    icon: Target,
    label: "Hotspots",
    component: HotspotsPanel,
  },
  {
    key: "image",
    icon: ImageIcon,
    label: "Image",
    component: ImagePanel,
  },
  {
    key: "animation",
    icon: Wand2,
    label: "Animation",
    component: AnimationPanel,
  },
];

/**
 * FloatingToolbar
 * A compact vertical icon bar on the right side of the preview.
 * Clicking an icon opens a floating popover panel beside it.
 */
export const FloatingToolbar = ({ availablePanels }) => {
  const { activePanel, setActivePanel, closePanel, draggingHotspotId } =
    useEditorStore();

  const visiblePanels = PANEL_DEFS.filter((p) =>
    availablePanels.includes(p.key),
  );

  const ActivePanelDef = PANEL_DEFS.find((p) => p.key === activePanel);

  // Hide entirely while user is dragging a hotspot
  if (draggingHotspotId) return null;

  return (
    <>
      {/* Icon bar */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1 p-1.5 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
        {visiblePanels.map((panel) => {
          const Icon = panel.icon;
          const isActive = activePanel === panel.key;
          return (
            <Tooltip
              content={panel.label}
              placement="left"
              key={panel.key}
              delay={300}
            >
              <button
                onClick={() => setActivePanel(panel.key)}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-zinc-500 hover:text-white hover:bg-white/10",
                )}
              >
                <Icon size={18} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Floating panel popover */}
      <AnimatePresence>
        {activePanel && ActivePanelDef && (
          <motion.div
            key={activePanel}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-[72px] top-1/2 -translate-y-1/2 z-50 w-[320px] max-h-[70vh] bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <ActivePanelDef.icon size={14} className="text-primary" />
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  {ActivePanelDef.label}
                </span>
              </div>
              <button
                onClick={closePanel}
                className="text-zinc-600 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4">
              <ActivePanelDef.component />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
