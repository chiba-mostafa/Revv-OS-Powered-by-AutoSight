import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, MapPin, Calendar, Clock, Car } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime12(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

// Pre-computed barcode bar dimensions (module-level, generated once)
const BARCODE_BARS = [
  { w: 2, h: 24 },
  { w: 3, h: 16 },
  { w: 2, h: 28 },
  { w: 3, h: 14 },
  { w: 2, h: 22 },
  { w: 3, h: 18 },
  { w: 2, h: 26 },
  { w: 3, h: 20 },
  { w: 2, h: 30 },
  { w: 3, h: 13 },
  { w: 2, h: 25 },
  { w: 3, h: 17 },
  { w: 2, h: 29 },
  { w: 3, h: 15 },
  { w: 2, h: 21 },
  { w: 3, h: 27 },
  { w: 2, h: 19 },
  { w: 3, h: 23 },
  { w: 2, h: 12 },
  { w: 3, h: 26 },
];

// ---------------------------------------------------------------------------
// DigitalPass Component — Apple Wallet-style confirmation card
// ---------------------------------------------------------------------------
export const DigitalPass = ({ message }) => {
  const { ticket_data } = message;

  if (!ticket_data) return null;

  const {
    car_make,
    car_model,
    car_year,
    appointment_date,
    appointment_time,
    customer_name,
    booking_id,
  } = ticket_data;

  const shortId = booking_id
    ? booking_id.slice(0, 8).toUpperCase()
    : "--------";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
      className="w-full max-w-[320px]"
    >
      <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/40 bg-gradient-to-br from-[#1a1a1a] via-[#222] to-[#1a1a1a] border border-white/[0.12]">
        {/* ── Top strip — success indicator ── */}
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-3 flex items-center gap-2.5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: 0.3,
            }}
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
          </motion.div>
          <div>
            <p className="text-[12px] font-semibold text-emerald-400 tracking-tight">
              Booking Confirmed
            </p>
            <p className="text-[10px] text-emerald-400/60">Ref: {shortId}</p>
          </div>
        </div>

        {/* ── Car + Customer ── */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Car size={13} className="text-white/40" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Vehicle
            </span>
          </div>
          <p className="text-[16px] font-bold text-white tracking-tight leading-tight">
            {car_year} {car_make} {car_model}
          </p>
          <p className="text-[11px] text-white/50 mt-1">{customer_name}</p>
        </div>

        {/* ── Date & Time ── */}
        <div className="px-5 pb-4 flex gap-6">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar size={11} className="text-white/40" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Date
              </span>
            </div>
            <p className="text-[13px] font-medium text-white/90">
              {formatDateLabel(appointment_date)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={11} className="text-white/40" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Time
              </span>
            </div>
            <p className="text-[13px] font-medium text-white/90">
              {formatTime12(appointment_time)}
            </p>
          </div>
        </div>

        {/* ── Divider — dashed line with notch circles ── */}
        <div className="relative px-4">
          <div className="border-t border-dashed border-white/[0.12]" />
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#1a1a1a]" />
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#1a1a1a]" />
        </div>

        {/* ── QR-style barcode + Get Directions ── */}
        <div className="px-5 pt-4 pb-5 flex items-end justify-between">
          {/* Fake barcode lines */}
          <div className="flex gap-0.5 items-end h-8">
            {BARCODE_BARS.map((bar, i) => (
              <div
                key={i}
                className="bg-white/20 rounded-sm"
                style={{ width: bar.w, height: bar.h }}
              />
            ))}
          </div>

          <button
            onClick={() => {
              window.open(
                `https://www.google.com/maps/search/car+dealership+near+me`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white text-[11px] font-medium transition-all"
          >
            <MapPin size={12} />
            Get Directions
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DigitalPass;
