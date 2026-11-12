/**
 * Vision-Enriched Prompting Service
 *
 * Takes a dealer inventory photo (photos[0] from the cars table) and uses
 * Gemini vision to analyze the car's actual physical details — rim style,
 * grille shape, trim accents, body shape — producing a concise description
 * that is injected into every image generation prompt.
 */

const sharp = require("sharp");
const {
  buildInlineDataPart,
  generateText,
  selectTextModel,
} = require("../../config/aiConfig");

const GEMINI_SUPPORTED_FORMATS = new Set(["png", "jpeg", "gif", "webp"]);

const VISION_PROMPT = `Analyze this specific car photo. Give me exactly ONE sentence describing the car's physical appearance. Focus strictly on:
- Wheel/rim style (size, spoke pattern, finish)
- Grille shape and finish (mesh, slats, blacked-out, chrome)
- Trim accents (chrome trim, blacked-out trim, body-colored trim)
- Body shape details (lip spoiler, roof rails, fender flares, diffuser)

Do NOT mention the car's make, model, year, or color — I already know those.
Do NOT mention interior features.
Return ONLY the one descriptive sentence, nothing else.`;

function getImageFormat(contentType = "", photoUrl = "") {
  const normalizedType = contentType.toLowerCase();
  if (normalizedType.includes("png")) return "png";
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) {
    return "jpeg";
  }
  if (normalizedType.includes("webp")) return "webp";
  if (normalizedType.includes("gif")) return "gif";
  if (normalizedType.includes("avif")) return "avif";
  if (normalizedType.includes("heic") || normalizedType.includes("heif")) {
    return "heic";
  }
  if (normalizedType.includes("tiff")) return "tiff";
  if (normalizedType.includes("bmp")) return "bmp";

  const lowerUrl = photoUrl.toLowerCase();
  if (lowerUrl.includes(".png")) return "png";
  if (lowerUrl.includes(".webp")) return "webp";
  if (lowerUrl.includes(".gif")) return "gif";
  if (lowerUrl.includes(".avif")) return "avif";
  if (lowerUrl.includes(".heic") || lowerUrl.includes(".heif")) {
    return "heic";
  }
  if (lowerUrl.includes(".tiff") || lowerUrl.includes(".tif")) {
    return "tiff";
  }
  if (lowerUrl.includes(".bmp")) return "bmp";
  return "jpeg";
}

async function normalizeImageForGemini(imageBytes, detectedFormat) {
  let actualFormat = detectedFormat;

  try {
    const metadata = await sharp(imageBytes).metadata();
    if (metadata?.format) {
      actualFormat = metadata.format.toLowerCase();
    }
  } catch (err) {
    console.warn(
      "⚠️ Vision Enricher: Could not inspect image metadata, using header/URL format detection",
    );
  }

  if (actualFormat === "jpg") {
    actualFormat = "jpeg";
  }

  if (GEMINI_SUPPORTED_FORMATS.has(actualFormat)) {
    return { imageBytes, imageFormat: actualFormat };
  }

  console.log(
    `🔄 Vision Enricher: Converting ${String(actualFormat).toUpperCase()} -> JPEG for Gemini compatibility`,
  );
  const convertedBytes = await sharp(imageBytes).jpeg({ quality: 85 }).toBuffer();

  return {
    imageBytes: convertedBytes,
    imageFormat: "jpeg",
  };
}

function extractText(response) {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((block) => block?.text || "")
    .join(" ")
    .trim();
}

async function analyzeCarPhoto(photoUrl) {
  if (!photoUrl) return null;

  try {
    console.log("🔍 Vision Enricher: Analyzing dealer inventory photo...");

    const imageResponse = await fetch(photoUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch dealer photo: ${imageResponse.status}`);
    }

    const fetchedImageBytes = Buffer.from(await imageResponse.arrayBuffer());
    const detectedFormat = getImageFormat(
      imageResponse.headers.get("content-type") || "",
      photoUrl,
    );
    const { imageBytes, imageFormat } = await normalizeImageForGemini(
      fetchedImageBytes,
      detectedFormat,
    );

    const response = await generateText({
      model: selectTextModel({ prefer: "pro" }),
      contents: [
        { text: VISION_PROMPT },
        buildInlineDataPart(imageBytes, `image/${imageFormat}`),
      ],
      temperature: 0.1,
      topP: 0.9,
      maxOutputTokens: 256,
    });

    const description = extractText(response);

    if (!description || description.length < 10) {
      console.warn(
        "⚠️ Vision Enricher: Response too short, skipping enrichment",
      );
      return null;
    }

    const cleaned =
      description.length > 300
        ? description.slice(0, 300).replace(/\s+\S*$/, "")
        : description;

    console.log(`✅ Vision Enricher: "${cleaned}"`);
    return cleaned;
  } catch (err) {
    console.warn(
      "⚠️ Vision Enricher failed (falling back to standard prompts):",
      err.message,
    );
    return null;
  }
}

module.exports = { analyzeCarPhoto };
