const {
  Modality,
  createGeminiClient,
  getProjectId,
  normalizeGeminiModelId,
} = require("../config/aiConfig");
const { broadcast } = require("./chatbotEventBus");
const { processChat } = require("./ragChatService");

const CHATBOT_LIVE_MODEL = normalizeGeminiModelId(
  process.env.GEMINI_LIVE_CHATBOT_MODEL || "gemini-live-2.5-flash-native-audio",
);
const CHATBOT_LIVE_LOCATION =
  process.env.GEMINI_LIVE_LOCATION ||
  (process.env.GOOGLE_CLOUD_LOCATION === "global"
    ? "us-central1"
    : process.env.GOOGLE_CLOUD_LOCATION) ||
  "us-central1";

function normalizeBookingDraft(input = {}) {
  const normalizedDate =
    typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
      ? input.date
      : null;

  let normalizedTime = null;
  if (typeof input.time === "string" && input.time.trim()) {
    const time = input.time.trim();
    const hhmmMatch = time.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmmMatch) {
      normalizedTime = `${hhmmMatch[1].padStart(2, "0")}:${hhmmMatch[2]}`;
    }
  }

  return {
    date: normalizedDate,
    time: normalizedTime,
    name: input.customer_name || null,
    phone: input.phone_number || null,
  };
}

function buildGroundingPrompt(carContext = {}, chatHistory = []) {
  const chatContextText =
    chatHistory
      .slice(-6)
      .map((m) => `${m.type === "user" ? "User" : "Assistant"}: ${m.text}`)
      .join("\n") || "No previous conversation.";

  const make = carContext.make || "Unknown";
  const model = carContext.model || "Vehicle";
  const year = carContext.year || "";
  const price = carContext.price ? `$${carContext.price}` : "Consult Dealer";

  return `You are AutoSense, a friendly real-time voice assistant for a car dealership.
You are helping a customer explore a ${year} ${make} ${model} priced at ${price}.

CRITICAL TOOL RULES:
- For any vehicle-specific factual question, you MUST call search_vehicle_docs before answering.
- This includes specs, features, performance, charging, dimensions, pricing, comparisons, availability, brochure details, ownership questions, suitability questions, and anything about this specific vehicle.
- Do not answer those from memory, prior knowledge, or guesswork.
- After search_vehicle_docs returns, answer naturally using only the tool result.
- When the customer wants to schedule, book, visit, or test drive the vehicle, call draft_test_drive immediately.
- Greetings, thanks, clarifications, and short conversational turns can be answered directly without a tool.

CONVERSATION CONTEXT:
${chatContextText}

STYLE:
- Sound warm, concise, and helpful.
- Keep spoken answers short unless the customer asks for more detail.
- If a booking widget was opened, acknowledge it and guide the customer briefly.

Today's date is: ${new Date().toISOString().split("T")[0]}`;
}

function buildLiveTools() {
  return [
    {
      functionDeclarations: [
        {
          name: "draft_test_drive",
          description:
            "Open the test drive booking flow when the customer wants to schedule a test drive, visit the dealership, or try the car. Extract any date, time, name, or phone number mentioned.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description:
                  "Requested date in YYYY-MM-DD format when possible. Interpret phrases like tomorrow or next Monday.",
              },
              time: {
                type: "string",
                description:
                  "Requested time in HH:MM 24-hour format when possible.",
              },
              customer_name: {
                type: "string",
                description: "Customer full name if mentioned.",
              },
              phone_number: {
                type: "string",
                description: "Customer phone number if mentioned.",
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        {
          name: "search_vehicle_docs",
          description:
            "Search the dealership backend for grounded answers about this specific vehicle. Use this for every vehicle-specific factual question before answering.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description:
                  "The customer's exact vehicle question, rewritten clearly if needed but preserving meaning.",
              },
            },
            required: ["question"],
            additionalProperties: false,
          },
        },
      ],
    },
  ];
}

