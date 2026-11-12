const { z } = require("zod");

const AlignmentEnum = z.enum([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

const CompositionEnum = z.enum([
  "split-image-left",
  "split-image-right",
  "full-bleed",
  "overlay-bottom",
  "centered-focus",
]);

const MotionSchema = z
  .object({
    image: z.enum([
      "slow-zoom-in",
      "slow-zoom-out",
      "subtle-pan-right",
      "static",
    ]),
    content: z.enum(["fade-up", "slide-in-left", "slide-in-right"]),
  })
  .passthrough();

const LayoutSchema = z
  .object({
    composition: CompositionEnum.optional(),
    content_alignment: AlignmentEnum.optional(),
    card_position: z.enum(["left", "right"]).optional(),
    motion: MotionSchema.optional(),
  })
  .passthrough();

const KeyStatSchema = z.object({
  value: z.string(),
  label: z.string(),
  unit: z.string().optional(),
});

const BadgeSchema = z.object({}).catchall(z.any());

const HoverContentSchema = z
  .object({
    title: z.string(),
    body: z.string(),
  })
  .passthrough();

const HotspotSchema = z
  .object({
    id: z.string().optional(),
    label: z.string(),
    icon: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    hover_content: HoverContentSchema.optional(),
  })
  .passthrough();

const VisualDirectionSchema = z
  .object({
    setting: z.string(),
    lighting: z.string(),
    camera_angle: z.string(),
    focus_point: z.string(),
  })
  .passthrough();

const SlideContentSchema = z
  .object({
    headline: z.string(),
    paragraph: z.string(),
    key_stats: z.array(KeyStatSchema).default([]),
    badges: z.array(BadgeSchema).default([]),
    alignment: z.enum(["left", "right"]).optional(),
    voiceover_text: z.string().optional(),
    theme_tag: z.string().optional(),
  })
  .passthrough();

const IntroContentSchema = z
  .object({
    title: z.string(),
    subtitle: z.string(),
    start_button_label: z.string().optional(),
  })
  .passthrough();

const OutroButtonSchema = z
  .object({
    label: z.string(),
    action: z.string(),
    style: z.string(),
  })
  .passthrough();

const OutroContentSchema = z
  .object({
    headline: z.string(),
    subheadline: z.string(),
    cta_buttons: z.array(OutroButtonSchema).optional(),
  })
  .passthrough();

const TechConfigSchema = z
  .object({
    mode: z.enum(["PERFORMANCE", "SAFETY", "UTILITY"]),
    drivetrain: z.string().optional(),
    engine_hp: z.number().nullable().optional(),
    torque_nm: z.number().nullable().optional(),
    zero_to_sixty_sec: z.number().nullable().optional(),
    airbag_count: z.number().optional(),
    has_front_sensors: z.boolean().optional(),
    has_rear_sensors: z.boolean().optional(),
    assist_systems: z.array(z.string()).optional(),
    trunk_capacity_liters: z.number().nullable().optional(),
    seat_count: z.number().optional(),
    dimensions: z
      .object({
        length_mm: z.number().nullable().optional(),
        width_mm: z.number().nullable().optional(),
        height_mm: z.number().nullable().optional(),
        wheelbase_mm: z.number().nullable().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const SceneSchema = z
  .object({
    scene_id: z.string().optional(),
    type: z.literal("slide_view").default("slide_view"),
    order: z.number(),
    theme_tag: z.string(),
    duration_seconds: z.number(),
    layout: LayoutSchema,
    slide_content: SlideContentSchema,
    visual_direction: VisualDirectionSchema,
    voiceover_text: z.string(),
    audio_url: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
    hotspots: z.array(HotspotSchema).default([]),
  })
  .passthrough();

const CopilotActionSchema = z
  .object({
    type: z.string(),
    sceneIndex: z.number().optional(),
    afterIndex: z.number().optional(),
    updates: z.object({}).catchall(z.any()).optional(),
    scene: z.object({}).catchall(z.any()).optional(),
    imagePrompt: z.string().optional(),
    voice: z.string().optional(),
    sceneUpdates: z
      .array(
        z
          .object({
            sceneIndex: z.number(),
            updates: z.object({}).catchall(z.any()).optional(),
            imagePrompt: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const CopilotResponseSchema = z.object({
  message: z.string(),
  actions: z.array(CopilotActionSchema).default([]),
});

module.exports = {
  CopilotResponseSchema,
  SceneSchema,
  SlideContentSchema,
  IntroContentSchema,
  OutroContentSchema,
  LayoutSchema,
  TechConfigSchema,
};
