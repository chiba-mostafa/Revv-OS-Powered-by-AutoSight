import { API_BASE } from "../../../config/api";

class ChatbotBackend {
  /**
   * Send a question to the multimodal RAG backend.
   * Returns { text, image_url } structured payload.
   *
   * @param {string} userMessage
   * @param {object} carContext — full car data from storyData
   * @param {object} currentScene — current scene (unused by backend, kept for API compat)
   * @param {Array}  conversationHistory — previous messages [{type, text}]
   * @returns {Promise<{ text: string, image_url: string|null }>}
   */
  async generateResponse(
    userMessage,
    carContext,
    currentScene,
    conversationHistory = [],
  ) {
    // Strip _storyData (too large to send) and build a lean context
    const { _storyData, ...leanContext } = carContext || {};

    const res = await fetch(`${API_BASE}/api/rag/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        car_id: carContext?.id || carContext?.car_id,
        question: userMessage,
        car_context: leanContext,
        conversation_history: conversationHistory.slice(-6).map((m) => ({
          type: m.type,
          text: m.text,
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }

    const data = await res.json();

    // Widget response (booking intent)
    if (data.type === "widget") {
      return {
        type: "widget",
        widget_type: data.widget_type,
        prefilled_data: data.prefilled_data,
        text: data.text,
      };
    }

    return {
      text: data.text,
      image_url: data.image_url || null,
    };
  }

  /**
   * Submit a test drive booking.
   * @returns {Promise<{ success: boolean, booking?: object, error?: string }>}
   */
  async bookTestDrive({
    car_id,
    dealer_id,
    customer_name,
    phone,
    appointment_date,
    appointment_time,
  }) {
    const res = await fetch(`${API_BASE}/api/leads/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        car_id,
        dealer_id,
        customer_name,
        phone,
        appointment_date,
        appointment_time,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    return data;
  }

  getContextualSuggestions(currentScene, carContext = null) {
    const baseSuggestions = [];

    if (carContext) {
      if (carContext.price) baseSuggestions.push("What's the price?");
      if (carContext.mileage !== undefined)
        baseSuggestions.push("What's the mileage?");
      if (carContext.color) baseSuggestions.push("What color is it?");

      const hasBadges =
        (carContext.badges && carContext.badges.length > 0) ||
        (carContext.features?.badges_to_suggest &&
          carContext.features.badges_to_suggest.length > 0);
      if (hasBadges) baseSuggestions.push("Did it win any awards?");
    }

    if (!currentScene) {
      return baseSuggestions.length > 0
        ? baseSuggestions.slice(0, 3)
        : ["What's the price?", "Is it a good car?", "Safety ratings?"];
    }

    const theme = (currentScene.slide_content?.theme_tag || "").toLowerCase();

    if (theme.includes("performance"))
      return ["How fast is it?", "What is the HP?", "What's the torque?"];
    if (theme.includes("efficiency"))
      return ["What is the MPG?", "What's the range?", "Is it fuel efficient?"];
    if (theme.includes("safety"))
      return ["Safety ratings?", "Is it IIHS rated?", "Any crash test awards?"];
    if (theme.includes("utility"))
      return ["Trunk space?", "How many seats?", "Cargo capacity?"];
    if (theme.includes("design") || theme.includes("exterior"))
      return ["What color is it?", "Dimensions?", "Is it AWD?"];
    if (theme.includes("interior"))
      return [
        "How many seats?",
        "Does it have CarPlay?",
        "What does the dashboard look like?",
      ];

    return baseSuggestions.length > 0
      ? baseSuggestions.slice(0, 3)
      : ["What's the price?", "Mileage?", "Is it a good car?"];
  }
}

export default new ChatbotBackend();
