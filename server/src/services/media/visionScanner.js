const { z } = require("zod");
const {
  buildInlineDataPart,
  generateStructuredData,
  selectTextModel,
} = require("../../config/aiConfig");

const BoundingBoxSchema = z.object({
  hotspot_id: z.string(),
  box_2d: z.array(z.number()).min(4).max(4),
});

const VisionResponseSchema = z.object({
  detections: z.array(BoundingBoxSchema),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toCenterPoint(box) {
  const [yMin, xMin, yMax, xMax] = box.map((value) => clamp(Number(value) || 0, 0, 1000));
  const x = Math.round(((xMin + xMax) / 2 / 1000) * 100);
  const y = Math.round(((yMin + yMax) / 2 / 1000) * 100);

  return {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
    box_2d: [yMin, xMin, yMax, xMax],
  };
}

function buildPrompt(hotspots) {
  const hotspotLines = hotspots
    .map((hotspot) => `- hotspot_id: ${hotspot.id}; target: ${hotspot.label}`)
    .join("\n");

  return `You are an automotive image localization system.

Find the visible target for each hotspot in this vehicle image.

Return only detections you are confident are visible.
For each detection, return box_2d as [y_min, x_min, y_max, x_max] normalized to 0..1000.
Do not guess for hidden or unclear parts.

Targets:
${hotspotLines}`;
}

async function scanHotspots(imageUrl, hotspots) {
  if (!hotspots || hotspots.length === 0) return {};

  try {
    console.log(
      `   👁️  Vision Scanner (Gemini Spatial): Looking for ${hotspots.length} items in image...`,
    );

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }

    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const result = await generateStructuredData({
      model: selectTextModel({ prefer: "pro" }),
      schema: VisionResponseSchema,
      contents: [
        { text: buildPrompt(hotspots) },
        buildInlineDataPart(imageBuffer, contentType),
      ],
      temperature: 0,
      topP: 0.8,
      maxOutputTokens: 2048,
    });

    const validatedMap = {};
    for (const detection of result.detections || []) {
      const hotspotId = detection.hotspot_id;
      if (!hotspotId || !Array.isArray(detection.box_2d) || detection.box_2d.length !== 4) {
        continue;
      }

      validatedMap[hotspotId] = toCenterPoint(detection.box_2d);
    }

    const foundCount = Object.keys(validatedMap).length;
    if (foundCount === hotspots.length) {
      console.log("   👁️  Vision Scanner: All targets acquired.");
    } else {
      console.log(`   👁️  Vision Scanner: Found ${foundCount}/${hotspots.length} targets.`);
    }

    return validatedMap;
  } catch (error) {
    console.warn(
      "   ⚠️ Vision Scan Failed (hotspots will be omitted):",
      error.message,
    );
    return {};
  }
}

module.exports = { scanHotspots };
