import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../config/supabaseClient";
import { useStoryStore } from "../../store/useStoryStore";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";

// The "Tech" messages that cycle while loading
const DEFAULT_LOADING_PHASES = [
  "Initializing Neural Link...",
  "Fetching Volumetric Data...",
  "Compiling Shaders...",
  "Calibrating Physics Engine...",
  "Optimizing Assets...",
  "Ready.",
];

const EDITOR_LOADING_PHASES = [
  "Initializing",
  "Loading Story",
  "Preparing Editor",
  "Optimizing",
  "Almost Ready",
  "Ready",
];

export default function AutoSenseLoader({ children, mode = "viewer" }) {
  const { storyId } = useParams();
  const { loadStory, isLoading, setStoryLoading } = useStoryStore();
  const [fetchError, setFetchError] = useState(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const isEditor = mode === "editor";
  const loadingPhases = useMemo(
    () => (isEditor ? EDITOR_LOADING_PHASES : DEFAULT_LOADING_PHASES),
    [isEditor],
  );

  useEffect(() => {
    const fetchStory = async () => {
      if (!storyId) return;

      try {
        setStoryLoading(true);
        setFetchError(null);
        setLoadProgress(20);
        // 1. Fetch the JSON blob from Supabase
        const { data, error } = await supabase
          .from("stories")
          .select("content, generation_status")
          .eq("id", storyId)
          .single();

        if (error) throw error;
        setLoadProgress(50);

        // 2. Check Status
        if (data.generation_status !== "complete") {
          setStoryLoading(false);
          setFetchError(
            `Story is ${data.generation_status}. Please wait for AI generation to finish.`,
          );
          return;
        }

        setLoadProgress(75);
        // 3. Hydrate the Store
        if (data.content) {
          loadStory(data.content);
          setLoadProgress(100);
        } else {
          throw new Error("Story content is empty");
        }
      } catch (err) {
        console.error("AutoSight Load Error:", err);
        setStoryLoading(false);
        setFetchError(
          "Failed to load story. It may not exist or you lack permission.",
        );
      }
    };

    fetchStory();
  }, [storyId, loadStory, setStoryLoading]);

  // Cycle through text phases based on progress
  useEffect(() => {
    if (isLoading) {
      const totalPhases = loadingPhases.length;
      const currentPhase = Math.floor((loadProgress / 100) * (totalPhases - 1));
      setPhaseIndex(currentPhase);
    }
  }, [loadProgress, isLoading, loadingPhases]);

  // --- RENDERING STATES ---

  if (fetchError) {
    return (
      <div className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center font-sans text-white">
        <div className="relative mb-8 flex justify-center">
          <div className="absolute inset-0 bg-red-500/20 blur-[60px] rounded-full" />
          <AlertCircle className="size-16 text-red-500 relative z-10" />
        </div>
        <h2 className="text-xl font-bold">Unable to Load Experience</h2>
        <p className="text-neutral-400 mt-2 text-center max-w-md px-4">
          {fetchError}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <AnimatePresence>
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center font-sans text-white"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mb-16"
          >
            <img
              src="https://lvodepwdbesxputvetnk.supabase.co/storage/v1/object/public/application/AutoSightLogo.png"
              alt="AutoSight"
              className="h-12 w-auto object-contain brightness-0 invert opacity-90"
            />
          </motion.div>

          <div className="flex flex-col items-center gap-4 w-80">
            <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${loadProgress}%` }}
                transition={{
                  duration: 0.3,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              />
            </div>

            <div className="h-5 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={phaseIndex}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="text-sm text-white/40 font-medium tracking-tight"
                >
                  {loadingPhases[phaseIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Once loaded, render the Player (children)
  return <>{children}</>;
}
