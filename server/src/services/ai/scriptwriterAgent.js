const {
  generateStructuredData,
  selectTextModel,
} = require("../../config/aiConfig");
const { buildScriptPrompt } = require("./prompts/scriptPrompt");
const { ScriptOutputSchema } = require("./schemas/scriptSchema");

const THEME_TO_BADGE_CATEGORIES = {
  SAFETY: ["Safety"],
  PERFORMANCE: ["Performance"],
  TECHNOLOGY: ["Technology"],
  EFFICIENCY: ["Eco", "Regulatory"],
  ECO: ["Eco", "Regulatory"],
  UTILITY: ["Technology", "Award"],
  VALUE: ["Award", "Reliability"],
  LUXURY: ["Award", "Technology"],
  GENERAL: [],
};

function toTitleCase(value = "") {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanSentenceFragment(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function formatStatValue(value, unit = "") {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { value: String(value), unit };
    }

    return { value: value.toFixed(1).replace(/\.0$/, ""), unit };
  }

  return { value: String(value), unit };
}

function buildFallbackKeyStats(scene, carContext) {
  const specs = carContext.normalized_specs || {};
  const performance = specs.performance || {};
  const dimensions = specs.dimensions || {};
  const safety = specs.safety || {};
  const themeTag = String(scene.theme_tag || "GENERAL").toUpperCase();

  const statCandidatesByTheme = {
    PERFORMANCE: [
      {
        label: "Horsepower",
        data: formatStatValue(performance.hp, "HP"),
      },
      {
        label: "Torque",
        data: formatStatValue(performance.torque_nm, "Nm"),
      },
      {
        label: "0-60",
        data: formatStatValue(performance.zero_to_sixty_sec, "Sec"),
      },
      {
        label: "Drive",
        data: formatStatValue(performance.drivetrain),
      },
    ],
    LUXURY: [
      {
        label: "Seats",
        data: formatStatValue(dimensions.seats, "Passengers"),
      },
      {
        label: "Weight",
        data: formatStatValue(dimensions.weight_kg, "kg"),
      },
      {
        label: "Trunk",
        data: formatStatValue(dimensions.trunk_capacity_l, "L"),
      },
    ],
    DESIGN: [
      {
        label: "Length",
        data: formatStatValue(dimensions.length_mm, "mm"),
      },
      {
        label: "Seats",
        data: formatStatValue(dimensions.seats, "Passengers"),
      },
      {
        label: "Trunk",
        data: formatStatValue(dimensions.trunk_capacity_l, "L"),
      },
    ],
    SAFETY: [
      {
        label: "Airbags",
        data: formatStatValue(safety.airbags),
      },
      {
        label: "Safety",
        data: formatStatValue(safety.rating_text),
      },
      {
        label: "Assist",
        data: formatStatValue((safety.assist_systems || []).length),
      },
    ],
  };

  const candidates = [
    ...(statCandidatesByTheme[themeTag] || []),
    {
      label: "Horsepower",
      data: formatStatValue(performance.hp, "HP"),
    },
    {
      label: "Torque",
      data: formatStatValue(performance.torque_nm, "Nm"),
    },
    {
      label: "Seats",
      data: formatStatValue(dimensions.seats, "Passengers"),
    },
    {
      label: "Trunk",
      data: formatStatValue(dimensions.trunk_capacity_l, "L"),
    },
  ];

  const unique = [];
  const seenLabels = new Set();

  for (const candidate of candidates) {
    if (!candidate?.data?.value) continue;
    if (seenLabels.has(candidate.label)) continue;

    seenLabels.add(candidate.label);
    unique.push({
      label: candidate.label,
      value: candidate.data.value,
      unit: candidate.data.unit || "",
    });

    if (unique.length >= 3) break;
  }

  return unique;
}

