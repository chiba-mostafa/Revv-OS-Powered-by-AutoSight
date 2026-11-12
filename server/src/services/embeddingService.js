/**
 * Embedding Service — Google Gemini / Vertex embeddings wrapper
 *
 * Keeps the legacy module path and exported function name so the rest of the
 * RAG pipeline can migrate without broad refactors.
 *
 * To preserve a single comparable vector space across text, tables, query
 * strings, and extracted document images, images are first described with
 * Gemini vision and then embedded with `gemini-embedding-001`.
 */

const {
  GEMINI_MODELS,
  buildInlineDataPart,
  generateText,
  getGeminiClient,
  selectTextModel,
} = require("../config/aiConfig");
require("dotenv").config();

const EMBEDDING_DIMENSIONS = 1024;

function normalizeImageFormat(imageFormat = "jpeg") {
  const format = String(imageFormat || "jpeg").toLowerCase();
  if (format === "jpg") return "jpeg";
  return format;
}

async function generateTextEmbedding(
  inputText,
  taskType = "RETRIEVAL_DOCUMENT",
) {
  const response = await getGeminiClient().models.embedContent({
    model: GEMINI_MODELS.EMBEDDING,
    contents: inputText,
    config: {
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
      autoTruncate: true,
    },
  });

  const vector = response.embeddings?.[0]?.values;

  if (!Array.isArray(vector)) {
    throw new Error("Unexpected Gemini embedding response: missing values array.");
  }

  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected Gemini embedding dimension: expected ${EMBEDDING_DIMENSIONS}, received ${vector.length}.`,
    );
  }

  return vector;
}

function extractTextResponse(response) {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => part?.text || "")
    .join(" ")
    .trim();
}

async function describeImageForEmbedding(inputImage, imageFormat = "jpeg") {
  const normalizedFormat = normalizeImageFormat(imageFormat);
  const imageBuffer = Buffer.from(inputImage, "base64");

  const response = await generateText({
    model: selectTextModel({ prefer: "pro" }),
    contents: [
      {
        text: "Describe this automotive brochure or dealership image for semantic search retrieval. Focus only on visible details such as vehicle view, cabin or exterior angle, materials, screens, seats, wheels, cargo area, dashboard, trim, controls, and other clearly visible automotive features. Return 1 or 2 plain sentences with no bullets or markdown.",
      },
      buildInlineDataPart(imageBuffer, `image/${normalizedFormat}`),
    ],
    temperature: 0.1,
    topP: 0.9,
    maxOutputTokens: 256,
    thinkingConfig: { thinkingBudget: 0 },
  });

  const description = extractTextResponse(response);

  if (!description) {
    throw new Error("Gemini did not return an image description for embedding.");
  }

  return description;
}

async function generateMultimodalEmbedding(payload) {
  if (payload.inputText) {
    const taskType = payload.taskType || "RETRIEVAL_DOCUMENT";
    return generateTextEmbedding(payload.inputText, taskType);
  }

  if (payload.inputImage) {
    const description = await describeImageForEmbedding(
      payload.inputImage,
      payload.imageFormat,
    );
    return generateTextEmbedding(description, "RETRIEVAL_DOCUMENT");
  }

  throw new Error(
    "generateMultimodalEmbedding: Provide either inputText or inputImage.",
  );
}

module.exports = {
  EMBEDDING_DIMENSIONS,
  generateMultimodalEmbedding,
};
