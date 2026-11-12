import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export const useChatbotStore = create(
  subscribeWithSelector((set, get) => ({
    isOpen: false,
    messages: [],
    isTyping: false,
    suggestions: [],
    conversationHistory: [],
    isWidgetActive: false,
    voiceSessionIds: [], // message IDs added during the active voice session
    voiceBotStreamMap: {}, // streamId -> messageId for incremental bot text

    toggleChatbot: () => set((state) => ({ isOpen: !state.isOpen })),
    openChatbot: () => set({ isOpen: true }),
    closeChatbot: () => set({ isOpen: false }),

    setWidgetActive: (active) => set({ isWidgetActive: active }),

    // Voice session tracking
    startVoiceSession: () =>
      set({ voiceSessionIds: [], voiceBotStreamMap: {} }),

    addVoiceBotMessage: (text) => {
      const message = {
        id: Date.now() + Math.random(),
        type: "bot",
        source: "voice",
        text,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, message],
        conversationHistory: [...state.conversationHistory, message],
        voiceSessionIds: [...state.voiceSessionIds, message.id],
      }));
      return message;
    },

    upsertVoiceBotMessageChunk: (streamId, text, isFinal = false) => {
      const safeStreamId = streamId || "assistant-stream";
      const chunk = text || "";

      set((state) => {
        const existingMessageId = state.voiceBotStreamMap[safeStreamId];

        // Final marker without text and no known message: nothing to do except cleanup.
        if (!existingMessageId && !chunk && isFinal) {
          const nextMap = { ...state.voiceBotStreamMap };
          delete nextMap[safeStreamId];
          return { voiceBotStreamMap: nextMap };
        }

        if (existingMessageId) {
          const nextMessages = state.messages.map((m) =>
            m.id === existingMessageId
              ? { ...m, text: `${m.text || ""}${chunk}` }
              : m,
          );
          const nextHistory = state.conversationHistory.map((m) =>
            m.id === existingMessageId
              ? { ...m, text: `${m.text || ""}${chunk}` }
              : m,
          );
          const nextMap = { ...state.voiceBotStreamMap };
          if (isFinal) delete nextMap[safeStreamId];

          return {
            messages: nextMessages,
            conversationHistory: nextHistory,
            voiceBotStreamMap: nextMap,
          };
        }

        const message = {
          id: Date.now() + Math.random(),
          type: "bot",
          source: "voice",
          text: chunk,
          timestamp: new Date().toISOString(),
        };
        const nextMap = { ...state.voiceBotStreamMap };
        if (!isFinal) nextMap[safeStreamId] = message.id;

        return {
          messages: [...state.messages, message],
          conversationHistory: [...state.conversationHistory, message],
          voiceSessionIds: [...state.voiceSessionIds, message.id],
          voiceBotStreamMap: nextMap,
        };
      });
    },

    addVoiceUserMessage: (text) => {
      const message = {
        id: Date.now() + Math.random(),
        type: "user",
        source: "voice",
        text,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, message],
        conversationHistory: [...state.conversationHistory, message],
        voiceSessionIds: [...state.voiceSessionIds, message.id],
      }));
      return message;
    },

    endVoiceSession: (durationSecs) => {
      const { messages, voiceSessionIds } = get();
      if (voiceSessionIds.length === 0) {
        set({ voiceSessionIds: [] });
        return;
      }
      // Collect voice messages
      const voiceMessages = messages.filter((m) =>
        voiceSessionIds.includes(m.id),
      );
      // Build summary card replacing all voice messages
      const summaryMessage = {
        id: Date.now() + Math.random(),
        type: "voice_summary",
        durationSecs,
        voiceMessages,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        messages: [
          ...state.messages.filter((m) => !voiceSessionIds.includes(m.id)),
          summaryMessage,
        ],
        voiceSessionIds: [],
        voiceBotStreamMap: {},
      }));
    },

    addMessage: (message) => {
      set((state) => ({
        messages: [...state.messages, message],
        conversationHistory: [...state.conversationHistory, message],
      }));
    },

    addBotMessage: (text, sceneContext = null, image_url = null) => {
      const message = {
        id: Date.now() + Math.random(),
        type: "bot",
        text,
        image_url,
        timestamp: new Date().toISOString(),
        sceneContext,
      };
      set((state) => ({
        messages: [...state.messages, message],
        conversationHistory: [...state.conversationHistory, message],
      }));
      return message;
    },

    addWidgetMessage: (widgetType, prefilledData, text) => {
      const message = {
        id: Date.now() + Math.random(),
        type: "widget",
        widget_type: widgetType,
        prefilled_data: prefilledData,
        text: text || "",
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, message],
        conversationHistory: [
          ...state.conversationHistory,
          { type: "bot", text: text || "Booking form presented." },
        ],
        isWidgetActive: true,
      }));
      return message;
    },

    replaceMessageWithTicket: (messageId, ticketData) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                type: "ticket",
                ticket_data: ticketData,
                timestamp: new Date().toISOString(),
              }
            : msg,
        ),
        isWidgetActive: false,
      }));
    },

    addUserMessage: (text) => {
      const message = {
        id: Date.now() + Math.random(),
        type: "user",
        text,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, message],
        conversationHistory: [...state.conversationHistory, message],
      }));
      return message;
    },

    setTyping: (isTyping) => set({ isTyping }),
    setSuggestions: (suggestions) => set({ suggestions }),

    clearMessages: () => {
      set({
        messages: [],
        conversationHistory: [],
        suggestions: [],
      });
    },

    updateContextualSuggestions: (currentScene, currentCar) => {
      const suggestions = get().generateContextualSuggestions(
        currentScene,
        currentCar,
      );
      set({ suggestions });
    },

    generateContextualSuggestions: (currentScene, currentCar) => {
      const suggestions = [];
      if (!currentCar) {
        suggestions.push("Tell me about the available vehicles");
        suggestions.push("What makes this car special?");
        return suggestions;
      }

      if (currentScene?.type === "intro_view") {
        suggestions.push("What's the electric range?");
        suggestions.push("How efficient is this hybrid?");
      } else if (currentScene?.slide_content?.theme_tag) {
        const theme = currentScene.slide_content.theme_tag.toLowerCase();
        if (theme.includes("efficiency")) {
          suggestions.push("What's the MPG rating?");
          suggestions.push("How long does it take to charge?");
        } else if (theme.includes("performance")) {
          suggestions.push("What's the horsepower?");
          suggestions.push("How quick is the acceleration?");
        } else if (theme.includes("technology")) {
          suggestions.push("What safety features are included?");
          suggestions.push("Tell me about the infotainment system");
        }
      }

      suggestions.push("Compare this to other models");
      suggestions.push("What are the key features?");

      return suggestions.slice(0, 3);
    },

    initializeChat: (currentScene, currentCar) => {
      const welcomeMessage = {
        id: Date.now(),
        type: "bot",
        text: "Hello! I'm your automotive assistant. I can help you understand the features and specifications of this vehicle.",
        timestamp: new Date().toISOString(),
        isWelcome: true,
      };

      set({
        messages: [welcomeMessage],
        conversationHistory: [welcomeMessage],
      });

      get().updateContextualSuggestions(currentScene, currentCar);
    },
  })),
);
