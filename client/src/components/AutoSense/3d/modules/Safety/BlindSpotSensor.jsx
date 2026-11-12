import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// --------------------------------------------------------
// 🟠 SINGLE EXPANDING SPHERE / DISC
// --------------------------------------------------------
const PulseSphere = ({ delay = 0, speed = 1.5, isMinimalTech = false }) => {
  const meshRef = useRef();
  const matRef = useRef();

  useFrame(({ clock }) => {
    if (!meshRef.current || !matRef.current) return;

    const t = (clock.getElapsedTime() * speed - delay) % 1;
    const phase = t < 0 ? 1 + t : t;

    const s = 0.8 + phase * 1.7;
    meshRef.current.scale.set(s, s, isMinimalTech ? 0.15 : s);

    matRef.current.opacity = isMinimalTech
      ? (1 - phase) * 0.95
      : (1 - phase) * 0.6;
  });

  const color = isMinimalTech ? "#ea580c" : "#ffaa00";

  return (
    <mesh ref={meshRef}>
      <sphereGeometry
        args={[0.11, isMinimalTech ? 6 : 32, isMinimalTech ? 4 : 32]}
      />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        blending={isMinimalTech ? THREE.NormalBlending : THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
};

// --------------------------------------------------------
// 📡 MAIN SENSOR GROUP
// --------------------------------------------------------
export const BlindSpotSensor = ({
  anchor,
  side = "left",
  isMinimalTech = false,
}) => {
  if (!anchor) return null;

  const coreColor = isMinimalTech ? "#c2410c" : "#ffaa00";

  return (
    <group position={anchor.position}>
      <group>
        <PulseSphere delay={0.0} speed={1.0} isMinimalTech={isMinimalTech} />
        <PulseSphere delay={0.33} speed={1.0} isMinimalTech={isMinimalTech} />
        <PulseSphere delay={0.66} speed={1.0} isMinimalTech={isMinimalTech} />

        {/* The Solid Core (The Sensor itself) */}
        <mesh>
          <sphereGeometry
            args={[0.06, isMinimalTech ? 6 : 32, isMinimalTech ? 6 : 32]}
          />
          <meshBasicMaterial
            color={coreColor}
            transparent
            opacity={isMinimalTech ? 1.0 : 0.9}
            blending={
              isMinimalTech ? THREE.NormalBlending : THREE.AdditiveBlending
            }
          />
        </mesh>
      </group>
    </group>
  );
};
