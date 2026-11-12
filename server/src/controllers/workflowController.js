const { supabase } = require("../config/supabase");
const { logStep } = require("../services/utils/storyLogger");

// Import your existing agents
const { buildCarContext } = require("../services/ingestion/ingestionService");
const { analyzeCar } = require("../services/ai/analystAgent");
const { planStory } = require("../services/ai/directorAgent");
const { writeScript } = require("../services/ai/scriptwriterAgent");
const { visualizeStory } = require("../services/media/visualizerAgent");
const { produceAudio } = require("../services/media/audioAgent");
const { v4: uuidv4 } = require("uuid");

/**
 * HELPER: Get the current working state from Supabase
 */
async function getStoryState(storyId) {
  const { data, error } = await supabase
    .from("stories")
    .select("content, car_id") // We temporarily use 'content' as our scratchpad
    .eq("id", storyId)
    .single();

  if (error || !data)
    throw new Error("Could not fetch story state: " + error?.message);
  return data;
}

/**
 * HELPER: Save the updated working state to Supabase
 */
async function saveStoryState(storyId, newState) {
  const { error } = await supabase
    .from("stories")
    .update({ content: newState })
    .eq("id", storyId);

  if (error) throw new Error("Could not save story state: " + error.message);
}

// ============================================================================
// STEP 1: INGESTION
// ============================================================================
const stepIngestion = async (req, res) => {
  const { storyId, dealerInput } = req.body;
  try {
    await logStep(storyId, "INGESTION", "Connecting to Vehicle Database...");

    // 1. Run your existing ingestion service
    const carContext = await buildCarContext(dealerInput);

    // 2. Fetch current state, inject carContext, and save
    const state = await getStoryState(storyId);
    const newState = { ...state.content, carContext, dealerInput };
    await saveStoryState(storyId, newState);

    return res.status(200).json({ success: true, step: "INGESTION" });
  } catch (error) {
    console.error("Ingestion Step Failed:", error);
    await logStep(storyId, "ERROR", `Ingestion Failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================================
// STEP 2: ANALYST
// ============================================================================
const stepAnalyst = async (req, res) => {
  const { storyId } = req.body;
  try {
    await logStep(storyId, "ANALYST", "Identifying buyer persona & USP...");

    // 1. Get state from DB
    const state = await getStoryState(storyId);
    const { carContext } = state.content;
    const templateStyle =
      carContext.request_params?.template_style || "Cinematic";

    // 2. Run Analyst
    const analystReport = await analyzeCar(carContext, templateStyle);

    // 3. Save state
    const newState = { ...state.content, analystReport };
    await saveStoryState(storyId, newState);

    return res.status(200).json({ success: true, step: "ANALYST" });
  } catch (error) {
    console.error("Analyst Step Failed:", error);
    await logStep(storyId, "ERROR", `Analyst Failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const stepDirector = async (req, res) => {
  const { storyId } = req.body;
  try {
    await logStep(storyId, "DIRECTOR", "Structuring narrative arc...");
    const state = await getStoryState(storyId);
    const { carContext, analystReport, dealerInput } = state.content;
    const templateStyle =
      carContext.request_params?.template_style || "Cinematic";

    const initialStoryboard = await planStory(
      carContext,
      analystReport,
      dealerInput.scenes || "automatic",
      templateStyle,
    );

    await saveStoryState(storyId, { ...state.content, initialStoryboard });
    return res.status(200).json({ success: true, step: "DIRECTOR" });
  } catch (error) {
    console.error("Director Step Failed:", error);
    await logStep(storyId, "ERROR", `Director Failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================================
// STEP 4: SCRIPTWRITER
// ============================================================================
const stepScriptwriter = async (req, res) => {
  const { storyId } = req.body;
  try {
    await logStep(storyId, "SCRIPTWRITER", "Composing scene narration...");
    const state = await getStoryState(storyId);
    const { carContext, initialStoryboard, dealerInput } = state.content;
    const templateStyle =
      carContext.request_params?.template_style || "Cinematic";
    const language = dealerInput.language || "en";

    const scriptedStoryboard = await writeScript(
      carContext,
      initialStoryboard,
      carContext.certifications || [],
      language,
      templateStyle,
    );

    await saveStoryState(storyId, { ...state.content, scriptedStoryboard });
    return res.status(200).json({ success: true, step: "SCRIPTWRITER" });
  } catch (error) {
    console.error("Scriptwriter Step Failed:", error);
    await logStep(storyId, "ERROR", `Scriptwriter Failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================================
// STEP 5: VISUALIZER
// ============================================================================
const stepVisualizer = async (req, res) => {
  const { storyId } = req.body;
  try {
    await logStep(storyId, "IMAGE_GENERATOR", "Rendering cinematic assets...");
    const state = await getStoryState(storyId);
    const { carContext, scriptedStoryboard } = state.content;
    const templateStyle =
      carContext.request_params?.template_style || "Cinematic";

    const visualizedStoryboard = await visualizeStory(
      carContext,
      scriptedStoryboard,
      templateStyle,
    );

    await logStep(
      storyId,
      "VISION_SCANNER",
      "Scanning spatial coordinates & hotspots...",
    );
    await saveStoryState(storyId, { ...state.content, visualizedStoryboard });
    return res.status(200).json({ success: true, step: "VISUALIZER" });
  } catch (error) {
    console.error("Visualizer Step Failed:", error);
    await logStep(storyId, "ERROR", `Visualizer Failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================================
// STEP 6: AUDIO
// ============================================================================
const stepAudio = async (req, res) => {
  const { storyId } = req.body;
  try {
    await logStep(storyId, "AUDIO_ENGINE", "Synthesizing neural voiceover...");
    const state = await getStoryState(storyId);
    const { carContext, visualizedStoryboard, dealerInput } = state.content;
    const templateStyle =
      carContext.request_params?.template_style || "Cinematic";
    const language = dealerInput.language || "en";

    const finalStoryboard = await produceAudio(
      carContext,
      visualizedStoryboard,
      language,
      templateStyle,
    );

    await saveStoryState(storyId, { ...state.content, finalStoryboard });
    return res.status(200).json({ success: true, step: "AUDIO" });
  } catch (error) {
    console.error("Audio Step Failed:", error);
    await logStep(storyId, "ERROR", `Audio Failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================================
// STEP 7: QA & FINALIZE
// ============================================================================
const stepQA = async (req, res) => {
  const { storyId } = req.body;
  try {
    await logStep(
      storyId,
      "QA_SYSTEM",
      "Validating assets & assembling story...",
    );
    const state = await getStoryState(storyId);
    const { finalStoryboard, carContext, dealerInput } = state.content;

    // Run your existing QA function
    const polishedStory = runQualityAssurance(
      finalStoryboard,
      carContext,
      dealerInput,
    );

    // FINALIZE THE DATABASE ROW
    // We overwrite the messy "scratchpad" content with the clean, final JSON
    const { error: saveError } = await supabase
      .from("stories")
      .update({
        generation_status: "complete",
        current_agent: "COMPLETE",
        content: polishedStory,
        progress_logs: [`Pipeline finished successfully by GCP Workflows`],
      })
      .eq("id", storyId);

    if (saveError) throw saveError;
    console.log(`✅ GCP Pipeline Success! Story ${storyId} is ready.`);

    return res.status(200).json({ success: true, step: "QA", storyId });
  } catch (error) {
    console.error("QA Step Failed:", error);
    await logStep(storyId, "ERROR", `QA Failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
};

function runQualityAssurance(storyboard, carContext, dealerInput) {
  const safeStory = {};

  const internalIp = "http://66.245.203.59";
  const publicDomain = "https://db.revv-os.live";
  const fixUrl = (url) => {
    if (!url || typeof url !== "string") return url;
    return url.replace(internalIp, publicDomain);
  };

  safeStory.story_id = storyboard.story_id || uuidv4();
  safeStory.car_id = carContext.car_id || carContext.context_id;
  safeStory.title =
    storyboard.title ||
    `${carContext.identity.year} ${carContext.identity.model}`;
  safeStory.narrative_arc_summary = storyboard.narrative_arc_summary || "";

  safeStory.meta = {
    schema_version: "1.1.0",
    template: dealerInput.template || "Cinematic",
    language: dealerInput.language || "en",
    theme_color: "#007AFF",
    generated_at: new Date().toISOString(),
    features: {
      has_tech_views: storyboard.scenes.some(
        (s) => s.scene_type === "tech_view",
      ),
      tech_view_count: storyboard.scenes.filter(
        (s) => s.scene_type === "tech_view",
      ).length,
    },
  };

  safeStory.scenes = (storyboard.scenes || []).map((scene, index) => {
    const rawId = scene.scene_id || String(index).padStart(2, "0");

    const transformedScene = {
      id: rawId,
      type: scene.scene_type || "slide_view",
      theme_tag: scene.theme_tag || "GENERAL",
      order: index + 1,
      visual_direction: scene.visual_direction || {},
      layout: scene.layout || null,

      image_url:
        scene.scene_type === "tech_view"
          ? null
          : scene.image_url ||
            "https://placehold.co/1280x720?text=Generating...",

      audio_url: scene.audio_url || null,
      raw_voiceover: scene.raw_voiceover || "",
      subtitles: scene.subtitles || [],

      intro_content: scene.intro_content,
      slide_content: scene.slide_content,
      outro_content: scene.outro_content,

      hotspots: scene.hotspots || [],
    };

    // ── Ensure card_position is set on layout and synced to slide_content ──
    if (transformedScene.layout) {
      const sceneType = transformedScene.type;
      if (!transformedScene.layout.card_position) {
        if (sceneType === "intro_view" || sceneType === "outro_view") {
          transformedScene.layout.card_position = "left";
        } else if (sceneType === "tech_view") {
          transformedScene.layout.card_position = "right";
        } else {
          transformedScene.layout.card_position = "left";
        }
      }
      // Sync slide_content.alignment from card_position
      if (transformedScene.slide_content) {
        transformedScene.slide_content.alignment =
          transformedScene.layout.card_position;
      }
    }

    if (scene.scene_type === "tech_view") {
      const specs = carContext.normalized_specs || {};
      const performance = specs.performance || {};
      const safety = specs.safety || {};
      const dimensions = specs.dimensions || {};
      const carYear = carContext.identity?.year || 0;

      let techConfig = scene.tech_config || {
        mode: scene.theme_tag || "PERFORMANCE",
      };

      if (techConfig.mode === "PERFORMANCE") {
        techConfig = {
          ...techConfig,
          drivetrain: techConfig.drivetrain || performance.drivetrain || "FWD",
          engine_hp: techConfig.engine_hp ?? performance.hp ?? null,
          torque_nm: techConfig.torque_nm ?? performance.torque_nm ?? null,
          zero_to_sixty_sec:
            techConfig.zero_to_sixty_sec ??
            performance.zero_to_sixty_sec ??
            null,
        };
      } else if (techConfig.mode === "SAFETY") {
        const assistSystems = safety.assist_systems || [];
        const rawDump = carContext.raw_api_dump || {};
        const assistText = assistSystems.join(" ").toLowerCase();
        const rawDumpText = JSON.stringify(rawDump).toLowerCase();
        const searchText = `${assistText} ${rawDumpText}`;

        const sensorKeywords = [
          "parking sensor",
          "collision",
          "camera",
          "radar",
          "blind spot",
          "parking assist",
          "surround view",
        ];
        const hasExplicitSensorData = sensorKeywords.some((kw) =>
          searchText.includes(kw),
        );

        let hasFrontSensors = techConfig.has_front_sensors;
        let hasRearSensors = techConfig.has_rear_sensors;

        if (hasFrontSensors === undefined || hasFrontSensors === null) {
          hasFrontSensors = hasExplicitSensorData || carYear > 2018;
        }
        if (hasRearSensors === undefined || hasRearSensors === null) {
          hasRearSensors = hasExplicitSensorData || carYear > 2018;
        }

        techConfig = {
          ...techConfig,
          airbag_count: techConfig.airbag_count ?? safety.airbags ?? 6,
          has_front_sensors: hasFrontSensors,
          has_rear_sensors: hasRearSensors,
          safety_rating: techConfig.safety_rating ?? safety.rating_text ?? null,
          assist_systems: techConfig.assist_systems ||
            safety.assist_systems || ["ABS", "Traction Control"],
        };
      } else if (techConfig.mode === "UTILITY") {
        const existingDimensions = techConfig.dimensions || {};
        const safeDimensions = {
          length_mm:
            existingDimensions.length_mm ?? dimensions.length_mm ?? 4500,
          width_mm: existingDimensions.width_mm ?? dimensions.width_mm ?? 1800,
          height_mm:
            existingDimensions.height_mm ?? dimensions.height_mm ?? 1500,
          wheelbase_mm:
            existingDimensions.wheelbase_mm ?? dimensions.wheelbase_mm ?? null,
        };

        techConfig = {
          ...techConfig,
          dimensions: safeDimensions,
          trunk_capacity_liters:
            techConfig.trunk_capacity_liters ??
            dimensions.trunk_capacity_l ??
            null,
          seat_count: techConfig.seat_count ?? dimensions.seats ?? 5,
        };
      }

      transformedScene.tech_config = techConfig;
    }

    return transformedScene;
  });

  safeStory.badges = carContext.certifications || [];

  safeStory.car = {
    make: carContext.identity.make,
    model: carContext.identity.model,
    year: carContext.identity.year,
    trim: carContext.identity.trim,
    body_type: carContext.identity.body_type,
    color: carContext.visual_directives?.image_prompt_color || null,
    dealer_id: carContext.dealer_id || null,
  };

  const specs = carContext.normalized_specs || {};
  const carYear = carContext.identity?.year || 0;

  const assistSystems = specs.safety?.assist_systems || [];
  const rawDump = carContext.raw_api_dump || {};
  const assistText = assistSystems.join(" ").toLowerCase();
  const rawDumpText = JSON.stringify(rawDump).toLowerCase();
  const searchText = `${assistText} ${rawDumpText}`;
  const sensorKeywords = [
    "parking sensor",
    "collision",
    "camera",
    "radar",
    "blind spot",
  ];
  const hasExplicitSensorData = sensorKeywords.some((kw) =>
    searchText.includes(kw),
  );
  const defaultSensors = hasExplicitSensorData || carYear > 2018;

  safeStory.car_specs = {
    performance: {
      hp: specs.performance?.hp ?? null,
      torque_nm: specs.performance?.torque_nm ?? null,
      zero_to_sixty_sec: specs.performance?.zero_to_sixty_sec ?? null,
      top_speed_kmh: specs.performance?.top_speed_kmh ?? null,
      drivetrain: specs.performance?.drivetrain || "FWD",
      transmission: specs.performance?.transmission ?? null,
    },
    safety: {
      airbags: specs.safety?.airbags ?? 6,
      rating_text: specs.safety?.rating_text ?? null,
      assist_systems: specs.safety?.assist_systems || [],
      has_front_sensors: defaultSensors,
      has_rear_sensors: defaultSensors,
    },
    dimensions: {
      length_mm: specs.dimensions?.length_mm ?? 4500,
      width_mm: specs.dimensions?.width_mm ?? 1800,
      height_mm: specs.dimensions?.height_mm ?? 1500,
      trunk_capacity_l: specs.dimensions?.trunk_capacity_l ?? null,
      seats: specs.dimensions?.seats ?? 5,
      weight_kg: specs.dimensions?.weight_kg ?? null,
      wheelbase_mm: specs.dimensions?.wheelbase_mm ?? null,
    },
    efficiency: {
      fuel_combined_l_100km: specs.efficiency?.fuel_combined_l_100km ?? null,
      range_km: specs.efficiency?.range_km ?? null,
      is_electric: specs.efficiency?.is_electric || false,
    },
  };

  return safeStory;
}

module.exports = {
  stepIngestion,
  stepAnalyst,
  stepDirector,
  stepScriptwriter,
  stepVisualizer,
  stepAudio,
  stepQA,
};
