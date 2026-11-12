const axios = require("axios");
const { supabase } = require("../../config/supabase");
const {
  getGeminiClient,
  normalizeGeminiModelId,
} = require("../../config/aiConfig");

const DEFAULT_VEO_MODEL = "veo-3.1-fast-generate-001";
const MAX_INPUT_IMAGE_BYTES = 8 * 1024 * 1024;
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 180000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mimeTypeToExtension(mimeType = "") {
  switch (mimeType.toLowerCase()) {
    case "video/mp4":
      return ".mp4";
    case "video/webm":
      return ".webm";
    default:
      return ".mp4";
  }
}

async function uploadVideoToSupabase(buffer, seed, mimeType = "video/mp4") {
  const extension = mimeTypeToExtension(mimeType);
  const fileName = `${Date.now()}_${seed}${extension}`;
  const filePath = `videos/${fileName}`;

  console.log(`   ☁️  Storage Step: Uploading ${fileName} to Supabase...`);

  const { error } = await supabase.storage
    .from("story_images")
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase Upload Error: ${error.message}`);
  }

  const { data: publicData } = supabase.storage
    .from("story_images")
    .getPublicUrl(filePath);

  // --- 👇 START OF URL REWRITE FIX 👇 ---
  let publicUrl = publicData.publicUrl;

  // Ensure the frontend receives an HTTPS domain link even if we use an IP internally
  publicUrl = publicUrl.replace(/^http:\/\/[^/]+/, "https://db.revv-os.live");
  // --- 👆 END OF URL REWRITE FIX 👆 ---

  console.log(`   ✅ Video Asset Ready: ${publicUrl}`);
  return publicUrl;
}

async function downloadInputImage(url) {
  if (!url) return null;

  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.*)$/i);
    if (!match) {
      throw new Error("Unsupported data URL format for input image.");
    }

    const mimeType = match[1].trim();
    const buffer = Buffer.from(match[2], "base64");

    if (!mimeType.startsWith("image/")) {
      throw new Error("Input image is not a supported image type.");
    }

    if (buffer.length > MAX_INPUT_IMAGE_BYTES) {
      throw new Error(
        "Input image exceeds the 8MB limit for video generation.",
      );
    }

    return { buffer, mimeType };
  }

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 15000,
  });

  const mimeType = String(response.headers["content-type"] || "image/jpeg")
    .split(";")[0]
    .trim();
  const buffer = Buffer.from(response.data);

  if (!mimeType.startsWith("image/")) {
    throw new Error("Input image is not a supported image type.");
  }

  if (buffer.length > MAX_INPUT_IMAGE_BYTES) {
    throw new Error("Input image exceeds the 8MB limit for video generation.");
  }

  return { buffer, mimeType };
}

async function pollVideoOperation(operation) {
  const ai = getGeminiClient();
  const start = Date.now();
  let current = operation;

  while (!current.done) {
    if (Date.now() - start > MAX_WAIT_MS) {
      throw new Error("Video generation timed out.");
    }

    await sleep(POLL_INTERVAL_MS);
    current = await ai.operations.getVideosOperation({ operation: current });
  }

  if (current.error) {
    throw new Error(current.error?.message || "Video generation failed.");
  }

  return current;
}

function extractGeneratedVideo(operation) {
  const generated = operation?.response?.generatedVideos?.[0]?.video;
  if (!generated) {
    return null;
  }

  return {
    uri: generated.uri || null,
    videoBytes: generated.videoBytes || null,
    mimeType: generated.mimeType || "video/mp4",
  };
}

async function generateIntroVideoFromImage({
  imageUrl,
  seed,
  durationSeconds = 6,
  aspectRatio = "16:9",
}) {
  if (!imageUrl) {
    throw new Error("Base image URL is required for intro video generation.");
  }

  const model = normalizeGeminiModelId(
    process.env.VEO_VIDEO_MODEL || DEFAULT_VEO_MODEL,
  );

  const inputImage = await downloadInputImage(imageUrl);
  if (!inputImage) {
    throw new Error("Failed to load base image for video generation.");
  }

  const prompt =
    "Create a seamless 6-second cinematic loop from the provided image. Preserve the car identity and composition, add subtle realistic motion, and do not add any text or logos.";

  const ai = getGeminiClient();
  let operation = await ai.models.generateVideos({
    model,
    image: {
      imageBytes: inputImage.buffer.toString("base64"),
      mimeType: inputImage.mimeType,
    },
    prompt,
    config: {
      numberOfVideos: 1,
      durationSeconds,
      aspectRatio,
    },
  });

  operation = await pollVideoOperation(operation);

  const generated = extractGeneratedVideo(operation);
  if (!generated) {
    throw new Error("No video returned from Veo model.");
  }

  if (generated.videoBytes) {
    const videoBuffer = Buffer.from(generated.videoBytes, "base64");
    return uploadVideoToSupabase(videoBuffer, seed, generated.mimeType);
  }

  if (generated.uri) {
    return generated.uri;
  }

  throw new Error("No usable video output from Veo model.");
}

module.exports = {
  generateIntroVideoFromImage,
};
