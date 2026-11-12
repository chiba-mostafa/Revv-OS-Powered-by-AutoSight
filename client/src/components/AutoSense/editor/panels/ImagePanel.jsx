import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Textarea, Button, Divider } from "@heroui/react";
import {
  Image,
  RefreshCw,
  Upload,
  Sparkles,
  ImageUp,
  X,
  ZoomIn,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStoryStore } from "../../../../store/useStoryStore";
import { useEditorStore } from "../../store/useEditorStore";
import axios from "axios";
import { API_BASE } from "../../../../config/api";

export const ImagePanel = () => {
  const { getCurrentScene, updateCurrentScene, storyData } = useStoryStore();
  const { markDirty, isRegeneratingImage, setRegeneratingImage } =
    useEditorStore();
  const scene = getCurrentScene();
  const [aiPrompt, setAiPrompt] = useState("");
  const [mode, setMode] = useState("ai"); // "ai" | "upload"
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileInputRef = useRef(null);

  if (!scene) return null;

  const imageUrl =
    scene.image_url ||
    scene.intro_content?.background_image ||
    scene.outro_content?.image_url;

  const hasIntroVideo =
    scene.type === "intro_view" && !!scene.intro_content?.background_video;
  const isIntroVideoHidden = !!scene.intro_content?.hide_video;
  const videoUrl = hasIntroVideo ? scene.intro_content?.background_video : null;
  const shouldShowVideo = !!videoUrl && !isIntroVideoHidden;
  const previewLabel = shouldShowVideo
    ? "Intro Video"
    : hasIntroVideo
      ? "Intro Image (Video Hidden)"
      : "Current Image";

  const applyImageUrl = (url, { clearHotspots = false } = {}) => {
    const hotspotReset = clearHotspots ? { hotspots: [] } : {};
    if (scene.type === "intro_view") {
      updateCurrentScene({
        image_url: url,
        intro_content: { background_image: url },
        ...hotspotReset,
      });
    } else if (scene.type === "outro_view") {
      updateCurrentScene({
        image_url: url,
        outro_content: { image_url: url },
        ...hotspotReset,
      });
    } else {
      updateCurrentScene({ image_url: url, ...hotspotReset });
    }
    markDirty();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB max

    // Create a persistent data URL for preview and fallback
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    setUploadPreview(dataUrl);

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("sceneId", scene.scene_id || scene.id || "scene");

      const res = await axios.post(
        `${API_BASE}/api/editor/upload-image`,
        formData,
      );

      if (res.data.success && res.data.image_url) {
        applyImageUrl(res.data.image_url, { clearHotspots: true });
      } else {
        // Server didn't return a URL — use the data URL as local fallback
        console.warn("Upload response missing image_url, using local fallback");
        applyImageUrl(dataUrl, { clearHotspots: true });
      }
    } catch (err) {
      // Server unreachable or error — apply the data URL so the image at least shows locally
      console.error(
        "Image upload to server failed, using local image:",
        err?.response?.data || err.message,
      );
      applyImageUrl(dataUrl, { clearHotspots: true });
    } finally {
      setUploadPreview(null);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAiRegenerate = async () => {
    setRegeneratingImage(true);
    try {
      const car = storyData?.car || {};
      const res = await axios.post(`${API_BASE}/api/editor/regenerate-image`, {
        prompt: aiPrompt.trim() || null,
        image_url: imageUrl || null,
        scene: {
          scene_id: scene.id || scene.scene_id,
          type: scene.type,
          theme_tag: scene.theme_tag,
          visual_direction: scene.visual_direction,
          layout: scene.layout,
          slide_content: {
            alignment: scene.slide_content?.alignment,
          },
        },
        car: {
          year: car.year,
          make: car.make,
          model: car.model,
          body_type: car.body_type,
          color: car.color,
        },
      });

      if (res.data.success) {
        applyImageUrl(res.data.image_url, { clearHotspots: true });
      }
    } catch (err) {
      console.error("Failed to regenerate image:", err);
    } finally {
      setRegeneratingImage(false);
    }
  };

  const handleToggleIntroVideo = () => {
    if (!hasIntroVideo) return;
    updateCurrentScene({
      intro_content: { hide_video: !isIntroVideoHidden },
    });
    markDirty();
  };

  return (
    <div className="space-y-5">
      {/* Current Image / Video Preview */}
      <div className="space-y-2">
        <SectionLabel>{previewLabel}</SectionLabel>
        {shouldShowVideo ? (
          <div
            onClick={() => setLightboxOpen(true)}
            className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-zinc-900 cursor-pointer group"
          >
            <video
              src={videoUrl}
              poster={imageUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-[10px] text-white/70 font-medium">
              VIDEO
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
              <ZoomIn size={20} className="text-white" />
            </div>
          </div>
        ) : imageUrl ? (
          <div
            onClick={() => setLightboxOpen(true)}
            className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-zinc-900 cursor-pointer group"
          >
            <img
              src={imageUrl}
              alt="Scene"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            {hasIntroVideo && isIntroVideoHidden && (
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-[10px] text-white/70 font-medium">
                VIDEO HIDDEN
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
              <ZoomIn size={20} className="text-white" />
            </div>
          </div>
        ) : (
          <div className="aspect-video bg-zinc-900 rounded-xl border border-dashed border-white/10 flex items-center justify-center">
            <div className="text-center">
              <Image size={24} className="text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">No image set</p>
            </div>
          </div>
        )}
        {hasIntroVideo && (
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
            <div className="text-[11px] text-zinc-400">
              {isIntroVideoHidden
                ? "Intro video hidden. Showing image instead."
                : "Intro video visible. Showing video."}
            </div>
            <button
              type="button"
              onClick={handleToggleIntroVideo}
              className="text-[11px] font-semibold text-primary hover:text-primary/80"
            >
              {isIntroVideoHidden ? "Show Video" : "Show Image"}
            </button>
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox (portalled to body) */}
      {lightboxOpen &&
        (videoUrl || imageUrl) &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X size={20} />
            </button>
            {shouldShowVideo ? (
              <video
                src={videoUrl}
                poster={imageUrl}
                autoPlay
                loop
                muted
                playsInline
                controls
                className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={imageUrl}
                alt="Scene full view"
                className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>,
          document.body,
        )}

      <Divider className="bg-white/5" />

      {/* Mode Switcher */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
        <button
          onClick={() => setMode("ai")}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
            mode === "ai"
              ? "bg-primary/20 text-primary"
              : "text-zinc-400 hover:text-white",
          )}
        >
          <Sparkles size={12} /> AI Generate
        </button>
        <button
          onClick={() => setMode("upload")}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
            mode === "upload"
              ? "bg-primary/20 text-primary"
              : "text-zinc-400 hover:text-white",
          )}
        >
          <Upload size={12} /> Upload
        </button>
      </div>

      {/* AI Mode */}
      {mode === "ai" && (
        <div className="space-y-3">
          <Textarea
            variant="bordered"
            radius="lg"
            minRows={3}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Optional: Describe the shot you want (leave empty for auto-generate based on scene context)..."
            classNames={{
              inputWrapper:
                "bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-primary",
              input: "text-sm text-white placeholder:text-zinc-600",
            }}
          />
          <p className="text-[10px] text-zinc-600">
            The AI will generate an image matching the car&apos;s visual
            identity and scene context.
          </p>
          <Button
            fullWidth
            size="md"
            radius="xl"
            isLoading={isRegeneratingImage}
            onPress={handleAiRegenerate}
            className="bg-primary text-white font-medium"
            startContent={!isRegeneratingImage && <RefreshCw size={16} />}
          >
            {isRegeneratingImage ? "Generating..." : "Generate New Image"}
          </Button>
        </div>
      )}

      {/* Upload Mode */}
      {mode === "upload" && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {uploadPreview && (
            <div className="relative rounded-xl overflow-hidden border border-primary/30 aspect-video bg-zinc-900">
              <img
                src={uploadPreview}
                alt="Upload preview"
                className="w-full h-full object-cover opacity-70"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 text-primary text-xs font-medium">
                  <RefreshCw size={14} className="animate-spin" />
                  Uploading...
                </div>
              </div>
            </div>
          )}

          <Button
            fullWidth
            size="md"
            radius="xl"
            isLoading={isUploading}
            onPress={() => fileInputRef.current?.click()}
            className="bg-white/10 text-white font-medium hover:bg-white/15"
            startContent={!isUploading && <ImageUp size={16} />}
          >
            {isUploading ? "Uploading..." : "Choose Image"}
          </Button>
          <p className="text-[10px] text-zinc-600">
            Upload a JPG, PNG, or WebP image (max 10MB). The image will be
            stored and applied to this scene.
          </p>
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
