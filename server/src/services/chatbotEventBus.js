/**
 * Chatbot Event Bus — Server-Sent Events for the RAG Voice Chatbot
 *
 * Separate from the editor event bus so the customer-facing chatbot
 * and the dealer-facing copilot don't cross-contaminate events.
 *
 * Events:
 *   "user_transcript"  — user's spoken words (ASR from Gemini Live)
 *   "ai_response"      — AI's spoken reply as text
 *   "tool_call"        — tool invocation (e.g. draft_test_drive)
 *   "status"           — connection lifecycle updates
 */

const clients = new Set();

/**
 * Register an SSE client (Express Response object).
 * @param {import("express").Response} res
 */
function addClient(res) {
  clients.add(res);
  console.log(`📡 [ChatbotBus] Client connected (${clients.size} total)`);
}

/**
 * Remove a disconnected SSE client.
 * @param {import("express").Response} res
 */
function removeClient(res) {
  clients.delete(res);
  console.log(`📡 [ChatbotBus] Client disconnected (${clients.size} total)`);
}

/**
 * Broadcast an event to every connected SSE client.
 * @param {string} eventName  — e.g. "user_transcript", "ai_response"
 * @param {object} data       — JSON-serializable payload
 */
function broadcast(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

module.exports = { addClient, removeClient, broadcast };
