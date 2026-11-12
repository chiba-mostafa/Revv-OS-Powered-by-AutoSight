const {
  GoogleGenAI,
  FunctionCallingConfigMode,
  Modality,
} = require("@google/genai");
const { zodToJsonSchema } = require("../utils/zodToJsonSchema");
require("dotenv").config();

const MODEL_ALIASES = {
  "gemini-3.1-flash": "gemini-3-flash-preview",
  "gemini-3-flash": "gemini-3-flash-preview",
  "gemini-3.1-pro": "gemini-3.1-pro-preview",
  "gemini-3-pro": "gemini-3-pro-preview",
  "gemini-3.1-pro-image": "gemini-3.1-pro-image-preview",
  "gemini-3-pro-image": "gemini-3.1-pro-image-preview",
  "gemini-3.1-flash-image": "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image-preview": "gemini-2.5-flash-image",
};

const STRUCTURED_OUTPUT_FUNCTION_NAME = "emit_structured_response";

function normalizeGeminiModelId(modelId) {
  const normalized = String(modelId || "").trim();
  return MODEL_ALIASES[normalized] || normalized;
}

const IMAGE_MODELS = {
  EXPERIENCE: normalizeGeminiModelId(
    process.env.EXPERIENCE_IMAGE_MODEL || "imagen-4.0-ultra-generate-001",
  ),
  EDITOR: normalizeGeminiModelId(
    process.env.EDITOR_IMAGE_MODEL || "gemini-2.5-flash-image",
  ),
};

const GEMINI_MODELS = {
  FLASH: normalizeGeminiModelId(
    process.env.GEMINI_FLASH_MODEL || "gemini-3-flash-preview",
  ),
  PRO: normalizeGeminiModelId(
    process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview",
  ),
  IMAGE: IMAGE_MODELS.EDITOR,
  EMBEDDING: normalizeGeminiModelId(
    process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
  ),
};

let cachedClient = null;

function getProjectId() {
  return (
    process.env.GOOGLE_CLOUD_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    null
  );
}

function getLocation() {
  return process.env.GOOGLE_CLOUD_LOCATION || "global";
}

function getApiKey() {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null;
}

function isGeminiConfigured() {
  return Boolean(getProjectId() || getApiKey());
}

function getGeminiClient() {
  if (cachedClient) return cachedClient;

  const project = getProjectId();
  const location = getLocation();
  const apiVersion = process.env.GOOGLE_GENAI_API_VERSION;

  if (project) {
    const options = {
      vertexai: true,
      project,
      location,
    };

    if (apiVersion) {
      options.apiVersion = apiVersion;
    }

    cachedClient = new GoogleGenAI(options);
    return cachedClient;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini is not configured. Set GOOGLE_CLOUD_PROJECT_ID/GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION for Vertex AI, or provide GOOGLE_API_KEY.",
    );
  }

  const options = {
    apiKey,
  };

  if (apiVersion) {
    options.apiVersion = apiVersion;
  }

  cachedClient = new GoogleGenAI(options);

  return cachedClient;
}

function createGeminiClient({ location, project, apiKey } = {}) {
  const resolvedProject = project || getProjectId();
  const resolvedLocation = location || getLocation();
  const resolvedApiKey = apiKey || getApiKey();
  const apiVersion = process.env.GOOGLE_GENAI_API_VERSION;

  if (resolvedProject) {
    const options = {
      vertexai: true,
      project: resolvedProject,
      location: resolvedLocation,
    };

    if (apiVersion) {
      options.apiVersion = apiVersion;
    }

    return new GoogleGenAI(options);
  }

  if (!resolvedApiKey) {
    throw new Error(
      "Gemini is not configured. Set GOOGLE_CLOUD_PROJECT_ID/GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION for Vertex AI, or provide GOOGLE_API_KEY.",
    );
  }

  const options = { apiKey: resolvedApiKey };
  if (apiVersion) {
    options.apiVersion = apiVersion;
  }

  return new GoogleGenAI(options);
}

function selectTextModel({ prefer = "flash", useHighQuality = true } = {}) {
  if (prefer === "pro" && useHighQuality !== false) {
    return GEMINI_MODELS.PRO;
  }

  return GEMINI_MODELS.FLASH;
}

