const {
  extractJsonPayload,
  generateText,
  selectTextModel,
} = require("../../config/aiConfig");
const { transcribeAudioWithWordOffsets } = require("./googleVoiceService");

function estimateWordDurationsFromText(text = "") {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return [];

  const wordsPerSecond = 2.6;
  let cursor = 0;

  return words.map((word) => {
    const cleanWord = String(word || "");
    const duration = Math.max(0.18, cleanWord.length / 14);
    const start = cursor;
    const end = start + duration;
    cursor = end + 1 / wordsPerSecond - duration;

    return {
      word: cleanWord,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
    };
  });
}

async function getWordTimestamps(audioBuffer, language = "en", fallbackText = "") {
  if (!audioBuffer || audioBuffer.length === 0) return [];

  try {
    const words = await transcribeAudioWithWordOffsets(audioBuffer, language);
    if (words.length > 0) {
      return words;
    }

    console.warn("   ⚠️ Google STT returned no words.");
    return estimateWordDurationsFromText(fallbackText);
  } catch (error) {
    const message = String(error.message || "");
    if (message.includes("speech.googleapis.com")) {
      console.warn(
        "   ⚠️ Google STT unavailable; using estimated subtitle timings instead.",
      );
    } else {
      console.warn("   ⚠️ Timestamp calculation failed:", error.message);
    }

    return estimateWordDurationsFromText(fallbackText);
  }
}

async function getGeminiSubtitlesFromWords(words) {
  if (!words || words.length === 0) return [];

  try {
    const wordsJson = JSON.stringify(
      words.map((w) => ({ w: w.word, s: w.start, e: w.end })),
    );

    const prompt = `You are a subtitle segmentation expert. You have an array of spoken words with their exact timestamps from audio transcription.

Group these words into natural subtitle segments for display on screen.

Rules:
- Each segment must be a complete phrase that reads naturally
- Prefer splitting at punctuation (. , !) or natural breath pauses (gaps > 0.3s between words)
- No segment should exceed 42 characters or 10 words
- Use the EXACT start time of the first word and end time of the last word in each segment
- Return ALL words — every word must appear in exactly one segment

Words array (w=word, s=start_seconds, e=end_seconds):
${wordsJson}

Return ONLY a valid JSON array, no markdown:
[{ "text": "...", "start": <number>, "end": <number> }]`;

    const response = await generateText({
      model: selectTextModel({ prefer: "flash" }),
      contents: prompt,
      temperature: 0.1,
      topP: 0.9,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    });

    const content = response.text || "";
    const jsonPayload = extractJsonPayload(content);
    if (!jsonPayload) throw new Error("No JSON array in Gemini response");

    const segments = JSON.parse(jsonPayload);
    return segments.filter(
      (s) => s.text && typeof s.start === "number" && typeof s.end === "number",
    );
  } catch (error) {
    console.warn(
      "   ⚠️ Gemini subtitle grouping failed, falling back to rule-based:",
      error.message,
    );
    return null;
  }
}

module.exports = {
  getWordTimestamps,
  getGeminiSubtitlesFromWords,
  estimateWordDurationsFromText,
};
