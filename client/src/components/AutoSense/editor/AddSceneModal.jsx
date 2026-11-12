import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
} from "@heroui/react";
import {
  Plus,
  Sparkles,
  Layout,
  Monitor,
  Film,
  Flag,
  Clapperboard,
  Wand2,
  Loader2,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useStoryStore } from "../../../store/useStoryStore";
import { useEditorStore } from "../store/useEditorStore";
import { API_BASE } from "../../../config/api";
import axios from "axios";

const SCENE_TYPES = [
  {
    type: "intro_view",
    label: "Intro",
    description: "Opening title screen with background image",
    icon: Clapperboard,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    type: "slide_view",
    label: "Narrative Slide",
    description: "Content slide with image, text, and layout",
    icon: Layout,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    type: "tech_view",
    label: "3D Tech View",
    description: "Interactive 3D model with performance data",
    icon: Monitor,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    type: "outro_view",
    label: "Outro",
    description: "Closing screen with CTA buttons",
    icon: Flag,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
];

const CARD_POSITIONS = ["left", "center", "right", "hidden"];

const TECH_MODES = ["PERFORMANCE", "SAFETY", "UTILITY"];

export const AddSceneModal = () => {
  const {
    isAddSceneOpen,
    closeAddScene,
    isGeneratingScene,
    setGeneratingScene,
  } = useEditorStore();
  const { addScene, storyData, currentSceneIndex } = useStoryStore();

  const [mode, setMode] = useState("manual"); // "manual" | "ai"
  const [selectedType, setSelectedType] = useState(null);
  const [cardPosition, setCardPosition] = useState("left");
  const [techMode, setTechMode] = useState("PERFORMANCE");

  // Manual fields
  const [headline, setHeadline] = useState("");
  const [paragraph, setParagraph] = useState("");

  // AI fields
  const [aiPrompt, setAiPrompt] = useState("");

  const resetState = () => {
    setSelectedType(null);
    setCardPosition("left");
    setTechMode("PERFORMANCE");
    setHeadline("");
    setParagraph("");
    setAiPrompt("");
    setMode("manual");
  };

  const handleClose = () => {
    resetState();
    closeAddScene();
  };

  const buildManualScene = () => {
    const order = currentSceneIndex + 2;
    const base = {
      scene_id: `scene_${Date.now()}`,
      order,
      duration_seconds: 8,
      voiceover_text: "",
      audio_url: null,
      image_url: null,
      hotspots: [],
    };

    switch (selectedType) {
      case "intro_view":
        return {
          ...base,
          type: "intro_view",
          theme_tag: "introduction",
          intro_content: {
            title: headline || "Welcome",
            subtitle: paragraph || "",
            start_button_label: "Begin Experience",
            background_image: null,
          },
        };
      case "slide_view":
        return {
          ...base,
          type: "slide_view",
          theme_tag: "feature-highlight",
          layout: {
            composition: "full-bleed",
            card_position: cardPosition,
            content_alignment: "middle-left",
            motion: { image: "slow-zoom-in", content: "fade-up" },
          },
          slide_content: {
            headline: headline || "New Slide",
            paragraph: paragraph || "",
            alignment: cardPosition === "hidden" ? "left" : cardPosition,
            key_stats: [],
            badges: [],
          },
          visual_direction: {
            setting: "Studio",
            lighting: "Soft diffused studio lighting",
            camera_angle: "Front three-quarter",
            focus_point: "Full vehicle profile",
          },
        };
      case "tech_view": {
        const specs = storyData?.car_specs || {};
        const perf = specs.performance || {};
        const safety = specs.safety || {};
        const dims = specs.dimensions || {};

        // Build tech_config from real car specs (mirrors server directorAgent.buildTechConfig)
        let techConfig = { mode: techMode, camera_views: ["primary"] };
        let keyStats = [];
        let defaultHeadline = "";
        let defaultParagraph = "";

        switch (techMode) {
          case "PERFORMANCE":
            techConfig = {
              ...techConfig,
              drivetrain: perf.drivetrain || "FWD",
              engine_hp: perf.hp ?? null,
              torque_nm: perf.torque_nm ?? null,
              zero_to_sixty_sec: perf.zero_to_sixty_sec ?? null,
            };
            if (perf.hp)
              keyStats.push({
                label: "Horsepower",
                value: String(perf.hp),
                unit: "HP",
              });
            if (perf.torque_nm)
              keyStats.push({
                label: "Torque",
                value: String(perf.torque_nm),
                unit: "Nm",
              });
            if (perf.zero_to_sixty_sec)
              keyStats.push({
                label: "0-60 mph",
                value: String(perf.zero_to_sixty_sec),
                unit: "Sec",
              });
            if (keyStats.length === 0)
              keyStats.push({
                label: "Drivetrain",
                value: perf.drivetrain || "FWD",
                unit: "",
              });
            defaultHeadline = "Performance Overview";
            defaultParagraph = perf.hp
              ? `Delivering ${perf.hp} horsepower${perf.torque_nm ? ` and ${perf.torque_nm} Nm of torque` : ""}, this powertrain is built for responsive driving.`
              : "Explore the powertrain and performance capabilities of this vehicle.";
            break;

          case "SAFETY":
            techConfig = {
              ...techConfig,
              airbag_count: safety.airbags ?? 6,
              has_front_sensors: true,
              has_rear_sensors: true,
              safety_rating: safety.rating_text ?? null,
              assist_systems: safety.assist_systems || [
                "ABS",
                "Traction Control",
              ],
            };
            if (safety.airbags)
              keyStats.push({
                label: "Airbags",
                value: String(safety.airbags),
                unit: "",
              });
            if (safety.rating_text)
              keyStats.push({
                label: "Safety Rating",
                value: safety.rating_text,
                unit: "",
              });
            keyStats.push({
              label: "Assist Systems",
              value: String(
                (safety.assist_systems || ["ABS", "Traction Control"]).length,
              ),
              unit: "Systems",
            });
            defaultHeadline = "Safety Overview";
            defaultParagraph = `Equipped with ${safety.airbags ?? 6} airbags and advanced driver-assistance systems to keep you protected on every journey.`;
            break;

          case "UTILITY":
            techConfig = {
              ...techConfig,
              dimensions: {
                length_mm: dims.length_mm ?? 4500,
                width_mm: dims.width_mm ?? 1800,
                height_mm: dims.height_mm ?? 1500,
                wheelbase_mm: dims.wheelbase_mm ?? null,
              },
              trunk_capacity_liters: dims.trunk_capacity_l ?? null,
              seat_count: dims.seats ?? 5,
            };
            if (dims.trunk_capacity_l)
              keyStats.push({
                label: "Cargo Space",
                value: String(dims.trunk_capacity_l),
                unit: "Liters",
              });
            keyStats.push({
              label: "Seats",
              value: String(dims.seats ?? 5),
              unit: "",
            });
            if (dims.length_mm)
              keyStats.push({
                label: "Length",
                value: String(dims.length_mm),
                unit: "mm",
              });
            defaultHeadline = "Utility Overview";
            defaultParagraph = dims.trunk_capacity_l
              ? `With ${dims.trunk_capacity_l} liters of cargo space and seating for ${dims.seats ?? 5}, this vehicle is designed for everyday versatility.`
              : "Explore the dimensions and cargo capabilities of this vehicle.";
            break;
        }

        return {
          ...base,
          type: "tech_view",
          theme_tag: techMode,
          tech_config: techConfig,
          layout: {
            composition: "overlay-bottom",
            card_position: "right",
            content_alignment: "bottom-left",
            motion: { image: "static", content: "fade-up" },
          },
          slide_content: {
            headline: headline || defaultHeadline,
            paragraph: paragraph || defaultParagraph,
            alignment: "right",
            key_stats: keyStats.slice(0, 3),
            badges: [],
            theme_tag: techMode,
          },
        };
      }
      case "outro_view":
        return {
          ...base,
          type: "outro_view",
          theme_tag: "conclusion",
          outro_content: {
            headline: headline || "Thank You",
            subheadline: paragraph || "",
            cta_buttons: [
              { label: "Schedule Test Drive", action: "cta_primary" },
              { label: "View Details", action: "cta_secondary" },
            ],
          },
        };
      default:
        return null;
    }
  };

  const handleAddManual = () => {
    const scene = buildManualScene();
    if (!scene) return;
    addScene(scene, currentSceneIndex);
    handleClose();
  };

  const handleAddAI = async () => {
    if (!aiPrompt.trim()) return;
    setGeneratingScene(true);
    try {
      const car = storyData?.car || {};
      const res = await axios.post(`${API_BASE}/api/editor/generate-scene`, {
        prompt: aiPrompt,
        car: {
          year: car.year,
          make: car.make,
          model: car.model,
          body_type: car.body_type,
          color: car.color,
        },
        existingScenes: (storyData?.scenes || []).map((s) => ({
          type: s.type,
          theme_tag: s.theme_tag,
          headline:
            s.slide_content?.headline ||
            s.intro_content?.title ||
            s.outro_content?.headline,
        })),
        insertAfterIndex: currentSceneIndex,
      });

      if (res.data.success && res.data.scene) {
        addScene(res.data.scene, currentSceneIndex);
        handleClose();
      }
    } catch (err) {
      console.error("Failed to generate scene:", err);
    } finally {
      setGeneratingScene(false);
    }
  };

  return (
    <Modal
      isOpen={isAddSceneOpen}
      onClose={handleClose}
      size="2xl"
      backdrop="blur"
      classNames={{
        wrapper: "z-[200]",
        backdrop: "z-[200]",
        base: "bg-zinc-900 border border-white/10",
        header: "border-b border-white/5",
        body: "py-6",
        footer: "border-t border-white/5",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <Plus size={18} className="text-primary" />
          <span className="text-white font-semibold">Add New Scene</span>
        </ModalHeader>

        <ModalBody>
          {/* Mode Switcher */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-5">
            <button
              onClick={() => setMode("manual")}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                mode === "manual"
                  ? "bg-primary/20 text-primary"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              <Layout size={14} /> Manual
            </button>
            <button
              onClick={() => setMode("ai")}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                mode === "ai"
                  ? "bg-primary/20 text-primary"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              <Sparkles size={14} /> AI Generate
            </button>
          </div>

          {mode === "manual" && (
            <div className="space-y-5">
              {/* Scene Type Selection */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">
                  Scene Type
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {SCENE_TYPES.map((st) => {
                    const Icon = st.icon;
                    return (
                      <button
                        key={st.type}
                        onClick={() => setSelectedType(st.type)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all",
                          selectedType === st.type
                            ? "border-primary bg-primary/10"
                            : "border-white/10 bg-white/5 hover:border-white/20",
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn("p-1.5 rounded-lg", st.bg)}>
                            <Icon size={14} className={st.color} />
                          </div>
                          <span className="text-sm font-medium text-white">
                            {st.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 ml-9">
                          {st.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Fields */}
              {selectedType && (
                <div className="space-y-3">
                  {selectedType === "slide_view" && (
                    <div>
                      <p className="text-xs text-zinc-500 font-semibold mb-2">
                        Layout Composition
                      </p>
                        <div className="flex flex-wrap gap-2">
                          {CARD_POSITIONS.map((position) => (
                            <button
                              key={position}
                              onClick={() => setCardPosition(position)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs border transition-all",
                                cardPosition === position
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-white/10 text-zinc-400 hover:text-white",
                              )}
                            >
                              {position}
                            </button>
                          ))}
                        </div>
                    </div>
                  )}

                  {selectedType === "tech_view" && (
                    <div>
                      <p className="text-xs text-zinc-500 font-semibold mb-2">
                        Tech Mode
                      </p>
                      <div className="flex gap-2">
                        {TECH_MODES.map((m) => (
                          <button
                            key={m}
                            onClick={() => setTechMode(m)}
                            className={cn(
                              "px-4 py-2 rounded-lg text-xs border transition-all font-medium",
                              techMode === m
                                ? "border-amber-400 bg-amber-500/10 text-amber-400"
                                : "border-white/10 text-zinc-400 hover:text-white",
                            )}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Input
                    variant="bordered"
                    radius="lg"
                    size="md"
                    label="Headline / Title"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder={
                      selectedType === "intro_view"
                        ? "e.g. Discover the 2025 Model"
                        : "e.g. Unmatched Performance"
                    }
                    classNames={{
                      inputWrapper:
                        "bg-white/5 border-white/10 group-data-[focus=true]:border-primary",
                      input: "text-white placeholder:text-zinc-600",
                      label: "text-zinc-400",
                    }}
                  />

                  <Textarea
                    variant="bordered"
                    radius="lg"
                    minRows={2}
                    label={
                      selectedType === "intro_view"
                        ? "Subtitle"
                        : selectedType === "outro_view"
                          ? "Subheadline"
                          : "Paragraph"
                    }
                    value={paragraph}
                    onChange={(e) => setParagraph(e.target.value)}
                    placeholder="Optional description..."
                    classNames={{
                      inputWrapper:
                        "bg-white/5 border-white/10 group-data-[focus=true]:border-primary",
                      input: "text-white placeholder:text-zinc-600",
                      label: "text-zinc-400",
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {mode === "ai" && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Wand2 size={18} className="text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-white font-medium">
                      AI Scene Generator
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Describe the scene you want. The AI will create a
                      narrative slide with layout, content, and image direction
                      based on your car&apos;s persona. Note: 3D tech views
                      cannot be AI-generated.
                    </p>
                  </div>
                </div>
              </div>

              <Textarea
                variant="bordered"
                radius="lg"
                minRows={4}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Create a dramatic overhead shot highlighting the aggressive front grille and LED headlights, emphasizing the sports car DNA..."
                classNames={{
                  inputWrapper:
                    "bg-white/5 border-white/10 group-data-[focus=true]:border-primary",
                  input: "text-white placeholder:text-zinc-600",
                }}
              />
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button
            variant="flat"
            radius="xl"
            onPress={handleClose}
            className="bg-white/5 text-zinc-400 font-medium"
          >
            Cancel
          </Button>

          {mode === "manual" ? (
            <Button
              radius="xl"
              isDisabled={!selectedType}
              onPress={handleAddManual}
              className="bg-primary text-white font-semibold"
              startContent={<Plus size={16} />}
            >
              Add Scene
            </Button>
          ) : (
            <Button
              radius="xl"
              isDisabled={!aiPrompt.trim()}
              isLoading={isGeneratingScene}
              onPress={handleAddAI}
              className="bg-primary text-white font-semibold"
              startContent={!isGeneratingScene && <Sparkles size={16} />}
            >
              {isGeneratingScene ? "Generating..." : "Generate Scene"}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