function buildInlineDataPart(buffer, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(buffer).toString("base64"),
      mimeType,
    },
  };
}

function extractJsonPayload(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  const firstObject = trimmed.indexOf("{");
  const firstArray = trimmed.indexOf("[");

  let startIndex = -1;
  if (firstObject === -1) startIndex = firstArray;
  else if (firstArray === -1) startIndex = firstObject;
  else startIndex = Math.min(firstObject, firstArray);

  if (startIndex === -1) return null;

  const opening = trimmed[startIndex];
  const closing = opening === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < trimmed.length; i += 1) {
    const char = trimmed[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opening) depth += 1;
    if (char === closing) depth -= 1;

    if (depth === 0) {
      return trimmed.slice(startIndex, i + 1);
    }
  }

  return null;
}

function buildStructuredError(message, rawText, cause) {
  const error = new Error(message);
  error.rawText = rawText;
  error.cause = cause;
  return error;
}

function getFunctionCallPayload(response, functionName) {
  const functionCall = (response.functionCalls || []).find(
    (call) => call?.name === functionName,
  );

  if (!functionCall) {
    return null;
  }

  return functionCall.args || null;
}

async function generateText({
  model,
  contents,
  systemInstruction,
  temperature = 0.2,
  topP = 0.9,
  maxOutputTokens = 8192,
  responseMimeType,
  responseJsonSchema,
  responseModalities,
  tools,
  toolConfig,
  candidateCount,
  thinkingConfig,
}) {
  const shouldDisableThinking =
    responseMimeType === "application/json" || Boolean(thinkingConfig);
  const resolvedThinkingConfig = shouldDisableThinking
    ? { thinkingBudget: 0, ...thinkingConfig }
    : undefined;

  return getGeminiClient().models.generateContent({
    model: normalizeGeminiModelId(model),
    contents,
    config: {
      systemInstruction,
      temperature,
      topP,
      maxOutputTokens,
      responseMimeType,
      responseJsonSchema,
      responseModalities,
      tools,
      toolConfig,
      candidateCount,
      thinkingConfig: resolvedThinkingConfig,
    },
  });
}

async function generateStructuredData({
  model,
  contents,
  systemInstruction,
  schema,
  temperature = 0.2,
  topP = 0.9,
  maxOutputTokens = 8192,
  thinkingConfig,
}) {
  const jsonSchema = zodToJsonSchema(schema);
  const response = await generateText({
    model,
    contents,
    systemInstruction,
    temperature,
    topP,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget: 0, ...thinkingConfig },
    tools: [
      {
        functionDeclarations: [
          {
            name: STRUCTURED_OUTPUT_FUNCTION_NAME,
            description: "Return the structured response payload.",
            parameters: jsonSchema,
          },
        ],
      },
    ],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: [STRUCTURED_OUTPUT_FUNCTION_NAME],
      },
    },
  });

  const functionPayload = getFunctionCallPayload(
    response,
    STRUCTURED_OUTPUT_FUNCTION_NAME,
  );

  if (functionPayload) {
    try {
      return schema.parse(functionPayload);
    } catch (error) {
      throw buildStructuredError(
        `Gemini function call failed schema validation: ${error.message}`,
        JSON.stringify(functionPayload),
        error,
      );
    }
  }

  const rawText = response.text || "";
  const jsonText = extractJsonPayload(rawText) || rawText;

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw buildStructuredError(
      `Gemini returned invalid JSON: ${error.message}`,
      rawText,
      error,
    );
  }

  try {
    return schema.parse(parsed);
  } catch (error) {
    throw buildStructuredError(
      `Gemini JSON failed schema validation: ${error.message}`,
      rawText,
      error,
    );
  }
}

module.exports = {
  GEMINI_MODELS,
  IMAGE_MODELS,
  FunctionCallingConfigMode,
  Modality,
  buildInlineDataPart,
  createGeminiClient,
  extractJsonPayload,
  generateStructuredData,
  generateText,
  getGeminiClient,
  getLocation,
  getProjectId,
  isGeminiConfigured,
  normalizeGeminiModelId,
  selectTextModel,
};
