/**
 * Chatbot WebSocket Handler
 *
 * Client -> server messages:
 *   JSON { type: "start", car_context, chat_history }
 *   JSON { type: "audio_end" }
 *   Binary frames: PCM16 mono 16kHz microphone audio
 *
 * Server -> client messages:
 *   JSON event envelopes for status / transcripts / tool calls / errors
 *   Binary frames: PCM16 mono 24kHz Gemini audio
 */

const { startChatbotVoiceSession } = require("./chatbotVoiceService");

function sendJson(ws, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

async function handleVoiceConnection(ws, req) {
  const url = new URL(req.url, "http://localhost");
  const carId = url.searchParams.get("car_id");

  if (!carId) {
    ws.close(1008, "car_id is required");
    return;
  }

  console.log(`[ChatbotWS] 🎤 New Gemini Live voice connection for car: ${carId}`);

  let sessionHandle = null;
  let closed = false;

  function safeStop() {
    if (sessionHandle) {
      try {
        sessionHandle.stop();
      } catch {}
      sessionHandle = null;
    }
  }

  async function startSession(config = {}) {
    if (sessionHandle) return;

    const carContext = config.car_context || {};
    const chatHistory = Array.isArray(config.chat_history)
      ? config.chat_history
      : [];

    sessionHandle = await startChatbotVoiceSession({
      carId,
      carContext,
      chatHistory,
      onAudioChunk: (audioChunk) => {
        if (ws.readyState === 1) {
          ws.send(audioChunk, { binary: true });
        }
      },
      onEvent: (eventName, payload) => {
        sendJson(ws, {
          ...payload,
          event: eventName,
        });
      },
      onClose: () => {
        if (!closed) {
          sendJson(ws, { type: "status", event: "disconnected", carId });
        }
      },
    });

    sendJson(ws, {
      type: "status",
      event: "connected",
      carId,
    });
  }

  ws.on("message", async (data, isBinary) => {
    try {
      if (isBinary) {
        if (!sessionHandle) return;
        sessionHandle.sendAudioChunk(data);
        return;
      }

      const payload = JSON.parse(data.toString());

      if (payload.type === "start") {
        await startSession(payload);
        return;
      }

      if (payload.type === "audio_end") {
        if (sessionHandle) {
          sessionHandle.sendAudioChunk(Buffer.alloc(0));
        }
        return;
      }

      if (payload.type === "stop") {
        safeStop();
        sendJson(ws, {
          type: "status",
          event: "stopped",
          carId,
        });
      }
    } catch (error) {
      console.error("[ChatbotWS] Message handling failed:", error.message);
      sendJson(ws, {
        type: "status",
        event: "error",
        carId,
        message: error.message,
      });
    }
  });

  ws.on("close", () => {
    closed = true;
    console.log(`[ChatbotWS] Connection closed for car: ${carId}`);
    safeStop();
  });

  ws.on("error", (err) => {
    console.error(`[ChatbotWS] Error for car ${carId}:`, err.message);
    sendJson(ws, {
      type: "status",
      event: "error",
      carId,
      message: err.message,
    });
    safeStop();
  });
}

module.exports = { handleVoiceConnection };
