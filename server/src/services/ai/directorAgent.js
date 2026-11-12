const {
  generateStructuredData,
  selectTextModel,
} = require("../../config/aiConfig");
const { buildDirectorPrompt } = require("./prompts/directorPrompt");
const { DirectorOutputSchema } = require("./schemas/directorSchema");

const PERFORMANCE_KEYWORDS = [
  "engine",
  "horsepower",
  "hp",
  "torque",
  "drivetrain",
  "battery",
  "motor",
  "transmission",
  "powertrain",
  "acceleration",
  "0-60",
  "zero-to-sixty",
  "turbo",
  "supercharger",
  "electric motor",
  "hybrid",
  "awd",
  "4wd",
  "rwd",
  "fwd",
];

const SAFETY_KEYWORDS = [
  "safety",
  "airbag",
  "sensor",
  "lidar",
  "blind spot",
  "collision",
  "abs",
  "traction control",
  "ncap",
  "crash",
  "iihs",
  "euro ncap",
  "lane assist",
  "emergency braking",
  "pedestrian detection",
];

const UTILITY_KEYWORDS = [
  "trunk",
  "cargo",
  "dimension",
  "wheelbase",
  "seating",
  "capacity",
  "storage",
  "interior space",
  "boot space",
  "luggage",
  "passenger",
  "seat",
  "legroom",
  "headroom",
  "load",
];

function detectTechViewMode(featureSlug, featureDescription) {
  const text = `${featureSlug} ${featureDescription}`.toLowerCase();

  for (const keyword of PERFORMANCE_KEYWORDS) {
    if (text.includes(keyword)) {
      return { useTechView: true, themeTag: "PERFORMANCE" };
    }
  }

  for (const keyword of SAFETY_KEYWORDS) {
    if (text.includes(keyword)) {
      return { useTechView: true, themeTag: "SAFETY" };
    }
  }

  for (const keyword of UTILITY_KEYWORDS) {
    if (text.includes(keyword)) {
      return { useTechView: true, themeTag: "UTILITY" };
    }
  }

  return { useTechView: false, themeTag: null };
}

function detectSensorCapabilities(carContext) {
  const specs = carContext.normalized_specs || {};
  const safety = specs.safety || {};
  const assistSystems = safety.assist_systems || [];
  const rawDump = carContext.raw_api_dump || {};
  const carYear = carContext.identity?.year || 0;

  const frontSensorKeywords = [
    "front parking",
    "front sensor",
    "forward collision",
    "front camera",
    "front radar",
    "pedestrian detection",
    "lane departure",
    "lane assist",
    "adaptive cruise",
    "aeb",
    "autonomous emergency",
  ];

  const rearSensorKeywords = [
    "rear parking",
    "rear sensor",
    "backup camera",
    "rear camera",
    "reverse camera",
    "rearview camera",
    "rear cross traffic",
    "blind spot",
    "parking assist",
  ];

  const genericSensorKeywords = [
    "parking sensor",
    "collision warning",
    "360 camera",
    "surround view",
    "parking assist",
  ];

  const assistText = assistSystems.join(" ").toLowerCase();
  const rawDumpText = JSON.stringify(rawDump).toLowerCase();
  const searchText = `${assistText} ${rawDumpText}`;

  let hasFrontSensors = frontSensorKeywords.some((kw) =>
    searchText.includes(kw),
  );

  let hasRearSensors = rearSensorKeywords.some((kw) => searchText.includes(kw));

  const hasGenericSensors = genericSensorKeywords.some((kw) =>
    searchText.includes(kw),
  );

  if (hasGenericSensors) {
    hasFrontSensors = true;
    hasRearSensors = true;
  }

  if (!hasFrontSensors && !hasRearSensors && carYear > 2018) {
    hasFrontSensors = true;
    hasRearSensors = true;
  }

  return {
    has_front_sensors: hasFrontSensors,
    has_rear_sensors: hasRearSensors,
  };
}

function buildTechConfig(themeTag, carContext) {
  const specs = carContext.normalized_specs || {};
  const performance = specs.performance || {};
  const safety = specs.safety || {};
  const dimensions = specs.dimensions || {};

  const baseConfig = { mode: themeTag };

  switch (themeTag) {
    case "PERFORMANCE":
      return {
        ...baseConfig,
        drivetrain: performance.drivetrain || "FWD",
        engine_hp: performance.hp ?? null,
        torque_nm: performance.torque_nm ?? null,
        zero_to_sixty_sec: performance.zero_to_sixty_sec ?? null,
      };

    case "SAFETY": {
      const sensorCaps = detectSensorCapabilities(carContext);

      return {
        ...baseConfig,
        airbag_count: safety.airbags ?? 6,
        has_front_sensors: sensorCaps.has_front_sensors,
        has_rear_sensors: sensorCaps.has_rear_sensors,
        safety_rating: safety.rating_text ?? null,
        assist_systems: safety.assist_systems || ["ABS", "Traction Control"],
      };
    }

    case "UTILITY": {
      const safeDimensions = {
        length_mm: dimensions.length_mm ?? 4500,
        width_mm: dimensions.width_mm ?? 1800,
        height_mm: dimensions.height_mm ?? 1500,
        wheelbase_mm: dimensions.wheelbase_mm ?? null,
      };

      return {
        ...baseConfig,
        dimensions: safeDimensions,
        trunk_capacity_liters: dimensions.trunk_capacity_l ?? null,
        seat_count: dimensions.seats ?? 5,
      };
    }

    default:
      return baseConfig;
  }
}

