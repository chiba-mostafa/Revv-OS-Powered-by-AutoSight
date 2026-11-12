const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");
const { cleanNum, cleanInt, normalizeDrivetrain } = require("./normalizer");
const { collectAllBadges } = require("../badges/badgeOrchestrator");
const { CarContextSchema } = require("./schemas");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET ||
  process.env.SUPABASE_KEY;

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is required. Check your .env file.");
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_KEY (service role) is required. Check your .env file.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Extract the primary dealer inventory photo URL from the cars table row.
 * The `photos` column is a JSONB array of public Supabase Storage URLs.
 * Returns the first photo URL or null.
 */
function extractDealerPhoto(dbCar) {
  if (!dbCar) return null;
  const photos = dbCar.photos;
  if (Array.isArray(photos) && photos.length > 0 && typeof photos[0] === "string") {
    return photos[0];
  }
  return null;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function joinNonEmpty(parts, separator = " ") {
  return parts
    .map((part) => {
      if (part === null || part === undefined) return "";
      return String(part).trim();
    })
    .filter(Boolean)
    .join(separator);
}

function buildImagePromptColor(color) {
  const safeColor = cleanText(color);
  return safeColor
    ? `${safeColor}, glossy finish`
    : "neutral metallic paint, glossy finish";
}

function buildBodyShapePrompt(raw) {
  return (
    joinNonEmpty([raw.year, raw.make, raw.model, raw.bodyType]) ||
    "modern passenger vehicle"
  );
}

function buildInteriorPrompt(raw) {
  return raw.make
    ? `${raw.make} modern cockpit, premium interior`
    : "modern cockpit, premium interior";
}

function extractAssistSystems(raw) {
  const systems = new Set();
  const searchText = JSON.stringify(raw || {}).toLowerCase();

  const keywordMap = [
    ["ABS", ["anti-lock brake", '"abs"', " abs "]],
    ["Traction Control", ["traction control", "stability control", "electronic stability", "esc", "esp"]],
    ["Blind Spot Monitoring", ["blind spot", "blind-spot"]],
    ["Lane Keep Assist", ["lane keep", "lane assist", "lane departure"]],
    ["Adaptive Cruise Control", ["adaptive cruise", "radar cruise"]],
    ["Rear Cross Traffic Alert", ["rear cross traffic"]],
    ["Parking Sensors", ["parking sensor", "park assist", "parking assist"]],
    ["Backup Camera", ["backup camera", "rear camera", "reverse camera", "rearview camera"]],
    ["Automatic Emergency Braking", ["automatic emergency braking", "autonomous emergency braking", "aeb", "forward collision"]],
  ];

  for (const [label, keywords] of keywordMap) {
    if (keywords.some((keyword) => searchText.includes(keyword))) {
      systems.add(label);
    }
  }

  return Array.from(systems);
}

function extractAirbagCount(raw) {
  const directCount = cleanInt(
    raw.airbags ||
    raw.airbagCount ||
    raw.numberOfAirbags ||
    raw.srsAirbags ||
    raw.airBagCount,
  );

  if (directCount !== null) {
    return directCount;
  }

  const searchText = JSON.stringify(raw || {}).toLowerCase();
  const match = searchText.match(/(\d+)\s*airbag/);
  return match ? cleanInt(match[1]) : null;
}

function extractSafetyData(raw) {
  return {
    rating_text:
      raw.safetyAssessment ||
      raw.safetyRating ||
      raw.crashRating ||
      raw.ncapRating ||
      null,
    airbags: extractAirbagCount(raw),
    assist_systems: extractAssistSystems(raw),
  };
}

async function buildCarContext(requestParams) {
  const logModel =
    requestParams.model || requestParams.identity?.model || "Unknown Model";
  const logVin = requestParams.vin || "UNKNOWN_VIN";

  console.log(`🕵️ Ingestion Started | Model: ${logModel} | VIN: ${logVin}`);

  let dbCar = null;
  let apiData = {};
  let dealerData = null;

  try {
    if (requestParams.car_id) {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("id", requestParams.car_id)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Car not found in database");

      dbCar = data;
      apiData = data.specs_raw || {};
      console.log(
        `✅ Retrieved from DB: ${dbCar.year} ${dbCar.make} ${dbCar.model}`,
      );

      // ── Fetch uploaded document chunks (RAG) from car_knowledge_base ──
      try {
        const { data: docRows, error: docError } = await supabase
          .from("car_knowledge_base")
          .select("content")
          .eq("car_id", requestParams.car_id)
          .in("content_type", ["text", "table"]);

        if (docError) {
          console.warn("⚠️ Failed to fetch document chunks:", docError.message);
        } else if (docRows && docRows.length > 0) {
          const joined = docRows
            .map((row) => row.content)
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 10000);
          dbCar._document_context = joined;
          console.log(
            `📄 Loaded ${docRows.length} document chunks (${joined.length} chars) from car_knowledge_base`,
          );
          console.log("");
        } else {
          console.log("📄 No document chunks found in car_knowledge_base\n");
        }
      } catch (docErr) {
        console.warn("⚠️ Document chunk fetch error:", docErr.message);
      }

      if (dbCar.dealer_id) {
        try {
          const { data: dealerRow, error: dealerError } = await supabase
            .from("dealers")
            .select("id, logo_url, dealership_name")
            .eq("id", dbCar.dealer_id)
            .single();

          if (dealerError) {
            console.warn("⚠️ Failed to fetch dealer branding:", dealerError.message);
          } else {
            dealerData = dealerRow;
          }
        } catch (dealerErr) {
          console.warn("⚠️ Dealer branding fetch error:", dealerErr.message);
        }
      }
    } else {
      console.warn("⚠️ No Car ID provided. Using manual input params.");
      apiData = {};
    }
  } catch (error) {
    console.error("❌ DB Fetch Error:", error.message);
  }

  const raw = {
    make: dbCar?.make || requestParams.make || requestParams.identity?.make,
    model: dbCar?.model || requestParams.model || requestParams.identity?.model,
    year: dbCar?.year || requestParams.year || requestParams.identity?.year,
    trim: dbCar?.trim || apiData.trim || requestParams.trim,
    vin: dbCar?.vin || requestParams.vin,

    ...apiData,

    color: dbCar?.color || requestParams.color,
    mileage: dbCar?.mileage || requestParams.mileage,
    price: dbCar?.price || requestParams.price,
  };

  const hp = cleanInt(raw.engineHp || raw.maxPowerKw);
  const torque = cleanInt(raw.maximumTorqueNM);
  const zeroSixty = cleanNum(raw.acceleration0To100KmPerHS);

  const fuel = cleanNum(
    raw.mixedFuelConsumptionPer100KmL || raw.cityFuelPer100KmL,
  );

  const range = cleanInt(raw.electricRangeKm || raw.rangeKm);
  const seats = cleanInt(raw.numberOfSeats);
  const trunk = cleanInt(raw.maxTrunkCapacityL || raw.cargoVolumeM3);
  const transmission =
    raw.transmission || raw.transmissionStyle || raw.numberOfGears;
  const mileage = cleanNum(raw.mileage);
  const safetyData = extractSafetyData(raw);

  const isElectric =
    cleanInt(raw.electricRangeKm) > 0 ||
    raw.fuelType === "Electric" ||
    raw.engineType === "Electric";

  const isSport = (zeroSixty !== null && zeroSixty < 6.0) || hp > 280;
  const isFamily = seats >= 5 && trunk > 400;
  const isEco = (fuel !== null && fuel < 6.0) || isElectric;

  const tempContext = {
    identity: {
      make: raw.make,
      model: raw.model,
      year: cleanInt(raw.year),
      trim: raw.trim,
      series: raw.series,
    },
    normalized_specs: {
      efficiency: {
        is_electric: isElectric,
        emission_standard: raw.emissionStandards,
        fuel_combined_l_100km: fuel,
      },
      performance: {
        hp: hp,
        zero_to_sixty_sec: zeroSixty,
      },
    },
    raw_api_dump: raw,
    request_params: {
      dealer_color_input: raw.color,
      dealer_mileage_input: raw.mileage,
    },
  };

  const badges = await collectAllBadges(tempContext);

  const context = {
    context_id: `ctx_${uuidv4()}`,
    car_id: dbCar?.id || null,
    dealer_id: dbCar?.dealer_id || null,
    created_at: new Date().toISOString(),

    request_params: {
      template_style: requestParams.template || "Cinematic",
      dealer_color_input: raw.color,
      dealer_mileage_input: raw.mileage,
    },

    identity: {
      vin: raw.vin,
      make: raw.make,
      model: raw.model,
      trim: raw.trim,
      year: cleanInt(raw.year),
      body_type: raw.bodyType || "Sedan",
      generation: raw.generation,
      series: raw.series,
    },

    visual_directives: {
      image_prompt_color: buildImagePromptColor(raw.color),
      body_shape_prompt: buildBodyShapePrompt(raw),
      interior_prompt: buildInteriorPrompt(raw),
    },

    normalized_specs: {
      performance: {
        hp: hp,
        torque_nm: torque || null,
        zero_to_sixty_sec: zeroSixty,
        top_speed_kmh: cleanInt(raw.maxSpeedKmPerH),
        drivetrain: normalizeDrivetrain(raw.driveWheels || raw.driveType),
        transmission: transmission,
        engine_cylinders: cleanInt(
          raw.numberOfCylinders || raw.engineNumberOfCylinders,
        ),
      },
      efficiency: {
        fuel_combined_l_100km: fuel,
        tank_capacity_l: cleanInt(raw.fuelTankCapacityL),
        range_km: cleanInt(raw.rangeKm),
        is_electric: isElectric,
        emission_standard: raw.emissionStandards || raw.fuelGrade,
      },
      dimensions: {
        trunk_capacity_l: trunk || null,
        seats: seats,
        length_mm: cleanInt(raw.lengthMm),
        weight_kg: cleanInt(raw.curbWeightKg),
      },
      safety: {
        rating_text: safetyData.rating_text,
        airbags: safetyData.airbags,
        assist_systems: safetyData.assist_systems,
      },
    },

    derived_intelligence: {
      vehicle_state: {
        is_new: mileage !== null ? mileage < 200 : false,
        is_low_mileage: mileage !== null ? mileage < 30000 : false,
        mileage_category:
          mileage === null ? "Unknown" : mileage < 30000 ? "Low" : "Average",
      },
      classification: {
        is_sport_car: isSport || false,
        is_family_car: isFamily || false,
        is_eco_car: isEco || false,
      },
      badges_to_suggest: badges.map((b) => b.id),
    },

    certifications: badges,
    dealer: dealerData || null,
    document_context: dbCar?._document_context || "",
    dealer_photo_url: extractDealerPhoto(dbCar),
    raw_api_dump: apiData,
  };

  try {
    const validated = CarContextSchema.parse(context);
    console.log("✅ Context Built Successfully");
    return validated;
  } catch (err) {
    console.error("❌ Schema Validation Failed:");
    if (err.errors) {
      err.errors.forEach((e) =>
        console.error(
          `   -> Path: [${e.path.join(" > ")}] | Error: ${e.message}`,
        ),
      );
    } else {
      console.error(err);
    }
    throw new Error("Ingestion Agent produced invalid data");
  }
}

module.exports = { buildCarContext };
