import { create } from "zustand";

const VOICES = [
  { id: "en-US-Chirp-HD-D", label: "Chirp HD D", language: "en", gender: "male" },
  { id: "en-US-Chirp-HD-F", label: "Chirp HD F", language: "en", gender: "female" },
  { id: "fr-FR-Chirp-HD-D", label: "Chirp HD D", language: "fr", gender: "male" },
  { id: "fr-FR-Chirp-HD-F", label: "Chirp HD F", language: "fr", gender: "female" },
];

export const useEditorStore = create((set) => ({
  // Active floating panel (null = all closed)
  activePanel: null,
  setActivePanel: (panel) =>
    set((s) => ({ activePanel: s.activePanel === panel ? null : panel })),
  closePanel: () => set({ activePanel: null }),

  // Inline editing
  editingField: null, // e.g. "headline", "paragraph", "stat-0", "subtitle"
  setEditingField: (f) => set({ editingField: f }),
  clearEditingField: () => set({ editingField: null }),

  // Hotspot drag mode
  draggingHotspotId: null, // id of hotspot currently being dragged/placed
  setDraggingHotspot: (id) => set({ draggingHotspotId: id }),
  clearDraggingHotspot: () => set({ draggingHotspotId: null }),

  // Script dock
  isScriptDockOpen: false,
  toggleScriptDock: () =>
    set((s) => ({ isScriptDockOpen: !s.isScriptDockOpen })),
  openScriptDock: () => set({ isScriptDockOpen: true }),
  closeScriptDock: () => set({ isScriptDockOpen: false }),

  // Copilot chat
  isCopilotOpen: false,
  toggleCopilot: () => set((s) => ({ isCopilotOpen: !s.isCopilotOpen })),
  openCopilot: () => set({ isCopilotOpen: true }),
  closeCopilot: () => set({ isCopilotOpen: false }),
  copilotMessages: [],
  addCopilotMessage: (msg) =>
    set((s) => ({ copilotMessages: [...s.copilotMessages, msg] })),
  upsertLastVoiceUserMessage: (text) =>
    set((s) => {
      const next = [...s.copilotMessages];
      const last = next[next.length - 1];
      if (last?.role === "user" && last?.isVoice && !last?.committed) {
        next[next.length - 1] = {
          ...last,
          content: `${last.content} ${text}`.replace(/\s+/g, " ").trim(),
          timestamp: Date.now(),
        };
      } else {
        next.push({
          role: "user",
          content: text,
          timestamp: Date.now(),
          isVoice: true,
          committed: false,
        });
      }
      return { copilotMessages: next };
    }),
  commitLastVoiceUserMessage: () =>
    set((s) => {
      const next = [...s.copilotMessages];
      const last = next[next.length - 1];
      if (last?.role === "user" && last?.isVoice && !last?.committed) {
        next[next.length - 1] = { ...last, committed: true };
      }
      return { copilotMessages: next };
    }),
  clearCopilotMessages: () => set({ copilotMessages: [] }),
  isCopilotLoading: false,
  setCopilotLoading: (v) => set({ isCopilotLoading: v }),

  // Add Scene Modal
  isAddSceneOpen: false,
  openAddScene: () => set({ isAddSceneOpen: true }),
  closeAddScene: () => set({ isAddSceneOpen: false }),

  // Save state
  isDirty: false,
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  isSaving: false,
  setIsSaving: (v) => set({ isSaving: v }),

  // Editor-only animation replay triggers for live preview
  previewReplay: {
    image: 0,
    content: 0,
    scene: 0,
  },
  replayPreviewAnimation: (kind) =>
    set((s) => ({
      previewReplay: {
        ...s.previewReplay,
        [kind]: (s.previewReplay?.[kind] || 0) + 1,
      },
    })),

  // Voice selection
  voices: VOICES,
  selectedVoice: "en-US-Chirp-HD-D",
  setSelectedVoice: (v) => set({ selectedVoice: v }),

  // Voice mode (S2S editor copilot)
  isVoiceActive: false,
  setVoiceActive: (v) => set({ isVoiceActive: v }),
  isVoiceConnecting: false,
  setVoiceConnecting: (v) => set({ isVoiceConnecting: v }),

  // AI loading states
  isRegeneratingVoiceover: false,
  setRegeneratingVoiceover: (v) => set({ isRegeneratingVoiceover: v }),
  isRegeneratingImage: false,
  setRegeneratingImage: (v) => set({ isRegeneratingImage: v }),
  isGeneratingScene: false,
  setGeneratingScene: (v) => set({ isGeneratingScene: v }),

  // Per-scene regeneration tracking (Copilot REGENERATE_SCENE / batch voiceover)
  regeneratingScenes: new Set(),
  addRegeneratingScene: (idx) =>
    set((s) => ({
      regeneratingScenes: new Set([...s.regeneratingScenes, idx]),
    })),
  removeRegeneratingScene: (idx) =>
    set((s) => {
      const next = new Set(s.regeneratingScenes);
      next.delete(idx);
      return { regeneratingScenes: next };
    }),
  clearRegeneratingScenes: () => set({ regeneratingScenes: new Set() }),

  // ── Ghost scene (ADD_SCENE skeleton) ────────────────────────────────────────
  // ghostScene: { index, type, layout } — injected into sidebar while AI builds
  ghostScene: null,
  setGhostScene: (g) => set({ ghostScene: g }),
  clearGhostScene: () => set({ ghostScene: null }),

  // ── Per-scene field reveal tracking (sequential populate) ───────────────────
  // revealedFields: Map<sceneIndex, Set<"text"|"image">>
  revealedFields: {},
  revealField: (idx, field) =>
    set((s) => ({
      revealedFields: {
        ...s.revealedFields,
        [idx]: new Set([...(s.revealedFields[idx] || []), field]),
      },
    })),
  clearRevealed: (idx) =>
    set((s) => {
      const next = { ...s.revealedFields };
      delete next[idx];
      return { revealedFields: next };
    }),

  // ── Cinematic sweep (UPDATE_META / UPDATE_ALL_SCENES progress card) ──────────
  cinematicSweep: null, // null | { message: string }
  setCinematicSweep: (v) => set({ cinematicSweep: v }),
  clearCinematicSweep: () => set({ cinematicSweep: null }),

  // ── Batch loading scenes (sidebar skeleton while UPDATE_ALL_SCENES runs) ─────
  batchLoadingScenes: new Set(),
  addBatchLoadingScene: (idx) =>
    set((s) => ({
      batchLoadingScenes: new Set([...s.batchLoadingScenes, idx]),
    })),
  removeBatchLoadingScene: (idx) =>
    set((s) => {
      const next = new Set(s.batchLoadingScenes);
      next.delete(idx);
      return { batchLoadingScenes: next };
    }),
  clearBatchLoadingScenes: () => set({ batchLoadingScenes: new Set() }),

  // ── Living status pills (Copilot inline task status) ────────────────────────
  // Array of { id, label, status: "pending"|"done" }
  activePills: [],
  setPills: (pills) => set({ activePills: pills }),
  updatePill: (id, status) =>
    set((s) => ({
      activePills: s.activePills.map((p) =>
        p.id === id ? { ...p, status } : p,
      ),
    })),
  clearPills: () => set({ activePills: [] }),

  // Helpers
  getAvailablePanels: (sceneType) => {
    // Panels available in the floating toolbar (content is now inline)
    const panels = ["layout"];
    if (sceneType === "slide_view" || sceneType === "tech_view") {
      panels.push("badges");
    }
    if (sceneType === "slide_view") {
      panels.push("hotspots", "image");
    }
    if (sceneType === "intro_view" || sceneType === "outro_view") {
      panels.push("image");
    }
    panels.push("animation");
    return panels;
  },
}));
