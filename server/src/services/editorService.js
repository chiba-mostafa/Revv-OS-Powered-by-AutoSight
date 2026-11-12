const { supabase } = require("../config/supabase");
const { generateEditorImage } = require("./media/googleImageService");
const { buildImagePrompt } = require("./media/promptBuilder");
const {
  extractJsonPayload,
  generateStructuredData,
  generateText,
  selectTextModel,
} = require("../config/aiConfig");
const {
  CopilotResponseSchema,
  SceneSchema,
} = require("./ai/schemas/editorSchemas");
const {
  getWordTimestamps,
  getGeminiSubtitlesFromWords,
} = require("./media/transcriptionService");
const { parseSubtitles } = require("./media/subtitleParser");
const {
  synthesizeVoiceover,
  resolveVoiceSelection,
} = require("./media/googleVoiceService");

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Regenerate Voiceover
// ═══════════════════════════════════════════════════════════════════════════════
async function regenerateVoiceover({ text, voice, sceneId, language = "en" }) {
  if (!text || text.trim().length === 0) {
    throw new Error("Voiceover text is required");
  }

  const voiceModel = resolveVoiceSelection({
    voice,
    language,
    templateStyle: "Cinematic",
  }).id;
  console.log(
    `   🎧 Editor: Regenerating TTS for ${sceneId} (${voiceModel})...`,
  );

  const audioArtifacts = await synthesizeVoiceover(text, {
    sceneId,
    language,
    voice: voiceModel,
    templateStyle: "Cinematic",
    filePrefix: "editor",
  });

  // ── Generate subtitles from the audio ──────────────────────────────────
  let subtitles = [];
  try {
    console.log(`   📝 Editor: Generating subtitles for ${sceneId}...`);
    const rawWords = await getWordTimestamps(
      audioArtifacts.audioBuffer,
      language,
      text,
    );

    if (rawWords.length > 0) {
      const geminiResult = await getGeminiSubtitlesFromWords(rawWords);
      subtitles = geminiResult ?? parseSubtitles(rawWords);
    }
    console.log(
      `   ✅ Editor: Generated ${subtitles.length} subtitle segments`,
    );
  } catch (subErr) {
    console.warn(`   ⚠️ Editor: Subtitle generation failed:`, subErr.message);
  }

  return { audio_url: audioArtifacts.publicUrl, subtitles };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Regenerate Image
// ═══════════════════════════════════════════════════════════════════════════════
async function regenerateImage({
  prompt,
  scene,
  car,
  template = "cinematic",
  imageUrl,
}) {
  const isMinimalTech =
    (template || "").toLowerCase().replace(/[\s-]/g, "") === "minimaltech";
  const templateLabel = isMinimalTech ? "Minimal Tech" : "Cinematic";
  const styleStr = isMinimalTech
    ? "pure white studio background, even softbox lighting, hyper-realistic product photography, sharp focus, minimal shadows, clean aesthetic, 8k"
    : "photorealistic, 8k, highly detailed, automotive photography, commercial car advertisement, dramatic shadows, volumetric lighting, ray tracing, sharp focus";

  let finalPrompt;

  // ── Detect interior vs exterior for spatial composition ──
  const interiorKeywords =
    /interior|dashboard|cabin|cockpit|steering|console|seat|inside/i;
  const sceneHint = `${scene?.visual_direction?.camera_angle || ""} ${scene?.visual_direction?.focus_point || ""} ${scene?.visual_direction?.setting || ""} ${prompt || ""}`;
  const isInterior = interiorKeywords.test(sceneHint);

  // ── Dynamic spatial composition based on card_position ──
  const cardPosition =
    scene?.layout?.card_position || scene?.slide_content?.alignment || "left";
  const carOnRight = cardPosition === "left";

  let spatialComposition;
  if (isInterior) {
    spatialComposition = carOnRight
      ? "Shot from the driver-side window looking inward toward the passenger side, center console and passenger seat in focus, left foreground in deep shadow, negative space on the left of the frame."
      : "Shot from the passenger-side window looking inward toward the driver side, steering wheel and dashboard in focus, right foreground in deep shadow, negative space on the right of the frame.";
  } else {
    spatialComposition = carOnRight
      ? "Right-aligned composition, car positioned in the right-third of the frame, asymmetrical framing, vast empty space on the left side of the image."
      : "Left-aligned composition, car positioned in the left-third of the frame, asymmetrical framing, vast empty space on the right side of the image.";
  }

  const stripSpatialInstructions = (text = "") =>
    text
      .replace(/\b(right|left)-aligned composition\b[^.]*\.?/gi, "")
      .replace(
        /\bcar positioned in the (right|left)-third of the frame\b[^.]*\.?/gi,
        "",
      )
      .replace(
        /\bvast empty (white\s+)?space on the (left|right)( side of the image)?\b[^.]*\.?/gi,
        "",
      )
      .replace(/\bvast empty asphalt on the (left|right)\b[^.]*\.?/gi, "")
      .replace(/\bdark empty space on the (left|right)\b[^.]*\.?/gi, "")
      .replace(
        /\bnegative space on the (left|right) of the frame\b[^.]*\.?/gi,
        "",
      )
      .replace(
        /\bshot from the (driver|passenger)-side window looking inward[^.]*\.?/gi,
        "",
      )
      .replace(/\s{2,}/g, " ")
      .trim();

  if (prompt) {
    // User-specified prompt — enrich with car identity, theme style, and spatial composition
    const subject = car
      ? `${car.year || ""} ${car.make || ""} ${car.model || ""}, ${car.color || ""}, ${car.body_type || ""}`
      : "a car";
    const sanitizedPrompt = stripSpatialInstructions(prompt);
    finalPrompt = `${spatialComposition} ${sanitizedPrompt}. Subject: ${subject}. Style: ${styleStr}`;
  } else if (scene?.visual_direction && car) {
    // Auto from scene context (buildImagePrompt handles spatial composition internally)
    finalPrompt = buildImagePrompt(
      scene,
      {
        identity: car,
        visual_directives: { image_prompt_color: car.color || "metallic" },
      },
      templateLabel,
    );
  } else {
    const subject = car
      ? `${car.year} ${car.make} ${car.model}`
      : "a modern car";
    const fallbackComposition = carOnRight
      ? "right-aligned composition, car positioned in the right-third of the frame, vast empty space on the left"
      : "left-aligned composition, car positioned in the left-third of the frame, vast empty space on the right";
    finalPrompt = isMinimalTech
      ? `Pure white studio product shot of ${subject}, ${fallbackComposition}, clean white cyclorama background, flat even lighting, technical automotive photography, sharp focus, 8k`
      : `Cinematic wide shot of ${subject}, ${fallbackComposition}, studio showroom, photorealistic, 8k, automotive photography, commercial car advertisement`;
  }

  const baseImageUrl =
    imageUrl ||
    scene?.image_url ||
    scene?.intro_content?.background_image ||
    scene?.outro_content?.image_url ||
    null;

  console.log(`   🎨 Editor: Generating image...`);
  const image_url = await generateEditorImage(finalPrompt, undefined, {
    inputImageUrl: baseImageUrl,
  });
  return { image_url };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Generate Scene (AI)
// ═══════════════════════════════════════════════════════════════════════════════
async function generateScene({
  prompt,
  car,
  existingScenes,
  insertAfterIndex,
  template = "cinematic",
}) {
  const isMinimalTech =
    (template || "").toLowerCase().replace(/[\s-]/g, "") === "minimaltech";
  const templateLabel = isMinimalTech ? "Minimal Tech" : "Cinematic";
  const activeModel = selectTextModel({ prefer: "flash" });
  const carContext = car
    ? `${car.year} ${car.make} ${car.model} (${car.body_type}, ${car.color})`
    : "a vehicle";

  const existingSummary = (existingScenes || [])
    .map((s, i) => `  ${i + 1}. [${s.type}] ${s.headline || s.theme_tag}`)
    .join("\n");

  const systemPrompt = `You are an expert automotive storytelling AI. Generate a single narrative scene for a car presentation story.

RULES:
- NEVER generate "tech_view" type scenes (those require 3D models)
- Output ONLY "slide_view" type scenes
- Match the car's persona and brand DNA
- Create visually compelling, emotionally resonant content
- The voiceover should be conversational and engaging (max 50 words)
- Include 2-3 key_stats with value and label

Respond with ONLY valid JSON, no markdown fences.`;

  const userPrompt = `Car: ${carContext}
User request: "${prompt}"
Existing scenes:
${existingSummary || "  (none)"}
Insert position: after scene ${(insertAfterIndex || 0) + 1}

Generate a JSON scene object with this exact structure:
{
  "scene_id": "scene_<unique_id>",
  "type": "slide_view",
  "order": ${(insertAfterIndex || 0) + 2},
  "theme_tag": "<short-tag>",
  "duration_seconds": 8,
  "layout": {
    "composition": "<one of: split-image-left, split-image-right, full-bleed, overlay-bottom, centered-focus>",
    "content_alignment": "<one of: top-left, top-center, top-right, middle-left, middle-center, middle-right, bottom-left, bottom-center, bottom-right>",
    "card_position": "<one of: left, right — which side the info card appears on; if car is on the right, use left and vice versa>",
    "motion": {
      "image": "<one of: slow-zoom-in, slow-zoom-out, subtle-pan-right, static>",
      "content": "<one of: fade-up, slide-in-left, slide-in-right>"
    }
  },
  "slide_content": {
    "headline": "<short impactful headline>",
    "paragraph": "<1-2 sentence description>",
    "key_stats": [
      { "value": "<number or short text>", "label": "<stat label>" }
    ],
    "badges": []
  },
  "visual_direction": {
    "setting": "<environment description>",
    "lighting": "<lighting description>",
    "camera_angle": "<camera description>",
    "focus_point": "<what to focus on>"
  },
  "voiceover_text": "<engaging narration, max 50 words>",
  "audio_url": null,
  "image_url": null,
  "hotspots": []
}`;

  const sceneJson = await generateStructuredData({
    model: activeModel,
    schema: SceneSchema,
    systemInstruction: systemPrompt,
    contents: userPrompt,
    temperature: 0.3,
    topP: 0.9,
    maxOutputTokens: 4096,
  });

  // Ensure essential fields
  sceneJson.type = "slide_view";
  sceneJson.scene_id = sceneJson.scene_id || `scene_ai_${Date.now()}`;
  sceneJson.audio_url = null;
  sceneJson.image_url = null;
  sceneJson.hotspots = sceneJson.hotspots || [];

  // Ensure card_position is set and synced
  if (!sceneJson.layout) sceneJson.layout = {};
  const cardPos = sceneJson.layout.card_position === "right" ? "right" : "left";
  sceneJson.layout.card_position = cardPos;
  if (sceneJson.slide_content) {
    sceneJson.slide_content.alignment = cardPos;
  }

  // Generate image for the new scene with dynamic spatial composition
  const genCarOnRight = cardPos === "left";
  try {
    const imagePrompt = sceneJson.visual_direction
      ? buildImagePrompt(
          sceneJson,
          {
            identity: car || {},
            visual_directives: { image_prompt_color: car?.color || "metallic" },
          },
          templateLabel,
        )
      : isMinimalTech
        ? `Pure white studio product shot of ${carContext}, ${genCarOnRight ? "right-aligned composition, car positioned in the right-third of the frame, vast empty white space on the left" : "left-aligned composition, car positioned in the left-third of the frame, vast empty white space on the right"}, clean white cyclorama background, flat even lighting, technical automotive photography, sharp focus, 8k`
        : `Cinematic shot of ${carContext}, ${genCarOnRight ? "right-aligned composition, car positioned in the right-third of the frame, vast dark empty space on the left" : "left-aligned composition, car positioned in the left-third of the frame, vast dark empty space on the right"}, showroom, photorealistic, 8k, dramatic lighting`;

    sceneJson.image_url = await generateEditorImage(imagePrompt);
  } catch (imgErr) {
    console.error("Image generation failed for new scene:", imgErr.message);
  }

  return { scene: sceneJson };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Copilot Agent
// ═══════════════════════════════════════════════════════════════════════════════

function buildCarSpecsBlock(fullStory) {
  const specs = fullStory?.car_specs;
  if (!specs) return "  (no specs available)";
  const lines = [];
  const p = specs.performance || {};
  const s = specs.safety || {};
  const d = specs.dimensions || {};
  lines.push("  Performance:");
  if (p.hp) lines.push(`    HP: ${p.hp}`);
  if (p.torque_nm) lines.push(`    Torque: ${p.torque_nm} Nm`);
  if (p.zero_to_sixty_sec) lines.push(`    0-60: ${p.zero_to_sixty_sec}s`);
  if (p.drivetrain) lines.push(`    Drivetrain: ${p.drivetrain}`);
  if (p.top_speed_kmh) lines.push(`    Top Speed: ${p.top_speed_kmh} km/h`);
  lines.push("  Safety:");
  if (s.airbags) lines.push(`    Airbags: ${s.airbags}`);
  if (s.rating_text) lines.push(`    Rating: ${s.rating_text}`);
  if (s.assist_systems?.length)
    lines.push(`    Assist Systems: ${s.assist_systems.join(", ")}`);
  lines.push("  Dimensions:");
  if (d.length_mm) lines.push(`    Length: ${d.length_mm} mm`);
  if (d.width_mm) lines.push(`    Width: ${d.width_mm} mm`);
  if (d.height_mm) lines.push(`    Height: ${d.height_mm} mm`);
  if (d.wheelbase_mm) lines.push(`    Wheelbase: ${d.wheelbase_mm} mm`);
  if (d.trunk_capacity_l) lines.push(`    Trunk: ${d.trunk_capacity_l} L`);
  if (d.seats) lines.push(`    Seats: ${d.seats}`);
  return lines.join("\n");
}

function extractReferencedSceneNumbers(message = "") {
  const references = new Set();
  const regex = /scene\s*#?\s*(\d+)/gi;
  let match;

  while ((match = regex.exec(message)) !== null) {
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value)) {
      references.add(value);
    }
  }

  const wordRegex =
    /scene\s*#?\s*(one|two|three|four|five|six|seven|eight|nine|ten)/gi;
  const wordMap = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  let wordMatch;
  while ((wordMatch = wordRegex.exec(message)) !== null) {
    const value = wordMap[wordMatch[1].toLowerCase()];
    if (Number.isFinite(value)) {
      references.add(value);
    }
  }

  return references;
}

function normalizeSceneIndex(index, shouldShiftAll, maxScenes, options = {}) {
  if (!Number.isFinite(index)) return index;

  const allowNegative = options.allowNegative ?? false;
  let nextIndex = index;

  if (shouldShiftAll && index > 0) {
    nextIndex = index - 1;
  }

  if (!Number.isFinite(maxScenes) || maxScenes <= 0) {
    return nextIndex;
  }

  if (allowNegative && nextIndex === -1) {
    return nextIndex;
  }

  return Math.min(Math.max(nextIndex, 0), maxScenes - 1);
}

function normalizeCopilotSceneIndices(actions = [], message, totalScenes = 0) {
  const referencedNumbers = extractReferencedSceneNumbers(message);
  const shouldShiftAll = referencedNumbers.size > 0;
  if (!shouldShiftAll) return actions;

  return actions.map((action) => {
    const nextAction = { ...action };

    if (Number.isFinite(nextAction.sceneIndex)) {
      nextAction.sceneIndex = normalizeSceneIndex(
        nextAction.sceneIndex,
        shouldShiftAll,
        totalScenes,
      );
    }

    if (Number.isFinite(nextAction.afterIndex)) {
      nextAction.afterIndex = normalizeSceneIndex(
        nextAction.afterIndex,
        shouldShiftAll,
        totalScenes,
        { allowNegative: true },
      );
    }

    if (Array.isArray(nextAction.sceneUpdates)) {
      nextAction.sceneUpdates = nextAction.sceneUpdates.map((update) => ({
        ...update,
        sceneIndex: normalizeSceneIndex(
          update.sceneIndex,
          shouldShiftAll,
          totalScenes,
        ),
      }));
    }

    return nextAction;
  });
}

function parseRethemeIntent(message = "") {
  const text = message.toLowerCase();
  const template = /minimal\s*tech|minimaltech|minimal-tech/.test(text)
    ? "minimaltech"
    : /cinematic/.test(text)
      ? "cinematic"
      : null;
  const language = /\bfrench\b|\bfrancais\b|\bfr\b/.test(text)
    ? "fr"
    : /\benglish\b|\ben\b/.test(text)
      ? "en"
      : null;
  const wantsTranslate = /translate|translation/.test(text);
  const shouldRetheme = !!template || !!language || wantsTranslate;

  return {
    shouldRetheme,
    template,
    language,
  };
}

function getTemplateLabel(template) {
  if (template === "minimaltech") return "Minimal Tech";
  if (template === "cinematic") return "Cinematic";
  return null;
}

function getLanguageLabel(language) {
  if (language === "fr") return "French";
  if (language === "en") return "English";
  return null;
}

function getDefaultVoice(template, language) {
  if (language === "fr") return "fr-FR-Chirp-HD-F";
  if (language === "en") {
    return template === "minimaltech" ? "en-US-Chirp-HD-F" : "en-US-Chirp-HD-D";
  }
  return null;
}

function upsertUpdateMetaAction(actions, updates) {
  if (!updates || Object.keys(updates).length === 0) return actions;
  const index = actions.findIndex((action) => action.type === "UPDATE_META");
  if (index === -1) {
    return [{ type: "UPDATE_META", updates }, ...actions];
  }

  const nextActions = [...actions];
  const current = nextActions[index] || {};
  nextActions[index] = {
    ...current,
    updates: { ...(current.updates || {}), ...updates },
  };

  return nextActions;
}

function buildRethemeMessage(intent, fallbackMessage) {
  const parts = [];
  const templateLabel = getTemplateLabel(intent.template);
  const languageLabel = getLanguageLabel(intent.language);

  if (templateLabel) parts.push(`switch to ${templateLabel} theme`);
  if (languageLabel) parts.push(`translate everything to ${languageLabel}`);

  if (parts.length === 0) return fallbackMessage;
  return parts.length === 2 ? `${parts[0]} and ${parts[1]}` : parts[0];
}

function ensureBatchVoice(action, intent) {
  if (!action || action.type !== "UPDATE_ALL_SCENES") return action;
  if (!intent.language || action.voice) return action;
  const voice = getDefaultVoice(intent.template, intent.language);
  if (!voice) return action;

  return { ...action, voice };
}

async function generateRethemeBatchActions({
  activeModel,
  systemPrompt,
  chatHistory,
  message,
  intent,
}) {
  const overrideLines = [
    "IMPORTANT: You must return a single UPDATE_ALL_SCENES action that updates every scene.",
    "Do NOT include UPDATE_META in this response.",
  ];
  const templateLabel = getTemplateLabel(intent.template);
  const languageLabel = getLanguageLabel(intent.language);
  if (templateLabel) overrideLines.push(`Target template: ${templateLabel}.`);
  if (languageLabel) overrideLines.push(`Target language: ${languageLabel}.`);

  const rethemePrompt = `${systemPrompt}\n\n${overrideLines.join("\n")}`;
  const rethemeMessage = buildRethemeMessage(intent, message);
  const historyBlocks = chatHistory.slice(-8).map((h) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));

  return generateStructuredData({
    model: activeModel,
    schema: CopilotResponseSchema,
    systemInstruction: rethemePrompt,
    contents: [
      ...historyBlocks,
      {
        role: "user",
        parts: [{ text: rethemeMessage }],
      },
    ],
    temperature: 0.2,
    topP: 0.9,
    maxOutputTokens: 8192,
  });
}

