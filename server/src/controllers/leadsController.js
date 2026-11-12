/**
 * Leads Controller — Test Drive Booking
 *
 * POST /api/leads/book — Insert a test drive booking into the leads table.
 */

const { supabase } = require("../config/supabase");

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const PHONE_RE = /^[+\d][\d\s()-]{6,20}$/;

// ---------------------------------------------------------------------------
// POST /api/leads/book
// ---------------------------------------------------------------------------
async function bookTestDrive(req, res) {
  const {
    car_id,
    dealer_id,
    customer_name,
    phone,
    appointment_date,
    appointment_time,
  } = req.body;

  if (!car_id || !dealer_id || !customer_name || !phone) {
    return res.status(400).json({
      success: false,
      error: "car_id, dealer_id, customer_name, and phone are required.",
    });
  }

  if (!appointment_date || !DATE_RE.test(appointment_date)) {
    return res.status(400).json({
      success: false,
      error: "appointment_date is required in YYYY-MM-DD format.",
    });
  }

  if (!appointment_time || !TIME_RE.test(appointment_time)) {
    return res.status(400).json({
      success: false,
      error: "appointment_time is required in HH:MM format.",
    });
  }

  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({
      success: false,
      error: "Invalid phone number format.",
    });
  }

  try {
    const { data, error } = await supabase
      .from("leads")
      .insert({
        car_id,
        dealer_id,
        customer_name,
        phone,
        appointment_date,
        appointment_time,
        message: "Test drive booking via AutoSense chatbot",
        status: "new",
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("❌ [Leads] Insert failed:", error.message);
      return res.status(500).json({
        success: false,
        error: "Failed to save booking.",
        details: error.message,
      });
    }

    console.log(`✅ [Leads] Booking created: ${data.id}`);

    return res.status(201).json({
      success: true,
      booking: {
        id: data.id,
        car_id,
        dealer_id,
        customer_name,
        phone,
        appointment_date,
        appointment_time,
        created_at: data.created_at,
      },
    });
  } catch (err) {
    console.error("🔥 [Leads] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error.",
    });
  }
}

// ---------------------------------------------------------------------------
// GET /api/leads/dealer?car_id=<uuid>
// Returns the dealer_id for a car — used as a fallback by the booking widget
// for stories generated before dealer_id was stored in the story JSON.
// ---------------------------------------------------------------------------
async function getDealerByCarId(req, res) {
  const { car_id } = req.query;

  if (!car_id) {
    return res.status(400).json({ error: "car_id is required" });
  }

  const { data, error } = await supabase
    .from("cars")
    .select("dealer_id")
    .eq("id", car_id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Car not found" });
  }

  return res.json({ dealer_id: data.dealer_id });
}

module.exports = { bookTestDrive, getDealerByCarId };