async function executeToolUse({
  toolName,
  input,
  carId,
  carContext,
  chatHistory,
  onEvent,
}) {
  if (toolName === "draft_test_drive") {
    const payload = normalizeBookingDraft(input);
    console.log("[ChatbotVoice] booking widget payload:", payload);

    const eventPayload = {
      type: "tool_call",
      tool: "booking_draft",
      payload,
      carId,
    };

    broadcast("tool_call", eventPayload);
    if (onEvent) onEvent("tool_call", eventPayload);

    return {
      status: "success",
      type: "booking_draft",
      widgetOpened: true,
      message:
        "The booking form is now open for the customer. Confirm the details briefly and offer to help fill in anything missing.",
      extracted: payload,
    };
  }

  if (toolName === "search_vehicle_docs") {
    const question = String(input.question || "").trim();
    if (!question) {
      return {
        status: "error",
        message:
          "No question was provided. Ask the customer to repeat the vehicle question briefly.",
      };
    }

    const ragResult = await processChat({
      question,
      carId,
      carContext,
      conversationHistory: chatHistory,
    });

    broadcast("user_transcript", {
      text: question,
      carId,
      isFinal: true,
      source: "tool_fallback",
    });

    if (
      ragResult?.type === "widget" &&
      ragResult?.widget_type === "booking_draft"
    ) {
      const eventPayload = {
        type: "tool_call",
        tool: "booking_draft",
        payload: ragResult.prefilled_data || {},
        carId,
      };

      broadcast("tool_call", eventPayload);
      if (onEvent) onEvent("tool_call", eventPayload);
    }

    const answerText =
      ragResult?.text ||
      "I could not find a confident answer in the dealership materials.";

    const toolStreamId = `tool-search-${Date.now()}`;
    broadcast("ai_response", {
      text: answerText,
      carId,
      streamId: toolStreamId,
      isFinal: false,
      source: "tool_result",
    });
    broadcast("ai_response", {
      text: "",
      carId,
      streamId: toolStreamId,
      isFinal: true,
      source: "tool_result",
    });

    return {
      status: "success",
      type: ragResult?.type || "text",
      answer: answerText,
      widgetType: ragResult?.widget_type || null,
      widgetOpened:
        ragResult?.type === "widget" &&
        ragResult?.widget_type === "booking_draft",
      prefilledData: ragResult?.prefilled_data || null,
      tier: ragResult?.tier ?? null,
    };
  }

  return {
    status: "error",
    message: `Unsupported tool: ${toolName}`,
  };
}

function extractTextParts(modelTurn) {
  return (modelTurn?.parts || [])
    .filter((part) => typeof part?.text === "string" && part.text.trim())
    .map((part) => part.text);
}

function extractAudioParts(modelTurn) {
  return (modelTurn?.parts || [])
    .filter((part) => part?.inlineData?.data)
    .map((part) => ({
      mimeType: part.inlineData.mimeType || "audio/pcm",
      data: part.inlineData.data,
    }));
}

