const express = require("express");
const multer = require("multer");
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});

const {
  handleRegenerateVoiceover,
  handleRegenerateImage,
  handleGenerateScene,
  handleCopilot,
  handleUploadImage,
} = require("../controllers/editorController");

// Editor AI endpoints
router.post("/regenerate-voiceover", handleRegenerateVoiceover);
router.post("/regenerate-image", handleRegenerateImage);
router.post("/generate-scene", handleGenerateScene);
router.post("/copilot", handleCopilot);
router.post("/upload-image", upload.single("image"), handleUploadImage);

module.exports = router;
