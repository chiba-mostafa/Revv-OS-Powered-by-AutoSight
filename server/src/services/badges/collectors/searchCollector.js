const { z } = require("zod");
const {
  generateStructuredData,
  generateText,
  selectTextModel,
} = require("../../../config/aiConfig");
const { BADGE_REGISTRY } = require("../badgeRegistry");

const SEARCH_TARGETS = `
1. NHTSA 5-Star / 4-Star safety ratings
2. IIHS Top Safety Pick / Plus (USA)
3. Euro NCAP / ANCAP / ASEAN NCAP / JNCAP / C-NCAP / Latin NCAP 5 Stars
4. Green NCAP 5 Stars
5. MotorTrend Car/SUV of the Year
6. Car and Driver 10Best / Editors' Choice
7. Wards 10 Best Engines / Interiors
8. Red Dot Design Award
9. World Car of the Year (WCOTY)
10. Kelley Blue Book (KBB) Best Buy / Resale
11. What Car? Car of the Year
12. J.D. Power Quality / Dependability
13. Consumer Reports Recommended
`;

const ExtractionSchema = z.object({
  found_badges: z.array(
    z.object({
      badge_id: z.string(),
      evidence_snippet: z.string(),
      confidence: z.enum(["HIGH", "LOW"]),
      source_url: z.string().optional(),
      source_title: z.string().optional(),
    }),
  ),
});

const EXTRACTION_PROMPT = `You are an automotive award verification specialist.

Vehicle:
{car_identity}

Allowed targets:
${SEARCH_TARGETS}

Allowed badge ids:
- SAFETY_NHTSA_5
- SAFETY_NHTSA_4
- SAFETY_IIHS_TSP_PLUS
- SAFETY_IIHS_TSP
- SAFETY_EURONCAP_5
- SAFETY_EURONCAP_ADV
- SAFETY_ANCAP_5
- SAFETY_ASEANNCAP_5
- SAFETY_JNCAP_5
- SAFETY_LATINNCAP_5
- SAFETY_CNCAP_5
- ENERGY_GREENNCAP_5
- AWARD_MOTORTREND_COTY
- AWARD_MOTORTREND_SUV
- AWARD_CARANDDRIVER_10BEST
- AWARD_CARANDDRIVER_EDITORS
- AWARD_WARDS_ENGINES
- AWARD_WARDS_INTERIORS
- AWARD_RED_DOT
- AWARD_WCOTY
- AWARD_KBB_BEST_BUY
- AWARD_KBB_RESALE
- AWARD_WHATCAR_COTY
- TRUST_JDPOWER_QUALITY
- TRUST_JDPOWER_DEPENDABILITY
- TRUST_CR_RECOMMENDED

Rules:
- Return only badges explicitly supported by grounded search evidence.
- Prefer the exact year/model. If the source is clearly about another year or another model, ignore it.
- If a result is ambiguous, mark confidence LOW.
- Do not invent badge ids.
- Return valid JSON only.`;

function flattenGroundingMetadata(response) {
  const metadata = response?.candidates?.[0]?.groundingMetadata || {};
  const chunks = metadata.groundingChunks || [];
  return chunks
    .map((chunk) => {
      const web = chunk.web || {};
      return {
        title: web.title || "",
        url: web.uri || web.url || "",
      };
    })
    .filter((chunk) => chunk.title || chunk.url);
}

function buildGroundedEvidenceText(answerText, groundedSources) {
  return [
    `Grounded answer:\n${answerText}`,
    "Grounded sources:",
    ...groundedSources.map(
      (source, index) =>
        `${index + 1}. ${source.title || "Untitled source"} - ${source.url || "No URL"}`,
    ),
  ].join("\n");
}

async function runGroundedSearch(year, make, model) {
  const carIdentity = `${year} ${make} ${model}`;
  const prompt = `For the vehicle ${carIdentity}, identify any official crash-test ratings, safety awards, editorial awards, quality awards, or recommendation badges that are currently supported by web evidence. Include NHTSA, IIHS, NCAP programs, Green NCAP, MotorTrend, Car and Driver, Wards, Red Dot, World Car of the Year, Kelley Blue Book, What Car?, J.D. Power, and Consumer Reports when applicable.`;

  const response = await generateText({
    model: selectTextModel({ prefer: "pro" }),
    contents: prompt,
    temperature: 0.1,
    topP: 0.8,
    maxOutputTokens: 2048,
    tools: [{ googleSearch: {} }],
  });

  return {
    answerText: response.text || "",
    groundedSources: flattenGroundingMetadata(response),
  };
}

async function analyzeGroundedSearch({ answerText, groundedSources, carIdentity }) {
  if (!answerText.trim()) return [];

  const result = await generateStructuredData({
    model: selectTextModel({ prefer: "pro" }),
    schema: ExtractionSchema,
    systemInstruction: EXTRACTION_PROMPT.replace("{car_identity}", carIdentity),
    contents: buildGroundedEvidenceText(answerText, groundedSources),
    temperature: 0.1,
    topP: 0.8,
    maxOutputTokens: 2048,
  });

  return result.found_badges || [];
}

async function collectSearchBadges(context) {
  if (
    !process.env.GOOGLE_CLOUD_PROJECT_ID &&
    !process.env.GOOGLE_CLOUD_PROJECT &&
    !process.env.GOOGLE_API_KEY &&
    !process.env.GEMINI_API_KEY
  ) {
    console.warn(
      "   ⚠️ Search Collector skipped: Gemini search grounding is not configured.",
    );
    return [];
  }

  const { year, make, model } = context.identity;
  const carIdentity = `${year} ${make} ${model}`;

  try {
    const { answerText, groundedSources } = await runGroundedSearch(year, make, model);

    if (!answerText.trim()) {
      return [];
    }

    const extractedRaw = await analyzeGroundedSearch({
      answerText,
      groundedSources,
      carIdentity,
    });

    const validBadges = [];
    for (const rawBadge of extractedRaw) {
      const registryEntry = BADGE_REGISTRY[rawBadge.badge_id];
      if (!registryEntry || rawBadge.confidence !== "HIGH") continue;

      validBadges.push({
        ...registryEntry,
        retrieval_method: "GROUNDING",
        evidence: rawBadge.evidence_snippet,
        source_url: rawBadge.source_url || null,
        source_title: rawBadge.source_title || null,
      });
    }

    return validBadges;
  } catch (error) {
    console.warn("   ⚠️ Gemini Search Grounding failed:", error.message);
    return [];
  }
}

module.exports = { collectSearchBadges };
