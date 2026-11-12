/**
 * RAG Chat Service — Multimodal Retrieval-Augmented Generation
 *
 * Three-tier pipeline:
 *   Tier 1: Intent & Context Check (Gemini Flash) — answer from carContext JSON if possible
 *   Tier 2: Multimodal Vector Search — embed question → Supabase pgvector cosine similarity
 *   Tier 3: Multimodal Synthesis (Gemini Pro) — synthesize answer from retrieved text + images
 *
 * Tool Calling:
 *   Gemini Pro with draft_test_drive tool — intercepts booking intent and returns widget payload
 *
 * Returns structured payload: { text, image_url } or { type: "widget", widget_type, prefilled_data }
 */

const {
  FunctionCallingConfigMode,
  generateText,
  selectTextModel,
} = require("../config/aiConfig");
const { supabase } = require("../config/supabase");
const { generateMultimodalEmbedding } = require("./embeddingService");

const SIMILARITY_THRESHOLD = 0.25;
const MAX_RESULTS = 5;
const MAX_HISTORY_TURNS = 6;

const DRAFT_TEST_DRIVE_FUNCTION = {
  name: "draft_test_drive",
  description:
    "Draft a test drive booking when the user expresses interest in scheduling a test drive, visiting the dealership, or trying/driving the car. Extract any date, time, name, or phone information mentioned.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description:
          "The requested date in YYYY-MM-DD format. Interpret relative dates like 'tomorrow', 'next Monday', etc. relative to today's date.",
      },
      time: {
        type: "string",
        description:
          "The requested time in HH:MM 24-hour format. Convert '2pm' to '14:00', '10am' to '10:00', etc.",
      },
      customer_name: {
        type: "string",
        description: "The customer's full name if mentioned.",
      },
      phone_number: {
        type: "string",
        description: "The customer's phone number if mentioned.",
      },
    },
    required: [],
  },
};

const TOOL_CALLING_SYSTEM = `You are a helpful car dealership AI assistant. You have access to a tool called "draft_test_drive" that lets you help customers schedule a test drive.

MANDATORY RULE: Call the draft_test_drive tool ONLY when the user expresses a clear intent to:
- Schedule, book, or arrange a test drive
- Visit the dealership to see or try the car
- Drive or test the vehicle
- Come in to see the car in person
- "test drive", "book", "schedule", "visit", "come in", "try it", "drive it"

You MUST call the draft_test_drive tool immediately. Do NOT respond with plain text for these requests. Extract any date, time, name, or phone details the user provides. If they don't provide details, call the tool with no arguments — the booking form will collect the rest.

IMPORTANT NON-BOOKING EXAMPLES:
- Questions about features, specs, price, mileage, dimensions, cargo space, infotainment, climate controls, AC buttons, steering-wheel buttons, physical controls, screens, or comparisons are NOT booking requests.
- If the user is asking what the car has or how something works, do NOT call the tool.

Today's date is: ${new Date().toISOString().split("T")[0]}

For all other questions (specs, features, pricing, comparisons), respond with a helpful text answer only.`;

const TIER1_SYSTEM = `You are a car dealership AI assistant. You will receive:
1. A user question about a vehicle
2. A JSON object containing the vehicle's structured data (specs, price, mileage, badges, etc.)

Your job: Determine if you can FULLY and ACCURATELY answer the user's question using ONLY the provided JSON data.

RULES:
- If the JSON contains enough data to give a complete, specific answer → respond with the answer directly.
- If the answer requires deeper knowledge not in the JSON (e.g., brochure details, interior descriptions, comparison data, subjective opinions about feel/comfort, visual descriptions) → respond with EXACTLY the text: SEARCH_DOCUMENTS
- Never guess or fabricate data. Only use what's explicitly in the JSON.
- Keep answers concise and conversational (2-3 sentences max).
- Format prices as USD, mileage with commas, specs with units.`;

const TIER3_SYSTEM = `You are an expert automotive assistant for a car dealership. You will receive:
1. The user's question
2. Retrieved context: a mix of text paragraphs, markdown tables, and image URLs from the vehicle's brochure/documentation
3. The vehicle's basic specs JSON

Your job: Synthesize a comprehensive, accurate answer using ALL provided context.

RULES:
- Draw from both the retrieved text/tables AND the specs JSON to give the best answer.
- If one of the retrieved images directly illustrates or is relevant to your answer, include its URL by outputting a line at the very end of your response in this exact format:
  IMAGE: <url>
- Only include IMAGE if the image is genuinely relevant. If no image helps, do not include the IMAGE line.
- Be conversational, helpful, and specific. Use actual numbers and facts from the context.
- If the retrieved context doesn't fully answer the question, say what you know and note the limitation.
- Keep answers focused: 2-4 sentences for simple questions, up to a short paragraph for complex ones.
- Never fabricate information not present in the provided context.`;

