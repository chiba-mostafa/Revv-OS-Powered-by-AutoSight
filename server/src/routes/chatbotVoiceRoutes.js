/**
 * Chatbot Voice Routes
 *
 * GET  /api/rag/voice/config  — Returns websocket URL and protocol details.
 * GET  /api/rag/voice/events  — Transitional SSE stream for chatbot transcript events.
 */

const express = require("express");
const { addClient, removeClient } = require("../services/chatbotEventBus");

const router = express.Router();

router.get("/config", (req, res) => {
  const host = req.headers.host;
  const isSecure =
    req.protocol === "https" ||
    req.headers["x-forwarded-proto"] === "https";
  const wsProtocol = isSecure ? "wss" : "ws";

  res.json({
    websocketUrl: `${wsProtocol}://${host}/api/rag/voice/ws`,
    inputFormat: {
      encoding: "pcm_s16le",
      sampleRate: 16000,
      channels: 1,
    },
    outputFormat: {
      encoding: "pcm_s16le",
      sampleRate: 24000,
      channels: 1,
    },
  });
});

router.post("/stop", (_req, res) => {
  res.json({ ok: true });
});

router.get("/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": req.headers.origin || "http://localhost:5173",
  });

  res.write("event: connected\ndata: {}\n\n");
  addClient(res);

  req.on("close", () => {
    removeClient(res);
  });
});

module.exports = router;
