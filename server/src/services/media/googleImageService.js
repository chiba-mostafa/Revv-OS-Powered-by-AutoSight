const axios = require("axios");
const { supabase } = require("../../config/supabase");
const {
  IMAGE_MODELS,
  buildInlineDataPart,
  getGeminiClient,
  getLocation,
  getProjectId,
  normalizeGeminiModelId,
} = require("../../config/aiConfig");

const EXPERIENCE_IMAGE_FALLBACK_MODEL = "imagen-4.0-generate-001";
const EDITOR_IMAGE_FALLBACK_MODEL = "gemini-2.5-flash-image";
const MAX_INPUT_IMAGE_BYTES = 8 * 1024 * 1024;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableQuotaError(error) {
  if (error?.status === 429) return true;
  return String(error?.message || "").includes("RESOURCE_EXHAUSTED");
}

function shouldFallbackImageModel(error) {
  if (error?.status === 404 || error?.status === 403) return true;

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("permission denied") ||
    message.includes("permission_denied") ||
    message.includes("does not have access")
  );
}

function mimeTypeToExtension(mimeType = "") {
  switch (mimeType.toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/jpeg":
    case "image/jpg":
    default:
      return ".jpg";
  }
}

async function uploadToSupabase(buffer, seed, mimeType = "image/jpeg") {
  const extension = mimeTypeToExtension(mimeType);
  const fileName = `${Date.now()}_${seed}${extension}`;
  const filePath = `generated/${fileName}`;

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

  let publicUrl = publicData.publicUrl;

  publicUrl = publicUrl.replace(/^http:\/\/[^/]+/, "https://db.revv-os.live");
  console.log(`   ✅ Image Asset Ready: ${publicUrl}`);
  return publicUrl;
}

function extractGeminiInlineImage(response) {
  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData);

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data returned from Gemini image model.");
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

function extractImagenImage(response) {
  const generated = response.generatedImages?.[0];

  if (generated?.raiFilteredReason) {
    throw new Error(
      `Imagen filtered the image request: ${generated.raiFilteredReason}`,
    );
  }

  const image = generated?.image;

  if (!image?.imageBytes) {
    throw new Error("No image data returned from Imagen model.");
  }

  return {
    buffer: Buffer.from(image.imageBytes, "base64"),
    mimeType: image.mimeType || "image/jpeg",
  };
}

function buildPrompt(prompt, { hasBaseImage = false } = {}) {
  const baseInstruction = hasBaseImage
    ? "Use the provided image as the base. Preserve the car identity and overall composition, apply the requested changes, and keep a 16:9 cinematic automotive photograph."
    : "Generate a high-quality 16:9 cinematic automotive photograph.";

  return `${baseInstruction} Do NOT include any text, watermarks, or logos in the image. ${prompt}`;
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
      throw new Error("Input image exceeds the 8MB limit for image-to-image.");
    }

    return { buffer, mimeType };
  }

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 10000,
  });

  const mimeType = String(response.headers["content-type"] || "image/jpeg")
    .split(";")[0]
    .trim();
  const buffer = Buffer.from(response.data);

  if (!mimeType.startsWith("image/")) {
    throw new Error("Input image is not a supported image type.");
  }

  if (buffer.length > MAX_INPUT_IMAGE_BYTES) {
    throw new Error("Input image exceeds the 8MB limit for image-to-image.");
  }

  return { buffer, mimeType };
}

async function generateGeminiImage(prompt, model, inputImage) {
  const ai = getGeminiClient();
  const parts = [];
  const hasBaseImage = Boolean(inputImage?.buffer);

  if (hasBaseImage) {
    parts.push(buildInlineDataPart(inputImage.buffer, inputImage.mimeType));
  }

  parts.push({ text: buildPrompt(prompt, { hasBaseImage }) });

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "2K",
        imageOutputOptions: {
          mimeType: "image/jpeg",
          compressionQuality: 85,
        },
      },
    },
  });

  return extractGeminiInlineImage(response);
}

async function generateImagenImage(prompt, seed, model) {
  const ai = getGeminiClient();
  const response = await ai.models.generateImages({
    model,
    prompt: buildPrompt(prompt),
    config: {
      numberOfImages: 1,
      aspectRatio: "16:9",
      outputMimeType: "image/jpeg",
      outputCompressionQuality: 85,
      imageSize: "2K",
      enhancePrompt: true,
      includeRaiReason: true,
      addWatermark: true,
    },
  });

  return extractImagenImage(response);
}