function buildFallbackSlideContent(scene, carContext) {
  const carLabel = `${carContext.identity.year} ${carContext.identity.make} ${carContext.identity.model}`;
  const featureLabel = toTitleCase(scene.main_feature_slug || scene.theme_tag || "Feature");
  const themeTag = scene.theme_tag || "GENERAL";
  const visualDirection = scene.visual_direction || {};
  const focusPoint = cleanSentenceFragment(visualDirection.focus_point || featureLabel.toLowerCase());
  const setting = cleanSentenceFragment(visualDirection.setting || "the road ahead");
  const keyStats = buildFallbackKeyStats(scene, carContext);

  const headline = featureLabel || "Signature Detail";
  const paragraph = `The ${carLabel} brings ${focusPoint.toLowerCase()} into focus, pairing the ${themeTag.toLowerCase()} story with concrete engineering details drawn from the vehicle data.`;
  const voiceoverText = `The ${carLabel} turns ${featureLabel.toLowerCase()} into something you can feel immediately. In ${setting.toLowerCase()}, every response feels deliberate, precise, and unmistakably BMW M.`;

  return {
    headline,
    paragraph,
    voiceover_text: voiceoverText,
    key_stats: keyStats,
    suggested_hotspots: [],
  };
}

function hasRenderableSlideContent(scene) {
  return Boolean(
    scene?.slide_content?.headline?.trim() ||
      scene?.slide_content?.paragraph?.trim() ||
      scene?.raw_voiceover?.trim() ||
      scene?.slide_content?.voiceover_text?.trim() ||
      (scene?.slide_content?.key_stats || []).length,
  );
}

function ensureSceneContent(scene, carContext, badges = []) {
  if (scene.scene_type !== "slide_view" && scene.scene_type !== "tech_view") {
    return scene;
  }

  if (hasRenderableSlideContent(scene)) {
    return scene;
  }

  const themeTag = scene.theme_tag || "GENERAL";
  const relevantCategories = THEME_TO_BADGE_CATEGORIES[themeTag] || [];
  const sceneBadges = badges
    .filter((badge) => relevantCategories.includes(badge.category))
    .slice(0, 2);

  const fallbackSlideContent = buildFallbackSlideContent(scene, carContext);

  return {
    ...scene,
    slide_content: {
      ...fallbackSlideContent,
      badges: sceneBadges,
      theme_tag: themeTag,
      alignment: scene.layout?.card_position || "left",
    },
    raw_voiceover: fallbackSlideContent.voiceover_text,
    subtitles: scene.subtitles || [],
    hotspots: scene.hotspots || [],
  };
}

async function writeScript(
  carContext,
  storyboard,
  badges = [],
  language = "en",
  templateStyle = "Cinematic",
) {
  const activeModel = selectTextModel({ prefer: "pro" });
  console.log(
    `✍️ Scriptwriter Agent: Writing scripts for ${storyboard.scenes.length} scenes in ${language}... (Template: ${templateStyle})`,
  );

  try {
    const scenePromises = storyboard.scenes.map(async (scene) =>
      processSingleScene(
        scene,
        carContext,
        badges,
        language,
        activeModel,
        templateStyle,
      ),
    );

    const fullyWrittenScenes = await Promise.all(scenePromises);
    console.log("✍️ Scriptwriter Agent: Done.");

    return {
      ...storyboard,
      scenes: fullyWrittenScenes,
    };
  } catch (error) {
    console.error("❌ Scriptwriter Agent Failed:", error);
    throw new Error("Failed to write scripts.");
  }
}

