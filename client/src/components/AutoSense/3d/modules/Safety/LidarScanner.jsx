import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// --------------------------------------------------------
// 🌊 SINGLE RADAR WAVE (TUNED)
// --------------------------------------------------------
const RadarWave = ({
  delay = 0,
  speed = 1,
  color = "#00ffff",
  isMinimalTech = false,
}) => {
  const meshRef = useRef();
  const materialRef = useRef();

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current) return;

    // 1. Lifecycle (Looping 0 to 1)
    const t = (clock.getElapsedTime() * speed - delay) % 1;
    const phase = t < 0 ? 1 + t : t;

    // 2. Animate Scale
    const scale = 1 + phase * 3;
    meshRef.current.scale.set(scale, scale, 1);

    // 3. Animate Opacity
    materialRef.current.opacity = isMinimalTech
      ? (1 - phase) * 0.8 // MT: sharper, more opaque
      : (1 - phase) * 0.5;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
      <ringGeometry
        args={[0.2, 0.5, isMinimalTech ? 6 : 32, 1, -Math.PI / 4, Math.PI / 2]}
      />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        blending={isMinimalTech ? THREE.NormalBlending : THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
};

// --------------------------------------------------------
// 📡 MAIN COMPONENT
// --------------------------------------------------------
export const LidarScanner = ({ anchor, isMinimalTech = false }) => {
  if (!anchor) return null;

  const waveColor = isMinimalTech ? "#06b6d4" : "#00ffff"; // solid cyan vs glowing cyan
  const baseColor = isMinimalTech ? "#0891b2" : "#00ffff";

  return (
    <group position={anchor.position}>
      <group position={[0, -0.3, 0.2]}>
        <RadarWave
          delay={0.0}
          speed={0.8}
          color={waveColor}
          isMinimalTech={isMinimalTech}
        />
        <RadarWave
          delay={0.33}
          speed={0.8}
          color={waveColor}
          isMinimalTech={isMinimalTech}
        />
        <RadarWave
          delay={0.66}
          speed={0.8}
          color={waveColor}
          isMinimalTech={isMinimalTech}
        />

        {/* The Solid Base (Source) */}
        <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
          <ringGeometry
            args={[
              0.15,
              0.2,
              isMinimalTech ? 6 : 32,
              1,
              -Math.PI / 4,
              Math.PI / 2,
            ]}
          />
          <meshBasicMaterial
            color={baseColor}
            transparent
            opacity={isMinimalTech ? 0.9 : 0.6}
            blending={
              isMinimalTech ? THREE.NormalBlending : THREE.AdditiveBlending
            }
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
};