async function generateImageWithModel({
  prompt,
  seed,
  model,
  mode,
  maxAttempts,
  inputImage,
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const project = getProjectId();
      const location = getLocation();

      console.log(
        `   🎨 Google ${mode === "imagen" ? "Imagen" : "Gemini"}: Generating image with ${model} in ${location}${project ? ` for ${project}` : ""} (attempt ${attempt}/${maxAttempts})...`,
      );

      const artifact =
        mode === "imagen"
          ? await generateImagenImage(prompt, seed, model)
          : await generateGeminiImage(prompt, model, inputImage);

      console.log(
        `   ✅ Google ${mode === "imagen" ? "Imagen" : "Gemini"}: Image generated (${(artifact.buffer.length / 1024).toFixed(0)} KB)`,
      );

      return await uploadToSupabase(artifact.buffer, seed, artifact.mimeType);
    } catch (error) {
      const project = getProjectId();
      const location = getLocation();
      const retryable = isRetryableQuotaError(error);
      const isLastAttempt = attempt === maxAttempts;

      console.error(
        `❌ Google ${mode === "imagen" ? "Imagen" : "Gemini"} Image Generation Failed:`,
        JSON.stringify({
          project,
          location,
          model,
          mode,
          attempt,
          maxAttempts,
          retryable,
          message: error.message,
          status: error.status,
        }),
      );

      if (!retryable || isLastAttempt) {
        const wrappedError = new Error(
          `Google Image Generation Failed: ${error.message}`,
        );
        wrappedError.status = error.status;
        throw wrappedError;
      }

      const backoffMs = 5000 * Math.pow(2, attempt - 1);
      console.log(
        `   ⏳ Google ${mode === "imagen" ? "Imagen" : "Gemini"}: Quota hit, retrying in ${Math.round(backoffMs / 1000)}s...`,
      );
      await sleep(backoffMs);
    }
  }

  return null;
}

async function generateExperienceImage(
  prompt,
  seed = Math.floor(Math.random() * 10000),
) {
  const maxAttempts = 4;
  const preferredModel = normalizeGeminiModelId(IMAGE_MODELS.EXPERIENCE);

  try {
    return await generateImageWithModel({
      prompt,
      seed,
      model: preferredModel,
      mode: "imagen",
      maxAttempts,
    });
  } catch (error) {
    const canFallback =
      preferredModel !== EXPERIENCE_IMAGE_FALLBACK_MODEL &&
      shouldFallbackImageModel(error);

    if (!canFallback) {
      throw error;
    }

    console.warn(
      `   ⚠️ Google Imagen: ${preferredModel} unavailable in this project. Falling back to ${EXPERIENCE_IMAGE_FALLBACK_MODEL}.`,
    );

    return generateImageWithModel({
      prompt,
      seed,
      model: EXPERIENCE_IMAGE_FALLBACK_MODEL,
      mode: "imagen",
      maxAttempts,
    });
  }
}

async function generateEditorImage(
  prompt,
  seed = Math.floor(Math.random() * 10000),
  options = {},
) {
  const maxAttempts = 4;
  const preferredModel = normalizeGeminiModelId(IMAGE_MODELS.EDITOR);
  let inputImage = null;

  if (options.inputImage) {
    inputImage = options.inputImage;
  } else if (options.inputImageUrl) {
    try {
      inputImage = await downloadInputImage(options.inputImageUrl);
    } catch (error) {
      console.warn(
        `   ⚠️  Google Gemini: Failed to load base image for editing: ${error.message}`,
      );
    }
  }

  try {
    return await generateImageWithModel({
      prompt,
      seed,
      model: preferredModel,
      mode: "gemini",
      maxAttempts,
      inputImage,
    });
  } catch (error) {
    const canFallback =
      preferredModel !== EDITOR_IMAGE_FALLBACK_MODEL &&
      shouldFallbackImageModel(error);

    if (!canFallback) {
      throw error;
    }

    console.warn(
      `   ⚠️ Google Gemini: ${preferredModel} unavailable in this project. Falling back to ${EDITOR_IMAGE_FALLBACK_MODEL}.`,
    );

    return generateImageWithModel({
      prompt,
      seed,
      model: EDITOR_IMAGE_FALLBACK_MODEL,
      mode: "gemini",
      maxAttempts,
      inputImage,
    });
  }
}

async function generateGoogleImage(
  prompt,
  seed = Math.floor(Math.random() * 10000),
  options = {},
) {
  const target = options.target || "experience";

  if (target === "editor") {
    return generateEditorImage(prompt, seed);
  }

  return generateExperienceImage(prompt, seed);
}

module.exports = {
  generateEditorImage,
  generateExperienceImage,
  generateGoogleImage,
};
