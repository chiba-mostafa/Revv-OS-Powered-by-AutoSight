const { buildImagePrompt } = require("./promptBuilder");
const { generateExperienceImage } = require("./googleImageService");
const { generateIntroVideoFromImage } = require("./googleVideoService");
const { scanHotspots } = require("./visionScanner");
const { analyzeCarPhoto } = require("./visionEnricher");

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

async function visualizeStory(
  carContext,
  storyboard,
  templateStyle = "Cinematic",
) {
  const techViewCount = storyboard.scenes.filter(
    (s) => s.scene_type === "tech_view",
  ).length;
  const imageSceneCount = storyboard.scenes.length - techViewCount;
  const sceneConcurrency = 1;

  console.log(
    `🎨 Visualizer Agent: Processing ${storyboard.scenes.length} scenes (${imageSceneCount} images, ${techViewCount} 3D tech views) [Engine: google, Concurrency: ${sceneConcurrency}]...`,
  );

  try {
    // ── Vision-Enriched Prompting: analyze dealer photo once ──
    // If the dealer uploaded inventory photos, use Nova Lite vision to
    // extract physical details (rims, grille, trim, body shape) and
    // inject them into every image prompt for visual accuracy.
    let visionDescription = null;
    const dealerPhotoUrl = carContext.dealer_photo_url;
    if (dealerPhotoUrl) {
      visionDescription = await analyzeCarPhoto(dealerPhotoUrl);
    }

    const fullyVisualizedScenes = await mapWithConcurrency(
      storyboard.scenes,
      sceneConcurrency,
      async (scene) => {
        return processSingleScene(
          scene,
          carContext,
          templateStyle,
          visionDescription,
        );
      },
    );

    console.log("🎨 Visualizer Agent: Done.");

    return { ...storyboard, scenes: fullyVisualizedScenes };
  } catch (error) {
    console.error("❌ Visualizer Agent Failed:", error);
    throw new Error("Failed to generate visuals.");
  }
}

async function processSingleScene(
  scene,
  carContext,
  templateStyle = "Cinematic",
  visionDescription = null,
) {
  try {
    const isMinimalTech =
      (templateStyle || "").toLowerCase().replace(/[\s-]/g, "") ===
      "minimaltech";

    if (scene.scene_type === "tech_view") {
      console.log(
        `   🔷 Scene ${scene.scene_id}: tech_view (${scene.theme_tag}) - Skipping image (3D mode)`,
      );

      return {
        ...scene,
        image_url: null,
        hotspots: [],
      };
    }

    const prompt = buildImagePrompt(
      scene,
      carContext,
      templateStyle,
      visionDescription,
    );

    const seed = Math.floor(Math.random() * 100000) + (scene.order || 1);

    const imageUrl = await generateExperienceImage(prompt, seed);

    let updatedHotspots = scene.hotspots || [];

    if (updatedHotspots.length > 0 && imageUrl) {
      const coordsMap = await scanHotspots(imageUrl, updatedHotspots);

      updatedHotspots = updatedHotspots
        .filter((spot) => {
          const discovered = coordsMap[spot.id];
          if (!discovered) {
            console.log(
              `   🗑️  Removing hotspot "${spot.label}" (not found in image)`,
            );
            return false;
          }
          return true;
        })
        .map((spot) => {
          const discovered = coordsMap[spot.id];
          return {
            ...spot,
            x: discovered.x,
            y: discovered.y,
            box_2d: discovered.box_2d || spot.box_2d,
          };
        });
    }

    const updatedScene = {
      ...scene,
      image_url: imageUrl,
      hotspots: updatedHotspots,
    };

    if (scene.scene_type === "intro_view" && updatedScene.intro_content) {
      updatedScene.intro_content.background_image = imageUrl;

      if (!isMinimalTech) {
        try {
          const videoUrl = await generateIntroVideoFromImage({
            imageUrl,
            seed,
            durationSeconds: 6,
            aspectRatio: "16:9",
          });

          updatedScene.intro_content.background_video = videoUrl;
        } catch (videoError) {
          console.warn(
            `   ⚠️ Intro video generation failed for ${scene.scene_id}: ${videoError.message}`,
          );
        }
      }
    } else if (
      scene.scene_type === "outro_view" &&
      updatedScene.outro_content
    ) {
      updatedScene.outro_content.image_url = imageUrl;
    }

    return updatedScene;
  } catch (err) {
    console.error(
      `⚠️ Failed to visualize scene ${scene.scene_id}:`,
      err.message,
    );
    return scene;
  }
}

module.exports = { visualizeStory };
