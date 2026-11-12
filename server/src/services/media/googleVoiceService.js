const textToSpeech = require("@google-cloud/text-to-speech").v1beta1;
const speech = require("@google-cloud/speech").v1;
const { supabase } = require("../../config/supabase");

const ttsClient = new textToSpeech.TextToSpeechClient();
const speechClient = new speech.SpeechClient();

const GOOGLE_VOICES = {
  "en-US-Chirp-HD-D": {
    id: "en-US-Chirp-HD-D",
    label: "Chirp HD D",
    language: "en",
    languageCode: "en-US",
    gender: "male",
  },
  "en-US-Chirp-HD-F": {
    id: "en-US-Chirp-HD-F",
    label: "Chirp HD F",
    language: "en",
    languageCode: "en-US",
    gender: "female",
  },
  "fr-FR-Chirp-HD-D": {
    id: "fr-FR-Chirp-HD-D",
    label: "Chirp HD D",
    language: "fr",
    languageCode: "fr-FR",
    gender: "male",
  },
  "fr-FR-Chirp-HD-F": {
    id: "fr-FR-Chirp-HD-F",
    label: "Chirp HD F",
    language: "fr",
    languageCode: "fr-FR",
    gender: "female",
  },
};

const DEFAULT_VOICE_BY_LANGUAGE = {
  en: {
    cinematic: "en-US-Chirp-HD-D",
    "minimal-tech": "en-US-Chirp-HD-F",
    default: "en-US-Chirp-HD-D",
  },
  fr: {
    cinematic: "fr-FR-Chirp-HD-F",
    "minimal-tech": "fr-FR-Chirp-HD-F",
    default: "fr-FR-Chirp-HD-F",
  },
};

function normalizeLanguage(language = "en") {
  return String(language || "en")
    .toLowerCase()
    .startsWith("fr")
    ? "fr"
    : "en";
}

function normalizeTemplateStyle(templateStyle = "Cinematic") {
  const normalized = String(templateStyle || "Cinematic")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  return normalized === "minimal-tech" ? "minimal-tech" : "cinematic";
}

function resolveVoiceSelection({
  voice,
  language = "en",
  templateStyle = "Cinematic",
} = {}) {
  if (voice && GOOGLE_VOICES[voice]) {
    return GOOGLE_VOICES[voice];
  }

  const normalizedLanguage = normalizeLanguage(language);
  const normalizedTemplateStyle = normalizeTemplateStyle(templateStyle);
  const defaults =
    DEFAULT_VOICE_BY_LANGUAGE[normalizedLanguage] ||
    DEFAULT_VOICE_BY_LANGUAGE.en;
  const voiceId = defaults[normalizedTemplateStyle] || defaults.default;
  return GOOGLE_VOICES[voiceId];
}

function durationToSeconds(duration) {
  if (!duration) return 0;
  if (typeof duration === "number") return duration;
  if (typeof duration === "string") {
    const normalized = duration.endsWith("s")
      ? duration.slice(0, -1)
      : duration;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const seconds = Number(duration.seconds || 0);
  const nanos = Number(duration.nanos || 0);
  return seconds + nanos / 1e9;
}

async function uploadAudioBuffer(buffer, filePrefix, sceneId) {
  const fileName = `${filePrefix}_${Date.now()}_${sceneId}.mp3`;
  const filePath = `generated/${fileName}`;

  const { error } = await supabase.storage
    .from("story_voiceover")
    .upload(filePath, buffer, {
      contentType: "audio/mpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase Upload Error: ${error.message}`);
  }

  const { data: publicData } = supabase.storage
    .from("story_voiceover")
    .getPublicUrl(filePath);

  // --- 👇 START OF URL REWRITE FIX 👇 ---
  let publicUrl = publicData.publicUrl;

  // Force the URL to use the secure domain for the frontend
  publicUrl = publicUrl.replace(/^http:\/\/[^/]+/, "https://db.revv-os.live");
  // --- 👆 END OF URL REWRITE FIX 👆 ---

  return publicUrl;
}

async function synthesizeVoiceover(
  text,
  {
    sceneId = "scene",
    language = "en",
    templateStyle = "Cinematic",
    voice,
    filePrefix = "generated",
  } = {},
) {
  if (!text || !String(text).trim()) return null;

  const voiceConfig = resolveVoiceSelection({ voice, language, templateStyle });

  console.log(
    `   Google TTS: Synthesizing ${sceneId} with ${voiceConfig.id}...`,
  );

  const [response] = await ttsClient.synthesizeSpeech({
    input: { text },
    voice: {
      languageCode: voiceConfig.languageCode,
      name: voiceConfig.id,
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate:
        normalizeTemplateStyle(templateStyle) === "minimal-tech" ? 0.98 : 1,
    },
  });

  const audioBuffer = Buffer.from(response.audioContent || []);
  if (!audioBuffer.length) {
    throw new Error("Google TTS returned empty audio content");
  }

  const publicUrl = await uploadAudioBuffer(audioBuffer, filePrefix, sceneId);
  return {
    publicUrl,
    audioBuffer,
    voiceId: voiceConfig.id,
  };
}

async function transcribeAudioWithWordOffsets(audioBuffer, language = "en") {
  if (!audioBuffer || !audioBuffer.length) return [];

  const normalizedLanguage = normalizeLanguage(language);
  const languageCode = normalizedLanguage === "fr" ? "fr-FR" : "en-US";

  const [response] = await speechClient.recognize({
    audio: {
      content: audioBuffer.toString("base64"),
    },
    config: {
      encoding: "MP3",
      languageCode,
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      model: "latest_long",
    },
  });

  return (response.results || []).flatMap((result) => {
    const words = result.alternatives?.[0]?.words || [];
    return words.map((word) => ({
      word: word.word || "",
      start: durationToSeconds(word.startTime),
      end: durationToSeconds(word.endTime),
    }));
  });
}

module.exports = {
  GOOGLE_VOICES,
  resolveVoiceSelection,
  synthesizeVoiceover,
  transcribeAudioWithWordOffsets,
};
