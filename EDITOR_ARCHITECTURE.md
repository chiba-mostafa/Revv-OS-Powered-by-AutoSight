# AutoSense Studio — Editor Architecture

> A complete reference for all new editor files, the interface design system, and the full client ↔ backend communication flow.

---

## Table of Contents

1. [Overview](#1-overview)
2. [New Files Added](#2-new-files-added)
3. [Editor Interface — How It Works](#3-editor-interface--how-it-works)
   - [Layout Structure](#31-layout-structure)
   - [State Management](#32-state-management)
   - [Inline Editing](#33-inline-editing)
   - [Floating Toolbar & Panels](#34-floating-toolbar--panels)
   - [Script Dock (Voiceover)](#35-script-dock-voiceover)
   - [Draggable Hotspot System](#36-draggable-hotspot-system)
   - [Add Scene Modal](#37-add-scene-modal)
   - [AutoSense Copilot](#38-autosense-copilot)
   - [Theme System](#39-theme-system)
4. [Backend Communication](#4-backend-communication)
   - [API Endpoints](#41-api-endpoints)
   - [Image Generation Pipeline](#42-image-generation-pipeline)
   - [Voiceover Generation Pipeline](#43-voiceover-generation-pipeline)
   - [AI Scene Generation](#44-ai-scene-generation)
   - [Copilot Agent](#45-copilot-agent)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [Scene Type Reference](#6-scene-type-reference)

---

## 1. Overview

The AutoSense Editor is a **space-saving, full-bleed** story editor. Instead of a traditional multi-column layout with separate content panes, the editor renders the **live presentation preview** at full size and overlays all editing tools directly on top of it. What you see in the editor is pixel-identical to what the viewer sees at runtime.

Key design principles:

- **WYSIWYG** — The editor overlay uses the exact same glass-card component tree as the viewer.
- **Non-destructive layers** — All editing UI (inline overlays, toolbar, hotspot handles) are CSS-positioned layers that sit above the live `StoryContainer`.
- **Drag mode isolation** — When the user drags a hotspot, the entire editing UI (overlay, toolbar, script dock toggle) hides to maximise the canvas.
- **Zustand-first** — All transient editor state (active panel, dragging mode, dirty flag) lives in `useEditorStore`; persistent story data lives in `useStoryStore`.

---

## 2. New Files Added

### Client-Side — `client/src/components/AutoSense/editor/`

| File                     | Type            | Purpose                                                                                                                                                     |
| ------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EditorView.jsx`         | Main layout     | Root editor component — two-column (scene list + full-bleed preview), header bar, save/preview controls                                                     |
| `InlineEditOverlay.jsx`  | Edit layer      | Renders editable fields directly on top of the live preview in the exact same glass-card layout as the viewer; fully theme-aware (Cinematic / Minimal Tech) |
| `FloatingToolbar.jsx`    | UI control      | Compact vertical icon bar on the right edge of the preview; opens floating popover panels                                                                   |
| `ScriptDock.jsx`         | Voiceover UI    | Collapsible bottom dock for reading, editing, and regenerating the scene's voiceover script                                                                 |
| `EditorHotspotLayer.jsx` | Hotspot editing | Two exports: `EditorHotspotLayer` (draggable dots rendered inside the Ken Burns animated div) and `HotspotDragBar` (fixed instruction banner)               |
| `AddSceneModal.jsx`      | Modal           | Full-featured modal to manually create or AI-generate a new scene                                                                                           |
| `CopilotChat.jsx`        | AI chat         | Sliding chat panel for the AutoSense Copilot AI assistant                                                                                                   |

### Client-Side — `client/src/components/AutoSense/editor/panels/`

| File                 | Purpose                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LayoutPanel.jsx`    | Change scene composition (`split-image-left`, `full-bleed`, etc.), content alignment, and presentation theme (Cinematic / Minimal Tech)                                            |
| `BadgesPanel.jsx`    | Add/remove/reorder achievement badges on the current scene                                                                                                                         |
| `HotspotsPanel.jsx`  | Create, label, configure, and enter drag-mode for hotspot pins                                                                                                                     |
| `ImagePanel.jsx`     | Upload a custom image (server-side Supabase upload via `POST /api/editor/upload-image`), trigger AI image regeneration, fullscreen lightbox viewer, and hotspot reset on new image |
| `AnimationPanel.jsx` | Adjust image motion (slow-zoom, pan, static) and content transition (fade-up, slide-in)                                                                                            |

### Client-Side — `client/src/components/AutoSense/store/`

| File                | Purpose                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useEditorStore.js` | All transient editor UI state (active panel, editing field, drag mode, save state, voice selection, AI loading flags); `getAvailablePanels()` returns Layout for all scene types |

### Server-Side — `server/src/`

| File                               | Purpose                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `controllers/editorController.js`  | Express route handlers for all `/api/editor/*` endpoints, including `handleUploadImage` (multer multipart)                                       |
| `routes/editorRoutes.js`           | Express router; configures multer (`memoryStorage`, 10 MB limit) and mounts all editor routes                                                    |
| `services/editorService.js`        | Business logic: voiceover regeneration (+ subtitle generation), image upload to Supabase, image regeneration, AI scene generation, Copilot agent |
| `services/media/imageGenerator.js` | Image generation with paid Pollinations fallback → free Pollinations → Supabase upload                                                           |

---

## 3. Editor Interface — How It Works

### 3.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER BAR  [← Back] [Car Title ●]         [Save] [Preview] [✦]│
├──────────────┬──────────────────────────────────────────────────┤
│  SCENE LIST  │           FULL-BLEED PREVIEW                     │
│  (220px)     │  ┌────────────────────────────────────────────┐  │
│              │  │  StoryContainer (live presentation)        │  │
│  [Intro]     │  │                                            │  │
│  [Slide 1] ← │  │     InlineEditOverlay (z-40)               │  │
│  [Slide 2]   │  │     (editable fields over live preview)    │  │
│  [3D Tech]   │  │                                            │  │
│  [Outro]     │  │                              ┌─────────┐   │  │
│              │  │                              │Floating │   │  │
│  [+ Add]     │  │                              │Toolbar  │   │  │
│              │  │                              └─────────┘   │  │
│ [◄] 2/5 [►] │  │  ┌─────── ScriptDock (bottom) ──────────┐  │  │
│         [🗑] │  │  │ 🎙 Voiceover  [▶] [↻]  [• Zeus ▾]   │  │  │
│              │  │  └─────────────────────────────────────┘  │  │
│              │  └────────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────┘
```

The scene list supports **drag-to-reorder** via Framer Motion's `Reorder.Group`. Each scene shows a thumbnail (image or scene-type icon), title, and type badge.

### 3.2 State Management

Two Zustand stores divide responsibility cleanly:

**`useEditorStore`** — ephemeral UI state, never persisted:

```
activePanel          — which floating panel is open (null = all closed)
editingField         — which text field is currently being edited inline
draggingHotspotId    — id of the hotspot being repositioned (null = none)
isScriptDockOpen     — whether the voiceover dock is expanded
isCopilotOpen        — whether the copilot chat panel is visible
isAddSceneOpen       — whether the Add Scene modal is open
isDirty / isSaving   — save state (dirty dot in header)
selectedVoice        — active TTS voice id
isRegeneratingVoiceover / isRegeneratingImage / isGeneratingScene — AI loading flags
```

**`useStoryStore`** — persistent story data and navigation:

```
storyData               — full story JSON (car metadata + all scenes)
scenes                  — computed array of scene objects
currentSceneIndex       — active scene being viewed/edited
getCurrentScene()       — returns the scene at currentSceneIndex
updateCurrentScene()    — merges partial updates into the active scene
updateSceneAtIndex()    — merges partial updates into a scene by index
updateAllScenesTheme()  — atomically sets layout.theme on every scene (used by LayoutPanel)
goToScene(index)        — navigates to a different scene
addScene()              — appends a scene and auto-navigates to it
removeScene()           — deletes a scene by index
```

### 3.3 Inline Editing

`InlineEditOverlay` renders an invisible `z-40` div covering the entire preview. Inside it, the **exact same glass-card JSX structure** as `SlideContentLayer` is reproduced — but every text node is replaced with an `EditableField` component.

**How `EditableField` works:**

1. In view mode it renders a `<span>` styled to match the original text.
2. A hidden sizer `<span>` behind it keeps the layout stable regardless of content length.
3. Clicking the span sets `editingField` in the store and reveals an `<input>` or `<textarea>` absolutely positioned over the exact same area.
4. On blur or Enter, the value is written back to `useStoryStore` and `markDirty()` is called.

**Scene type support:**

- `slide_view` — editable headline, paragraph, key stats (values + labels), subtitle
- `intro_view` — editable title, subtitle, start button label
- `outro_view` — editable headline, subheadline, CTA button labels
- `tech_view` — same as slide_view + `TechCameraControls` (primary / secondary / tertiary / free-roam camera buttons rendered above the glass card)

**Theme awareness:** `InlineEditOverlay` derives `isMinimalTech` using a two-level priority:

1. Per-scene override: `scene.layout?.theme === "minimal_tech"` (if explicitly set)
2. Global fallback: `storyData.meta.template === "minimaltech"`

This drives all visual changes — glass card colours, badge tints, stat box stroke colours, typography weights.

**Auto-hide:** `InlineEditOverlay` returns `null` when `draggingHotspotId` is set, allowing unobstructed hotspot dragging.

### 3.4 Floating Toolbar & Panels

`FloatingToolbar` is a compact vertical pill docked to the right edge of the preview canvas (absolute-positioned `right-4`, `top-1/2`).

Available panels per scene type:

| Panel     | slide_view | tech_view | intro_view | outro_view |
| --------- | ---------- | --------- | ---------- | ---------- |
| Layout    | ✓          | ✓         | ✓          | ✓          |
| Badges    | ✓          | ✓         | —          | —          |
| Hotspots  | ✓          | —         | —          | —          |
| Image     | ✓          | —         | ✓          | ✓          |
| Animation | ✓          | ✓         | ✓          | ✓          |

> **Note:** Layout panel is available for all scene types so users can switch the presentation theme on any scene.

Clicking an icon toggles the panel. The active panel opens as a `320px` wide popover to the left of the icon bar, animated with Framer Motion (`opacity + x + scale`). The toolbar **hides completely** while `draggingHotspotId` is set so the panel doesn't obscure the hotspot positioning canvas.

### 3.5 Script Dock (Voiceover)

`ScriptDock` is a floating bottom-center dock, only shown for `slide_view` and `tech_view` scenes.

**Collapsed state:** Shows a pill with a microphone icon, word count, and estimated duration (`~150 wpm`).

**Expanded state:**

- Resizable `<textarea>` for editing the voiceover script.
- Voice selector dropdown (9 Deepgram Aura-2 voices across EN and FR).
- Regenerate button — calls `POST /api/editor/regenerate-voiceover` and writes the returned `audio_url` **and `subtitles` array** back into the scene. Subtitles are word-by-word SRT entries generated server-side from the Deepgram TTS timing data immediately after the audio is produced.
- Audio player with play/pause, a custom progress bar, and elapsed/total time display.
- Live word count and character count.

Editing the script sets `scriptChanged = true`, which enables the regenerate button. Any edit also calls `markDirty()`.

### 3.6 Draggable Hotspot System

Hotspot editing involves two separate components that are deliberately split to solve a CSS transform conflict with Ken Burns animation.

#### EditorHotspotLayer (inside Ken Burns div)

Rendered **inside** `SceneLayer`'s `motion.div` that drives the Ken Burns zoom animation. This ensures hotspot dots scale and translate with the image — exactly as they do in the live viewer. Replaces `HotspotLayer` conditionally when `editorMode` is true.

Each `DraggableHotspot`:

- Renders as a plain `w-4 h-4` white circle (no icon) with a pulsing ring animation.
- Clicking it selects it (sets `draggingHotspotId`), turning the dot purple.
- While selected, `onPointerDown` starts tracking `pointermove` on `window`, computing percentage positions relative to the container's bounding rect.
- Position is clamped to `[2%, 98%]` in both axes and written to `updateCurrentScene({ hotspots: [...] })` in real time.
- A small tooltip below the dot shows the label and live `(x%, y%)` coordinates.
- `PearlyHoverCard` is only shown on hover when NOT in drag mode.

#### HotspotDragBar (outside Ken Burns div)

Rendered directly in `EditorView` at `z-50`, outside the animated tree. Shows the instruction banner: `"Drag to reposition hotspot"` with an X button to exit drag mode. Animated with `AnimatePresence` so it smoothly appears/disappears.

#### Ken Burns freeze

When `draggingHotspotId` is set, `EditorView` passes `freezeAnimation={true}` to `StoryContainer` → `SceneLayer`, which adds the `draggingHotspotId` to the `isAnimationPaused` condition — preventing the image from zooming while the user is precisely positioning a hotspot.

### 3.7 Add Scene Modal

`AddSceneModal` uses HeroUI's `Modal` with `z-[200]` on both the wrapper and backdrop (the editor page sits at `z-[100]`, so this was required to render above it).

**Two creation modes:**

**Manual mode:**

- Pick scene type (Intro / Narrative Slide / 3D Tech View / Outro)
- Enter headline and paragraph
- Choose composition layout
- For `tech_view`: choose a tech mode (PERFORMANCE / SAFETY / UTILITY)
- Scene scaffolded locally, no AI call

**Tech view data population:** When adding a `tech_view` manually, `buildManualScene()` pulls real values from `storyData.car_specs` to populate `key_stats` and `tech_config`:

| Mode        | `key_stats` drawn from                        | `tech_config` fields set                              |
| ----------- | --------------------------------------------- | ----------------------------------------------------- |
| PERFORMANCE | `hp`, `torque_nm`, `zero_to_sixty_sec`        | `drivetrain`, `hp`, `torque_nm`, `zero_to_sixty_sec`  |
| SAFETY      | `airbags`, `rating_text`, `assist_systems[0]` | `airbag_count`, `has_front/rear_sensors`, `systems[]` |
| UTILITY     | `length_mm`, `trunk_capacity_l`, `seats`      | `cargo_capacity_l`, `seats`, all dimension fields     |

**AI-Assisted mode:**

- User writes a natural-language prompt (e.g. "Add a slide about the panoramic sunroof")
- Calls `POST /api/editor/generate-scene`
- Backend LLM generates the full scene JSON with layout, content, voiceover, and then triggers `generateImage()` for the scene's image
- The complete scene (with image URL) is inserted into the story

After insertion, `useStoryStore.addScene()` auto-navigates to the new scene index.

### 3.9 Theme System

The editor supports two presentation themes: **Cinematic** (default, dark cinematic glass) and **Minimal Tech** (bright, monochrome data-card aesthetic).

#### Theme Priority

Every component that renders scene content resolves the active theme using a two-level priority chain:

```js
const isMinimalTech =
  scene.layout?.theme != null
    ? scene.layout.theme === "minimal_tech" // 1. per-scene explicit override
    : storyData?.meta?.template === "minimaltech"; // 2. global story template
```

This logic is implemented identically in all seven theme-aware components:
`InlineEditOverlay`, `SlideContentLayer`, `SceneLayer`, `CanvasWrapper`, `HotspotLayer`, `StoryContainer`, `ChatbotWidget`.

#### Switching Themes

`LayoutPanel` exposes two toggle buttons (Film icon = Cinematic, Cpu icon = Minimal Tech) at the top of the panel. Clicking either calls `updateAllScenesTheme(value)`, which atomically sets `layout.theme` on **every scene** in a single Zustand `set()` call, then `markDirty()`. This ensures all scenes switch visually at once with no flash.

#### Per-Scene vs Global

| Where set             | Field                | Value                            |
| --------------------- | -------------------- | -------------------------------- |
| Story-level (default) | `meta.template`      | `"cinematic"` / `"minimaltech"`  |
| Per-scene override    | `scene.layout.theme` | `"cinematic"` / `"minimal_tech"` |

The LayoutPanel default button selection is computed as:

1. Check `scene.layout?.theme` first (explicit override)
2. Fall back to `storyData.meta.template`
3. Default to `"cinematic"` if neither is set

#### Visual Differences

| Aspect        | Cinematic                     | Minimal Tech                   |
| ------------- | ----------------------------- | ------------------------------ |
| Background    | Dark gradient / Ken Burns     | Near-white with grid overlay   |
| Card style    | `backdrop-blur` frosted glass | Sharp white card, black border |
| Badge tint    | Colour-matched to brand       | Monochrome, uppercase serif    |
| Bloom / HDR   | Enabled (Three.js ACESFilmic) | Disabled (LinearToneMapping)   |
| 3D lighting   | Dramatic warm key light       | Neutral flat studio light      |
| Hotspot rings | Purple pulsing rings          | Black circle outline           |

---

### 3.8 AutoSense Copilot

`CopilotChat` is a right-side sliding panel (`z-[150]`) with a backdrop. Triggered by the `✦` sparkles button in the header.

**How it sends context:**
The client builds a lightweight `storySummary` (car info + scene titles/types/snippets) to avoid sending the entire story JSON on every message. The `fullStory` (complete JSON) is also sent — the backend extracts `car_specs` from it to inject real vehicle specifications into the LLM prompt.

**Quick suggestion chips** are shown when the chat is empty:

- "Add a tech view showing the exact trunk capacity"
- "Make scene 2 focus on safety instead"
- "Switch the theme to minimal tech and translate everything to French"
- "Rewrite all voiceover scripts in a sportier tone"

**Seven action types** are supported:

| Action              | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `UPDATE_SCENE`      | Merge partial updates into one scene                                     |
| `ADD_SCENE`         | Insert a new scene (slide_view or tech_view with full tech_config)       |
| `REMOVE_SCENE`      | Delete a scene                                                           |
| `GO_TO_SCENE`       | Navigate the editor to a scene                                           |
| `REGENERATE_SCENE`  | Rewrite text + fire background image & voiceover regeneration            |
| `UPDATE_META`       | Change global metadata (theme, language); propagates theme to all scenes |
| `UPDATE_ALL_SCENES` | Batch-update text across all scenes + batch voiceover regeneration       |

**Action execution:** `applyActions()` is async. It iterates the `actions` array sequentially:

- **UPDATE_SCENE / ADD_SCENE / REMOVE_SCENE / GO_TO_SCENE** — immediate store mutations.
- **REGENERATE_SCENE** — applies text updates instantly, marks the scene as regenerating (loading overlay), then fires parallel background API calls to `regenerate-image` and `regenerate-voiceover`. The loading overlay disappears when both resolve.
- **UPDATE_META** — calls `store.updateMeta()` + `store.updateAllScenesTheme()` if template changed.
- **UPDATE_ALL_SCENES** — applies all text updates, then batch-regenerates voiceovers for every affected scene in parallel. Each scene shows its own loading overlay while its voiceover is being generated.

**Regeneration loading overlay:** When a scene is in the `regeneratingScenes` set (tracked in `useEditorStore`), `EditorView` renders a translucent `z-45` overlay with a spinner and "Regenerating scene…" label over the preview. This provides instant visual feedback while background API calls complete.

---

## 4. Backend Communication

### 4.1 API Endpoints

All editor endpoints are under `POST /api/editor/`.

| Endpoint                                | Handler                     | Purpose                                                                                                  |
| --------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /api/editor/regenerate-voiceover` | `handleRegenerateVoiceover` | Generate new TTS audio + word-level subtitles for a voiceover script                                     |
| `POST /api/editor/regenerate-image`     | `handleRegenerateImage`     | Generate a new AI image for a scene                                                                      |
| `POST /api/editor/upload-image`         | `handleUploadImage`         | Accept a `multipart/form-data` file upload, store in Supabase `story_images/uploads/`, return public URL |
| `POST /api/editor/generate-scene`       | `handleGenerateScene`       | Use AI to create a complete new scene JSON + image                                                       |
| `POST /api/editor/copilot`              | `handleCopilot`             | Send a chat message to the Copilot agent and receive story mutation actions                              |

### 4.2 Image Generation Pipeline

`imageGenerator.js` implements a three-tier fallback strategy:

```
User triggers "Regenerate Image"
         │
         ▼
POLLINATIONS_API_KEY set?
    ├── YES → Try gen.pollinations.ai (paid, model: klein-large, 1920×1080)
    │              │
    │         ┌────┴─────┐
    │        200 OK     4xx/error
    │         │          │
    │    Download bytes  └─── WARN + fall through ──┐
    │         │                                      │
    │         ▼                                      ▼
    │   Upload to Supabase storage          Try image.pollinations.ai
    │   bucket: story_images/generated/     (free, model: flux, 1920×1080)
    │         │                                      │
    │         └──────────── public URL ◄────── download + upload to Supabase
    │
    └── NO  → Skip to free endpoint (same as above)

If ALL attempts fail → return raw redirect URL as last resort
```

The Supabase `story_images` bucket is organised as:

```
story_images/
  generated/
    <timestamp>_<seed>.jpg
```

### 4.3 Voiceover Generation Pipeline

```
ScriptDock → POST /api/editor/regenerate-voiceover
  { text, voice, sceneId, language }
         │
         ▼
editorService.regenerateVoiceover()
         │
         ▼
Deepgram Aura-2 TTS API
  deepgram.speak.request({
    model: voice,       // e.g. "aura-2-zeus-en"
    text: text
  })
         │
         ▼
Stream → Buffer → Upload to Supabase
  bucket: voiceovers/
  path: editor/<sceneId>_<timestamp>.mp3
         │
         ▼
Generate word-level SRT subtitles
  transcriptionService.transcribeBuffer(audioBuffer)
  → Deepgram STT with word timestamps
  → subtitleParser.buildSubtitles(words)
  → returns subtitles[]
         │
         ▼
Response: { audio_url, subtitles }
         │
         ▼
Client writes to scene: { audio_url, subtitles }
markDirty() — user must Save to persist
```

### 4.4 Image Upload Pipeline

```
ImagePanel → POST /api/editor/upload-image  (multipart/form-data)
  file: <File>
         │
         ▼
multer memoryStorage  (10 MB limit, images only)
  → req.file.buffer available in handler
         │
         ▼
editorService.uploadImage(buffer, mimetype, originalname)
         │
         ▼
Supabase storage upload
  bucket: story_images
  path: uploads/<timestamp>_<originalname>
  contentType: <mimetype>
         │
         ▼
getPublicUrl()  →  { publicUrl }
         │
         ▼
Response: { image_url: publicUrl }
         │
         ▼
Client: updateCurrentScene({ image_url })
  clearAllHotspots()  ← hotspots referencing old image are wiped
  markDirty()
```

If Supabase upload fails the client falls back to a `FileReader` data URL so the user always sees their chosen image even without network persistence.

### 4.5 AI Scene Generation

```
AddSceneModal (AI mode) → POST /api/editor/generate-scene
  { prompt, car, existingScenes, insertAfterIndex }
         │
         ▼
editorService.generateScene()
         │
         ├─ Build system prompt (rules: only slide_view, exact JSON schema)
         ├─ Build user prompt (car context + existing scenes summary + insert position)
         │
         ▼
analystModel (LangChain LLM)
  → returns JSON: full scene object with layout, content, voiceover, visual_direction
         │
         ▼
Parse + validate JSON
  Force: type = "slide_view", audio_url = null
         │
         ▼
generateImage(imagePrompt from visual_direction)
  → Pollinations + Supabase (see §4.2)
         │
         ▼
Response: { scene: { ...fullSceneObject, image_url } }
         │
         ▼
Client: useStoryStore.addScene(scene, afterIndex)
  → auto-navigates to new scene
  → markDirty()
```

### 4.6 Copilot Agent

```
CopilotChat → POST /api/editor/copilot
  { message, storySummary, fullStory, currentSceneIndex, use_aws_models }
         │
         ▼
editorService.processCopilotMessage()
         │
         ├─ System prompt includes:
         │    • Car identity (year/make/model)
         │    • Real car specs (HP, torque, 0-60, airbags, trunk, dimensions…)
         │    • Total scene count + current theme + language
         │    • Scene-by-scene summary (type, theme_tag, headline, paragraph)
         │    • Current scene index
         │    • Full action schema documentation (7 action types)
         │    • Complete tech_view scene JSON schema + tech_config per mode
         │    • Compound action examples
         │
         ▼
activeModel.invoke([SystemMessage, HumanMessage])
         │
         ▼
Parse JSON response:
  { message: "...", actions: [...] }
         │
         ▼
Response sent to client
         │
         ▼
CopilotChat.applyActions(actions):   [async, sequential]
  "UPDATE_SCENE"      → store.updateSceneAtIndex(index, updates)
  "ADD_SCENE"         → store.addScene(scene, afterIndex)
  "REMOVE_SCENE"      → store.removeScene(index)
  "GO_TO_SCENE"       → store.goToScene(index)
  "REGENERATE_SCENE"  → store.updateSceneAtIndex(index, updates)
                        + addRegeneratingScene(index)
                        + background: POST /regenerate-image + /regenerate-voiceover
                        + on resolve: update image_url / audio_url, remove overlay
  "UPDATE_META"       → store.updateMeta(updates)
                        + if template changed: store.updateAllScenesTheme(theme)
  "UPDATE_ALL_SCENES" → apply all text updates per scene
                        + batch POST /regenerate-voiceover for each affected scene
                        + per-scene loading overlays while regenerating
         │
         ▼
All changes are in-memory. User must press Save to persist to Supabase.
```

---

## 5. Data Flow Diagrams

### Save Flow

```
User clicks Save
       │
       ▼
useEditorStore.setIsSaving(true)
       │
       ▼
useStoryStore.getState().storyData  (latest snapshot)
       │
       ▼
supabase.from("stories")
  .update({ content: storyData })
  .eq("id", storyId)
       │
       ▼
markClean()  →  dirty dot disappears from header
```

### Hotspot Drag Flow

```
User clicks hotspot dot
       │
       ▼
setDraggingHotspot(id)
  → InlineEditOverlay returns null
  → FloatingToolbar returns null
  → SceneLayer freezes Ken Burns animation
  → HotspotDragBar appears (instruction banner)
       │
       ▼
User drags (pointermove on window)
  → EditorHotspotLayer.updateHotspotPosition(id, x%, y%)
  → updateCurrentScene({ hotspots: [...] })   (live, every frame)
  → markDirty()
       │
       ▼
User releases pointer / clicks X on DragBar
  → clearDraggingHotspot()
  → All hidden UI reappears
  → Ken Burns resumes
```

---

## 6. Scene Type Reference

| Type         | Editable Fields                                      | Panels Available                           | Hotspots | Voiceover |
| ------------ | ---------------------------------------------------- | ------------------------------------------ | -------- | --------- |
| `intro_view` | title, subtitle, start button label                  | Layout, Image, Animation                   | ✗        | ✗         |
| `slide_view` | headline, paragraph, key stats, subtitle             | Layout, Badges, Hotspots, Image, Animation | ✓        | ✓         |
| `tech_view`  | headline, paragraph, key stats + camera view buttons | Layout, Badges, Animation                  | ✗        | ✓         |
| `outro_view` | headline, subheadline, CTA button labels             | Layout, Image, Animation                   | ✗        | ✗         |

> **Note:** `tech_view` scenes use a 3D WebGL model and custom camera views (primary / secondary / tertiary / free-roam). The `TechCameraControls` component inside `InlineEditOverlay` lets the editor switch camera angles while editing.