async function processCopilotMessage({
  message,
  storySummary,
  fullStory,
  currentSceneIndex,
  chatHistory = [],
}) {
  const activeModel = selectTextModel({ prefer: "pro" });

  const carLabel = storySummary?.car
    ? `${storySummary.car.year} ${storySummary.car.make} ${storySummary.car.model}`
    : "Unknown";

  const currentTemplate = fullStory?.meta?.template || "cinematic";
  const currentLanguage = fullStory?.language || storySummary?.language || "en";

  const systemPrompt = `You are AutoSense Copilot — an AI assistant with full control over a car presentation story JSON.

You can:
- Edit any scene's text (headlines, paragraphs, voiceover scripts)
- Change layouts (composition, alignment, motion)
- Add or remove scenes (including 3D tech_view scenes)
- Modify badges, hotspots, key_stats
- Reorder scenes
- Change theme tags
- Switch the global presentation theme (Cinematic / Minimal Tech)
- Translate all content to a different language
- Regenerate a scene's visual and audio media with new content

══════════════════════════════════════════════════════════════════════
CONTEXT
══════════════════════════════════════════════════════════════════════
- Car: ${carLabel}
- Total Scenes: ${storySummary?.totalScenes || 0}
- User is viewing scene index: ${currentSceneIndex}
- Current Theme: ${currentTemplate}
- Current Language: ${currentLanguage}

CAR SPECIFICATIONS (use these real numbers — NEVER hallucinate specs):
${buildCarSpecsBlock(fullStory)}

Use the existing backend schema names exactly when editing or creating tech_view scenes:
- PERFORMANCE uses engine_hp, torque_nm, zero_to_sixty_sec, drivetrain
- SAFETY uses airbag_count, has_front_sensors, has_rear_sensors, assist_systems
- UTILITY uses trunk_capacity_liters, seat_count, and dimensions { length_mm, width_mm, height_mm, wheelbase_mm }

STORY OVERVIEW:
${(storySummary?.scenes || []).map((s, i) => `  Scene ${i + 1} [${s.type}] theme_tag="${s.theme_tag}" card_position="${s.layout?.card_position || s.slide_content?.alignment || (s.type === "tech_view" ? "right" : "left")}": "${s.headline}" — ${s.paragraph?.slice(0, 80) || "(no text)"}...`).join("\n")}

══════════════════════════════════════════════════════════════════════
RESPONSE FORMAT
══════════════════════════════════════════════════════════════════════
Respond with valid JSON only (no markdown fences):
{
  "message": "<friendly response to the user explaining what you did>",
  "actions": [ ... ]
}

══════════════════════════════════════════════════════════════════════
ACTION TYPES
══════════════════════════════════════════════════════════════════════

Scene numbers in user requests are 1-based. Convert them to 0-based indices in actions (scene 1 -> sceneIndex 0).

1. UPDATE_SCENE — merge partial updates into one scene
   { "type": "UPDATE_SCENE", "sceneIndex": <0-based>, "updates": { ... } }
   updates can contain: slide_content, intro_content, outro_content, layout,
   voiceover_text, theme_tag, duration_seconds, hotspots, key_stats, tech_config
   When updating layout, you can set card_position to "left" or "right" to control
   which side the info card appears on (only meaningful for slide_view scenes).

2. ADD_SCENE — insert a new scene (slide_view OR tech_view)
   {
     "type": "ADD_SCENE",
     "scene": { <full scene object with image_url: null> },
     "afterIndex": <0-based or -1 for end>,
     "imagePrompt": "<theme-appropriate image generation prompt>"
   }
   For slide_view, intro_view, and outro_view scenes, you MUST include imagePrompt.
   DO NOT include imagePrompt for tech_view scenes (they render a live 3D WebGL model).

3. REMOVE_SCENE — delete a scene
   { "type": "REMOVE_SCENE", "sceneIndex": <0-based> }

4. GO_TO_SCENE — navigate the editor to a scene
   { "type": "GO_TO_SCENE", "sceneIndex": <0-based> }

5. REGENERATE_SCENE — rewrite a scene's text AND regenerate its image and voiceover
   {
     "type": "REGENERATE_SCENE",
     "sceneIndex": <0-based>,
     "updates": {
       "slide_content": { "headline": "...", "paragraph": "...", "key_stats": [...] },
       "voiceover_text": "..."
     },
     "imagePrompt": "<detailed image generation prompt for the new visual>"
   }
   The frontend will apply the text updates immediately, then fire background
   API calls to regenerate the image and voiceover audio.

6. UPDATE_META — change global story metadata (theme, language, title)
   { "type": "UPDATE_META", "updates": { "template": "minimaltech" } }
   Valid template values: "cinematic", "minimaltech"
   When changing template, the frontend will propagate the theme to ALL scenes.
   When changing language, include a "language" field (e.g. "fr", "en").

7. UPDATE_ALL_SCENES — batch-update text & media across every scene
   This is the POWERHOUSE action for full retheme, translation, and tone changes.
   {
     "type": "UPDATE_ALL_SCENES",
     "voice": "<optional TTS voice model id — see VOICE MODELS below>",
     "sceneUpdates": [
       {
         "sceneIndex": 0,
         "updates": { "intro_content": { "title": "...", "subtitle": "..." } },
         "imagePrompt": "<optional — detailed prompt for AI image regeneration>"
       },
       {
         "sceneIndex": 1,
         "updates": { "slide_content": { "headline": "...", "paragraph": "..." }, "voiceover_text": "..." },
         "imagePrompt": "<optional — only for slide_view scenes that have images>"
       }
     ]
   }
   The frontend will: apply all text, regenerate voiceovers (with the voice you chose),
   AND regenerate images for any scene that has an imagePrompt.

══════════════════════════════════════════════════════════════════════
VOICE MODELS (Google Chirp HD / Journey-style TTS)
══════════════════════════════════════════════════════════════════════
When changing language, you MUST also switch the voice model.

  English voices:
    "en-US-Chirp-HD-D"  — Male, deep dramatic (best for Cinematic)
    "en-US-Chirp-HD-F"  — Female, clean professional (best for Minimal Tech)

  French voices:
    "fr-FR-Chirp-HD-F"  — Female, crisp professional (use for French content)
    "fr-FR-Chirp-HD-D"  — Male, grounded alternative

Default pairing:
  Cinematic + English → "en-US-Chirp-HD-D"
  Minimal Tech + English → "en-US-Chirp-HD-F"
  Cinematic + French → "fr-FR-Chirp-HD-F"
  Minimal Tech + French → "fr-FR-Chirp-HD-F"

══════════════════════════════════════════════════════════════════════
TECH VIEW SCENES — 3D INTERACTIVE
══════════════════════════════════════════════════════════════════════
You CAN and SHOULD create tech_view scenes when the user asks about
performance stats, safety features, cargo/trunk capacity, dimensions, etc.

A tech_view scene requires these fields:
{
  "scene_id": "scene_tech_<id>",
  "type": "tech_view",
  "theme_tag": "PERFORMANCE" | "SAFETY" | "UTILITY",
  "duration_seconds": 10,
  "layout": {
    "composition": "full-bleed",
    "content_alignment": "middle-left",
    "card_position": "right",
    "motion": { "image": "static", "content": "fade-up" }
  },
  "slide_content": {
    "headline": "<short headline>",
    "paragraph": "<1-2 sentences>",
    "key_stats": [ { "value": "<number>", "label": "<label>" } ],
    "badges": []
  },
  "tech_config": { ... },
  "voiceover_text": "<max 50 words>",
  "audio_url": null,
  "image_url": null,
  "hotspots": [],
  "camera_views": ["primary","secondary","tertiary"]
}

tech_config per mode (use REAL values from CAR SPECIFICATIONS above):

PERFORMANCE:
  { "mode": "PERFORMANCE", "drivetrain": "<AWD/FWD/RWD>", "engine_hp": <number>, "torque_nm": <number>, "zero_to_sixty_sec": <number> }

SAFETY:
  { "mode": "SAFETY", "airbag_count": <number>, "has_front_sensors": true/false, "has_rear_sensors": true/false, "assist_systems": ["<system1>", ...] }

UTILITY:
  { "mode": "UTILITY", "trunk_capacity_liters": <number>, "seat_count": <number>, "dimensions": { "length_mm": <number>, "width_mm": <number>, "height_mm": <number>, "wheelbase_mm": <number> } }

══════════════════════════════════════════════════════════════════════
FULL RETHEME + TRANSLATION OPERATION
══════════════════════════════════════════════════════════════════════
When the user asks to switch themes AND/OR translate, you must do ALL of these:

1. UI SURFACE — UPDATE_META with new template + language
2. TEXT — Rewrite ALL headlines, paragraphs, voiceover scripts.
   Do NOT just translate literally — adapt the *persona*:
   • Cinematic persona: Emotional, poetic, sensory ("Beneath the sculpted hood lies a ferocious heart...")
   • Minimal Tech persona: Clinical, data-first, precise ("Architecture à double moteur. Temps de réponse: 0,2s.")
3. IMAGES — Include imagePrompt for every slide_view, intro_view, and outro_view scene.
   Skip tech_view scenes only — they render a live 3D WebGL model, not a background image.

   ─── SPATIAL COMPOSITION (CRITICAL) ───
   The viewer UI overlays an info card on one side of each slide_view image, controlled by layout.card_position ("left" or "right").
   To prevent the card from hiding the car, ALL imagePrompts MUST position the subject on the OPPOSITE side from card_position:
   Always inspect the current scene's card_position from STORY OVERVIEW before writing an imagePrompt.

   • If card_position is "left" (default): Push the car to the RIGHT side of the frame.
     EXTERIOR: "right-aligned composition, car positioned in the right-third of the frame, asymmetrical framing"
     Fill left with environment: "vast empty asphalt on the left" (Cinematic) or "vast empty white space on the left" (Minimal Tech).

   • If card_position is "right": Push the car to the LEFT side of the frame.
     EXTERIOR: "left-aligned composition, car positioned in the left-third of the frame, asymmetrical framing"
     Fill right with environment: "vast empty asphalt on the right" (Cinematic) or "vast empty white space on the right" (Minimal Tech).

   • INTERIOR shots (dashboard, cabin, steering, console, seats):
     card_position "left": "shot from the driver-side window looking inward, negative space on the left of the frame"
     card_position "right": "shot from the passenger-side window looking inward, negative space on the right of the frame"

   Theme image styles (adjust left/right based on card_position):
   • Cinematic: "dark moody environment, rain-slicked streets, dramatic neon reflections, volumetric fog, 8k, [left or right]-aligned composition, car in the [opposite]-third of the frame, dark empty space on the [card_position side]"
   • Minimal Tech: "white cyclorama studio, flat even lighting, technical product shot, clean minimal background, sharp focus, [left or right]-aligned composition, car in the [opposite]-third of the frame, vast empty white space on the [card_position side]"
   Always include the car subject: "${carLabel}, <color>, <body_type>"
4. AUDIO — Set the "voice" field on UPDATE_ALL_SCENES to the correct language voice.
5. STRUCTURE — Keep the EXACT same number of scenes in the EXACT same order.
   The dealer liked the structure; they just want a different vibe and language.

══════════════════════════════════════════════════════════════════════
COMPOUND ACTIONS
══════════════════════════════════════════════════════════════════════
You can return MULTIPLE actions in a single response. Execute them in order.

Example — "Switch to minimal tech and translate to French" (FULL RETHEME):
{
  "message": "Done! I've switched to Minimal Tech, translated everything to French, set a French voice, and queued new studio-style images for every scene.",
  "actions": [
    { "type": "UPDATE_META", "updates": { "template": "minimaltech", "language": "fr" } },
    {
      "type": "UPDATE_ALL_SCENES",
      "voice": "fr-FR-Chirp-HD-F",
      "sceneUpdates": [
        {
          "sceneIndex": 0,
          "updates": { "intro_content": { "title": "...", "subtitle": "...", "start_button_label": "Commencer" } },
          "imagePrompt": "White cyclorama studio, flat even lighting, dramatic hero shot of ${carLabel}, right-aligned composition, car positioned in the right-third of the frame, vast empty white space on the left, front 3/4 angle, clean minimal background, sharp focus, technical product photography"
        },
        {
          "sceneIndex": 1,
          "updates": { "slide_content": { "headline": "...", "paragraph": "...", "key_stats": [...] }, "layout": { "card_position": "left" }, "voiceover_text": "..." },
          "imagePrompt": "White cyclorama studio, flat even lighting, technical product shot of ${carLabel}, right-aligned composition, car positioned in the right-third of the frame, vast empty white space on the left, clean minimal background, sharp focus, showing exterior front 3/4 angle"
        },
        {
          "sceneIndex": 2,
          "updates": { "slide_content": { "headline": "...", "paragraph": "...", "key_stats": [...] }, "voiceover_text": "..." },
          "imagePrompt": "White cyclorama studio, flat even lighting, engine bay detail shot of ${carLabel}, right-aligned composition, mechanical details in the right-third of the frame, deep shadow on the left, technical product photography"
        },
        {
          "sceneIndex": 3,
          "updates": { "outro_content": { "headline": "...", "subheadline": "...", "cta_buttons": [...] } },
          "imagePrompt": "White cyclorama studio, flat even lighting, rear 3/4 beauty shot of ${carLabel}, right-aligned composition, car positioned in the right-third of the frame, vast empty white space on the left, clean minimal background, product photography"
        }
      ]
    }
  ]
}

Example — "Add a tech view showing trunk capacity":
{
  "message": "I've added a 3D Utility tech view showing the exact trunk capacity.",
  "actions": [
    {
      "type": "ADD_SCENE",
      "afterIndex": ${currentSceneIndex},
      "scene": {
        "scene_id": "scene_tech_utility",
        "type": "tech_view",
        "theme_tag": "UTILITY",
        "duration_seconds": 10,
        "layout": { "composition": "full-bleed", "content_alignment": "middle-left", "card_position": "right", "motion": { "image": "static", "content": "fade-up" } },
        "slide_content": { "headline": "Cargo Space", "paragraph": "...", "key_stats": [{ "value": "...", "label": "Trunk Capacity" }], "badges": [] },
        "tech_config": { "mode": "UTILITY", "trunk_capacity_liters": <real_value>, "seat_count": <real_value>, "dimensions": { "length_mm": <real_value>, "width_mm": <real_value>, "height_mm": <real_value>, "wheelbase_mm": <real_value> } },
        "voiceover_text": "...",
        "audio_url": null, "image_url": null, "hotspots": [],
        "camera_views": ["primary","secondary","tertiary"]
      }
    }
  ]
}

══════════════════════════════════════════════════════════════════════
RULES
══════════════════════════════════════════════════════════════════════
- Always use REAL car specs from the CAR SPECIFICATIONS section. NEVER invent numbers.
- For imagePrompt fields on REGENERATE_SCENE and ADD_SCENE, write a detailed visual
  description (environment, lighting, mood, camera angle) that matches the CURRENT THEME:
  • Cinematic imagePrompts: dark moody environment, rain-slicked streets, dramatic neon
    reflections, volumetric fog, cinematic wide shot, 8k photorealistic automotive photography
  • Minimal Tech imagePrompts: white cyclorama studio, flat even softbox lighting,
    technical product shot, clean minimal background, sharp focus, 8k
  Always include the specific car: "${carLabel}, <color>, <body_type>"
- When the user asks to change what a scene *focuses on*, shift its topic, or rewrite
  its content significantly (e.g. "make it about affordability", "focus on the engine",
  "emphasise safety"), use REGENERATE_SCENE instead of UPDATE_SCENE for slide_view,
  intro_view, and outro_view scenes. This ensures the background image is also
  regenerated to visually match the new content. Only use UPDATE_SCENE alone for
  minor wording tweaks where the visual theme stays the same.
- When translating, translate ALL text fields: headlines, paragraphs, voiceover_text,
  key_stat labels, button labels, subtitles. Keep numeric values unchanged.
- When switching themes, ALWAYS include imagePrompt for every slide_view, intro_view, and outro_view scene.
  tech_view scenes use a live 3D WebGL model (no background image — do NOT include imagePrompt for them).
- When switching language, ALWAYS set the "voice" field on UPDATE_ALL_SCENES
  to a voice model matching the target language (see VOICE MODELS section).
- Do NOT just literally translate -- adapt the writing persona to match the target theme.
- NEVER change the number or order of scenes during a retheme/translation operation.
- If no changes are needed, return actions as an empty array.
- Always respond with the JSON format above.`;

  try {
    const historyBlocks = chatHistory.slice(-8).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    }));

    const parsed = await generateStructuredData({
      model: activeModel,
      schema: CopilotResponseSchema,
      systemInstruction: systemPrompt,
      contents: [
        ...historyBlocks,
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 8192,
    });

    const normalizedActions = normalizeCopilotSceneIndices(
      parsed.actions || [],
      message,
      storySummary?.totalScenes || 0,
    );
    const rethemeIntent = parseRethemeIntent(message);
    let finalActions = normalizedActions;

    if (rethemeIntent.shouldRetheme) {
      const metaUpdates = {};
      if (rethemeIntent.template) metaUpdates.template = rethemeIntent.template;
      if (rethemeIntent.language) metaUpdates.language = rethemeIntent.language;
      finalActions = upsertUpdateMetaAction(finalActions, metaUpdates);

      const hasBatch = finalActions.some(
        (action) => action.type === "UPDATE_ALL_SCENES",
      );
      if (!hasBatch) {
        try {
          const rethemeParsed = await generateRethemeBatchActions({
            activeModel,
            systemPrompt,
            chatHistory,
            message,
            intent: rethemeIntent,
          });
          const rethemeBatch = rethemeParsed?.actions?.find(
            (action) => action.type === "UPDATE_ALL_SCENES",
          );
          if (rethemeBatch) {
            finalActions = [
              ...finalActions,
              ensureBatchVoice(rethemeBatch, rethemeIntent),
            ];
          }
        } catch (rethemeErr) {
          console.warn("Copilot retheme fallback failed:", rethemeErr.message);
        }
      } else if (rethemeIntent.language) {
        finalActions = finalActions.map((action) =>
          action.type === "UPDATE_ALL_SCENES"
            ? ensureBatchVoice(action, rethemeIntent)
            : action,
        );
      }
    }

    return {
      message: parsed.message || "Done!",
      actions: finalActions,
    };
  } catch (parseErr) {
    const historyBlocks = chatHistory.slice(-8).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    }));

    const fallbackResponse = await generateText({
      model: activeModel,
      systemInstruction: `${systemPrompt}\n\nIf you cannot produce valid JSON, reply with a single concise sentence and no actions.`,
      contents: [
        ...historyBlocks,
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 512,
    });

    const text = extractJsonPayload(fallbackResponse.text || "")
      ? "Done!"
      : fallbackResponse.text ||
        "I understood your request but couldn't format a proper response.";

    return {
      message: text,
      actions: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Upload Image
// ═══════════════════════════════════════════════════════════════════════════════
async function uploadImage({ fileBuffer, mimetype, sceneId }) {
  const ext =
    mimetype === "image/png"
      ? "png"
      : mimetype === "image/webp"
        ? "webp"
        : "jpg";
  const fileName = `editor/${Date.now()}_${sceneId || "scene"}.${ext}`;

  console.log(`   📸 Editor: Uploading image for ${sceneId}...`);

  const { error } = await supabase.storage
    .from("story_images")
    .upload(fileName, fileBuffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) throw new Error(`Upload Error: ${error.message}`);

  const { data: publicData } = supabase.storage
    .from("story_images")
    .getPublicUrl(fileName);

  return { image_url: publicData.publicUrl };
}

module.exports = {
  regenerateVoiceover,
  regenerateImage,
  generateScene,
  processCopilotMessage,
  uploadImage,
};
