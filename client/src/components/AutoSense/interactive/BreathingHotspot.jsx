import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../../lib/utils";

export const BreathingHotspot = ({
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
  isActive = false,
  isMinimalTech = false,
  ...props
}) => {
  return (
    <motion.div
      className={cn(
        "relative flex items-center justify-center cursor-pointer group",
        isMinimalTech ? "w-9 h-9" : "w-8 h-8",
        className,
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: isMinimalTech ? 1.1 : 1.2 }}
      whileTap={{ scale: 0.9 }}
      transition={
        isMinimalTech
          ? { duration: 0.12, ease: "easeOut" }
          : { type: "spring", stiffness: 260, damping: 20 }
      }
      {...props}
    >
      {isMinimalTech ? (
        // MINIMAL TECH: Filled dot with pulsing ring — high contrast on white bg
        <>
          {/* Outer pulsing ring */}
          <motion.div
            className={cn(
              "absolute inset-0 rounded-full border-2",
              isActive ? "border-blue-600" : "border-white",
            )}
            animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Static ring */}
          <div
            className={cn(
              "absolute inset-0 rounded-full border-2 transition-colors duration-100",
              isActive ? "border-blue-600" : "border-white",
            )}
          />
          {/* Center filled dot */}
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors duration-100",
              isActive ? "bg-blue-600" : "bg-white",
            )}
          />
        </>
      ) : (
        // CINEMATIC: Organic breathing pulse
        <>
          <motion.div
            className={cn(
              "absolute inset-0 rounded-full border",
              isActive ? "border-primary/60" : "border-white/40",
            )}
            animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className={cn(
              "w-4 h-4 rounded-full transition-colors duration-300",
              isActive
                ? "bg-primary shadow-[0_0_15px_rgba(var(--heroui-primary),0.8)]"
                : "bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)]",
            )}
          />
        </>
      )}
      <div className="absolute inset-0 -m-4 bg-transparent rounded-full" />
    </motion.div>
  );
};
