const {
  regenerateVoiceover,
  regenerateImage,
  generateScene,
  processCopilotMessage,
  uploadImage,
} = require("../services/editorService");

// POST /api/editor/regenerate-voiceover
async function handleRegenerateVoiceover(req, res) {
  try {
    const { text, voice, sceneId, language } = req.body;
    if (!text) {
      return res
        .status(400)
        .json({ success: false, error: "text is required" });
    }

    const result = await regenerateVoiceover({
      text,
      voice: voice || "en-US-Chirp-HD-D",
      sceneId: sceneId || "editor",
      language: language || "en",
    });

    res.json({
      success: true,
      audio_url: result.audio_url,
      subtitles: result.subtitles,
    });
  } catch (err) {
    console.error("❌ Regenerate Voiceover Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// POST /api/editor/regenerate-image
async function handleRegenerateImage(req, res) {
  try {
    const { prompt, scene, car, template, image_url, imageUrl } = req.body;

    const result = await regenerateImage({
      prompt,
      scene,
      car,
      template: template || "cinematic",
      imageUrl: image_url || imageUrl || scene?.image_url || null,
    });
    res.json({ success: true, image_url: result.image_url });
  } catch (err) {
    console.error("❌ Regenerate Image Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// POST /api/editor/generate-scene
async function handleGenerateScene(req, res) {
  try {
    const { prompt, car, existingScenes, insertAfterIndex, template } =
      req.body;
    if (!prompt) {
      return res
        .status(400)
        .json({ success: false, error: "prompt is required" });
    }

    const result = await generateScene({
      prompt,
      car,
      existingScenes,
      insertAfterIndex,
      template: template || "cinematic",
    });

    res.json({ success: true, scene: result.scene });
  } catch (err) {
    console.error("❌ Generate Scene Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// POST /api/editor/copilot
async function handleCopilot(req, res) {
  try {
    const { message, storySummary, fullStory, currentSceneIndex, chatHistory } =
      req.body;
    if (!message) {
      return res
        .status(400)
        .json({ success: false, error: "message is required" });
    }

    const result = await processCopilotMessage({
      message,
      storySummary,
      fullStory,
      currentSceneIndex,
      chatHistory: chatHistory || [],
    });

    res.json({
      success: true,
      message: result.message,
      actions: result.actions,
    });
  } catch (err) {
    console.error("❌ Copilot Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// POST /api/editor/upload-image
async function handleUploadImage(req, res) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    const result = await uploadImage({
      fileBuffer: req.file.buffer,
      mimetype: req.file.mimetype,
      sceneId: req.body.sceneId || "editor",
    });

    res.json({ success: true, image_url: result.image_url });
  } catch (err) {
    console.error("❌ Upload Image Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleRegenerateVoiceover,
  handleRegenerateImage,
  handleGenerateScene,
  handleCopilot,
  handleUploadImage,
};
