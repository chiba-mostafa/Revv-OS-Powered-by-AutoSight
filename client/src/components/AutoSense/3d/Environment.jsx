import React from "react";
import {
  Environment as DreiEnvironment,
  ContactShadows,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";

export const Environment = ({ isMinimalTech = false }) => {
  return (
    <>
      {/* --------------------------------------------------------
          1. LIGHTING RIG
      -------------------------------------------------------- */}

      {/* HDRI Reflections */}
      <DreiEnvironment
        files="/textures/env_map.hdr"
        environmentIntensity={0.5}
      />

      {/* Key Light (Front-Top-Left) */}
      <spotLight
        position={[-5, 10, 5]}
        angle={0.5}
        penumbra={1}
        intensity={isMinimalTech ? 120 : 200}
        castShadow
        shadow-bias={-0.0001}
      />

      {isMinimalTech ? (
        <>
          {/* MT: Even, clinical fill — like a photo studio */}
          <spotLight
            position={[-5, 5, -5]}
            angle={0.8}
            penumbra={1}
            intensity={80}
            color="#ffffff"
          />
          <spotLight
            position={[5, 5, -5]}
            angle={0.8}
            penumbra={1}
            intensity={80}
            color="#ffffff"
          />
          <ambientLight intensity={0.6} color="#f5f5f5" />
        </>
      ) : (
        <>
          {/* Rim Light Left (Cool) */}
          <spotLight
            position={[-5, 0, -5]}
            angle={0.5}
            penumbra={1}
            intensity={300}
            color="#cceeff"
            lookAt={[0, 0, 0]}
          />

          {/* Rim Light Right (Warm) */}
          <spotLight
            position={[5, 0, -5]}
            angle={0.5}
            penumbra={1}
            intensity={300}
            color="#ffffff"
            lookAt={[0, 0, 0]}
          />
        </>
      )}

      {/* --------------------------------------------------------
          2. FLOOR SHADOWS (Grounding)
      -------------------------------------------------------- */}
      <ContactShadows
        resolution={1024}
        scale={20}
        blur={isMinimalTech ? 1 : 2}
        opacity={isMinimalTech ? 0.25 : 0.5}
        far={10}
        color={isMinimalTech ? "#a3a3a3" : "#000000"}
      />

      {/* --------------------------------------------------------
          3. POST-PROCESSING EFFECTS
      -------------------------------------------------------- */}
      {isMinimalTech ? (
        // MT: No bloom, no vignette, no grain — clinical clean
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={4}
            mipmapBlur
            intensity={0.2}
            radius={0.3}
          />
        </EffectComposer>
      ) : (
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={1}
            mipmapBlur
            intensity={1.5}
            radius={0.6}
          />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
          <Noise opacity={0.02} />
        </EffectComposer>
      )}
    </>
  );
};