function extractResponseText(response) {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => part?.text || "")
    .join("")
    .trim();
}

async function checkBookingIntent(question, carContext, conversationHistory) {
  const historyBlock = formatHistory(conversationHistory);
  const contextJson = JSON.stringify(
    {
      year: carContext.year,
      make: carContext.make,
      model: carContext.model,
      trim: carContext.trim,
      price: carContext.price,
    },
    null,
    2,
  );

  const prompt = `${historyBlock ? `CONVERSATION HISTORY:\n${historyBlock}\n\n` : ""}VEHICLE: ${contextJson}\n\nUSER MESSAGE: ${question}`;

  const response = await generateText({
    model: selectTextModel({ prefer: "pro" }),
    systemInstruction: TOOL_CALLING_SYSTEM,
    contents: prompt,
    temperature: 0.1,
    topP: 0.9,
    maxOutputTokens: 512,
    tools: [
      {
        functionDeclarations: [DRAFT_TEST_DRIVE_FUNCTION],
      },
    ],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO,
        allowedFunctionNames: [DRAFT_TEST_DRIVE_FUNCTION.name],
      },
    },
  });

  const toolCalls = response.functionCalls || [];

  console.log(
    "🔧 [RAG Chat] Tool call check — functionCalls:",
    JSON.stringify(toolCalls),
  );

  if (toolCalls.length > 0 && toolCalls[0].name === DRAFT_TEST_DRIVE_FUNCTION.name) {
    const args = toolCalls[0].args || {};
    console.log("🗓️  [RAG Chat] Tool call: draft_test_drive", args);
    return {
      isBooking: true,
      prefilled_data: {
        date: args.date || null,
        time: args.time || null,
        name: args.customer_name || null,
        phone: args.phone_number || null,
      },
    };
  }

  return { isBooking: false };
}

async function tier1ContextCheck(question, carContext, conversationHistory) {
  const historyBlock = formatHistory(conversationHistory);
  const contextJson = JSON.stringify(carContext, null, 2);

  const prompt = `${historyBlock ? `CONVERSATION HISTORY:\n${historyBlock}\n\n` : ""}USER QUESTION: ${question}\n\nVEHICLE DATA JSON:\n${contextJson}`;

  const response = await generateText({
    model: selectTextModel({ prefer: "flash" }),
    systemInstruction: TIER1_SYSTEM,
    contents: prompt,
    temperature: 0.1,
    topP: 0.9,
    maxOutputTokens: 768,
    thinkingConfig: { thinkingBudget: 0 },
  });

  const text = extractResponseText(response);

  if (text === "SEARCH_DOCUMENTS" || text.includes("SEARCH_DOCUMENTS")) {
    return { answered: false };
  }

  return { answered: true, text };
}

async function tier2VectorSearch(question, carId) {
  const queryEmbedding = await generateMultimodalEmbedding({
    inputText: question,
    taskType: "RETRIEVAL_QUERY",
  });

  const { data, error } = await supabase.rpc("match_car_knowledge", {
    query_embedding: JSON.stringify(queryEmbedding),
    target_car_id: carId,
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: MAX_RESULTS,
  });

  if (error) {
    console.error("❌ [RAG Chat] Vector search failed:", error.message);
    throw new Error(`Vector search failed: ${error.message}`);
  }

  console.log(
    `🔍 [RAG Chat] Retrieved ${data?.length || 0} results (threshold: ${SIMILARITY_THRESHOLD})`,
  );

  return data || [];
}

