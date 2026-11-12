/**
 * @param {object}      scene
 * @param {object}      carContext
 * @param {string}      templateStyle
 * @param {string|null} visionDescription  Vision-enriched physical description
 *                                         from the dealer inventory photo (optional).
 */
function buildImagePrompt(scene, carContext, templateStyle = "Cinematic", visionDescription = null) {
  const { identity, visual_directives } = carContext;
  const { visual_direction } = scene;

  const subjectParts = [
    identity?.year,
    identity?.make,
    identity?.model,
    visual_directives?.image_prompt_color,
    identity?.body_type,
  ]
    .map((part) => (part === null || part === undefined ? "" : String(part).trim()))
    .filter(Boolean);

  const subject = subjectParts.length > 0
    ? subjectParts.join(", ")
    : "modern passenger vehicle";

  // ── Vision enrichment: append real-world physical details ──
  // When a dealer photo was analyzed by the Vision Enricher, inject the
  // observed details (rim style, grille shape, trim accents, body shape)
  // so the image generator reproduces the actual car, not a generic one.
  const visionClause = visionDescription
    ? `, featuring ${visionDescription}`
    : "";

  const action = visual_direction?.camera_angle || "Cinematic Wide Shot";
  const focus = visual_direction?.focus_point || "The whole car";

  const environment = `${visual_direction?.setting || "Showroom"}, ${
    visual_direction?.lighting || "Studio Lighting"
  }`;

  const isMinimalTech =
    templateStyle === "Minimal Tech" || templateStyle === "minimal-tech";

  const style = isMinimalTech
    ? "pure white studio background, even softbox lighting, hyper-realistic product photography, sharp focus, minimal shadows, clean aesthetic, 8k"
    : "photorealistic, 8k, highly detailed, automotive photography, commercial car advertisement, dramatic shadows, volumetric lighting, anamorphic lens flare, ray tracing, sharp focus";

  const plateDirective =
    "If a license plate is visible, it must be completely blank and empty, with no letters, numbers, logos, branding, dealership marks, or region text";

  // ── Spatial composition: dynamic based on card_position ──
  // If the info card is on the left, push the car to the right (and vice versa).
  // Default to card on left / car on right for backward compatibility.
  const cardPosition = scene.layout?.card_position || "left";
  const carOnRight = cardPosition === "left";

  const interiorKeywords =
    /interior|dashboard|cabin|cockpit|steering|console|seat|inside/i;
  const hint = `${action} ${focus} ${visual_direction?.setting || ""}`;
  const isInterior = interiorKeywords.test(hint);

  let composition;
  if (isInterior) {
    composition = carOnRight
      ? "Shot from the driver-side window looking inward toward the passenger side, center console and passenger seat in focus, left foreground in deep shadow, negative space on the left of the frame"
      : "Shot from the passenger-side window looking inward toward the driver side, steering wheel and dashboard in focus, right foreground in deep shadow, negative space on the right of the frame";
  } else {
    composition = carOnRight
      ? "Right-aligned composition, car positioned in the right-third of the frame, asymmetrical framing, vast empty space on the left side of the image"
      : "Left-aligned composition, car positioned in the left-third of the frame, asymmetrical framing, vast empty space on the right side of the image";
  }

  const fullPrompt = `${action} of a ${subject}${visionClause}, focusing on ${focus}. ${composition}. ${environment}. ${style}. ${plateDirective}.`;

  return fullPrompt;
}

module.exports = { buildImagePrompt };