async function processSingleScene(
  scene,
  carContext,
  badges = [],
  language = "en",
  activeModel,
  templateStyle = "Cinematic",
) {
  const languageNames = { en: "English", fr: "French" };
  const outputLanguage = languageNames[language] || "English";
  const brandLogo = carContext.dealer?.logo_url || null;

  const vd = scene.visual_direction || {};
  const interiorKeywords = [
    "interior",
    "cabin",
    "inside",
    "cockpit",
    "dashboard",
    "passenger",
    "driver seat",
  ];
  const rawAngle = (
    (vd.camera_angle || "") +
    " " +
    (vd.focus_point || "") +
    " " +
    (vd.setting || "")
  ).toLowerCase();
  const cameraPerspective = interiorKeywords.some((kw) => rawAngle.includes(kw))
    ? "INTERIOR"
    : "EXTERIOR";

  const visualContext = vd.camera_angle
    ? `Camera Angle: ${vd.camera_angle} | Setting: ${vd.setting || "N/A"} | Focus: ${vd.focus_point || "N/A"} | Lighting: ${vd.lighting || "N/A"}`
    : "Not specified";

  const prompt = buildScriptPrompt({
    car_identity: `${carContext.identity.year} ${carContext.identity.make} ${carContext.identity.model}`,
    scene_type: scene.scene_type,
    scene_objective: scene.main_feature_slug || scene.scene_type,
    scene_theme: scene.theme_tag || "GENERAL",
    feature_data: JSON.stringify(carContext.normalized_specs),
    visual_direction: visualContext,
    camera_perspective: cameraPerspective,
    output_language: outputLanguage,
    template_style: templateStyle,
    document_context:
      carContext.document_context || "No additional documentation provided.",
  });

  try {
    const result = await generateStructuredData({
      model: activeModel,
      schema: ScriptOutputSchema,
      systemInstruction: prompt.systemInstruction,
      contents: prompt.userPrompt,
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 4096,
    });

    const updatedScene = { ...scene };

    if (scene.scene_type === "intro_view" && result.intro_content) {
      updatedScene.intro_content = {
        ...result.intro_content,
        background_image: scene.visual_direction?.setting || "default_intro.jpg",
        brand_logo: brandLogo,
      };
    } else if (scene.scene_type === "outro_view" && result.outro_content) {
      updatedScene.outro_content = {
        ...result.outro_content,
        cta_buttons: [
          {
            label: result.outro_content.cta_button_primary,
            action: "OPEN_LEAD_FORM",
            style: "primary",
          },
          {
            label: result.outro_content.cta_button_secondary,
            action: "REPLAY_STORY",
            style: "secondary",
          },
        ],
      };
    } else if (scene.scene_type === "tech_view" && result.slide_content) {
      const themeTag = scene.theme_tag || "GENERAL";
      const relevantCategories = THEME_TO_BADGE_CATEGORIES[themeTag] || [];
      const sceneBadges = badges
        .filter((badge) => relevantCategories.includes(badge.category))
        .slice(0, 2);

      updatedScene.slide_content = {
        ...result.slide_content,
        theme_tag: themeTag,
        badges: sceneBadges,
        suggested_hotspots: [],
      };

      updatedScene.hotspots = [];
      updatedScene.subtitles = [];
      updatedScene.raw_voiceover = result.slide_content.voiceover_text;
    } else if (scene.scene_type === "slide_view" && result.slide_content) {
      const hotspots = (result.slide_content.suggested_hotspots || []).map(
        (h, i) => ({
          id: `hs_${scene.scene_id}_${i}`,
          label: h.label,
          icon: h.icon || "circle",
          x: 50,
          y: 50,
          hover_content: {
            title: h.detail_title,
            body: h.detail_body,
          },
        }),
      );

      const themeTag = scene.theme_tag || "GENERAL";
      const relevantCategories = THEME_TO_BADGE_CATEGORIES[themeTag] || [];
      const sceneBadges = badges
        .filter((badge) => relevantCategories.includes(badge.category))
        .slice(0, 2);

      updatedScene.slide_content = {
        ...result.slide_content,
        theme_tag: themeTag,
        badges: sceneBadges,
      };

      updatedScene.hotspots = hotspots;
      updatedScene.subtitles = [];
      updatedScene.raw_voiceover = result.slide_content.voiceover_text;
    }

    const cardPos = scene.layout?.card_position;
    if (cardPos && updatedScene.slide_content) {
      updatedScene.slide_content.alignment = cardPos;
    }

    return ensureSceneContent(updatedScene, carContext, badges);
  } catch (err) {
    console.error(`⚠️ Failed to write scene ${scene.scene_id}:`, err.message);
    return ensureSceneContent(scene, carContext, badges);
  }
}

module.exports = { writeScript };
