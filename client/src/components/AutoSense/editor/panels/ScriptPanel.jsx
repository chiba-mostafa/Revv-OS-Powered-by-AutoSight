import React, { useState } from "react";
import { Textarea, Button, Select, SelectItem, Divider } from "@heroui/react";
import { Mic, RefreshCw, Volume2 } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStoryStore } from "../../../../store/useStoryStore";
import { useEditorStore } from "../../store/useEditorStore";
import axios from "axios";
import { API_BASE } from "../../../../config/api";

export const ScriptPanel = () => {
  const { getCurrentScene, updateCurrentScene } = useStoryStore();
  const {
    markDirty,
    voices,
    selectedVoice,
    setSelectedVoice,
    isRegeneratingVoiceover,
    setRegeneratingVoiceover,
  } = useEditorStore();
  const scene = getCurrentScene();
  const [scriptChanged, setScriptChanged] = useState(false);

  if (!scene) return null;

  const voiceoverText =
    scene.raw_voiceover || scene.slide_content?.voiceover_text || "";

  const updateScript = (text) => {
    updateCurrentScene({
      raw_voiceover: text,
      slide_content: { voiceover_text: text },
    });
    setScriptChanged(true);
    markDirty();
  };

  const handleRegenerateVoiceover = async () => {
    const text = scene.raw_voiceover || scene.slide_content?.voiceover_text;
    if (!text || text.trim().length === 0) return;

    setRegeneratingVoiceover(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/editor/regenerate-voiceover`,
        {
          text,
          sceneId: scene.id || scene.scene_id,
          voice: selectedVoice,
          language: selectedVoice.includes("-fr") ? "fr" : "en",
        },
      );

      if (res.data.success) {
        updateCurrentScene({
          audio_url: res.data.audio_url,
          subtitles: res.data.subtitles || [],
        });
        setScriptChanged(false);
        markDirty();
      }
    } catch (err) {
      console.error("Failed to regenerate voiceover:", err);
    } finally {
      setRegeneratingVoiceover(false);
    }
  };

  const wordCount = voiceoverText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Voiceover Script */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Voiceover Script</SectionLabel>
          <span
            className={cn(
              "text-[10px] font-medium",
              wordCount > 60 ? "text-red-400" : "text-zinc-500",
            )}
          >
            {wordCount} words
          </span>
        </div>
        <Textarea
          variant="bordered"
          radius="lg"
          minRows={5}
          value={voiceoverText}
          onChange={(e) => updateScript(e.target.value)}
          placeholder="Write the narration script for this scene..."
          classNames={{
            inputWrapper:
              "bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-primary",
            input: "text-sm text-white placeholder:text-zinc-600",
          }}
        />
        {wordCount > 60 && (
          <p className="text-[10px] text-red-400">
            Recommended: Keep voiceover under 60 words for pacing.
          </p>
        )}
      </div>

      <Divider className="bg-white/5" />

      {/* Voice Selection */}
      <div className="space-y-3">
        <SectionLabel>Voice</SectionLabel>
        <Select
          size="sm"
          variant="bordered"
          selectedKeys={[selectedVoice]}
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0];
            if (val) setSelectedVoice(val);
          }}
          classNames={{
            trigger: "bg-white/5 border-white/10 h-11",
            value: "text-sm text-white",
            popoverContent: "bg-zinc-900 border-white/10",
          }}
        >
          {voices.map((v) => (
            <SelectItem
              key={v.id}
              textValue={`${v.label} (${v.language.toUpperCase()})`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">{v.label}</span>
                <div className="flex gap-1.5">
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400 uppercase">
                    {v.language}
                  </span>
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400">
                    {v.gender}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </Select>
      </div>

      {/* Regenerate Button */}
      <Button
        fullWidth
        size="md"
        radius="xl"
        isLoading={isRegeneratingVoiceover}
        onPress={handleRegenerateVoiceover}
        isDisabled={!voiceoverText.trim()}
        className={cn(
          "font-medium",
          scriptChanged
            ? "bg-primary text-white"
            : "bg-white/10 text-zinc-300 hover:bg-white/15",
        )}
        startContent={!isRegeneratingVoiceover && <RefreshCw size={16} />}
      >
        {isRegeneratingVoiceover
          ? "Generating..."
          : scriptChanged
            ? "Regenerate Voiceover"
            : "Regenerate Voiceover"}
      </Button>

      {/* Current Audio */}
      {scene.audio_url && (
        <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
          <div className="flex items-center gap-2">
            <Volume2 size={14} className="text-zinc-400" />
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
              Current Audio
            </span>
          </div>
          <audio
            controls
            src={scene.audio_url}
            className="w-full h-8 opacity-70"
            style={{ filter: "invert(1)" }}
          />
        </div>
      )}
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
    {children}
  </h4>
);
