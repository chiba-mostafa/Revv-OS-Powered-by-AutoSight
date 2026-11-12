import React from "react";
import { Input, Textarea, Button, Divider } from "@heroui/react";
import { Plus, Trash2, Type } from "lucide-react";
import { useStoryStore } from "../../../../store/useStoryStore";
import { useEditorStore } from "../../store/useEditorStore";

export const ContentPanel = () => {
  const { getCurrentScene, updateCurrentScene } = useStoryStore();
  const { markDirty } = useEditorStore();
  const scene = getCurrentScene();

  if (!scene) return null;

  const update = (contentKey, field, value) => {
    updateCurrentScene({ [contentKey]: { [field]: value } });
    markDirty();
  };

  // ── INTRO VIEW ──
  if (scene.type === "intro_view") {
    const c = scene.intro_content || {};
    return (
      <div className="space-y-5">
        <SectionLabel>Intro Content</SectionLabel>
        <FieldInput
          label="Title"
          value={c.title || ""}
          onChange={(v) => update("intro_content", "title", v)}
        />
        <FieldInput
          label="Subtitle"
          value={c.subtitle || ""}
          onChange={(v) => update("intro_content", "subtitle", v)}
        />
        <FieldInput
          label="Start Button Label"
          value={c.start_button_label || "Start"}
          onChange={(v) => update("intro_content", "start_button_label", v)}
        />
      </div>
    );
  }

  // ── OUTRO VIEW ──
  if (scene.type === "outro_view") {
    const c = scene.outro_content || {};
    const ctaButtons = c.cta_buttons || [];
    return (
      <div className="space-y-5">
        <SectionLabel>Outro Content</SectionLabel>
        <FieldInput
          label="Headline"
          value={c.headline || ""}
          onChange={(v) => update("outro_content", "headline", v)}
        />
        <FieldInput
          label="Subheadline"
          value={c.subheadline || ""}
          onChange={(v) => update("outro_content", "subheadline", v)}
        />
        <Divider className="bg-white/5" />
        <SectionLabel>CTA Buttons</SectionLabel>
        {ctaButtons.map((btn, i) => (
          <div
            key={i}
            className="space-y-2 p-3 bg-white/5 rounded-xl border border-white/10"
          >
            <FieldInput
              label={`Button ${i + 1} Label`}
              value={btn.label || ""}
              onChange={(v) => {
                const newBtns = [...ctaButtons];
                newBtns[i] = { ...newBtns[i], label: v };
                update("outro_content", "cta_buttons", newBtns);
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // ── SLIDE VIEW / TECH VIEW ──
  const c = scene.slide_content || {};
  const keyStats = c.key_stats || [];

  const updateSlide = (field, value) => update("slide_content", field, value);

  const addStat = () => {
    const newStats = [...keyStats, { label: "New Stat", value: "0", unit: "" }];
    updateSlide("key_stats", newStats);
  };

  const updateStat = (i, field, value) => {
    const newStats = [...keyStats];
    newStats[i] = { ...newStats[i], [field]: value };
    updateSlide("key_stats", newStats);
  };

  const removeStat = (i) => {
    const newStats = keyStats.filter((_, idx) => idx !== i);
    updateSlide("key_stats", newStats);
  };

  return (
    <div className="space-y-5">
      <SectionLabel>Text Content</SectionLabel>
      <FieldInput
        label="Headline"
        value={c.headline || ""}
        onChange={(v) => updateSlide("headline", v)}
        placeholder="Punchy 2-4 word headline"
      />
      <FieldTextarea
        label="Paragraph"
        value={c.paragraph || ""}
        onChange={(v) => updateSlide("paragraph", v)}
        placeholder="Professional description..."
      />

      <Divider className="bg-white/5" />

      {/* Key Stats */}
      <div className="flex items-center justify-between">
        <SectionLabel>Key Stats</SectionLabel>
        <Button
          size="sm"
          variant="flat"
          radius="full"
          className="bg-white/5 text-zinc-400 hover:bg-white/10 text-xs"
          startContent={<Plus size={12} />}
          onPress={addStat}
          isDisabled={keyStats.length >= 4}
        >
          Add Stat
        </Button>
      </div>

      {keyStats.map((stat, i) => (
        <div
          key={i}
          className="flex gap-2 items-start p-3 bg-white/5 rounded-xl border border-white/10"
        >
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Input
                size="sm"
                variant="bordered"
                label="Value"
                value={stat.value || ""}
                onChange={(e) => updateStat(i, "value", e.target.value)}
                classNames={{
                  inputWrapper: "bg-white/5 border-white/10 h-10",
                  input: "text-sm text-white",
                  label: "text-[10px] text-zinc-500",
                }}
              />
              <Input
                size="sm"
                variant="bordered"
                label="Unit"
                value={stat.unit || ""}
                onChange={(e) => updateStat(i, "unit", e.target.value)}
                classNames={{
                  inputWrapper: "bg-white/5 border-white/10 h-10",
                  input: "text-sm text-white",
                  label: "text-[10px] text-zinc-500",
                }}
                className="w-24"
              />
            </div>
            <Input
              size="sm"
              variant="bordered"
              label="Label"
              value={stat.label || ""}
              onChange={(e) => updateStat(i, "label", e.target.value)}
              classNames={{
                inputWrapper: "bg-white/5 border-white/10 h-10",
                input: "text-sm text-white",
                label: "text-[10px] text-zinc-500",
              }}
            />
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="text-zinc-500 hover:text-red-400 mt-1"
            onPress={() => removeStat(i)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}

      {keyStats.length === 0 && (
        <p className="text-xs text-zinc-600 text-center py-4 border border-dashed border-white/10 rounded-xl">
          No stats yet. Click "Add Stat" to create one.
        </p>
      )}
    </div>
  );
};

// ── Shared sub-components ──

const SectionLabel = ({ children }) => (
  <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
    {children}
  </h4>
);

const FieldInput = ({ label, value, onChange, placeholder }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
      {label}
    </label>
    <Input
      variant="bordered"
      radius="lg"
      size="md"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      classNames={{
        inputWrapper:
          "bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-primary h-11",
        input: "text-sm text-white placeholder:text-zinc-600",
      }}
    />
  </div>
);

const FieldTextarea = ({ label, value, onChange, placeholder }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
      {label}
    </label>
    <Textarea
      variant="bordered"
      radius="lg"
      minRows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      classNames={{
        inputWrapper:
          "bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-primary",
        input: "text-sm text-white placeholder:text-zinc-600",
      }}
    />
  </div>
);