async function tier3Synthesis(
  question,
  retrievedResults,
  carContext,
  conversationHistory,
) {
  const historyBlock = formatHistory(conversationHistory);

  const textResults = retrievedResults.filter(
    (r) => r.content_type === "text" || r.content_type === "table",
  );
  const imageResults = retrievedResults.filter(
    (r) => r.content_type === "image",
  );

  let contextBlock = "";

  if (textResults.length > 0) {
    contextBlock += "RETRIEVED TEXT & TABLES:\n";
    textResults.forEach((r, i) => {
      contextBlock += `\n--- Document ${i + 1} (similarity: ${r.similarity?.toFixed(3)}) ---\n${r.content}\n`;
    });
  }

  if (imageResults.length > 0) {
    contextBlock += "\nRETRIEVED IMAGES:\n";
    imageResults.forEach((r, i) => {
      contextBlock += `- Image ${i + 1} (similarity: ${r.similarity?.toFixed(3)}): ${r.content}\n`;
    });
  }

  const specsJson = JSON.stringify(
    {
      year: carContext.year,
      make: carContext.make,
      model: carContext.model,
      trim: carContext.trim,
      price: carContext.price,
      mileage: carContext.mileage,
      color: carContext.color,
    },
    null,
    2,
  );

  const prompt = `${historyBlock ? `CONVERSATION HISTORY:\n${historyBlock}\n\n` : ""}USER QUESTION: ${question}\n\nVEHICLE BASICS:\n${specsJson}\n\n${contextBlock}`;

  const response = await generateText({
    model: selectTextModel({ prefer: "pro" }),
    systemInstruction: TIER3_SYSTEM,
    contents: prompt,
    temperature: 0.3,
    topP: 0.9,
    maxOutputTokens: 2048,
  });

  const rawText = extractResponseText(response);
  const imageMatch = rawText.match(/\nIMAGE:\s*(.+)$/);
  let text = rawText;
  let image_url = null;

  if (imageMatch) {
    image_url = imageMatch[1].trim();
    text = rawText.replace(/\nIMAGE:\s*.+$/, "").trim();
  }

  return { text, image_url };
}

async function processChat({
  question,
  carId,
  carContext,
  conversationHistory = [],
}) {
  console.log(`\n💬 [RAG Chat] Question: "${question}" | Car: ${carId}`);

  try {
    console.log("🗓️  [RAG Chat] Checking booking intent (Gemini Pro)...");
    const bookingCheck = await checkBookingIntent(
      question,
      carContext,
      conversationHistory,
    );

    if (bookingCheck.isBooking) {
      console.log("✅ [RAG Chat] Booking intent detected — returning widget");
      return {
        type: "widget",
        widget_type: "booking_draft",
        prefilled_data: bookingCheck.prefilled_data,
        text: "I'd love to help you schedule a test drive! Let me pull up the booking form for you.",
        image_url: null,
        tier: 0,
      };
    }

    console.log(
      "➡️  [RAG Chat] No booking intent — proceeding to RAG pipeline",
    );
  } catch (err) {
    console.error(
      "⚠️  [RAG Chat] Booking intent check failed, continuing with RAG:",
      err.message,
      err.stack,
    );
  }

  try {
    console.log("⚡ [RAG Chat] Tier 1 — Context check...");
    const tier1 = await tier1ContextCheck(
      question,
      carContext,
      conversationHistory,
    );

    if (tier1.answered) {
      console.log("✅ [RAG Chat] Tier 1 answered from context JSON");
      return { text: tier1.text, image_url: null, tier: 1 };
    }

    console.log(
      "➡️  [RAG Chat] Tier 1 → SEARCH_DOCUMENTS, advancing to Tier 2",
    );
  } catch (err) {
    console.error(
      "⚠️  [RAG Chat] Tier 1 failed, falling through to Tier 2:",
      err.message,
    );
  }

  let retrievedResults = [];
  try {
    console.log("🔍 [RAG Chat] Tier 2 — Vector search...");
    retrievedResults = await tier2VectorSearch(question, carId);

    if (retrievedResults.length === 0) {
      console.log("⚠️  [RAG Chat] No vector results found");
      return {
        text: "I don't have detailed documentation for that specific question yet. The dealer can provide more information — would you like to ask about something else?",
        image_url: null,
        tier: 2,
      };
    }
  } catch (err) {
    console.error("❌ [RAG Chat] Tier 2 vector search failed:", err.message);
    return {
      text: "I'm having trouble searching the vehicle documentation right now. Please try again in a moment.",
      image_url: null,
      tier: 2,
    };
  }

  try {
    console.log("🧠 [RAG Chat] Tier 3 — Gemini Pro synthesis...");
    const result = await tier3Synthesis(
      question,
      retrievedResults,
      carContext,
      conversationHistory,
    );

    console.log(
      `✅ [RAG Chat] Tier 3 complete${result.image_url ? " (with image)" : ""}`,
    );
    return { ...result, tier: 3 };
  } catch (err) {
    console.error("❌ [RAG Chat] Tier 3 synthesis failed:", err.message);
    return {
      text: "I found some relevant information but had trouble processing it. Please try rephrasing your question.",
      image_url: null,
      tier: 3,
    };
  }
}

function formatHistory(conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) return "";

  const recent = conversationHistory.slice(-MAX_HISTORY_TURNS);
  return recent
    .map((msg) => {
      const role = msg.type === "user" ? "User" : "Assistant";
      return `${role}: ${msg.text}`;
    })
    .join("\n");
}

module.exports = { processChat, tier2VectorSearch };
