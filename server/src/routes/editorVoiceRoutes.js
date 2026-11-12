/**
 * Editor Voice Routes
 *
 * POST /api/editor/voice/start — Creates a LiveKit room, spawns the bot agent,
 *                                  returns a user token for the client to join.
 * POST /api/editor/voice/stop  — Stops the bot agent for a given room.
 * GET  /api/editor/voice/events — SSE stream for transcripts, AI responses, tool calls.
 */

const express = require("express");
const { AccessToken } = require("livekit-server-sdk");
const { addClient, removeClient } = require("../services/editorEventBus");
const { EditorLivekitAgent } = require("../services/editorLivekitAgent");
require("dotenv").config();

const router = express.Router();

function getAllowedOrigin(origin) {
  const configured = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const allowed = new Set([
    "http://localhost:5173",
    "http://localhost:5174",
    ...configured,
  ]);

  if (origin && allowed.has(origin)) {
    return origin;
  }

  return "http://localhost:5173";
}

// Active agents by room name — cleanup on disconnect
const activeAgents = new Map();

/**
 * POST /api/editor/voice/start
 * Body: { car_id, story_data, current_scene_index }
 * Returns: { token, url, roomName }
 */
router.post("/start", async (req, res) => {
  try {
    const { car_id, story_data = {}, current_scene_index = 0 } = req.body;
    if (!car_id) {
      return res.status(400).json({ error: "car_id is required" });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.status(500).json({ error: "LiveKit not configured" });
    }

    const roomName = `editor-${car_id.slice(0, 8)}-${Date.now()}`;

    const userToken = new AccessToken(apiKey, apiSecret, {
      identity: `dealer-${Date.now()}`,
      name: "Dealer",
    });
    userToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });
    const jwt = await userToken.toJwt();

    // Spawn the bot agent
    const agent = new EditorLivekitAgent(
      roomName,
      car_id,
      story_data,
      current_scene_index,
    );
    activeAgents.set(roomName, agent);

    // Wait for the bot to connect (creates the room) before sending the token
    await agent.connect();

    // Now that the room exists, let the agent wait for user mic in background
    agent.waitAndRun().catch((err) => {
      console.error(
        `[EditorVoiceRoute] Agent session failed for ${roomName}:`,
        err.message,
      );
      activeAgents.delete(roomName);
    });

    res.json({ token: jwt, url: livekitUrl, roomName });
  } catch (err) {
    console.error("[EditorVoiceRoute] /start error:", err);
    res.status(500).json({ error: "Failed to start editor voice session" });
  }
});

/**
 * POST /api/editor/voice/stop
 * Body: { roomName }
 */
router.post("/stop", (req, res) => {
  const { roomName } = req.body;
  const agent = activeAgents.get(roomName);
  if (agent) {
    agent.stop();
    activeAgents.delete(roomName);
  }
  res.json({ ok: true });
});

/**
 * GET /api/editor/voice/events
 * SSE stream for editor voice transcripts, responses, and tool calls.
 */
router.get("/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": getAllowedOrigin(req.headers.origin),
  });

  res.write("event: connected\ndata: {}\n\n");

  addClient(res);

  req.on("close", () => {
    removeClient(res);
  });
});

module.exports = router;
