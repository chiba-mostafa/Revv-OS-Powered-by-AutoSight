import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, ChevronDown, ChevronUp } from "lucide-react";
import BookingApplet from "./BookingApplet";
import DigitalPass from "./DigitalPass";

function VoiceSummaryCard({ message }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMessages = message.voiceMessages?.length > 0;

  return (
    <div className="w-full max-w-[90%] rounded-2xl border border-white/10 bg-zinc-900 overflow-hidden">
      <button
        onClick={() => hasMessages && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${hasMessages ? "hover:bg-white/5 cursor-pointer" : "cursor-default"}`}
      >
        <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Mic size={13} className="text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white/90 leading-tight">
            Voice chat ended
          </p>
          <p className="text-[11px] text-white/40 mt-0.5">
            {message.durationSecs}s conversation ·{" "}
            {hasMessages
              ? `${message.voiceMessages.length} messages`
              : "no messages captured"}
          </p>
        </div>
        {hasMessages &&
          (isExpanded ? (
            <ChevronUp size={14} className="text-white/40 flex-shrink-0" />
          ) : (
            <ChevronDown size={14} className="text-white/40 flex-shrink-0" />
          ))}
      </button>

      <AnimatePresence>
        {isExpanded && hasMessages && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-2 space-y-2 border-t border-white/5 max-h-52 overflow-y-auto scrollbar-hide">
              {message.voiceMessages.map((vm) => (
                <div
                  key={vm.id}
                  className={`flex ${vm.type === "bot" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`px-3 py-1.5 rounded-xl text-[11px] leading-relaxed max-w-[85%] ${
                      vm.type === "bot"
                        ? "bg-zinc-700 text-white/80 rounded-tl-sm"
                        : "bg-zinc-600 text-white/70 rounded-tr-sm"
                    }`}
                  >
                    {vm.text}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const ChatMessage = ({ message }) => {
  // ── Rich message routing ──
  if (message.type === "widget") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="flex w-full justify-start"
      >
        <BookingApplet message={message} />
      </motion.div>
    );
  }

  if (message.type === "ticket") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="flex w-full justify-start"
      >
        <DigitalPass message={message} />
      </motion.div>
    );
  }

  if (message.type === "voice_summary") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="flex w-full justify-start"
      >
        <VoiceSummaryCard message={message} />
      </motion.div>
    );
  }

  // ── Standard text message ──
  const isBot = message.type === "bot";
  const isVoiceUser = message.type === "user" && message.source === "voice";
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className={`flex w-full ${isBot ? "justify-start" : "justify-end"}`}
      >
        <div
          className={`flex max-w-[82%] ${isBot ? "flex-row" : "flex-row-reverse"} gap-2`}
        >
          {/* Message Bubble */}
          <div
            className={`
              px-4 py-2.5 text-[13px] leading-relaxed tracking-tight
              ${
                isBot
                  ? "bg-zinc-800 text-white/90 rounded-2xl rounded-tl-sm"
                  : isVoiceUser
                    ? "bg-white text-black rounded-2xl rounded-tr-sm border border-zinc-300"
                    : "bg-white text-black rounded-2xl rounded-tr-sm"
              }
            `}
          >
            <p className="whitespace-pre-wrap">{message.text}</p>

            {/* Image thumbnail */}
            {isBot && message.image_url && (
              <button
                onClick={() => setExpanded(true)}
                className="mt-2 block w-full overflow-hidden rounded-xl border border-white/10 hover:border-white/30 transition-colors"
              >
                <img
                  src={message.image_url}
                  alt="From vehicle documentation"
                  className="w-full h-auto max-h-48 object-cover"
                  loading="lazy"
                />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Fullscreen lightbox — rendered at document.body via portal to escape overflow-hidden */}
      {expanded &&
        message.image_url &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setExpanded(false)}
            >
              <button
                onClick={() => setExpanded(false)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <X size={20} />
              </button>
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                src={message.image_url}
                alt="From vehicle documentation"
                className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};

export default ChatMessage;
