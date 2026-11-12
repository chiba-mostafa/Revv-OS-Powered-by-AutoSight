import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, User, Check, Loader2 } from "lucide-react";
import { useChatbotStore } from "../../../store/useChatbotStore";
import { useStoryStore } from "../../../store/useStoryStore";
import ChatbotBackend from "../services/ChatbotService";
import { API_BASE } from "../../../config/api";
// ---------------------------------------------------------------------------
// Date / Time helpers
// ---------------------------------------------------------------------------
function generateDateOptions() {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const day = d.getDay();
    if (day === 0) continue; // skip Sunday
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Tomorrow"
          : d.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
    dates.push({ value: `${yyyy}-${mm}-${dd}`, label });
  }
  return dates;
}

const TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
];

function formatTime12(t) {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function findClosestDate(target, dates) {
  if (!target || dates.length === 0) return null;
  if (dates.find((d) => d.value === target)) return target;

  const targetDate = new Date(`${target}T00:00:00`);
  if (Number.isNaN(targetDate.getTime())) return null;

  let best = dates[0].value;
  let bestDiff = Infinity;

  for (const option of dates) {
    const optionDate = new Date(`${option.value}T00:00:00`);
    const diff = Math.abs(optionDate.getTime() - targetDate.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      best = option.value;
    }
  }

  return best;
}

function findClosestTime(target) {
  if (!target) return null;
  const [th, tm] = target.split(":");
  const targetMin = parseInt(th) * 60 + parseInt(tm);
  let best = TIME_SLOTS[0];
  let bestDiff = Infinity;
  for (const slot of TIME_SLOTS) {
    const [sh, sm] = slot.split(":");
    const slotMin = parseInt(sh) * 60 + parseInt(sm);
    const diff = Math.abs(slotMin - targetMin);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = slot;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// BookingApplet Component
// ---------------------------------------------------------------------------
export const BookingApplet = ({ message }) => {
  const { prefilled_data } = message;
  const { replaceMessageWithTicket } = useChatbotStore();
  const { storyData } = useStoryStore();

  const dateOptions = useRef(generateDateOptions()).current;
  const dateScrollRef = useRef(null);
  const timeScrollRef = useRef(null);

  // Resolve car and dealer IDs from storyData
  const carData = storyData?.car_data || storyData?.car || {};
  const resolvedCarId = storyData?.car_id || carData.id || null;
  // dealer_id: present in newly-generated stories; fall back to fetching via server for old ones
  const [dealerId, setDealerId] = useState(carData.dealer_id || null);

  useEffect(() => {
    if (dealerId || !resolvedCarId) return;
    // Fetch dealer_id for stories generated before this fix
    fetch(`${API_BASE}/api/leads/dealer?car_id=${resolvedCarId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.dealer_id) setDealerId(d.dealer_id);
      })
      .catch(() => {}); // silently ignore — will show validation error at submit
  }, [resolvedCarId, dealerId]);

  // Form state
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Ghost-typing animation state
  const [ghostPhase, setGhostPhase] = useState(0); // 0=idle, 1=date, 2=time, 3=name, 4=phone, 5=done
  const [typingName, setTypingName] = useState("");
  const [typingPhone, setTypingPhone] = useState("");

  const isComplete =
    selectedDate && selectedTime && name.trim() && phone.trim();

  // ── Ghost-typing effect ──
  useEffect(() => {
    if (!prefilled_data) {
      setSelectedDate(null);
      setSelectedTime(null);
      setName("");
      setPhone("");
      setTypingName("");
      setTypingPhone("");
      setGhostPhase(5);
      return;
    }

    const resolvedDate = prefilled_data.date
      ? findClosestDate(prefilled_data.date, dateOptions)
      : null;
    const resolvedTime = prefilled_data.time
      ? findClosestTime(prefilled_data.time)
      : null;
    const prefillName = prefilled_data.name || "";
    const prefillPhone = prefilled_data.phone || "";

    setSelectedDate(resolvedDate);
    setSelectedTime(resolvedTime);
    setName(prefillName);
    setPhone(prefillPhone);

    setGhostPhase(0);
    setTypingName("");
    setTypingPhone("");

    const timers = [];

    // Phase 1: date
    if (resolvedDate) {
      timers.push(
        setTimeout(() => {
          setGhostPhase(1);
          setSelectedDate(resolvedDate);
        }, 600),
      );
    }

    // Phase 2: time
    if (resolvedTime) {
      timers.push(
        setTimeout(
          () => {
            setGhostPhase(2);
            setSelectedTime(resolvedTime);
          },
          resolvedDate ? 1200 : 600,
        ),
      );
    }

    // Phase 3: name (ghost type char by char)
    if (prefillName) {
      const nameStart =
        (resolvedDate ? 1200 : 0) + (resolvedTime ? 600 : 0) + 400;
      for (let i = 0; i <= prefillName.length; i++) {
        timers.push(
          setTimeout(
            () => {
              setTypingName(prefillName.slice(0, i));
              if (i === prefillName.length) {
                setName(prefillName);
                setGhostPhase(3);
              }
            },
            nameStart + i * 45,
          ),
        );
      }
    }

    // Phase 4: phone
    if (prefillPhone) {
      const phoneStart =
        (resolvedDate ? 1200 : 0) +
        (resolvedTime ? 600 : 0) +
        (prefillName ? prefillName.length * 45 + 600 : 400);
      for (let i = 0; i <= prefillPhone.length; i++) {
        timers.push(
          setTimeout(
            () => {
              setTypingPhone(prefillPhone.slice(0, i));
              if (i === prefillPhone.length) {
                setPhone(prefillPhone);
                setGhostPhase(4);
              }
            },
            phoneStart + i * 45,
          ),
        );
      }
    }

    // Phase 5: done
    const finalDelay =
      (resolvedDate ? 1200 : 0) +
      (resolvedTime ? 600 : 0) +
      (prefillName ? prefillName.length * 45 + 600 : 0) +
      (prefillPhone ? prefillPhone.length * 45 + 400 : 0) +
      300;
    timers.push(setTimeout(() => setGhostPhase(5), finalDelay));

    return () => timers.forEach(clearTimeout);
  }, [prefilled_data, dateOptions]);

  // ── Scroll pills into view when ghost-selected ──
  useEffect(() => {
    if (selectedDate && dateScrollRef.current) {
      const pill = dateScrollRef.current.querySelector(
        `[data-date="${selectedDate}"]`,
      );
      pill?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTime && timeScrollRef.current) {
      const pill = timeScrollRef.current.querySelector(
        `[data-time="${selectedTime}"]`,
      );
      pill?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [selectedTime]);

  // ── Submit handler ──
  const handleConfirm = async () => {
    if (!isComplete || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await ChatbotBackend.bookTestDrive({
        car_id: resolvedCarId,
        dealer_id: dealerId,
        customer_name: name.trim(),
        phone: phone.trim(),
        appointment_date: selectedDate,
        appointment_time: selectedTime,
      });

      replaceMessageWithTicket(message.id, {
        booking_id: result.booking.id,
        car_make: carData.make,
        car_model: carData.model,
        car_year: carData.year,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        customer_name: name.trim(),
        dealer_id: dealerId,
      });
    } catch (err) {
      setError(err.message || "Booking failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  // ===========================================================================
  // Render
  // ===========================================================================
  const steps = [
    { done: !!selectedDate },
    { done: !!selectedTime },
    { done: !!(name.trim() && phone.trim()) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="w-full max-w-[320px]"
    >
      {/* Card */}
      <div className="rounded-3xl bg-[#0f0f0f]/95 backdrop-blur-3xl border border-white/9 overflow-hidden shadow-2xl shadow-black/70">

        {/* Top shimmer line */}
        <div className="h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4">
          {carData.make && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="flex items-center gap-1.5 mb-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80 shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                {[carData.year, carData.make, carData.model].filter(Boolean).join(" ")}
              </span>
            </motion.div>
          )}
          <h3 className="text-[15px] font-semibold text-white/90 tracking-tight leading-tight">
            Schedule a Test Drive
          </h3>
          <p className="text-[12px] text-white/38 mt-1 leading-snug">
            {message.text || "Pick a date and time that works for you."}
          </p>

          {/* Step progress pills */}
          <div className="flex items-center gap-1.5 mt-3.5">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                animate={{
                  width: step.done ? 22 : 6,
                  backgroundColor: step.done
                    ? "rgba(255,255,255,0.85)"
                    : "rgba(255,255,255,0.16)",
                }}
                transition={{ type: "spring", stiffness: 480, damping: 36 }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>
        </div>

        <div className="h-px bg-white/6" />

        {/* ── Date section (always visible) ── */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-1.5 mb-3">
            <Calendar size={11} className="text-white/35" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Date
            </span>
            <AnimatePresence>
              {selectedDate && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 22 }}
                  className="ml-auto w-4 h-4 rounded-full bg-white/12 flex items-center justify-center"
                >
                  <Check size={9} className="text-white/70" strokeWidth={2.5} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Pill row with gradient-fade edges */}
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-5 bg-linear-to-r from-[#0f0f0f] to-transparent z-10 pointer-events-none" />
            <div
              ref={dateScrollRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5 px-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {dateOptions.map((d) => (
                <motion.button
                  key={d.value}
                  data-date={d.value}
                  onClick={() => setSelectedDate(d.value)}
                  whileTap={{ scale: 0.9 }}
                  className="relative shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-medium"
                >
                  {selectedDate === d.value && (
                    <motion.span
                      layoutId="date-sel"
                      className="absolute inset-0 rounded-full bg-white"
                      transition={{ type: "spring", stiffness: 500, damping: 36 }}
                    />
                  )}
                  <span
                    className={`relative z-10 whitespace-nowrap transition-colors duration-100 ${
                      selectedDate === d.value ? "text-black" : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    {d.label}
                  </span>
                </motion.button>
              ))}
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-5 bg-linear-to-l from-[#0f0f0f] to-transparent z-10 pointer-events-none" />
          </div>
        </div>

        {/* ── Time section (reveals after date) ── */}
        <AnimatePresence>
          {selectedDate && (
            <motion.div
              key="time"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
            >
              <div className="h-px bg-white/6" />
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <Clock size={11} className="text-white/35" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                    Time
                  </span>
                  <AnimatePresence>
                    {selectedTime && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 600, damping: 22 }}
                        className="ml-auto w-4 h-4 rounded-full bg-white/12 flex items-center justify-center"
                      >
                        <Check size={9} className="text-white/70" strokeWidth={2.5} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-5 bg-linear-to-r from-[#0f0f0f] to-transparent z-10 pointer-events-none" />
                  <div
                    ref={timeScrollRef}
                    className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5 px-1"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {TIME_SLOTS.map((t) => (
                      <motion.button
                        key={t}
                        data-time={t}
                        onClick={() => setSelectedTime(t)}
                        whileTap={{ scale: 0.9 }}
                        className="relative shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-medium"
                      >
                        {selectedTime === t && (
                          <motion.span
                            layoutId="time-sel"
                            className="absolute inset-0 rounded-full bg-white"
                            transition={{ type: "spring", stiffness: 500, damping: 36 }}
                          />
                        )}
                        <span
                          className={`relative z-10 whitespace-nowrap transition-colors duration-100 ${
                            selectedTime === t ? "text-black" : "text-white/45 hover:text-white/75"
                          }`}
                        >
                          {formatTime12(t)}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-5 bg-linear-to-l from-[#0f0f0f] to-transparent z-10 pointer-events-none" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Contact section (reveals after time) ── */}
        <AnimatePresence>
          {selectedDate && selectedTime && (
            <motion.div
              key="contact"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 420, damping: 36, delay: 0.06 }}
            >
              <div className="h-px bg-white/6" />
              <div className="px-5 pt-4 pb-3 space-y-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <User size={11} className="text-white/35" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                    Your Details
                  </span>
                </div>
                {/* Name */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={ghostPhase < 5 && typingName ? typingName : name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/8 rounded-2xl text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 focus:bg-white/7 transition-all duration-200"
                  />
                  <AnimatePresence>
                    {name.trim().length > 1 && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 600, damping: 22 }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/12 flex items-center justify-center pointer-events-none"
                      >
                        <Check size={9} className="text-white/70" strokeWidth={2.5} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {/* Phone */}
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={ghostPhase < 5 && typingPhone ? typingPhone : phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/8 rounded-2xl text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 focus:bg-white/7 transition-all duration-200"
                  />
                  <AnimatePresence>
                    {phone.trim().length > 5 && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 600, damping: 22 }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/12 flex items-center justify-center pointer-events-none"
                      >
                        <Check size={9} className="text-white/70" strokeWidth={2.5} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Booking summary strip ── */}
        <AnimatePresence>
          {selectedDate && selectedTime && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: "spring", stiffness: 420, damping: 36, delay: 0.1 }}
              className="px-5 pt-1 pb-1"
            >
              <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-white/4 border border-white/7">
                <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                  <Calendar size={10} />
                  <span>{dateOptions.find((d) => d.value === selectedDate)?.label}</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                  <Clock size={10} />
                  <span>{formatTime12(selectedTime)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-5 pt-2 text-[11px] text-red-400/85"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* ── Confirm button ── */}
        <div className="px-5 pt-3 pb-5">
          <motion.button
            onClick={handleConfirm}
            disabled={!isComplete || isSubmitting}
            whileTap={isComplete && !isSubmitting ? { scale: 0.975 } : {}}
            className={`relative w-full py-3 rounded-2xl text-[13px] font-semibold tracking-tight overflow-hidden flex items-center justify-center gap-2 transition-colors duration-300 ${
              isComplete && !isSubmitting
                ? "bg-white text-black cursor-pointer"
                : "bg-white/[0.07] text-white/22 cursor-not-allowed"
            }`}
          >
            {/* Shimmer sweep when form is complete */}
            {isComplete && !isSubmitting && (
              <motion.span
                className="absolute inset-0 bg-linear-to-r from-transparent via-black/6 to-transparent pointer-events-none"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{
                  repeat: Infinity,
                  duration: 2.4,
                  ease: "linear",
                  repeatDelay: 1.8,
                }}
              />
            )}
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Booking...</span>
              </>
            ) : (
              "Confirm Booking"
            )}
          </motion.button>
        </div>

        {/* Bottom shimmer line */}
        <div className="h-px bg-linear-to-r from-transparent via-white/6 to-transparent" />
      </div>
    </motion.div>
  );
};

export default BookingApplet;
