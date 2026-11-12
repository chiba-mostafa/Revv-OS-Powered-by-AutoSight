import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useGLTF, Grid } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

// --- MODULE IMPORTS ---
import { LidarScanner } from "./modules/Safety/LidarScanner";
import { BlindSpotSensor } from "./modules/Safety/BlindSpotSensor";
import { SafetyShield } from "./modules/Safety/SafetyShield";
import { CargoVolume } from "./modules/Utility/CargoVolume";
import { Dimensions } from "./modules/Utility/Dimensions";
import { PowerFlow } from "./modules/Performance/PowerFlow";
import { PerformanceRing } from "./modules/Performance/PerformanceRing";
import { WindLines } from "./modules/Performance/WindLines";

// THE FRESNEL SHADER (Hologram Logic)
const fresnelMaterial = new THREE.ShaderMaterial({
  uniforms: {
    color1: { value: new THREE.Color("#0088ff") },
    color2: { value: new THREE.Color("#000000") },
    fresnelBias: { value: 0.1 },
    fresnelScale: { value: 1.0 },
    fresnelPower: { value: 4.0 },
  },
  transparent: true,
  depthWrite: false,
  vertexShader: `
    uniform float fresnelBias;
    uniform float fresnelScale;
    uniform float fresnelPower;
    varying float vReflectionFactor;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
      vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
      vec3 I = worldPosition.xyz - cameraPosition;
      vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 color1;
    uniform vec3 color2;
    varying float vReflectionFactor;
    void main() {
      float f = clamp( vReflectionFactor, 0.0, 1.0 );
      gl_FragColor = vec4(mix(color2, color1, vec3(f)), f); 
    }
  `,
});

