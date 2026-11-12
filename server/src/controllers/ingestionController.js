const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../config/supabase");
const { ExecutionsClient } = require("@google-cloud/workflows");
const axios = require("axios");

// Initialize GCP Workflows Client
const workflowsClient = new ExecutionsClient();

const generateContext = async (req, res) => {
  try {
    const { car_id, template, scenes, language } = req.body;

    console.log(`🚀 Request Received for Car: ${car_id}`);
    console.log(`🌐 Language: ${language || "en"}`);

    if (!car_id) {
      return res.status(400).json({ error: "Missing car_id" });
    }

    const { data: carData, error: carError } = await supabase
      .from("cars")
      .select("dealer_id")
      .eq("id", car_id)
      .single();

    if (carError || !carData) {
      throw new Error(
        "Could not find car or dealer_id: " +
          (carError?.message || "Unknown error"),
      );
    }

    const dealerId = carData.dealer_id;

    const { data: existingStory } = await supabase
      .from("stories")
      .select("id", "generation_status")
      .eq("car_id", car_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingStory && existingStory.generation_status === "processing") {
      console.log(`🛑 Blocked duplicate generation for car: ${car_id}`);
      return res.status(429).json({
        success: false,
        error:
          "A story is already being generated for this vehicle. Please wait.",
      });
    }

    let storyId;
    let dbError;

    const storyPayload = {
      car_id: car_id,
      dealer_id: dealerId,
      generation_status: "processing",
      current_agent: "SYSTEM",
      progress_percent: 0,
      progress_logs: ["Pipeline initialized"],
      deleted_at: null,
      content: {}, // <-- CRITICAL: Clears old data if we are overwriting
    };

    if (existingStory) {
      storyId = existingStory.id;
      console.log(`🔄 Overwriting existing story: ${storyId}`);

      const { error } = await supabase
        .from("stories")
        .update(storyPayload)
        .eq("id", storyId);
      dbError = error;
    } else {
      storyId = uuidv4();
      storyPayload.id = storyId;
      console.log(`✨ Creating new story: ${storyId}`);

      const { error } = await supabase.from("stories").insert(storyPayload);
      dbError = error;
    }

    if (dbError) {
      throw new Error("DB Operation Failed: " + dbError.message);
    }

    // RESPOND INSTANTLY TO FRONTEND
    res.status(200).json({
      success: true,
      message: "Generation Started",
      storyId: storyId,
    });

    // ---------------------------------------------------------
    // TRIGGER THE PIPELINE (Cloud or Local)
    // ---------------------------------------------------------
    const workflowArgs = {
      storyId: storyId,
      dealerInput: req.body, // Passes the full payload (language, scenes, etc.)
    };

    if (
      process.env.NODE_ENV === "production" ||
      process.env.USE_GCP_WORKFLOWS === "true"
    ) {
      console.log(`☁️ Triggering Google Cloud Workflow for Story: ${storyId}`);
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      const location =
        process.env.GOOGLE_CLOUD_WORKFLOW_REGION || "us-central1";
      const workflowName =
        process.env.GOOGLE_CLOUD_WORKFLOW_NAME || "autosense-pipeline";

      const parent = workflowsClient.workflowPath(
        projectId,
        location,
        workflowName,
      );

      await workflowsClient.createExecution({
        parent,
        execution: {
          argument: JSON.stringify(workflowArgs),
        },
      });
    }
    // Otherwise, simulate the workflow locally on your laptop
    else {
      console.log(`💻 Running Local Workflow Simulation for Story: ${storyId}`);
      runLocalSimulation(workflowArgs);
    }
  } catch (error) {
    console.error("❌ Controller Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

/**
 * HELPER: Simulates Google Cloud Workflows locally
 * Hits our new Micro-Endpoints one by one
 */
async function runLocalSimulation(args) {
  const baseUrl = `http://localhost:${process.env.PORT || 3000}/api/workflow`;
  const endpoints = [
    "/ingest",
    "/analyze",
    "/direct",
    "/script",
    "/visualize",
    "/audio",
    "/qa",
  ];

  try {
    for (const endpoint of endpoints) {
      console.log(`\n[LOCAL WORKFLOW] Hitting ${endpoint}...`);
      await axios.post(`${baseUrl}${endpoint}`, args);
    }
    console.log(`\n[LOCAL WORKFLOW] ✅ Simulation Complete!`);
  } catch (error) {
    console.error(
      `\n[LOCAL WORKFLOW] ❌ Pipeline crashed at endpoint. Check logs.`,
    );
    console.error(error.message);
  }
}

module.exports = { generateContext };
