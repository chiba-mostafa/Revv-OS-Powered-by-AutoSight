/**
 * Editor Event Bus — Server-Sent Events for the Editor Voice Copilot
 *
 * Separate from the chatbot event bus so the customer-facing chatbot
 * and the dealer-facing copilot don't cross-contaminate events.
 *
 * Events:
 *   "user_transcript"  — user's spoken words (ASR from Gemini Live)
 *   "ai_response"      — AI's spoken reply as text
 *   "tool_call"        — tool invocation (e.g. update_scene_text, navigate_scene)
 *   "status"           — connection lifecycle updates
 */

const clients = new Set();

/**
 * Register an SSE client (Express Response object).
 * @param {import("express").Response} res
 */
function addClient(res) {
  clients.add(res);
  console.log(`[EditorBus] Client connected (${clients.size} total)`);
}

/**
 * Remove a disconnected SSE client.
 * @param {import("express").Response} res
 */
function removeClient(res) {
  clients.delete(res);
  console.log(`[EditorBus] Client disconnected (${clients.size} total)`);
}

/**
 * Broadcast an event to every connected SSE client.
 * @param {string} eventName  — e.g. "user_transcript", "ai_response", "tool_call"
 * @param {object} data       — JSON-serializable payload
 */
function broadcast(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

module.exports = { addClient, removeClient, broadcast };
