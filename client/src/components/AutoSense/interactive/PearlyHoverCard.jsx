import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../../lib/utils";

export const PearlyHoverCard = ({
  isVisible,
  title,
  body,
  icon: Icon,
  position = "right",
  className,
  style,
  isMinimalTech = false,
}) => {
  let initialX = 0,
    initialY = 0;
  let originX = 0.5,
    originY = 0.5;

  if (position === "right") {
    initialX = -10;
    originX = 0;
  }
  if (position === "left") {
    initialX = 10;
    originX = 1;
  }
  if (position === "top") {
    initialY = 10;
    originY = 1;
  }
  if (position === "bottom") {
    initialY = -10;
    originY = 0;
  }

  const positionClass =
    position === "right"
      ? "left-10 top-1/2 -translate-y-1/2"
      : position === "left"
        ? "right-10 top-1/2 -translate-y-1/2"
        : position === "top"
          ? "bottom-full mb-4 left-1/2 -translate-x-1/2"
          : "top-full mt-4 left-1/2 -translate-x-1/2";

  // ── Motion variants ─────────────────────────────────────────────────────────
  const cinematicInitial = {
    opacity: 0,
    x: initialX,
    y: initialY,
    scale: 0.9,
    filter: "blur(8px)",
  };
  const cinematicAnimate = {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  };
  const cinematicExit = {
    opacity: 0,
    scale: 0.9,
    filter: "blur(8px)",
    transition: { duration: 0.2 },
  };
  const cinematicTransition = {
    type: "spring",
    stiffness: 120,
    damping: 15,
    mass: 0.8,
  };

  const mtInitial = { opacity: 0, x: initialX, y: initialY };
  const mtAnimate = { opacity: 1, x: 0, y: 0 };
  const mtExit = { opacity: 0, transition: { duration: 0.1 } };
  const mtTransition = { duration: 0.15, ease: "easeOut" };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={isMinimalTech ? mtInitial : cinematicInitial}
          animate={isMinimalTech ? mtAnimate : cinematicAnimate}
          exit={isMinimalTech ? mtExit : cinematicExit}
          transition={isMinimalTech ? mtTransition : cinematicTransition}
          style={{
            transformOrigin: `${originX * 100}% ${originY * 100}%`,
            ...style,
          }}
          className={cn(
            "absolute z-50 p-5 w-72",
            positionClass,
            isMinimalTech
              ? "bg-white border border-zinc-200 rounded-sm shadow-lg"
              : "bg-black/60 backdrop-blur-xl saturate-150 border border-white/20 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]",
            className,
          )}
        >
          {/* Cinematic-only inner gloss gradient */}
          {!isMinimalTech && (
            <div className="absolute inset-0 pointer-events-none rounded-lg bg-gradient-to-tr from-white/10 via-transparent to-transparent opacity-50" />
          )}

          <div className="relative z-10 flex items-start gap-4">
            {Icon && (
              <div
                className={cn(
                  "p-2.5 shrink-0",
                  isMinimalTech
                    ? "border border-zinc-200 rounded-sm bg-zinc-50"
                    : "rounded-2xl bg-white/10 border border-white/20 shadow-inner",
                )}
              >
                <Icon
                  size={20}
                  className={isMinimalTech ? "text-zinc-700" : "text-white"}
                />
              </div>
            )}
            <div className="flex-1 space-y-1">
              <h3
                className={cn(
                  "font-bold",
                  isMinimalTech
                    ? "font-mono text-sm tracking-widest uppercase text-zinc-900"
                    : "text-lg tracking-wide drop-shadow-sm text-white",
                )}
              >
                {title}
              </h3>
              <p
                className={cn(
                  "text-xs leading-relaxed",
                  isMinimalTech
                    ? "font-mono text-zinc-500"
                    : "font-medium text-blue-100/80",
                )}
              >
                {body}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