export const CarModel = ({
  mode = "SHOWROOM",
  drivetrain = "AWD",
  bodyType = "Sedan",
  techConfig = {},
  isMinimalTech = false,
}) => {
  // 1. DETERMINE WHICH MODEL TO LOAD
  // Normalize input: 'SUV', 'Sedan', 'Coupe' -> 'suv_hologram.glb'
  const modelFile = bodyType.toLowerCase().includes("suv")
    ? "/models/suv_hologram.glb"
    : "/models/sedan_hologram.glb";

  const { nodes } = useGLTF(modelFile, "/draco/gltf/");
  const groupRef = useRef();
  const engineLightRef = useRef();

  // -----------------------------------------------------
  // THE MATERIAL LIBRARY
  // -----------------------------------------------------
  const library = useMemo(() => {
    return {
      paint: new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        metalness: 0.6,
        roughness: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.5,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        metalness: 1.0,
        roughness: 0.1,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: "#000000",
        metalness: 0.0,
        roughness: 0.0,
        transmission: 0.9,
        transparent: true,
      }),
      ghost: fresnelMaterial,
      techMesh: new THREE.MeshPhysicalMaterial({
        color: "#ff0000",
        transmission: 0.6,
        opacity: 0.8,
        metalness: 0.0,
        roughness: 0.1,
        transparent: true,
      }),
      graphite: new THREE.MeshStandardMaterial({
        color: "#181818",
        roughness: 0.6,
        metalness: 0.8,
        envMapIntensity: 0.2,
      }),
      tintedGlass: new THREE.MeshPhysicalMaterial({
        color: "#001133",
        metalness: 0.1,
        roughness: 0.1,
        transmission: 0.8,
        transparent: true,
        opacity: 0.8,
      }),
      outline: new THREE.LineBasicMaterial({
        color: "#ffffff",
        linewidth: 1,
        opacity: 0.6,
        transparent: true,
      }),
      satin: new THREE.MeshStandardMaterial({
        color: "#111111",
        roughness: 0.4,
        metalness: 0.5,
        envMapIntensity: 0.8,
      }),
      magma: new THREE.MeshBasicMaterial({
        color: "#ff4400",
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
      hotMetal: new THREE.MeshBasicMaterial({
        color: "#ff2200",
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      }),
      darkGlass: new THREE.MeshPhysicalMaterial({
        color: "#000000",
        metalness: 0.8,
        roughness: 0.2,
        transmission: 0.5,
        transparent: true,
        opacity: 0.6,
      }),

      // ── MINIMAL TECH MATERIALS ──────────────────────────────
      // Frosted white glass (PERFORMANCE body)
      mtFrostedGlass: new THREE.MeshPhysicalMaterial({
        color: "#f0f0f0",
        metalness: 0.0,
        roughness: 0.15,
        transmission: 0.5,
        transparent: true,
        opacity: 0.65,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
        envMapIntensity: 0.3,
      }),
      // Anodized crimson engine block
      mtEngine: new THREE.MeshStandardMaterial({
        color: "#8b1a1a",
        metalness: 0.7,
        roughness: 0.35,
        envMapIntensity: 0.5,
      }),
      // Brushed steel drivetrain
      mtSteel: new THREE.MeshStandardMaterial({
        color: "#aaaaaa",
        metalness: 0.9,
        roughness: 0.3,
        envMapIntensity: 0.4,
      }),
      // Pure matte white (UTILITY clay model / SAFETY wireframe base)
      mtWhiteMatte: new THREE.MeshStandardMaterial({
        color: "#f8f8f8",
        metalness: 0.0,
        roughness: 0.9,
        envMapIntensity: 0.1,
      }),
      // Black contour edges (UTILITY)
      mtBlackOutline: new THREE.LineBasicMaterial({
        color: "#1a1a1a",
        linewidth: 1,
        opacity: 0.9,
        transparent: true,
      }),
      // SAFETY wireframe material
      mtWireframe: new THREE.MeshBasicMaterial({
        color: "#d4d4d8",
        wireframe: true,
        transparent: true,
        opacity: 0.45,
      }),
      // Dark chrome wheels for MT
      mtDarkChrome: new THREE.MeshStandardMaterial({
        color: "#555555",
        metalness: 0.8,
        roughness: 0.25,
        envMapIntensity: 0.3,
      }),
      // ── SAFETY MT: translucent medical scan body (pale blue ghost) ──
      mtMedical: new THREE.MeshPhysicalMaterial({
        color: "#bfdbfe",
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        envMapIntensity: 0.0,
      }),
      // ── SAFETY MT: red airbags with clearcoat reflections ──
      mtAirbagRed: new THREE.MeshPhysicalMaterial({
        color: "#ef4444",
        emissive: new THREE.Color("#b91c1c"),
        emissiveIntensity: 0.3,
        clearcoat: 1.0,
        clearcoatRoughness: 0.2,
        metalness: 0.2,
        roughness: 0.35,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
      // ── PERFORMANCE MT: glowing blue axles + wheels ──
      mtAxleGlow: new THREE.MeshStandardMaterial({
        color: "#60a5fa",
        emissive: "#2563eb",
        emissiveIntensity: 1.5,
        roughness: 0.2,
        metalness: 0.3,
      }),
    };
  }, []);

  // -----------------------------------------------------
  // 🛠️ HELPERS
  // -----------------------------------------------------
  const applyMaterial = (node, material, renderOrder = 0) => {
    if (!node) return;
    const apply = (mesh) => {
      mesh.material = material;
      mesh.renderOrder = renderOrder;
    };
    if (node.isMesh) apply(node);
    if (node.traverse) {
      node.traverse((child) => {
        if (child.isMesh) apply(child);
      });
    }
  };

  const toggleVisibility = (node, visible) => {
    if (!node) return;
    node.visible = visible;
  };

  const setupEdges = (node, material) => {
    if (!node) return;
    const mat = material || library.outline;
    const createEdgeOnMesh = (mesh) => {
      if (mesh.userData.hasEdges) return;
      const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 15);
      const edgesMesh = new THREE.LineSegments(edgesGeo, mat);
      edgesMesh.name = "Blueprint_Edges";
      edgesMesh.visible = false;
      mesh.add(edgesMesh);
      mesh.userData.hasEdges = true;
    };
    if (node.isMesh) createEdgeOnMesh(node);
    if (node.traverse) {
      node.traverse((child) => {
        if (child.isMesh) createEdgeOnMesh(child);
      });
    }
  };

  const toggleEdges = (node, visible) => {
    if (!node) return;
    if (node.traverse) {
      node.traverse((child) => {
        if (child.name === "Blueprint_Edges") child.visible = visible;
      });
    }
  };

  // -----------------------------------------------------
  // THE LOGIC ENGINE
  // -----------------------------------------------------
  useEffect(() => {
    const edgeMat = isMinimalTech ? library.mtBlackOutline : library.outline;
    setupEdges(nodes.Chassis_Main, edgeMat);
    setupEdges(nodes.Trunk || nodes.trunk, edgeMat);

    const resetVisibility = () => {
      toggleVisibility(nodes.Engine_Block, false);
      toggleVisibility(nodes.Drivetrain_Front, false);
      toggleVisibility(nodes.Drivetrain_Rear, false);
      toggleVisibility(nodes.Exhaust_System, false);
      toggleVisibility(nodes.Airbags_Group, false);

      toggleVisibility(nodes.Chassis_Main, true);
      toggleVisibility(nodes.Chassis_Glass, true);
      toggleVisibility(nodes.Interior_Detail, true);
      toggleVisibility(nodes.Trunk || nodes.trunk, true);
      toggleVisibility(nodes.Headlights, true);
      toggleVisibility(nodes.Taillights, true);
      [nodes.Wheel_FL, nodes.Wheel_FR, nodes.Wheel_RL, nodes.Wheel_RR].forEach(
        (w) => toggleVisibility(w, true),
      );

      if (nodes.Chassis_Main) nodes.Chassis_Main.renderOrder = 0;
      toggleEdges(nodes.Chassis_Main, false);
      toggleEdges(nodes.Trunk || nodes.trunk, false);
    };

    resetVisibility();

    switch (mode) {
      case "SHOWROOM":
        applyMaterial(nodes.Chassis_Main, library.paint);
        applyMaterial(nodes.Trunk || nodes.trunk, library.paint);
        applyMaterial(nodes.Chassis_Glass, library.glass);
        applyMaterial(nodes.Headlights, library.glass);
        applyMaterial(nodes.Taillights, library.glass);
        applyMaterial(nodes.Interior_Detail, library.graphite);
        [
          nodes.Wheel_FL,
          nodes.Wheel_FR,
          nodes.Wheel_RL,
          nodes.Wheel_RR,
        ].forEach((w) => applyMaterial(w, library.chrome));
        break;

      case "SAFETY":
        if (isMinimalTech) {
          // ── MT: frosted glass body, visible signals, airbags rendered on top ──
          applyMaterial(nodes.Chassis_Main, library.mtFrostedGlass);
          applyMaterial(nodes.Trunk || nodes.trunk, library.mtFrostedGlass);
          applyMaterial(nodes.Chassis_Glass, library.mtFrostedGlass);
          applyMaterial(nodes.Interior_Detail, library.mtFrostedGlass);
          [
            nodes.Wheel_FL,
            nodes.Wheel_FR,
            nodes.Wheel_RL,
            nodes.Wheel_RR,
          ].forEach((w) => applyMaterial(w, library.mtFrostedGlass));

          // Headlights + Taillights: use tintedGlass for 3D volumetric look
          applyMaterial(nodes.Headlights, library.tintedGlass);
          applyMaterial(nodes.Taillights, library.tintedGlass);

          // Airbags: render ON TOP of the transparent chassis so they're always visible
          toggleVisibility(nodes.Airbags_Group, true);
          applyMaterial(nodes.Airbags_Group, library.mtAirbagRed, 999);
        } else {
          applyMaterial(nodes.Chassis_Main, library.ghost);
          applyMaterial(nodes.Trunk || nodes.trunk, library.ghost);
          applyMaterial(nodes.Chassis_Glass, library.ghost);
          applyMaterial(nodes.Headlights, library.ghost);
          applyMaterial(nodes.Taillights, library.ghost);
          applyMaterial(nodes.Interior_Detail, library.ghost);
          [
            nodes.Wheel_FL,
            nodes.Wheel_FR,
            nodes.Wheel_RL,
            nodes.Wheel_RR,
          ].forEach((w) => applyMaterial(w, library.ghost));
          toggleVisibility(nodes.Airbags_Group, true);
          applyMaterial(nodes.Airbags_Group, library.techMesh);
        }
        break;

      case "PERFORMANCE":
        if (isMinimalTech) {
          // ── MT: "Exploded Engineering" — frosted glass body, anodized internals ──
          applyMaterial(nodes.Chassis_Main, library.mtFrostedGlass, 0);
          applyMaterial(nodes.Trunk || nodes.trunk, library.mtFrostedGlass, 0);
          toggleVisibility(nodes.Chassis_Glass, true);
          applyMaterial(nodes.Chassis_Glass, library.mtFrostedGlass, 1);
          toggleVisibility(nodes.Interior_Detail, false);
          toggleVisibility(nodes.Headlights, false);
          toggleVisibility(nodes.Taillights, false);

          toggleVisibility(nodes.Engine_Block, true);
          applyMaterial(nodes.Engine_Block, library.mtEngine);
          toggleVisibility(nodes.Exhaust_System, true);
          applyMaterial(nodes.Exhaust_System, library.mtSteel);

          const mtIsFront =
            drivetrain === "AWD" ||
            drivetrain === "FWD" ||
            drivetrain === "4WD";
          const mtIsRear =
            drivetrain === "AWD" ||
            drivetrain === "RWD" ||
            drivetrain === "4WD";

          toggleVisibility(nodes.Drivetrain_Front, mtIsFront);
          if (mtIsFront)
            applyMaterial(nodes.Drivetrain_Front, library.mtAxleGlow);

          toggleVisibility(nodes.Drivetrain_Rear, mtIsRear);
          if (mtIsRear)
            applyMaterial(nodes.Drivetrain_Rear, library.mtAxleGlow);

          // Wheels with axles get the same glow as the power flow
          const mtFwMat = mtIsFront
            ? library.mtAxleGlow
            : library.mtFrostedGlass;
          applyMaterial(nodes.Wheel_FL, mtFwMat);
          applyMaterial(nodes.Wheel_FR, mtFwMat);
          const mtRwMat = mtIsRear
            ? library.mtAxleGlow
            : library.mtFrostedGlass;
          applyMaterial(nodes.Wheel_RL, mtRwMat);
          applyMaterial(nodes.Wheel_RR, mtRwMat);
        } else {
          applyMaterial(nodes.Chassis_Main, library.satin, 0);
          applyMaterial(nodes.Trunk || nodes.trunk, library.satin, 0);
          toggleVisibility(nodes.Chassis_Glass, true);
          applyMaterial(nodes.Chassis_Glass, library.darkGlass, 1);
          toggleVisibility(nodes.Interior_Detail, false);
          toggleVisibility(nodes.Headlights, false);
          toggleVisibility(nodes.Taillights, false);

          const XRAY_ORDER = 999;

          toggleVisibility(nodes.Engine_Block, true);
          applyMaterial(nodes.Engine_Block, library.magma, XRAY_ORDER);
          toggleVisibility(nodes.Exhaust_System, true);
          applyMaterial(nodes.Exhaust_System, library.magma, XRAY_ORDER);

          const isFront =
            drivetrain === "AWD" ||
            drivetrain === "FWD" ||
            drivetrain === "4WD";
          const isRear =
            drivetrain === "AWD" ||
            drivetrain === "RWD" ||
            drivetrain === "4WD";

          toggleVisibility(nodes.Drivetrain_Front, isFront);
          if (isFront)
            applyMaterial(nodes.Drivetrain_Front, library.hotMetal, XRAY_ORDER);

          toggleVisibility(nodes.Drivetrain_Rear, isRear);
          if (isRear)
            applyMaterial(nodes.Drivetrain_Rear, library.hotMetal, XRAY_ORDER);

          const frontWheelMat = isFront ? library.hotMetal : library.satin;
          const frontOrder = isFront ? XRAY_ORDER : 0;
          applyMaterial(nodes.Wheel_FL, frontWheelMat, frontOrder);
          applyMaterial(nodes.Wheel_FR, frontWheelMat, frontOrder);

          const rearWheelMat = isRear ? library.hotMetal : library.satin;
          const rearOrder = isRear ? XRAY_ORDER : 0;
          applyMaterial(nodes.Wheel_RL, rearWheelMat, rearOrder);
          applyMaterial(nodes.Wheel_RR, rearWheelMat, rearOrder);
        }
        break;

      case "UTILITY":
        if (isMinimalTech) {
          // ── MT: "Spec Sheet" — matte white clay with black contour edges ──
          applyMaterial(nodes.Chassis_Main, library.mtWhiteMatte);
          applyMaterial(nodes.Trunk || nodes.trunk, library.mtWhiteMatte);
          applyMaterial(nodes.Chassis_Glass, library.mtFrostedGlass);
          toggleEdges(nodes.Chassis_Main, true);
          toggleEdges(nodes.Trunk || nodes.trunk, true);
          [
            nodes.Wheel_FL,
            nodes.Wheel_FR,
            nodes.Wheel_RL,
            nodes.Wheel_RR,
          ].forEach((w) => applyMaterial(w, library.mtDarkChrome));
          applyMaterial(nodes.Interior_Detail, library.mtWhiteMatte);
        } else {
          applyMaterial(nodes.Chassis_Main, library.graphite);
          applyMaterial(nodes.Trunk || nodes.trunk, library.graphite);
          applyMaterial(nodes.Chassis_Glass, library.tintedGlass);
          toggleEdges(nodes.Chassis_Main, true);
          toggleEdges(nodes.Trunk || nodes.trunk, true);
          [
            nodes.Wheel_FL,
            nodes.Wheel_FR,
            nodes.Wheel_RL,
            nodes.Wheel_RR,
          ].forEach((w) => applyMaterial(w, library.graphite));
          applyMaterial(nodes.Interior_Detail, library.graphite);
        }
        break;

      default:
        break;
    }
  }, [mode, nodes, library, drivetrain, isMinimalTech]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    const trunkNode = nodes.Trunk || nodes.trunk;
    if (trunkNode) {
      const targetAngle = mode === "UTILITY" ? 1.3 : 0;
      trunkNode.rotation.x = THREE.MathUtils.lerp(
        trunkNode.rotation.x,
        targetAngle,
        delta * 2,
      );
    }

    if (mode === "PERFORMANCE") {
      if (!isMinimalTech) {
        // Cinematic: slow fade — engine dims over time instead of pulsing bright
        const fade = 0.15 + Math.sin(t * 1.2) * 0.08;
        library.magma.color.set("#ff4400");
        library.magma.opacity = fade;

        if (engineLightRef.current) {
          engineLightRef.current.intensity = 0.4 + Math.sin(t * 1.2) * 0.2;
        }
      }

      const wheelSpeed = (isMinimalTech ? 8 : 15) * delta;
      if (nodes.Wheel_FL) nodes.Wheel_FL.rotation.x += wheelSpeed;
      if (nodes.Wheel_FR) nodes.Wheel_FR.rotation.x += wheelSpeed;
      if (nodes.Wheel_RL) nodes.Wheel_RL.rotation.x += wheelSpeed;
      if (nodes.Wheel_RR) nodes.Wheel_RR.rotation.x += wheelSpeed;

      if (nodes.Car_Root) {
        if (isMinimalTech) {
          nodes.Car_Root.position.y = 0;
          nodes.Car_Root.rotation.z = 0;
        } else {
          nodes.Car_Root.position.y = Math.sin(t * 60) * 0.002;
          nodes.Car_Root.rotation.z = Math.sin(t * 40) * 0.001;
        }
      }
    } else {
      if (nodes.Car_Root) {
        nodes.Car_Root.position.y = 0;
        nodes.Car_Root.rotation.z = 0;
      }
    }
  });

  return (
    <group ref={groupRef} dispose={null}>
      <primitive object={nodes.Car_Root} />

      {/* ── INFINITE GRID FLOOR FOR ALL MT MODES ── */}
      {isMinimalTech && mode !== "SHOWROOM" && mode !== "PERFORMANCE" && (
        <Grid
          position={[0, 0.02, 0]}
          infiniteGrid
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#d4d4d8"
          sectionSize={2}
          sectionThickness={1.0}
          sectionColor="#a1a1aa"
          fadeDistance={55}
          fadeStrength={4}
        />
      )}

      {mode === "PERFORMANCE" && (
        <>
          {!isMinimalTech && nodes.Anchor_Engine_Core && (
            <group position={nodes.Anchor_Engine_Core.position}>
              <pointLight
                ref={engineLightRef}
                color="#ff6600"
                distance={3}
                decay={2}
                castShadow={false}
              />
            </group>
          )}

          <PowerFlow
            nodes={nodes}
            drivetrain={drivetrain}
            isMinimalTech={isMinimalTech}
          />
          <PerformanceRing
            hp={techConfig.engine_hp ?? 220}
            isMinimalTech={isMinimalTech}
          />
          <WindLines count={60} isMinimalTech={isMinimalTech} />
        </>
      )}

      {mode === "SAFETY" && nodes.Anchor_Sensor_Front && (
        <>
          {(techConfig.has_front_sensors ?? true) && (
            <LidarScanner
              anchor={nodes.Anchor_Sensor_Front}
              isMinimalTech={isMinimalTech}
            />
          )}
          {(techConfig.has_rear_sensors ?? true) && (
            <>
              <BlindSpotSensor
                anchor={nodes.Anchor_BlindSpot_L}
                side="left"
                isMinimalTech={isMinimalTech}
              />
              <BlindSpotSensor
                anchor={nodes.Anchor_BlindSpot_R}
                side="right"
                isMinimalTech={isMinimalTech}
              />
            </>
          )}
        </>
      )}

      {mode === "UTILITY" && (
        <>
          {nodes.Anchor_Trunk && (
            <CargoVolume
              anchor={nodes.Anchor_Trunk}
              isOpen={true}
              capacity={techConfig.trunk_capacity_liters}
              isMinimalTech={isMinimalTech}
            />
          )}
          <Dimensions
            nodes={nodes}
            data={techConfig.dimensions}
            isMinimalTech={isMinimalTech}
          />
        </>
      )}
    </group>
  );
};

// 4. Preload BOTH models to avoid lag when switching
useGLTF.preload("/models/sedan_hologram.glb");
useGLTF.preload("/models/suv_hologram.glb");
