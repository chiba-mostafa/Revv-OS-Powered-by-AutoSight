const { synthesizeVoiceover } = require("./googleVoiceService");

async function generateAudio(
  text,
  sceneId,
  language = "en",
  templateStyle = "Cinematic",
) {
  if (!text || text.trim().length === 0) return null;

  try {
    return await synthesizeVoiceover(text, {
      sceneId,
      language,
      templateStyle,
      filePrefix: "generated",
    });
  } catch (error) {
    console.error(`❌ Audio Generation Failed [${sceneId}]:`, error.message);
    return null;
  }
}

module.exports = { generateAudio };
