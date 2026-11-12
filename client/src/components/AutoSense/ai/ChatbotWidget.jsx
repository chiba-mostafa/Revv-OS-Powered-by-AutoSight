import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Minimize2, Maximize2, Sparkles } from "lucide-react";

import { useChatbotStore } from "../../../store/useChatbotStore";
import { useStoryStore } from "../../../store/useStoryStore";
import { useVoiceChatbot } from "../../../hooks/useVoiceChatbot";
import ChatbotBackend from "../services/ChatbotService";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

export const ChatbotWidget = ({ onOpenPayPalDeposit }) => {
  const {
    isOpen,
    messages,
    isTyping,
    suggestions,
    isWidgetActive,
    toggleChatbot,
    openChatbot,
    closeChatbot,
    addBotMessage,
    addUserMessage,
    addWidgetMessage,
    setTyping,
    setSuggestions,
    initializeChat,
    updateContextualSuggestions,
  } = useChatbotStore();

  const { getCurrentScene, storyData } = useStoryStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef(null);

  const currentScene = getCurrentScene();

  const isMinimalTech =
    currentScene?.layout?.theme != null
      ? currentScene.layout.theme === "minimal_tech"
      : (storyData?.meta?.template || "")
          .toLowerCase()
          .replace(/[\s-]/g, "") === "minimaltech";

  const buildCarContext = () => {
    if (!storyData) return {};

    const baseCar = storyData.car_data || storyData.car || {};

    const rootBadges = storyData.badges || [];

    let parsedSpecsRaw = {};
    if (baseCar.specs_raw) {
      try {
        parsedSpecsRaw =
          typeof baseCar.specs_raw === "string"
            ? JSON.parse(baseCar.specs_raw)
            : baseCar.specs_raw;
      } catch (e) {
        console.warn("Failed to parse specs_raw:", e);
      }
    }

    const extractedSpecs = {};
    const scenes = storyData.scenes || [];
    scenes.forEach((scene) => {
      const keyStats = scene.slide_content?.key_stats || [];
      keyStats.forEach((stat) => {
        const label = stat.label?.toLowerCase().replace(/\s+/g, "_");
        if (label && stat.value) {
          extractedSpecs[label] = stat.value;
          extractedSpecs[`${label}_unit`] = stat.unit;
        }
      });
    });

    let parsedHp = null;
    const trimSource = baseCar.trim || parsedSpecsRaw.trim;
    if (trimSource) {
      const hpMatch = trimSource.match(/(\d+)\s*[Hh][Pp]/i);
      if (hpMatch) {
        parsedHp = parseInt(hpMatch[1], 10);
      }
    }

    return {
      ...baseCar,
      id: storyData.car_id || baseCar.id,
      badges: rootBadges,
      specs: {
        ...(baseCar.specs || {}),
        ...parsedSpecsRaw,
        ...extractedSpecs,
        hp: baseCar.specs?.hp || parsedSpecsRaw.engineHp || parsedHp,
      },
      car_specs: storyData.car_specs || null,
      color: baseCar.color || parsedSpecsRaw.color_name,
      condition: baseCar.condition || parsedSpecsRaw.condition,
      _storyData: storyData,
    };
  };

  const currentCar = buildCarContext();

  const { isVoiceActive, isConnecting, startVoice, stopVoice } =
    useVoiceChatbot(currentCar?.id || currentCar?.car_id, currentCar);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isOpen]);

  useEffect(() => {
    if (isOpen && !isInitialized && storyData) {
      initializeChat(currentScene, currentCar);
      setIsInitialized(true);
    }
  }, [isOpen, isInitialized, storyData]);

  useEffect(() => {
    if (isOpen) {
      updateContextualSuggestions(currentScene, currentCar);
    }
  }, [currentScene?.id, isOpen]);

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    addUserMessage(text);
    setTyping(true);

    try {
      const { messages: currentMessages } = useChatbotStore.getState();
      const response = await ChatbotBackend.generateResponse(
        text,
        currentCar,
        currentScene,
        currentMessages,
      );

      // Handle widget response (booking intent)
      if (response.type === "widget") {
        if (response.text) {
          addBotMessage(response.text, currentScene?.id);
        }
        addWidgetMessage(
          response.widget_type,
          response.prefilled_data,
          response.text,
        );
      } else {
        addBotMessage(response.text, currentScene?.id, response.image_url);
      }

      setTyping(false);

      const nextSuggestions = ChatbotBackend.getContextualSuggestions(
        currentScene,
        currentCar,
      );
      setSuggestions(nextSuggestions);
    } catch (error) {
      console.error("Chat Error:", error);
      addBotMessage(
        "I'm having trouble connecting to the vehicle database. Please try again.",
      );
      setTyping(false);
    }
  };

  return (
    <div
      className="fixed bottom-26 right-8 z-[60] flex flex-col items-end"
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onKeyPress={(e) => e.stopPropagation()}
    >
      {/* CHAT WINDOW */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: 1,
              y: 0,
              height: isMinimized ? 64 : isVoiceActive ? 680 : 565,
              width: isVoiceActive ? 430 : 360,
            }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            style={{ maxHeight: "calc(100vh - 8rem)" }}
            className="mb-3 rounded-3xl bg-[#1a1a1a] shadow-2xl shadow-black/40 overflow-hidden border border-white/10 flex flex-col"
          >
            {/* HEADER */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <img
                    src="https://lvodepwdbesxputvetnk.supabase.co/storage/v1/object/public/application/AutoSight-icon.png"
                    alt="AutoSight"
                    className="w-5 h-5 object-contain brightness-0 invert"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    AutoSight
                  </h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    {currentCar.model || "Vehicle Assistant"}
                  </p>
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {isMinimized ? (
                    <Maximize2 size={14} />
                  ) : (
                    <Minimize2 size={14} />
                  )}
                </button>
                <button
                  onClick={toggleChatbot}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* BODY (Messages) */}
            {!isMinimized && (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 scrollbar-hide">
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1">
                        <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* FOOTER (Input) */}
                <div className="px-3 pt-2 pb-2 border-t border-white/10 flex-shrink-0">
                  {onOpenPayPalDeposit && (
                    <div className="mb-2">
                      <button
                        onClick={onOpenPayPalDeposit}
                        className="w-full py-1.5 px-3 bg-gradient-to-r from-[#0070BA]/20 to-[#003087]/30 hover:from-[#0070BA]/30 hover:to-[#003087]/50 border border-[#0070BA]/40 rounded-xl text-xs font-semibold text-blue-200 flex items-center justify-center gap-2 transition-all shadow-sm"
                      >
                        <svg className="w-3.5 h-3.5 fill-[#0070BA]" viewBox="0 0 24 24">
                          <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.789.789 0 0 1 .778-.654h7.112c3.543 0 5.86 1.776 5.378 5.25-.403 2.91-2.484 4.542-5.32 4.542h-2.18l-1.07 6.804a.642.642 0 0 1-.632.544l-1.934.131zm8.216-12.723c.25-1.802-.916-2.614-2.764-2.614H8.79l-1.4 8.89h1.79c1.944 0 3.864-.32 4.112-2.115l.004-.035z" />
                        </svg>
                        <span>Reserve Vehicle ($500 PayPal Deposit)</span>
                      </button>
                    </div>
                  )}
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    suggestions={suggestions}
                    disabled={isTyping || isWidgetActive}
                    isVoiceActive={isVoiceActive}
                    isConnecting={isConnecting}
                    onToggleVoice={async () => {
                      if (isVoiceActive) {
                        await stopVoice();
                      } else {
                        try {
                          await startVoice();
                        } catch (err) {
                          const msg =
                            "Failed to start voice mode. Please check your microphone permissions and try again.";
                          addBotMessage(msg);
                        }
                      }
                    }}
                  />
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING TOGGLE BUTTON */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            onClick={toggleChatbot}
            className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all border ${
              isMinimalTech
                ? "bg-zinc-700 border-zinc-600 hover:bg-zinc-600 shadow-black/20"
                : "bg-white/10 backdrop-blur-2xl border-white/20 shadow-black/40 hover:shadow-xl hover:bg-white/[0.15]"
            }`}
          >
            <img
              src="https://lvodepwdbesxputvetnk.supabase.co/storage/v1/object/public/application/AutoSight-icon.png"
              alt="AutoSight"
              className="w-7 h-7 object-contain brightness-0 invert"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
