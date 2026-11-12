const {
  generateStructuredData,
  selectTextModel,
} = require("../../config/aiConfig");
const { buildAnalystPrompt } = require("./prompts/analystPrompt");
const { AnalystReportSchema } = require("./schemas/analystSchema");

async function analyzeCar(
  carContext,
  templateStyle = "Cinematic",
) {
  const activeModel = selectTextModel({ prefer: "flash" });
  console.log(`🧠 Analyst Agent: Thinking... (Template: ${templateStyle})`);

  try {
    const leanContext = {
      identity: carContext.identity,
      visuals: carContext.visual_directives,
      specs: carContext.normalized_specs,
      intelligence: carContext.derived_intelligence,
      available_badges: carContext.certifications,
    };

    const prompt = buildAnalystPrompt({
      car_context_json: JSON.stringify(leanContext, null, 2),
      template_style: templateStyle,
      document_context:
        carContext.document_context || "No additional documentation provided.",
    });

    const report = await generateStructuredData({
      model: activeModel,
      schema: AnalystReportSchema,
      systemInstruction: prompt.systemInstruction,
      contents: prompt.userPrompt,
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 4096,
    });

    console.log(
      `🧠 Analyst Agent: Done. Persona identified as "${report.marketing_persona}"`,
    );
    return report;
  } catch (error) {
    console.error("❌ Analyst Agent Failed:", error);
    throw new Error("Failed to analyze car context.");
  }
}

module.exports = { analyzeCar };
