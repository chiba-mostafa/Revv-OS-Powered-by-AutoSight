import { create } from "zustand";

const MAX_HISTORY = 50;

const cloneStoryData = (storyData) => {
  if (!storyData) return storyData;
  return JSON.parse(JSON.stringify(storyData));
};

export const useStoryStore = create((set, get) => ({
  story: null,
  storyData: null,
  scenes: [],
  currentSceneIndex: 0,
  isLoading: true,

  history: {
    past: [],
    future: [],
  },

  playback: {
    isPlaying: false,
    isPaused: false,
    autoAdvance: true,
    currentTime: 0,
  },
  audioCurrentTime: 0,
  currentSceneAudioDuration: 0,
  activeCameraView: "primary",
  isFreeRoam: false,

  setStoryLoading: (isLoading) => set({ isLoading }),

  loadStory: (storyData) => {
    set({
      story: storyData,
      storyData,
      scenes: storyData?.scenes || [],
      currentSceneIndex: 0,
      isLoading: false,
      history: { past: [], future: [] },
      playback: {
        isPlaying: false,
        isPaused: false,
        autoAdvance: true,
        currentTime: 0,
      },
      audioCurrentTime: 0,
      currentSceneAudioDuration: 0,
      activeHotspotId: null,
    });
  },

  getCurrentScene: () => {
    const { scenes, currentSceneIndex } = get();
    return scenes[currentSceneIndex] || null;
  },

  nextScene: () => {
    const { scenes, currentSceneIndex } = get();
    if (currentSceneIndex < scenes.length - 1) {
      set({
        currentSceneIndex: currentSceneIndex + 1,
        audioCurrentTime: 0,
        currentSceneAudioDuration: 0,
      });
    }
  },

  prevScene: () => {
    const { currentSceneIndex } = get();
    if (currentSceneIndex > 0) {
      set({
        currentSceneIndex: currentSceneIndex - 1,
        audioCurrentTime: 0,
        currentSceneAudioDuration: 0,
      });
    }
  },

  goToScene: (index) => {
    const { scenes } = get();
    if (index >= 0 && index < scenes.length) {
      set({
        currentSceneIndex: index,
        audioCurrentTime: 0,
        currentSceneAudioDuration: 0,
      });
    }
  },

  play: () => {
    set((state) => ({
      playback: { ...state.playback, isPlaying: true, isPaused: false },
    }));
  },

  setIsPlaying: (value) => {
    set((state) => ({
      playback: {
        ...state.playback,
        isPlaying: value,
        isPaused: value ? false : state.playback.isPaused,
      },
    }));
  },

  pause: () => {
    set((state) => ({
      playback: { ...state.playback, isPaused: true },
    }));
  },

  setPaused: (value) => {
    set((state) => ({
      playback: { ...state.playback, isPaused: value },
    }));
  },

  togglePlayPause: () => {
    set((state) => ({
      playback: {
        ...state.playback,
        isPaused: !state.playback.isPaused,
      },
    }));
  },

  stop: () => {
    set((state) => ({
      playback: { ...state.playback, isPlaying: false, isPaused: false },
      currentSceneIndex: 0,
      audioCurrentTime: 0,
      currentSceneAudioDuration: 0,
    }));
  },

  setAutoAdvance: (value) => {
    set((state) => ({
      playback: { ...state.playback, autoAdvance: value },
    }));
  },

  setAudioCurrentTime: (time) => {
    set((state) => ({
      audioCurrentTime: time,
      playback: { ...state.playback, currentTime: time },
    }));
  },

  setCurrentSceneAudioDuration: (duration) => {
    set({
      currentSceneAudioDuration:
        Number.isFinite(duration) && duration > 0 ? duration : 0,
    });
  },

  setCameraView: (view) => set({ activeCameraView: view }),

  setFreeRoam: (enabled) =>
    set({
      isFreeRoam: enabled,
      activeCameraView: enabled ? "free" : "primary",
    }),

  activeHotspotId: null,
  setActiveHotspot: (id) => set({ activeHotspotId: id }),

  updateStoryData: (newStoryData) => {
    get().pushHistory();
    set({
      story: newStoryData,
      storyData: newStoryData,
      scenes: newStoryData?.scenes || [],
    });
  },

  addScene: (scene, atIndex = -1) => {
    get().pushHistory();
    const { scenes, storyData } = get();
    const newScene = {
      ...scene,
      id: scene.id || scene.scene_id || `scene_${Date.now()}`,
      order: atIndex >= 0 ? atIndex + 1 : scenes.length + 1,
    };
    const newScenes =
      atIndex >= 0
        ? [
            ...scenes.slice(0, atIndex + 1),
            newScene,
            ...scenes.slice(atIndex + 1),
          ]
        : [...scenes, newScene];
    // Re-index orders
    const reindexed = newScenes.map((s, i) => ({ ...s, order: i + 1 }));
    const updated = { ...storyData, scenes: reindexed };
    // Navigate to the newly added scene
    const newIndex = atIndex >= 0 ? atIndex + 1 : reindexed.length - 1;
    set({
      scenes: reindexed,
      storyData: updated,
      story: updated,
      currentSceneIndex: newIndex,
    });
  },

  removeScene: (index) => {
    const { scenes, storyData, currentSceneIndex } = get();
    if (scenes.length <= 1) return;
    get().pushHistory();
    const newScenes = scenes.filter((_, i) => i !== index);
    const reindexed = newScenes.map((s, i) => ({ ...s, order: i + 1 }));
    const newIndex = Math.min(currentSceneIndex, reindexed.length - 1);
    const updated = { ...storyData, scenes: reindexed };
    set({
      scenes: reindexed,
      storyData: updated,
      story: updated,
      currentSceneIndex: newIndex,
    });
  },

  updateSceneAtIndex: (index, updates) => {
    const { scenes, storyData } = get();
    if (!scenes[index]) return;
    get().pushHistory();
    const currentScene = scenes[index];
    let updatedScene = { ...currentScene };
    Object.keys(updates).forEach((key) => {
      if (
        [
          "intro_content",
          "slide_content",
          "outro_content",
          "tech_config",
        ].includes(key) &&
        typeof updates[key] === "object"
      ) {
        updatedScene[key] = { ...updatedScene[key], ...updates[key] };
      } else {
        updatedScene[key] = updates[key];
      }
    });
    const newScenes = [...scenes];
    newScenes[index] = updatedScene;
    const updated = { ...storyData, scenes: newScenes };
    set({ scenes: newScenes, storyData: updated, story: updated });
  },

  updateCurrentScene: (updates) => {
    const { scenes, currentSceneIndex, storyData } = get();
    if (!scenes[currentSceneIndex]) return;
    get().pushHistory();

    const currentScene = scenes[currentSceneIndex];
    let updatedScene = { ...currentScene };

    Object.keys(updates).forEach((key) => {
      if (
        ["intro_content", "slide_content", "outro_content"].includes(key) &&
        typeof updates[key] === "object"
      ) {
        updatedScene[key] = {
          ...updatedScene[key],
          ...updates[key],
        };
      } else {
        updatedScene[key] = updates[key];
      }
    });

    const newScenes = [...scenes];
    newScenes[currentSceneIndex] = updatedScene;

    set({
      scenes: newScenes,
      storyData: storyData
        ? { ...storyData, scenes: newScenes }
        : { scenes: newScenes },
      story: storyData
        ? { ...storyData, scenes: newScenes }
        : { scenes: newScenes },
    });
  },

  startExperience: () => {
    const { scenes, currentSceneIndex } = get();
    const currentScene = scenes[currentSceneIndex];

    if (currentScene?.type === "intro_view") {
      set({
        currentSceneIndex: currentSceneIndex + 1,
        audioCurrentTime: 0,
        currentSceneAudioDuration: 0,
        playback: {
          isPlaying: true,
          isPaused: false,
          autoAdvance: true,
          currentTime: 0,
        },
      });
    } else {
      set((state) => ({
        playback: { ...state.playback, isPlaying: true, isPaused: false },
      }));
    }
  },

  setScene: (index) => {
    const { storyData } = get();
    if (storyData && index >= 0 && index < (storyData.scenes?.length || 0)) {
      set({
        playback: {
          ...get().playback,
          currentSceneIndex: index,
          currentTime: 0,
        },
        activeCameraView: "primary",
        isFreeRoam: false,
        audioCurrentTime: 0,
        currentSceneAudioDuration: 0,
      });
    }
  },

  // Applies a theme ("cinematic" | "minimal_tech") to ALL scenes in one atomic update
  updateAllScenesTheme: (theme) => {
    get().pushHistory();
    const { scenes, storyData } = get();
    const newScenes = scenes.map((s) => ({
      ...s,
      layout: { ...(s.layout || {}), theme },
    }));
    const updated = { ...storyData, scenes: newScenes };
    set({ scenes: newScenes, storyData: updated, story: updated });
  },

  // Update global story metadata (template, language, title, etc.)
  updateMeta: (updates) => {
    get().pushHistory();
    const { storyData } = get();
    const newMeta = { ...(storyData?.meta || {}), ...updates };
    const updated = { ...storyData, meta: newMeta };
    // Also propagate language to top-level for compatibility
    if (updates.language) updated.language = updates.language;
    set({ storyData: updated, story: updated });
  },

  pushHistory: () => {
    const { storyData, currentSceneIndex, history } = get();
    if (!storyData) return;
    const snapshot = {
      storyData: cloneStoryData(storyData),
      currentSceneIndex,
    };

    const past = [...history.past, snapshot];
    const trimmedPast = past.length > MAX_HISTORY ? past.slice(1) : past;

    set({
      history: {
        past: trimmedPast,
        future: [],
      },
    });
  },

  undo: () => {
    const { history, storyData, currentSceneIndex } = get();
    if (!history.past.length || !storyData) return;

    const previous = history.past[history.past.length - 1];
    const futureSnapshot = {
      storyData: cloneStoryData(storyData),
      currentSceneIndex,
    };

    const nextPast = history.past.slice(0, -1);
    const nextFuture = [futureSnapshot, ...history.future];

    set({
      story: previous.storyData,
      storyData: previous.storyData,
      scenes: previous.storyData?.scenes || [],
      currentSceneIndex: previous.currentSceneIndex ?? 0,
      history: {
        past: nextPast,
        future: nextFuture,
      },
    });
  },

  redo: () => {
    const { history, storyData, currentSceneIndex } = get();
    if (!history.future.length || !storyData) return;

    const next = history.future[0];
    const pastSnapshot = {
      storyData: cloneStoryData(storyData),
      currentSceneIndex,
    };

    const nextFuture = history.future.slice(1);
    const nextPast = [...history.past, pastSnapshot];

    set({
      story: next.storyData,
      storyData: next.storyData,
      scenes: next.storyData?.scenes || [],
      currentSceneIndex: next.currentSceneIndex ?? 0,
      history: {
        past: nextPast,
        future: nextFuture,
      },
    });
  },
}));