function postProcessStoryboard(storyboard, carContext) {
  const totalScenes = storyboard.scenes.length;
  const maxTechViews = totalScenes < 9 ? 1 : 2;

  const usedModes = new Set();
  let techViewCount = 0;

  const processedScenes = storyboard.scenes.map((scene) => {
    if (scene.use_3d_mode || scene.scene_type === "tech_view") {
      let themeTag = scene.theme_tag;

      if (!["PERFORMANCE", "SAFETY", "UTILITY"].includes(themeTag)) {
        const detection = detectTechViewMode(
          scene.main_feature_slug || "",
          scene.visual_direction?.focus_point || "",
        );
        if (detection.useTechView) {
          themeTag = detection.themeTag;
        } else {
          const { use_3d_mode, ...cleanScene } = scene;
          return { ...cleanScene, scene_type: "slide_view" };
        }
      }

      if (techViewCount >= maxTechViews || usedModes.has(themeTag)) {
        const { use_3d_mode, tech_config, ...cleanScene } = scene;
        return { ...cleanScene, scene_type: "slide_view" };
      }

      usedModes.add(themeTag);
      techViewCount += 1;

      const techConfig = buildTechConfig(themeTag, carContext);

      const { use_3d_mode, ...cleanScene } = scene;
      return {
        ...cleanScene,
        scene_type: "tech_view",
        theme_tag: themeTag,
        tech_config: techConfig,
      };
    }

    if (scene.scene_type === "slide_view") {
      const detection = detectTechViewMode(
        scene.main_feature_slug || "",
        scene.visual_direction?.focus_point || "",
      );

      if (
        detection.useTechView &&
        techViewCount < maxTechViews &&
        !usedModes.has(detection.themeTag)
      ) {
        usedModes.add(detection.themeTag);
        techViewCount += 1;

        const techConfig = buildTechConfig(detection.themeTag, carContext);
        return {
          ...scene,
          scene_type: "tech_view",
          theme_tag: detection.themeTag,
          tech_config: techConfig,
        };
      }
    }

    return scene;
  });

  let slideIndex = 0;
  const finalScenes = processedScenes.map((scene) => {
    const layout = scene.layout || {};

    if (scene.scene_type === "intro_view" || scene.scene_type === "outro_view") {
      return {
        ...scene,
        layout: { ...layout, card_position: "left" },
      };
    }

    if (scene.scene_type === "tech_view") {
      return {
        ...scene,
        layout: { ...layout, card_position: "right" },
      };
    }

    if (scene.scene_type === "slide_view") {
      const alternatingPos = slideIndex % 2 === 0 ? "left" : "right";
      slideIndex += 1;
      return {
        ...scene,
        layout: { ...layout, card_position: alternatingPos },
      };
    }

    return scene;
  });

  return { ...storyboard, scenes: finalScenes };
}

async function planStory(
  carContext,
  analystReport,
  sceneCount = "automatic",
  templateStyle = "Cinematic",
) {
  const activeModel = selectTextModel({ prefer: "pro" });
  console.log(
    `🎬 Director Agent: Planning scenes... (Template: ${templateStyle})`,
  );

  try {
    const slideCount =
      sceneCount === "automatic" ? "automatic" : Math.max(sceneCount - 2, 1);

    const maxFeatures =
      slideCount === "automatic" ? 12 : Math.min(slideCount + 3, 18);
    const validFeatures = analystReport.prioritized_features
      .filter((f) => f.score >= 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFeatures);

    let sceneInstruction;
    if (slideCount === "automatic") {
      sceneInstruction =
        "AUTOMATIC: Create between 3 and 5 slide scenes based on the quality and quantity of features available.";
    } else {
      sceneInstruction = `EXACT: Create exactly ${slideCount} slide scenes. Pick the top ${slideCount} features.`;
    }

    const prompt = buildDirectorPrompt({
      car_identity: `${carContext.identity.year} ${carContext.identity.make} ${carContext.identity.model} (${carContext.identity.body_type})`,
      scene_count_instruction: sceneInstruction,
      analyst_report: JSON.stringify({
        persona: analystReport.marketing_persona,
        tone: analystReport.suggested_tone,
        narrative_angle: analystReport.narrative_angle,
        prioritized_features: validFeatures,
      }),
      narrative_angle:
        analystReport.narrative_angle ||
        "Build a coherent story arc around the car's strongest features.",
      template_style: templateStyle,
      document_context:
        carContext.document_context || "No additional documentation provided.",
    });

    const storyboard = await generateStructuredData({
      model: activeModel,
      schema: DirectorOutputSchema,
      systemInstruction: prompt.systemInstruction,
      contents: prompt.userPrompt,
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 8192,
    });

    const processedStoryboard = postProcessStoryboard(storyboard, carContext);

    const finalSlideCount = processedStoryboard.scenes.filter(
      (s) => s.scene_type === "slide_view",
    ).length;
    const techCount = processedStoryboard.scenes.filter(
      (s) => s.scene_type === "tech_view",
    ).length;

    console.log(
      `🎬 Director Agent: Cut! Planned ${finalSlideCount} slide + ${techCount} tech_view scenes (Total: ${processedStoryboard.scenes.length}).`,
    );

    return processedStoryboard;
  } catch (error) {
    console.error("❌ Director Agent Failed:", error);
    throw new Error("Failed to plan story.");
  }
}

module.exports = {
  planStory,
  detectTechViewMode,
  buildTechConfig,
  detectSensorCapabilities,
};