async function startChatbotVoiceSession({
  carId,
  carContext,
  chatHistory = [],
  onAudioChunk,
  onEvent,
  onClose,
}) {
  const project = getProjectId();

  if (!project) {
    throw new Error(
      "Gemini Live chatbot requires Vertex AI project configuration.",
    );
  }

  const regionalClient = createGeminiClient({
    project,
    location: CHATBOT_LIVE_LOCATION,
  });

  const liveSession = await regionalClient.live.connect({
    model: CHATBOT_LIVE_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 1024,
      systemInstruction: buildGroundingPrompt(carContext, chatHistory),
      tools: buildLiveTools(),
      speechConfig: {
        languageCode: "en-US",
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: process.env.GEMINI_LIVE_VOICE || "Aoede",
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      enableAffectiveDialog: true,
      sessionResumption: { transparent: true },
    },
    callbacks: {
      onopen: () => {
        console.log(
          `[ChatbotVoice] Gemini Live connected (${CHATBOT_LIVE_MODEL} @ ${CHATBOT_LIVE_LOCATION}) for car: ${carId}`,
        );
      },
      onmessage: async (message) => {
        if (message.setupComplete?.sessionId) {
          const payload = {
            type: "connected",
            carId,
            sessionId: message.setupComplete.sessionId,
          };
          broadcast("status", payload);
          if (onEvent) onEvent("status", payload);
        }

        if (message.sessionResumptionUpdate?.newHandle) {
          const payload = {
            type: "session_resumption",
            carId,
            resumable: Boolean(message.sessionResumptionUpdate.resumable),
          };
          broadcast("status", payload);
          if (onEvent) onEvent("status", payload);
        }

        if (message.goAway) {
          const payload = {
            type: "go_away",
            carId,
            timeLeft: message.goAway.timeLeft || null,
          };
          broadcast("status", payload);
          if (onEvent) onEvent("status", payload);
        }

        if (message.serverContent?.interrupted) {
          const payload = {
            type: "interrupted",
            carId,
          };
          broadcast("status", payload);
          if (onEvent) onEvent("status", payload);
        }

        if (message.serverContent?.inputTranscription?.text) {
          const transcript = String(
            message.serverContent.inputTranscription.text || "",
          ).trim();
          if (transcript) {
            const payload = {
              text: transcript,
              carId,
              isFinal: Boolean(message.serverContent.turnComplete),
            };
            broadcast("user_transcript", payload);
            if (onEvent) onEvent("user_transcript", payload);

            if (message.serverContent.turnComplete) {
              chatHistory.push({ type: "user", text: transcript });
            }
          }
        }

        if (message.serverContent?.outputTranscription?.text) {
          const transcript = String(
            message.serverContent.outputTranscription.text || "",
          );
          const streamId = "assistant-live-stream";

          const payload = {
            text: transcript,
            carId,
            streamId,
            isFinal: Boolean(message.serverContent.turnComplete),
          };
          broadcast("ai_response", payload);
          if (onEvent) onEvent("ai_response", payload);

          if (message.serverContent.turnComplete && transcript.trim()) {
            chatHistory.push({ type: "bot", text: transcript.trim() });
          }
        } else if (message.serverContent?.turnComplete) {
          const payload = {
            text: "",
            carId,
            streamId: "assistant-live-stream",
            isFinal: true,
          };
          broadcast("ai_response", payload);
          if (onEvent) onEvent("ai_response", payload);
        }

        if (message.serverContent?.modelTurn) {
          const audioParts = extractAudioParts(message.serverContent.modelTurn);
          for (const part of audioParts) {
            if (onAudioChunk) {
              onAudioChunk(Buffer.from(part.data, "base64"), part.mimeType);
            }
          }

          const textParts = extractTextParts(message.serverContent.modelTurn);
          if (textParts.length > 0 && !message.serverContent.outputTranscription) {
            const joined = textParts.join("");
            const payload = {
              text: joined,
              carId,
              streamId: "assistant-live-stream",
              isFinal: Boolean(message.serverContent.turnComplete),
            };
            broadcast("ai_response", payload);
            if (onEvent) onEvent("ai_response", payload);

            if (message.serverContent.turnComplete && joined.trim()) {
              chatHistory.push({ type: "bot", text: joined.trim() });
            }
          }
        }

        if (message.toolCall?.functionCalls?.length) {
          const responses = [];

          for (const call of message.toolCall.functionCalls) {
            try {
              const output = await executeToolUse({
                toolName: call.name,
                input: call.args || {},
                carId,
                carContext,
                chatHistory,
                onEvent,
              });

              responses.push({
                id: call.id,
                name: call.name,
                response: output,
              });
            } catch (toolErr) {
              console.error(
                `[ChatbotVoice] Tool ${call.name} failed:`,
                toolErr.message,
              );
              responses.push({
                id: call.id,
                name: call.name,
                response: {
                  status: "error",
                  message:
                    "The backend search failed. Apologize briefly and ask the customer to try again.",
                },
              });
            }
          }

          if (responses.length > 0) {
            liveSession.sendToolResponse({ functionResponses: responses });
          }
        }
      },
      onerror: (error) => {
        console.error("[ChatbotVoice] Gemini Live session error:", error?.error || error);
      },
      onclose: () => {
        const payload = {
          type: "disconnected",
          carId,
        };
        broadcast("status", payload);
        if (onEvent) onEvent("status", payload);
        if (onClose) onClose();
      },
    },
  });

  function sendAudioChunk(buffer) {
    if (!buffer || buffer.length === 0) return;

    liveSession.sendRealtimeInput({
      audio: {
        mimeType: "audio/pcm;rate=16000",
        data: Buffer.from(buffer).toString("base64"),
      },
    });
  }

  function stop() {
    try {
      liveSession.sendRealtimeInput({ audioStreamEnd: true });
    } catch {}

    try {
      liveSession.close();
    } catch {}
  }

  return {
    sendAudioChunk,
    stop,
  };
}

module.exports = {
  CHATBOT_LIVE_LOCATION,
  CHATBOT_LIVE_MODEL,
  startChatbotVoiceSession,
};
