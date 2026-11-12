# AutoSense Client — Complete Architecture Reference

> A comprehensive deep-dive into every file in the `client/` directory, the component hierarchy, state management, 3D engine, AutoSense player, story editor, and all page flows.

---

## Table of Contents

1. [Overview & Stack](#1-overview--stack)
2. [File Map — Every File Explained](#2-file-map--every-file-explained)
3. [Configuration & Build System](#3-configuration--build-system)
4. [App Bootstrap & Routing](#4-app-bootstrap--routing)
5. [State Management](#5-state-management)


    - [Redux Store (SaaS Platform)](#51-redux-store-saas-platform)
    - [Auth Slice](#52-auth-slice)
    - [Dealer Slice](#53-dealer-slice)
    - [Inventory Slice](#54-inventory-slice)
    - [Studio Slice](#55-studio-slice)
    - [Microsite Slice](#56-microsite-slice)
    - [Story Store (Zustand — Player/Editor)](#57-story-store-zustand--playereditor)
    - [Editor Store (Zustand — Editor UI)](#58-editor-store-zustand--editor-ui)
    - [AI UX Store (Zustand)](#59-ai-ux-store-zustand)
    - [Chatbot Store (Zustand)](#510-chatbot-store-zustand)

6. [Layouts](#6-layouts)


    - [Auth Layout](#61-auth-layout)
    - [Dashboard Layout](#62-dashboard-layout)
    - [Onboarding Layout](#63-onboarding-layout)
    - [Public Layout](#64-public-layout)

7. [Pages — Auth & Onboarding](#7-pages--auth--onboarding)


    - [Login](#71-login)
    - [Register](#72-register)
    - [Onboarding Flow](#73-onboarding-flow)

8. [Pages — Landing](#8-pages--landing)
9. [Pages — Dashboard](#9-pages--dashboard)


    - [Dashboard Home](#91-dashboard-home)
    - [Inventory Page](#92-inventory-page)
    - [Studio Page](#93-studio-page)

10. [Pages — Studio Wizard (Story Generation)](#10-pages--studio-wizard-story-generation)
    - [Studio Wizard](#101-studio-wizard)
    - [Car Selector Step](#102-car-selector-step)
    - [Config Step](#103-config-step)
    - [Generation Visualizer](#104-generation-visualizer)
11. [Pages — Public Microsite](#11-pages--public-microsite)
    - [Showroom](#111-showroom)
    - [Vehicle Detail](#112-vehicle-detail)
12. [Dashboard Components](#12-dashboard-components)
    - [Add Car Modal](#121-add-car-modal)
    - [Inventory Table](#122-inventory-table)
    - [Specs Drawer](#123-specs-drawer)
    - [Studio Card](#124-studio-card)
13. [Microsite Components](#13-microsite-components)
14. [Showcase (3D Vehicle Display)](#14-showcase-3d-vehicle-display)
15. [AutoSense Engine — Overview](#15-autosense-engine--overview)
16. [AutoSense Loader](#16-autosense-loader)
17. [AutoSense 3D System](#17-autosense-3d-system)
    - [Canvas Wrapper](#171-canvas-wrapper)
    - [Car Model](#172-car-model)
    - [Camera Controller](#173-camera-controller)
    - [Environment](#174-environment)
    - [Performance Modules](#175-performance-modules)
    - [Safety Modules](#176-safety-modules)
    - [Utility Modules](#177-utility-modules)
18. [AutoSense Layer System](#18-autosense-layer-system)
    - [Story Container](#181-story-container)
    - [Scene Layer](#182-scene-layer)
    - [Slide Content Layer](#183-slide-content-layer)
19. [AutoSense Interactive System](#19-autosense-interactive-system)
    - [Hotspot Layer](#191-hotspot-layer)
    - [Breathing Hotspot](#192-breathing-hotspot)
    - [Pearly Hover Card](#193-pearly-hover-card)
20. [AutoSense Playback System](#20-autosense-playback-system)
    - [Playback View](#201-playback-view)
    - [Playback Controls](#202-playback-controls)
    - [Audio Player](#203-audio-player)
    - [Subtitles](#204-subtitles)
    - [Timeline](#205-timeline)
    - [Keyboard Shortcuts](#206-keyboard-shortcuts)
21. [AutoSense AI System (Chatbot)](#21-autosense-ai-system-chatbot)
    - [Chatbot Widget](#211-chatbot-widget)
    - [Chat Input](#212-chat-input)
    - [Chat Message](#213-chat-message)
    - [Chatbot Service](#214-chatbot-service)
    - [AI Intent Orchestrator](#215-ai-intent-orchestrator)
22. [AutoSense Editor (Covered in EDITOR_ARCHITECTURE.md)](#22-autosense-editor)
23. [Services & Utilities](#23-services--utilities)
24. [Environment Variables](#24-environment-variables)
25. [Full Component Tree](#25-full-component-tree)

---

## 1. Overview & Stack

The AutoSense Client is a React 19 single-page application that serves **three distinct user experiences** from one codebase:

1. **Axle Dashboard (B2B SaaS)** — A professional dealer management platform for inventory, story generation, and editing. Protected by Supabase Auth.
2. **AutoSense Player (B2C Experience)** — A full-screen cinematic story viewer with 3D digital twin, voiceover, subtitles, and interactive hotspots.
3. **Public Microsite (B2C Storefront)** — A white-label vehicle showroom with filtering, detail pages, 3D preview, and 360° interior.

### Technology Stack

| Component             | Technology                                               |
| --------------------- | -------------------------------------------------------- |
| Framework             | React 19.2                                               |
| Build Tool            | Vite 7.2                                                 |
| Language              | JavaScript (JSX), ES Modules                             |
| Styling               | Tailwind CSS v4.1 + HeroUI v2.8 (NextUI fork)            |
| 3D Engine             | Three.js 0.182 + React Three Fiber (R3F) 9.5 + Drei 10.7 |
| Post-Processing       | @react-three/postprocessing 3.0 (Bloom, Vignette, Noise) |
| State (SaaS)          | Redux Toolkit 2.11 (5 slices)                            |
| State (Player/Editor) | Zustand 5.0 (4 stores)                                   |
| Routing               | React Router DOM 7.13                                    |
| Animation             | Framer Motion 12.29                                      |
| Database/Auth         | Supabase JS 2.93 (client-side anon key)                  |
| HTTP Client           | Axios 1.13                                               |
| Icons                 | Lucide React 0.563                                       |
| 3D Debug              | Leva 0.10 (dev panel for camera tuning)                  |
| Utilities             | clsx + tailwind-merge, uuid                              |

---

## 2. File Map — Every File Explained

```
client/
├── index.html                    # Entry HTML (Poppins font, #root mount)
├── package.json                  # Dependencies & scripts
├── vite.config.js                # Vite + React + Tailwind plugins
├── tailwind.config.js            # Tailwind v4 + HeroUI plugin
├── hero.ts                       # HeroUI theme (colors, fonts)
├── eslint.config.js              # ESLint flat config for React
│
├── public/
│   ├── gltf/                     # Draco decoder (WASM mesh compression)
│   │   ├── draco_decoder.js
│   │   ├── draco_encoder.js
│   │   └── draco_wasm_wrapper.js
│   └── models/                   # GLB car models (sedan, SUV hologram)
│
└── src/
    ├── main.jsx                  # Bootstrap: Provider → Router → HeroUI → App
    ├── App.jsx                   # Route definitions (23 routes)
    ├── index.css                 # Tailwind v4 imports + CSS custom properties
    │
    ├── config/
    │   └── supabaseClient.js     # Supabase client (anon key)
    │
    ├── hooks/
    │   └── useImageUpload.js     # Image resize + Supabase Storage upload
    │
    ├── lib/
    │   └── utils.js              # cn() — clsx + tailwind-merge helper
    │
    ├── services/
    │   └── carSpecsService.js    # RapidAPI Car-Specs: search trims, fetch specs
    │
    ├── store/
    │   ├── store.js              # Redux configureStore (5 slices)
    │   ├── useAIUXStore.js       # Zustand: AI UX mode & intent
    │   ├── useChatbotStore.js    # Zustand: Chatbot visibility & messages
    │   ├── useStoryStore.js      # Zustand: Story data, scenes, playback, camera
    │   └── slices/
    │       ├── authSlice.js      # Redux: session, user, auth state
    │       ├── dealerSlice.js    # Redux: dealer profile CRUD
    │       ├── inventorySlice.js # Redux: car inventory CRUD + storage uploads
    │       ├── micrositeSlice.js # Redux: public dealer/inventory fetching
    │       └── studioSlice.js    # Redux: stories + cars joined query, soft delete
    │
    ├── layouts/
    │   ├── AuthLayout.jsx        # Split gradient layout for Login/Register
    │   ├── DashboardLayout.jsx   # Two-tier sidebar (primary rail + context nav)
    │   ├── OnboardingLayout.jsx  # 3-step progress layout
    │   └── PublicLayout.jsx      # White-label public shell with dealer colors
    │
    ├── pages/
    │   ├── Auth/
    │   │   ├── Login.jsx         # Email/password login form
    │   │   └── Register.jsx      # Registration form
    │   ├── Dashboard/
    │   │   ├── DashboardHome.jsx # Stats overview + quick actions
    │   │   ├── Inventory.jsx     # Inventory page (modal + table wrapper)
    │   │   └── Studio/
    │   │       ├── StudioPage.jsx      # Story library grid
    │   │       ├── EditorPage.jsx      # Full-screen editor loader
    │   │       └── Wizard/
    │   │           ├── StudioWizard.jsx          # 3-step wizard shell
    │   │           ├── CarSelectorStep.jsx       # Car picker grid
    │   │           ├── ConfigStep.jsx            # Story config + model toggles
    │   │           ├── GenerationTerminal.jsx    # Terminal-style log UI
    │   │           └── GenerationVisualizer.jsx  # Immersive generation experience
    │   ├── Landing/
    │   │   └── Home.jsx          # Marketing landing page
    │   ├── Microsite/
    │   │   ├── Showroom.jsx      # Public car grid with filters
    │   │   └── VehicleDetail.jsx # Full vehicle detail page
    │   ├── Onboarding/
    │   │   ├── AccountStep.jsx   # Dealer account setup
    │   │   ├── BrandingStep.jsx  # Logo + brand color
    │   │   └── PaymentStep.jsx   # Plan selection
    │   └── Player/
    │       └── ViewerPage.jsx    # AutoSense experience entry point
    │
    └── components/
        ├── ProtectedRoute.jsx    # Auth guard (redirect to /login)
        ├── PublicNavbar.jsx      # Public-facing navbar
        │
        ├── microsite/
        │   ├── FilterSidebar.jsx   # Faceted filter (make, body, price, condition)
        │   └── PublicCarCard.jsx   # Car card with photo + price badge
        │
        ├── Showcase/
        │   ├── Experience.jsx    # R3F Canvas + Exterior model
        │   ├── Exterior.jsx      # GLTF car loader with auto-rotate
        │   ├── GlossyFloor.jsx   # Reflective floor (MeshReflectorMaterial)
        │   ├── Interior.jsx      # 360° panorama viewer
        │   └── index.js          # Barrel export
        │
        ├── dashboard/
        │   ├── inventory/
        │   │   ├── AddCarModal.jsx     # ~960-line vehicle CRUD modal
        │   │   ├── InventoryTable.jsx  # HeroUI data table
        │   │   └── SpecsDrawer.jsx     # Right-side specs panel
        │   └── studio/
        │       └── StudioCard.jsx      # 3-variant story card
        │
        └── AutoSense/              # ← The core experience engine
            ├── AutoSenseLoader.jsx   # Story fetcher + loading screen
            ├── 3d/
            │   ├── CanvasWrapper.jsx       # R3F Canvas shell
            │   ├── CarModel.jsx            # Core 3D car with 4-mode materials
            │   ├── CameraController.jsx    # Preset + free-roam camera
            │   ├── Environment.jsx         # Lighting + post-processing
            │   └── modules/
            │       ├── Performance/
            │       │   ├── PerformanceRing.jsx  # Shader tick-mark gauge
            │       │   ├── PowerFlow.jsx        # Plasma energy beams
            │       │   └── WindLines.jsx        # Instanced wind particles
            │       ├── Safety/
            │       │   ├── BlindSpotSensor.jsx  # Pulsing sensor orbs
            │       │   ├── LidarScanner.jsx     # Radar ring waves
            │       │   └── SafetyShield.jsx     # Fresnel forcefield
            │       └── Utility/
            │           ├── CargoVolume.jsx       # Animated trunk volume box
            │           └── Dimensions.jsx        # Measurement lines + labels
            ├── ai/
            │   ├── AIIntentOrchestrator.jsx # Intent routing placeholder
            │   ├── ChatbotWidget.jsx        # Floating chat window
            │   ├── ChatInput.jsx            # Chat input + suggestions
            │   └── ChatMessage.jsx          # Message bubbles
            ├── services/
            │   └── ChatbotService.js        # ~640-line rule-based chatbot
            ├── store/
            │   └── useEditorStore.js         # Editor UI state (Zustand)
            ├── interactive/
            │   ├── BreathingHotspot.jsx      # Animated pulsing dot
            │   ├── HotspotLayer.jsx          # Positioned hotspot container
            │   └── PearlyHoverCard.jsx       # Glassmorphic info card
            ├── layers/
            │   ├── StoryContainer.jsx        # Composition root
            │   ├── SceneLayer.jsx            # Ken Burns image + transitions
            │   └── SlideContentLayer.jsx     # Glass-card content renderer
            ├── ui/
            │   └── ExperienceLoader.jsx      # R3F progress loader
            ├── playback/
            │   ├── PlaybackView.jsx          # Full-screen viewer
            │   ├── PlaybackControls.jsx      # Transport bar
            │   ├── AudioPlayer.jsx           # Hidden audio element
            │   ├── Subtitles.jsx             # Time-synced subtitle display
            │   ├── Timeline.jsx              # Scrubbing timeline
            │   └── KeyboardShortcuts.jsx     # Keyboard shortcut overlay
            └── editor/                        # ← Covered in EDITOR_ARCHITECTURE.md
                ├── EditorView.jsx
                ├── EditorSlide.jsx
                ├── LiveSceneEditor.jsx
                ├── InlineEditOverlay.jsx
                ├── FloatingToolbar.jsx
                ├── ScriptDock.jsx
                ├── EditorHotspotLayer.jsx
                ├── AddSceneModal.jsx
                ├── CopilotChat.jsx
                └── panels/
                    ├── LayoutPanel.jsx
                    ├── BadgesPanel.jsx
                    ├── HotspotsPanel.jsx
                    ├── ImagePanel.jsx
                    ├── AnimationPanel.jsx
                    ├── ContentPanel.jsx
                    └── ScriptPanel.jsx
```

**Total: ~105 source files** (excluding `node_modules`, build output, and assets)

---

## 3. Configuration & Build System

### `index.html` — Entry Point

Minimal HTML shell. Loads Poppins font from Google Fonts (via Supabase-hosted favicon). Title: `"AXLE - Dealership OS"`. Mounts `<div id="root">`.

### `vite.config.js` — Build Configuration

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Two plugins: React (JSX transform + Fast Refresh) and Tailwind CSS v4 (Vite-native integration, no PostCSS config needed).

### `tailwind.config.js` — Tailwind Configuration

Enables class-based dark mode (`darkMode: "class"` for HeroUI). Content scan paths include HeroUI's internal theme components. Single plugin: `heroui()`.

### `hero.ts` — HeroUI Theme Definition

Custom brand palette:

| Token        | Hex       | Usage                               |
| ------------ | --------- | ----------------------------------- |
| `primary`    | `#6C5CE7` | Brand purple — active states, links |
| `secondary`  | `#FF9F43` | Orange — CTAs, highlights, accents  |
| `success`    | `#1EDB60` | Green — health indicators, checks   |
| `background` | `#F4F7F6` | Main app background                 |

Custom fonts: `Poppins` (sans), `Laca Black` (display headings).

### `index.css` — Global Styles

```css
@import "tailwindcss";
@plugin '../hero.ts';
@source '../node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}';
@custom-variant dark (&:is(.dark *));

@theme {
  --color-axle-blue: #0088ff;
  --color-axle-dark: #0f172a;
}
```

Uses Tailwind v4's new `@import`, `@plugin`, and `@theme` directives. Registers two CSS custom properties for direct use.

### `eslint.config.js` — Linting

ESLint flat config with `react-hooks` and `react-refresh` plugins. Suppresses unused variable warnings for capitalized names (component imports).

---

## 4. App Bootstrap & Routing

### `main.jsx` — Bootstrap

```
React.StrictMode
  └── Redux Provider (store)
      └── BrowserRouter
          └── HeroUIProvider
              └── App
```

### `App.jsx` — Route Definitions

On mount, `App` initializes a Supabase auth listener (`onAuthStateChange`) that dispatches `setSession` and `fetchDealerProfile` on every auth event. This ensures the Redux auth state stays synchronized with Supabase.

**Route Map (23 routes):**

| Path                                | Component       | Layout             | Auth |
| ----------------------------------- | --------------- | ------------------ | ---- |
| `/`                                 | `Home`          | None (standalone)  | No   |
| `/login`                            | `Login`         | `AuthLayout`       | No   |
| `/onboarding/account`               | `AccountStep`   | `OnboardingLayout` | No   |
| `/onboarding/payment`               | `PaymentStep`   | `OnboardingLayout` | No   |
| `/onboarding/branding`              | `BrandingStep`  | `OnboardingLayout` | No   |
| `/dashboard`                        | `DashboardHome` | `DashboardLayout`  | Yes  |
| `/dashboard/inventory`              | `Inventory`     | `DashboardLayout`  | Yes  |
| `/dashboard/studio`                 | `StudioPage`    | `DashboardLayout`  | Yes  |
| `/dashboard/studio/published`       | `StudioPage`    | `DashboardLayout`  | Yes  |
| `/dashboard/studio/trash`           | `StudioPage`    | `DashboardLayout`  | Yes  |
| `/dashboard/studio/wizard`          | `StudioWizard`  | `DashboardLayout`  | Yes  |
| `/dashboard/editor/:storyId`        | `EditorPage`    | `DashboardLayout`  | Yes  |
| `/dashboard/settings`               | Placeholder     | `DashboardLayout`  | Yes  |
| `/experience/:storyId`              | `ViewerPage`    | None (full-screen) | No   |
| `/sites/:dealerId`                  | `Showroom`      | `PublicLayout`     | No   |
| `/sites/:dealerId/inventory/:carId` | `VehicleDetail` | `PublicLayout`     | No   |

Auth-protected routes are wrapped in `<ProtectedRoute>`, which checks `state.auth.isAuthenticated` and redirects to `/login` if false.

---

## 5. State Management

The application uses a **dual state management** strategy: Redux Toolkit for the SaaS platform (dashboard, inventory, auth) and Zustand for the AutoSense experience engine (player, editor, AI).

### 5.1 Redux Store (SaaS Platform)

**File:** `store/store.js`

```javascript
export const store = configureStore({
  reducer: {
    auth: authReducer,
    dealer: dealerReducer,
    inventory: inventoryReducer,
    studio: studioReducer,
    microsite: micrositeReducer,
  },
});
```

### 5.2 Auth Slice

**File:** `store/slices/authSlice.js`

Synchronous-only slice (no async thunks). Actions are dispatched from `App.jsx`'s Supabase auth listener.

**State:**

```javascript
{ user: null, session: null, isAuthenticated: false, loading: true }
```

**Actions:**

| Action       | Effect                                               |
| ------------ | ---------------------------------------------------- |
| `setSession` | Extracts `user` from session, sets `isAuthenticated` |
| `setLoading` | Toggles loading flag                                 |
| `logout`     | Clears user, session, sets `isAuthenticated: false`  |

### 5.3 Dealer Slice

**File:** `store/slices/dealerSlice.js`

**State:**

```javascript
{ profile: null, loading: false, error: null }
```

**Async Thunks:**

| Thunk                | Supabase Query                                                   |
| -------------------- | ---------------------------------------------------------------- |
| `fetchDealerProfile` | `supabase.from("dealers").select("*").eq("id", userId).single()` |

**Actions:**

| Action               | Effect                                |
| -------------------- | ------------------------------------- |
| `updateSubscription` | Merges subscription data into profile |
| `updateBranding`     | Merges branding data into profile     |
| `clearDealerData`    | Resets profile to `null`              |

### 5.4 Inventory Slice

**File:** `store/slices/inventorySlice.js` (~261 lines)

The most complex Redux slice. Manages vehicle CRUD with multi-bucket Supabase Storage uploads.

**State:**

```javascript
{ list: [], loading: false, uploading: false, error: null }
```

**Async Thunks (4):**

| Thunk            | Behavior                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `fetchInventory` | `SELECT * FROM cars WHERE dealer_id = user.id`                                                  |
| `addCar`         | Uploads photos → `car_photos`, 3D model → `3d_cars`, 360° → `360_cars`; then `INSERT INTO cars` |
| `updateCar`      | Same upload logic; then `UPDATE cars SET ... WHERE id = carId`                                  |
| `deleteCar`      | `DELETE FROM cars WHERE id = carId`                                                             |

**Storage Buckets Used:**

| Bucket       | Content            | Path Pattern                    |
| ------------ | ------------------ | ------------------------------- |
| `car_photos` | Vehicle photos     | `{dealer_id}/{timestamp}.{ext}` |
| `3d_cars`    | GLB 3D models      | `{dealer_id}/{timestamp}.glb`   |
| `360_cars`   | 360° interior JPGs | `{dealer_id}/{timestamp}.jpg`   |

**Image handling:** Photos are resized client-side (max 1200px) before upload using `canvas.toBlob()`. Multiple photos per vehicle are supported.

### 5.5 Studio Slice

**File:** `store/slices/studioSlice.js` (~156 lines)

Manages the story library with a joined `cars + stories` query and soft-delete/restore logic.

**State:**

```javascript
{ items: [], stats: { total: 0, unexplored: 0, showroom: 0 }, loading: false, error: null }
```

**Async Thunks (3):**

| Thunk             | Behavior                                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| `fetchStudioData` | `SELECT *, stories(...) FROM cars WHERE dealer_id = user.id` (joined query) |
| `softDeleteStory` | `UPDATE stories SET deleted_at = now() WHERE id = storyId`                  |
| `restoreStory`    | `UPDATE stories SET deleted_at = null WHERE id = storyId`                   |

**Story Selection Logic:** Each car may have multiple stories. The slice selects the "best" story per car:

1. Active stories (null `deleted_at`) first, sorted by newest
2. Computes derived flags: `hasStoryHistory`, `isDeleted`, `hasActiveStory`, `storyStatus` (`"complete"` / `"processing"` / `"failed"` / `"none"`)

**Stats Computation:**

- `total` — all cars
- `unexplored` — cars with no active story
- `showroom` — cars with a `"complete"` active story

### 5.6 Microsite Slice

**File:** `store/slices/micrositeSlice.js` (~138 lines)

Powers the public-facing dealer microsite.

**State:**

```javascript
{ currentDealer: null, inventory: [], activeCar: null, loadingDealer: false, loadingInventory: false, loadingCar: false, error: null }
```

**Async Thunks (3):**

| Thunk                  | Supabase Query                                                                  |
| ---------------------- | ------------------------------------------------------------------------------- |
| `fetchPublicDealer`    | `SELECT id, dealership_name, logo_url, primary_color, website_url FROM dealers` |
| `fetchPublicInventory` | `SELECT *, stories(id, generation_status) FROM cars WHERE dealer_id = dealerId` |
| `fetchPublicCar`       | `SELECT *, stories(id, generation_status, content) FROM cars WHERE id = carId`  |

### 5.7 Story Store (Zustand — Player/Editor)

**File:** `store/useStoryStore.js` (~244 lines)

Central state store for the AutoSense experience. Used by both the Playback View (viewer) and the Editor View.

**State Fields:**

```javascript
{
  // Story data
  story: null,            // Raw story row from Supabase
  storyData: null,        // Parsed story JSON (content field)
  scenes: [],             // Array of scene objects
  currentSceneIndex: 0,   // Active scene being viewed/edited

  // Playback
  playback: {
    isPlaying: false,
    isPaused: false,
    autoAdvance: true,
    currentTime: 0,
  },

  // Audio
  audioCurrentTime: 0,

  // 3D Camera
  activeCameraView: "primary",
  isFreeRoam: false,

  // Hotspots
  activeHotspotId: null,
}
```

**Actions (19):**

| Action                 | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `loadStory(row)`       | Parses story row, extracts scenes from `content.scenes`    |
| `getCurrentScene()`    | Returns `scenes[currentSceneIndex]`                        |
| `nextScene()`          | Increments index (wraps to 0)                              |
| `prevScene()`          | Decrements index (wraps to last)                           |
| `goToScene(i)`         | Sets index directly                                        |
| `play()` / `pause()`   | Playback state toggles                                     |
| `setAutoAdvance(bool)` | Toggle auto-advance to next scene                          |
| `setAudioCurrentTime`  | Syncs audio position for subtitles                         |
| `setCameraView(view)`  | Sets 3D camera preset (`primary`/`secondary`/`tertiary`)   |
| `setFreeRoam(bool)`    | Enables/disables orbit controls                            |
| `setActiveHotspot(id)` | Sets active hotspot (triggers content blur + hover card)   |
| `updateStoryData(d)`   | Merges partial updates into storyData                      |
| `addScene(scene, i)`   | Inserts scene at position, re-indexes, auto-navigates      |
| `removeScene(i)`       | Removes scene, clamps index                                |
| `updateSceneAtIndex`   | Deep-merges partial update for a specific scene            |
| `updateCurrentScene`   | Deep-merges partial update for active scene                |
| `startExperience()`    | Sets `isPlaying: true`, navigates to scene 1 (skips intro) |

**Deep-merge logic:** `updateSceneAtIndex` and `updateCurrentScene` perform intelligent nested merging for `intro_content`, `slide_content`, `outro_content`, and `tech_config` — spreading existing nested objects before applying partial updates.

### 5.8 Editor Store (Zustand — Editor UI)

**File:** `components/AutoSense/store/useEditorStore.js` (~97 lines)

All transient editor UI state. Never persisted — resets on page navigation.

**State Groups:**

| Group            | Fields                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **Panel**        | `activePanel`, `setActivePanel(name)`, `closePanel()`                                              |
| **Editing**      | `editingField`, `setEditingField(name)`, `clearEditingField()`                                     |
| **Hotspot Drag** | `draggingHotspotId`, `setDraggingHotspot(id)`, `clearDraggingHotspot()`                            |
| **Script Dock**  | `isScriptDockOpen`, `toggleScriptDock()`, `openScriptDock()`, `closeScriptDock()`                  |
| **Copilot**      | `isCopilotOpen`, `toggleCopilot()`, `copilotMessages[]`, `addCopilotMessage()`, `isCopilotLoading` |
| **Add Scene**    | `isAddSceneOpen`, `openAddScene()`, `closeAddScene()`                                              |
| **Save State**   | `isDirty`, `markDirty()`, `markClean()`, `isSaving`, `setIsSaving()`                               |
| **Voice**        | `voices[]` (9-entry array), `selectedVoice`, `setSelectedVoice()`                                  |
| **AI Model**     | `useAwsModels` (default `true`), `setUseAwsModels()`                                               |
| **AI Loading**   | `isRegeneratingVoiceover`, `isRegeneratingImage`, `isGeneratingScene` (+ setters)                  |

**VOICES Array (9 Deepgram Aura-2 voices):**

| ID                 | Label  | Language | Gender |
| ------------------ | ------ | -------- | ------ |
| `aura-2-zeus-en`   | Zeus   | EN       | Male   |
| `aura-2-athena-en` | Athena | EN       | Female |
| `aura-2-helios-en` | Helios | EN       | Male   |
| `aura-2-hera-en`   | Hera   | EN       | Female |
| `aura-2-orion-en`  | Orion  | EN       | Male   |
| `aura-2-luna-en`   | Luna   | EN       | Female |
| `aura-2-arcas-en`  | Arcas  | EN       | Male   |
| `aura-2-stella-en` | Stella | EN       | Female |
| `aura-2-agathe-fr` | Agathe | FR       | Female |

**`getAvailablePanels(sceneType)` logic:**

| Scene Type   | Available Panels                           |
| ------------ | ------------------------------------------ |
| `slide_view` | layout, badges, hotspots, image, animation |
| `tech_view`  | layout, badges, animation                  |
| `intro_view` | image, animation                           |
| `outro_view` | image, animation                           |

### 5.9 AI UX Store (Zustand)

**File:** `store/useAIUXStore.js` (~15 lines)

Minimal store for AI orchestration mode.

**State:** `uxMode` (default `"guided"`), `currentIntent`

**Actions:** `setIntent(intent)`, `setUXMode(mode)`, `clearIntent()`

### 5.10 Chatbot Store (Zustand)

**File:** `store/useChatbotStore.js` (~107 lines)

Uses `subscribeWithSelector` middleware for selective re-renders.

**State:** `isOpen`, `messages[]`, `isTyping`, `suggestions[]`, `conversationHistory[]`

**Actions (12):**

| Action                          | Purpose                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `toggleChatbot() / open/close`  | Visibility control                                         |
| `addMessage(msg)`               | Generic message insertion                                  |
| `addBotMessage(text)`           | Creates `{ role: "bot", text, timestamp }`                 |
| `addUserMessage(text)`          | Creates `{ role: "user", text, timestamp }`                |
| `setTyping(bool)`               | Typing indicator state                                     |
| `setSuggestions(arr)`           | Updates suggestion chips                                   |
| `clearMessages()`               | Resets chat                                                |
| `generateContextualSuggestions` | Generates suggestions based on current scene's `theme_tag` |
| `initializeChat()`              | Adds welcome message from bot                              |

**Theme-based suggestion generation:** Switches on `currentScene.slide_content.theme_tag`:

- Performance themes → "What's the 0-60 time?", "Tell me about the engine"
- Efficiency themes → "What's the fuel economy?", "How far can it go?"
- Safety themes → "What safety features does it have?"

---

## 6. Layouts

### 6.1 Auth Layout

**File:** `layouts/AuthLayout.jsx`

Split layout: left side is a gradient background with branding, right side renders the `<Outlet>` (login/register form). Uses Framer Motion entry animations.

### 6.2 Dashboard Layout

**File:** `layouts/DashboardLayout.jsx` (~412 lines)

The most complex layout. Implements a **two-tier sidebar** pattern:

```
┌──────┬──────────────┬──────────────────────────────────────┐
│ Rail │ Context Nav   │              Content                 │
│ 64px │ 220px        │              <Outlet>                 │
│      │              │                                      │
│ [🏠] │ LIBRARY      │                                      │
│ [🚗] │  All Stories │                                      │
│ [🎬] │  Published   │                                      │
│ [⚙️] │  Trash       │                                      │
│      │              │                                      │
│      │ CREATE       │                                      │
│      │  + New Story │                                      │
│      │              │                                      │
│      │ ──────────── │                                      │
│      │ [Avatar]     │                                      │
│      │ Dealer Name  │                                      │
│      │ [Upgrade ▲]  │                                      │
└──────┴──────────────┴──────────────────────────────────────┘
```

**Primary Rail (`PrimaryRail`):**

4 navigation icons:

| Key         | Icon       | Path                   |
| ----------- | ---------- | ---------------------- |
| `dashboard` | `Home`     | `/dashboard`           |
| `inventory` | `Car`      | `/dashboard/inventory` |
| `studio`    | `Video`    | `/dashboard/studio`    |
| `settings`  | `Settings` | `/dashboard/settings`  |

**Secondary Sidebar:** Context-sensitive — shows different menus based on the current route:

| Active Context         | Sections                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| `/dashboard/studio`    | **Library:** All Stories, Published, Trash — **Create:** + New Story |
| `/dashboard/inventory` | **Fleet:** All Vehicles, + Add Vehicle                               |
| `/dashboard/settings`  | **Account:** General, Billing, Team                                  |
| `/dashboard`           | **Analytics:** Overview                                              |

**Bottom section:** Dealer avatar + name dropdown (profile, billing, logout), conditional upgrade card for non-enterprise plans.

**Mobile:** HeroUI `Drawer` component overlays the sidebar on small screens.

### 6.3 Onboarding Layout

**File:** `layouts/OnboardingLayout.jsx`

3-step progress indicator at the top: Account → Payment → Branding. Renders `<Outlet>` below. Steps are visually connected with progress lines.

### 6.4 Public Layout

**File:** `layouts/PublicLayout.jsx` (~250 lines)

White-label public-facing layout for dealer microsites. On mount, fetches the dealer profile via `fetchPublicDealer(dealerId)` and injects the dealer's `primary_color` as CSS custom properties across the page.

**Dynamic color injection:**

```javascript
document.documentElement.style.setProperty(
  "--dealer-primary",
  dealer.primary_color,
);
```

Includes: dealer-branded navbar (logo + name + nav links), `<Outlet>`, and a footer with dealer contact info.

---

## 7. Pages — Auth & Onboarding

### 7.1 Login

**File:** `pages/Auth/Login.jsx`

Email/password form using HeroUI `Input` + `Button`. Dispatches Redux action (Supabase `signInWithPassword`). Error display with Framer Motion slide animation. Redirect to `/dashboard` on success.

### 7.2 Register

**File:** `pages/Auth/Register.jsx`

Registration form (email, password, confirm password). Creates Supabase user via `signUp`. Redirects to `/onboarding/account`.

### 7.3 Onboarding Flow

Three sequential pages within `OnboardingLayout`:

**`AccountStep.jsx` (~370 lines):**
Dealer profile creation form — dealership name, phone, address, city, state, zip, country, website URL. On submit: `supabase.from("dealers").upsert(profileData)`. Navigates to `/onboarding/payment`.

**`BrandingStep.jsx` (~300 lines):**
Logo upload (via `useImageUpload` hook to `dealer_logos` bucket) + brand color picker (hex input). Updates dealer profile. Navigates to `/onboarding/branding`.

**`PaymentStep.jsx` (~230 lines):**
3-tier plan selection: Starter (Free), Professional ($49/mo), Enterprise ($199/mo). Feature comparison grid. Currently a placeholder — no actual payment integration.

---

## 8. Pages — Landing

### `Home.jsx` (~680 lines)

Marketing landing page for the AXLE product. Not protected by auth.

**Sections:**

1. **Hero** — Headline, subheadline, CTA buttons ("Get Started", "See Demo")
2. **Features Grid** — 6 feature cards with icons (AI Storytelling, 3D Digital Twin, Real-Time Badges, Voice Narration, Smart Editor, Public Microsite)
3. **How It Works** — 3-step visual flow (Add Vehicle → AI Generates → Share)
4. **3-Tier Pricing** — Starter/Professional/Enterprise cards with feature lists
5. **CTA Section** — Final conversion banner

All sections use Framer Motion `whileInView` animations for scroll-triggered reveals.

---

## 9. Pages — Dashboard

### 9.1 Dashboard Home

**File:** `pages/Dashboard/DashboardHome.jsx` (~350 lines)

Overview dashboard showing:

**Stat Cards (3):**

- Total Vehicles (from inventory count)
- Active Stories (complete stories count)
- Pending Generation (processing stories count)

**Quick Actions:** "Add Vehicle", "Create Story", "View Showroom"

**Recent Activity:** Timeline of latest inventory additions and story generations, pulled from Redux state.

### 9.2 Inventory Page

**File:** `pages/Dashboard/Inventory.jsx`

Wrapper page that renders `AddCarModal` + `InventoryTable`. Fetches inventory on mount via `fetchInventory` thunk. Manages modal open/close state and passes selected car for editing.

### 9.3 Studio Page

**File:** `pages/Dashboard/Studio/StudioPage.jsx` (~200 lines)

The story library dashboard. Fetches joined `cars + stories` data via `fetchStudioData`.

**Three sub-views** (based on route):

1. **Main (`/studio`)** — Two grids:


    - **"Ready to Create"** — Cars without active stories (unexplored)
    - **"Live Showroom"** — Cars with complete stories

2. **Published (`/studio/published`)** — Filter to only show published stories
3. **Trash (`/studio/trash`)** — Filter to only show soft-deleted stories

Each car+story pair is rendered via `StudioCard`.

---

## 10. Pages — Studio Wizard (Story Generation)

### 10.1 Studio Wizard

**File:** `pages/Dashboard/Studio/Wizard/StudioWizard.jsx` (~160 lines)

3-step wizard shell with `AnimatePresence` page transitions:

```
Step 1: CarSelectorStep → Step 2: ConfigStep → Step 3: GenerationVisualizer
```

State managed locally: `step` (1–3), `selectedCar`, `storyConfig`.

### 10.2 Car Selector Step

**File:** `pages/Dashboard/Studio/Wizard/CarSelectorStep.jsx` (~100 lines)

Grid of available vehicles pulled from Redux `studio.items`. Each card shows the car photo, make/model/year, and a "Remix" badge if the car already has a story. Search input filters by make/model.

### 10.3 Config Step

**File:** `pages/Dashboard/Studio/Wizard/ConfigStep.jsx` (~360 lines)

The story configuration page with the selected car's hero photo and specs on the left, and configuration options on the right.

**Configuration Options:**

| Option         | Control       | Values                                | Default   |
| -------------- | ------------- | ------------------------------------- | --------- |
| Template Style | Dropdown      | Cinematic, Minimalist                 | Cinematic |
| Scene Count    | Slider (3–7)  | Number or "Automatic"                 | Automatic |
| Language       | Select        | English, French                       | English   |
| AI Model       | Toggle Switch | AWS Bedrock Nova ↔ Groq Cloud         | AWS       |
| Vision System  | Toggle Switch | OWLv2 (Object Detection) ↔ LLM Vision | OWLv2     |

**Model toggle descriptions:** Inline help text explains the tradeoffs:

- AWS: "Amazon Nova 2 Lite — Best for structured outputs"
- Groq: "GPT-OSS-120B — Ultra-fast inference"
- OWLv2: "Local zero-shot detection — No API calls"
- LLM Vision: "Llama 4 Scout — Language-based reasoning"

**Car spec extraction:** Parses selected car's `specs_raw` to display key specs (HP, 0-60, MPG, etc.) next to the hero photo.

### 10.4 Generation Visualizer

**File:** `pages/Dashboard/Studio/Wizard/GenerationVisualizer.jsx` (~500 lines)

The most visually complex component. An immersive, full-screen generation experience with three phases:

**Phase 1 — Scanner (`"scanning"`, 3.5 seconds):**

- Car photo displayed in grayscale with a sweeping cyan scan beam
- Corner bracket crosshairs animate around the image
- Rotating `Aperture` reticle from Lucide
- Auto-transitions to Phase 2

**Phase 2 — Generating (`"generating"`):**

- Fires `POST http://localhost:3000/api/ingest/context` with the full config
- Opens a Supabase Realtime subscription on the `stories` table:
  ```javascript
  supabase
    .channel(`story-${storyId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", table: "stories", filter: `id=eq.${storyId}` },
      (payload) => {
        /* match current_agent to GENERATION_STEPS */
      },
    )
    .subscribe();
  ```
- Orbital progress visualization: SVG rings with step dots that light up as each agent completes
- Dynamic radial gradient background color follows the current step's color
- Ambient particle system (30 floating particles)

**GENERATION_STEPS mapping (11 steps):**

| Step | Agent Key            | Display Label | Icon           |
| ---- | -------------------- | ------------- | -------------- |
| 0    | `SYSTEM`             | SYSTEM        | `Cpu`          |
| 1    | `INGESTION`          | INGESTION     | `Database`     |
| 2    | `BADGE_ORCHESTRATOR` | VERIFICATION  | `ShieldCheck`  |
| 3    | `ANALYST`            | ANALYST       | `Brain`        |
| 4    | `DIRECTOR`           | DIRECTOR      | `Film`         |
| 5    | `SCRIPTWRITER`       | SCRIPTWRITER  | `PenTool`      |
| 6    | `IMAGE_GENERATOR`    | IMAGE GEN     | `Image`        |
| 7    | `VISION_SCANNER`     | VISION AI     | `ScanEye`      |
| 8    | `AUDIO_ENGINE`       | AUDIO ENGINE  | `AudioLines`   |
| 9    | `QA_SYSTEM`          | QA SYSTEM     | `CheckCircle2` |
| 10   | `COMPLETE`           | COMPLETE      | `Sparkles`     |

**Phase 3 — Complete (`"complete"`):**

- Success animation with checkmark
- "Open Editor" button → redirects to `/dashboard/editor/${storyId}`

---

## 11. Pages — Public Microsite

### 11.1 Showroom

**File:** `pages/Microsite/Showroom.jsx` (~280 lines)

Public vehicle grid with `FilterSidebar` on the left. Fetches dealer inventory via `fetchPublicInventory(dealerId)`. Renders `PublicCarCard` per vehicle.

**Filter capabilities:**

- Make (multi-select from inventory)
- Body type (Sedan, SUV, Truck, Coupe, etc.)
- Price range (slider)
- Condition (New, Used, Certified Pre-Owned)

Cards link to `/sites/:dealerId/inventory/:carId`.

### 11.2 Vehicle Detail

**File:** `pages/Microsite/VehicleDetail.jsx` (~1010 lines)

The most content-rich page. Fetches a single car with its story via `fetchPublicCar(carId)`.

**Sections:**

1. **Photo Gallery** — Grid with primary large image + thumbnails, fullscreen modal with carousel
2. **Vehicle Header** — Year/Make/Model/Trim, price badge, condition tag
3. **Spec Highlights** — 4 key stats (HP, MPG, Drivetrain, Seats) in pills
4. **3D Model Preview** — `Experience` component (R3F Canvas + `Exterior` model) if GLB file exists
5. **360° Interior** — `Interior` panorama viewer if 360° image exists
6. **Specs Tabs** — Tabbed interface: Performance, Dimensions, Efficiency, Safety, Technology
7. **Story CTA** — "View Cinematic Experience" button if story is complete → links to `/experience/:storyId`
8. **Contact Form** — Test drive request / inquiry form (email, phone, message)

**Fullscreen Modal:** Supports both photo gallery mode and 3D model fullscreen mode with exterior/interior toggle.

---

## 12. Dashboard Components

### 12.1 Add Car Modal

**File:** `components/dashboard/inventory/AddCarModal.jsx` (~960 lines)

The largest single component in the application. Full vehicle creation/editing modal.

**Tab 1 — Vehicle Details:**

**RapidAPI Integration:**

1. User enters a Trim ID
2. "Fetch from RapidAPI" button calls `fetchTrimSpecs(trimId)` from `carSpecsService.js`
3. Data is normalized via `normalizeCarData()`: extracts identity (make/model/year/trim), converts remaining fields to `{ id, key, label, value }` specs array
4. Identity fields populate the form inputs
5. Specs populate the `SpecsDrawer`

**Vehicle Form Fields (11):**

| Field     | Type         | Notes                          |
| --------- | ------------ | ------------------------------ |
| VIN       | Text         | 17-char Vehicle ID             |
| Make      | Text         | Auto-filled from API           |
| Model     | Text         | Auto-filled from API           |
| Year      | Number       | Auto-filled from API           |
| Trim      | Text         | Auto-filled from API           |
| Color     | Text         | Dealer input                   |
| Price     | Number       | Dealer input (USD)             |
| Mileage   | Number       | Dealer input (km or mi)        |
| Condition | Select       | New / Used / Certified         |
| Body Type | Text         | Auto-filled from API           |
| Photos    | File[] (img) | Multi-upload with preview grid |

**Tab 2 — 3D Assets:**

| Asset         | Format | Purpose                   |
| ------------- | ------ | ------------------------- |
| 3D Model      | `.glb` | WebGL model for 3D views  |
| Interior 360° | `.jpg` | Panoramic interior viewer |

**Knowledge Base Section (below tabs):**

Enables RAG document ingestion:

1. **Existing Documents:** Fetches list via `GET /api/rag/documents/:carId`, displays filename + size + delete button
2. **Upload New PDFs:** Multi-file input (`.pdf` only), drag-and-drop area
3. **On Save:** Sends new PDFs via `POST /api/rag/ingest` (multipart/form-data, 5-minute timeout)
4. **Visual Feedback:** Progress spinner during ingestion, success/error toast with element counts

**State (~20 variables):** `isFetching`, `isSaving`, `trimId`, `mainInfo` (11-field object), `techSpecs[]`, `isDrawerOpen`, `activeTab`, `photoFiles[]`, `photoPreviews[]`, `existingPhotos[]`, `model3dFile`, `model3dPreview`, `image360File`, `image360Preview`, `pdfFiles[]`, `existingDocs[]`, `isIngesting`, `ingestResult`

### 12.2 Inventory Table

**File:** `components/dashboard/inventory/InventoryTable.jsx` (~180 lines)

HeroUI `Table` with columns: Photo thumbnail, Vehicle (make/model), Trim, Year, Price, Mileage, Actions (edit/delete). Supports row click to open edit modal.

### 12.3 Specs Drawer

**File:** `components/dashboard/inventory/SpecsDrawer.jsx` (~170 lines)

Right-side sliding drawer for managing raw vehicle specifications.

**Features:**

- Filterable spec list (search by label)
- Add new spec (key/value pair with auto-generated UUID)
- Edit spec value inline
- Delete individual specs
- All changes are local state — persisted when the parent modal saves

### 12.4 Studio Card

**File:** `components/dashboard/studio/StudioCard.jsx` (~220 lines)

Three-variant card component based on story state:

| Variant      | Shown When            | Actions                                                            |
| ------------ | --------------------- | ------------------------------------------------------------------ |
| `showroom`   | Car has active story  | ▶ Play (→ `/experience/:id`), ✏️ Edit (→ `/editor/:id`), 🗑 Delete |
| `trash`      | Story is soft-deleted | ♻️ Restore                                                         |
| `unexplored` | Car has no story      | ✨ Generate (→ `/studio/wizard`)                                   |

Each card displays the car photo, year/make/model, and story status badge (`Complete` / `Processing` / `Failed`).

---

## 13. Microsite Components

### `FilterSidebar.jsx` (~250 lines)

Collapsible faceted filter panel for the public showroom. Sections:

| Filter    | Type          | Source                        |
| --------- | ------------- | ----------------------------- |
| Make      | Checkbox list | Extracted from inventory data |
| Body Type | Checkbox list | Hardcoded (Sedan, SUV, etc.)  |
| Price     | Range slider  | Min/Max from inventory prices |
| Condition | Checkbox list | New / Used / Certified        |

Filters are applied client-side with `useMemo` filtering.

### `PublicCarCard.jsx` (~100 lines)

Car card with: photo (or placeholder), price badge overlay, year/make/model label, body type pill, mileage, condition badge. Links to vehicle detail page.

---

## 14. Showcase (3D Vehicle Display)

A standalone 3D viewer used in the VehicleDetail page, separate from the AutoSense engine.

### `Experience.jsx`

R3F `Canvas` wrapper with `ambientLight`, `spotLight`, `Environment` (HDRI), and an `Exterior` car model. Uses `OrbitControls` for user interaction.

### `Exterior.jsx`

`useGLTF` loader for the car's GLB file. Auto-rotate via `useFrame`. Material override for showroom-quality rendering (metallic paint, glossy clearcoat).

### `GlossyFloor.jsx`

`MeshReflectorMaterial` from Drei — reflective floor underneath the 3D model with blur and opacity settings.

### `Interior.jsx`

360° equirectangular panorama viewer. Uses a sphere geometry with interior-facing normals + the 360 image as texture. Orbit controls with restricted vertical movement.

### `index.js`

Barrel export: `{ Experience, Interior }`.

---

## 15. AutoSense Engine — Overview

The AutoSense engine is the core experience platform. It's a self-contained module under `components/AutoSense/` with its own component hierarchy, state stores, services, and rendering layers.

**Architecture:**

```
AutoSenseLoader (data fetching + loading screen)
  └── PlaybackView / EditorView (depending on route)
        └── StoryContainer (composition root)
              ├── CanvasWrapper (3D — only renders for tech_view)
              │     ├── CarModel (4-mode 3D car)
              │     ├── CameraController (preset + free-roam)
              │     └── Environment (lights + post-processing)
              │
              ├── SceneLayer (2D — Ken Burns images + transitions)
              │     └── HotspotLayer / EditorHotspotLayer
              │           └── BreathingHotspot + PearlyHoverCard
              │
              ├── SlideContentLayer (glass-card content)
              │     └── Badges, Headline, Paragraph, Stats, Camera Controls
              │
              ├── Subtitles (time-synced captions)
              └── AudioPlayer (hidden audio element)
```

---

## 16. AutoSense Loader

**File:** `components/AutoSense/AutoSenseLoader.jsx` (~156 lines)

Entry point for both the player (`/experience/:storyId`) and editor (`/dashboard/editor/:storyId`). Fetches the story row from Supabase and drives a cinematic loading screen.

**Loading Sequence:**

1. Extracts `storyId` from URL params
2. Fetches: `supabase.from("stories").select("*").eq("id", storyId).single()`
3. Validates `generation_status === "complete"` and `content` is non-null
4. Calls `useStoryStore.loadStory(data)` to hydrate all state
5. Renders the child component (PlayerView or EditorView)

**Loading Screen:**

Phase messages cycle with 2-second intervals:

```
"Initializing AutoSense Core..." →
"Loading Vehicle Intelligence..." →
"Rendering 3D Digital Twin..." →
"Preparing Cinematic Experience..."
```

Animated with Framer Motion (fade + slide + scale transitions). Progress bar fills based on phase count.

**Error States:**

- Story not found → "Story Not Found" with retry button
- Generation in progress → "Story is still being generated" with animated spinner
- Generation failed → "Generation Failed" with error details

---

## 17. AutoSense 3D System

### 17.1 Canvas Wrapper

**File:** `components/AutoSense/3d/CanvasWrapper.jsx` (~62 lines)

R3F `Canvas` wrapper that renders the 3D scene only when the current scene is a `tech_view`. For all other scene types, the canvas is hidden (returns `null` or `opacity-0`).

**Composition:**

```jsx
<Canvas camera={{ position: [4, 2, 5], fov: 45 }}>
  <Environment />
  <CarModel
    mode={techMode}
    drivetrain={drivetrain}
    bodyType={bodyType}
    techConfig={techConfig}
  />
  <CameraController isTechView={true} />
</Canvas>
```

Props are extracted from the current scene's `tech_config` object. The `mode` prop maps `tech_config.mode` directly: `"PERFORMANCE"`, `"SAFETY"`, or `"UTILITY"`.

### 17.2 Car Model

**File:** `components/AutoSense/3d/CarModel.jsx` (~300 lines)

The core 3D car component. Loads GLB models via `useGLTF` and applies a sophisticated material system based on the active mode.

**Model Selection:**

```javascript
bodyType.toLowerCase().includes("suv")
  ? "/models/suv_hologram.glb"
  : "/models/sedan_hologram.glb";
```

Both models are preloaded at module level to avoid loading delays during mode switches.

**Materials Library (12 materials):**

| Key           | Type                  | Usage                                        |
| ------------- | --------------------- | -------------------------------------------- |
| `paint`       | MeshPhysicalMaterial  | Body panels — metalness: 0.6, roughness: 0.3 |
| `chrome`      | MeshStandardMaterial  | Trim, handles — metalness: 1.0               |
| `glass`       | MeshPhysicalMaterial  | Windows — transmission: 0.9, transparent     |
| `ghost`       | Custom ShaderMaterial | Fresnel hologram (Safety mode)               |
| `techMesh`    | MeshStandardMaterial  | Emissive cyan wireframe (Safety highlights)  |
| `graphite`    | MeshStandardMaterial  | Dark matte body (Utility mode)               |
| `tintedGlass` | MeshPhysicalMaterial  | Darker windows (Utility mode)                |
| `outline`     | LineBasicMaterial     | Edge wireframes (Utility mode)               |
| `satin`       | MeshPhysicalMaterial  | Satin finish body (Performance mode)         |
| `magma`       | MeshStandardMaterial  | Emissive red-orange (engine parts)           |
| `hotMetal`    | MeshStandardMaterial  | Emissive drivetrain glow                     |
| `darkGlass`   | MeshPhysicalMaterial  | Very dark windows (Performance mode)         |

**Fresnel Hologram Shader (custom GLSL):**

```glsl
// Vertex shader
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment shader
uniform float uTime;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 2.5);
  vec3 col = mix(vec3(0.0, 0.8, 1.0), vec3(0.4, 0.9, 1.0), fresnel);
  gl_FragColor = vec4(col, fresnel * 0.6 + 0.05);
}
```

**Mode Switching Logic:**

| Mode          | Body Material | Glass Material | Special Effects                                                                                               | 3D Modules Rendered                         |
| ------------- | ------------- | -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `SHOWROOM`    | `paint`       | `glass`        | None                                                                                                          | None                                        |
| `SAFETY`      | `ghost`       | `ghost`        | Holographic Fresnel on all meshes; `techMesh` on airbag-named parts                                           | `LidarScanner`, `BlindSpotSensor`           |
| `PERFORMANCE` | `satin`       | `darkGlass`    | `magma` on engine/exhaust; `hotMetal` on drivetrain; pulsing engine light; spinning wheels; chassis vibration | `PowerFlow`, `PerformanceRing`, `WindLines` |
| `UTILITY`     | `graphite`    | `tintedGlass`  | Edge wireframes; trunk stays closed                                                                           | `CargoVolume`, `Dimensions`                 |

**Material Assignment:** The model's mesh children are traversed. Material is assigned based on mesh name pattern matching (e.g., names containing "glass", "window" → glass material; "engine", "exhaust" → magma; "wheel" → chrome).

**`useFrame` Animation Loop:**

- Trunk lid rotation: lerps toward 0 (closed) in all modes — trunk open animation removed
- Engine glow: sinusoidal pulsing in PERFORMANCE mode (cinematic only)
- Wheel spin: continuous rotation around X-axis in PERFORMANCE mode
- Chassis vibration: subtle random jitter in PERFORMANCE mode (cinematic only; disabled in MT)

### 17.3 Camera Controller

**File:** `components/AutoSense/3d/CameraController.jsx` (~82 lines)

Uses Drei's `CameraControls` for smooth camera transitions.

**CAMERA_PRESETS:**

| Theme         | View      | Position       | Target              |
| ------------- | --------- | -------------- | ------------------- |
| `SAFETY`      | primary   | `[4, 2, 5]`    | `[0, 0.5, 0]`       |
|               | secondary | `[-4, 2, -3]`  | `[0, 0.5, 0]`       |
|               | tertiary  | `[0, 8, 0.1]`  | `[0, 0, 0]` (top)   |
| `UTILITY`     | primary   | `[-5, 2.5, 3]` | `[0, 0.5, 0]`       |
|               | secondary | `[0, 3, -6]`   | `[0, 0, 0]` (rear)  |
| `PERFORMANCE` | primary   | `[5, 1.5, 5]`  | `[0, 0.3, 0]` (low) |
|               | secondary | `[0, 7, 0.1]`  | `[0, 0, 0]` (top)   |
| `SHOWROOM`    | primary   | `[5, 2, 5]`    | `[0, 0, 0]`         |
|               | secondary | `[5, 2, 5]`    | `[0, 0, 0]` (same)  |

**Camera Modes:**

1. **Free Roam** (`isFreeRoam = true`): Orbit controls enabled, user can rotate/zoom/pan freely. Triggered by the "Free Roam" button in `SlideContentLayer`.
2. **Tech View** (`activeCameraView` changes): Smooth 0.8s transition via `cameraControlsRef.setLookAt()` with `smoothTime`. Triggered by camera view buttons in `SlideContentLayer` or `InlineEditOverlay`.
3. **Default**: Fixed position `[4, 2, 5]` looking at `[0, 0, 0]`.

Uses Leva debug panel for camera position tuning in development.

### 17.4 Environment

**File:** `components/AutoSense/3d/Environment.jsx` (~65 lines)

R3F scene environment with:

- **HDRI:** Drei `Environment` preset (studio lighting)
- **3 Spot Lights:** Key light (warm, intensity 2), fill light (cool, intensity 0.8), rim light (white, intensity 1.2)
- **Contact Shadows:** Ground plane with soft shadow (blur 2, opacity 0.4)
- **Post-Processing:** `EffectComposer` with Bloom (intensity 0.3, threshold 0.85), Vignette (offset 0.3, darkness 0.6), Noise (opacity 0.02)

### 17.5 Performance Modules

**`PerformanceRing.jsx` (~110 lines):**
Custom shader geometry ring with tick marks representing a gauge. Uses GLSL vertex/fragment shaders for animated tick marks with color gradient (cyan → orange → red). Displays HP value as floating `Text` from Drei.

**`PowerFlow.jsx` (~115 lines):**
Plasma energy flow visualization. Creates `CatmullRomCurve3` paths from the engine to each wheel. Custom `ShaderMaterial` with animated UV scrolling to simulate energy flowing through tubes. Color shifts from orange (engine) to cyan (wheels) based on `uProgress` uniform.

**`WindLines.jsx` (~60 lines):**
`InstancedMesh` particle system with 50 wind line instances. Each line is a thin cylinder positioned randomly and animated leftward via `useFrame`. Creates a speed/wind effect around the car.

### 17.6 Safety Modules

**`SafetyShield.jsx` (~65 lines):**
Semi-transparent bubble shield around the car using a custom Fresnel `ShaderMaterial`. Sphere geometry with `side: THREE.FrontSide`. Animated opacity pulsing via `uTime` uniform.

**`LidarScanner.jsx` (~75 lines):**
Animated radar ring waves emanating from sensor anchor points on the car. Uses `RingGeometry` instances that scale outward and fade. Multiple concurrent rings with staggered timing. Configurable sensor anchor positions based on `techConfig.has_front_sensors` / `has_rear_sensors`.

**`BlindSpotSensor.jsx` (~70 lines):**
Pulsing orange spheres positioned at blind-spot sensor locations (typically side mirrors). Animated scale pulsing via `useFrame` with sinusoidal easing.

### 17.7 Utility Modules

**`CargoVolume.jsx` (~120 lines):**
Animated translucent box representing trunk cargo volume. Uses `BoxGeometry` positioned at the rear of the car. Animates from zero height to full height on mode entry. Displays capacity label (e.g., "480L") as floating `Text`. Trunk stays closed (no open animation). Color: cinematic uses semi-transparent cyan with wireframe overlay; MT uses blue (`#2563eb`) with matching dark blue edges.

**`Dimensions.jsx` (~120 lines):**
Dimensional measurement lines with labels. Renders three measurement groups:

- **Length** — dashed line along the car's side with floating label (e.g., "4680 mm")
- **Width** — dashed line across the front with label
- **Height** — vertical dashed line with label

Each line uses `Line` from Drei with `dashed` prop. Labels use `Text` with billboard positioning. Values sourced from `techConfig.dimensions`.

---

## 18. AutoSense Layer System

### 18.1 Story Container

**File:** `components/AutoSense/layers/StoryContainer.jsx` (~55 lines)

The composition root that layers all visual systems:

```jsx
<div className="relative w-full h-full overflow-hidden">
  {/* Layer 1: 3D Model (only for tech_view) */}
  <CanvasWrapper />

  {/* Layer 2: 2D Scene Image (Ken Burns) */}
  <SceneLayer editorMode={editorMode} freezeAnimation={freezeAnimation} />

  {/* Layer 3: Content Glass Card */}
  <SlideContentLayer />

  {/* Layer 4: Subtitles */}
  <Subtitles />

  {/* Layer 5: Audio (invisible) */}
  <AudioPlayer />

  {/* Layer 6: Free Roam Exit Button */}
  {isFreeRoam && <button onClick={exitFreeRoam}>Exit Free Roam</button>}
</div>
```

Props: `editorMode` (boolean), `freezeAnimation` (boolean — from editor hotspot drag).

### 18.2 Scene Layer

**File:** `components/AutoSense/layers/SceneLayer.jsx` (~130 lines)

Manages the 2D background image layer with Ken Burns animation and scene transitions.

**Ken Burns Animation:**

```javascript
const motionVariants = {
  "slow-zoom-in":   { scale: [1, 1.08], transition: { duration: 15, ease: "linear" } },
  "slow-zoom-out":  { scale: [1.08, 1], ... },
  "subtle-pan-right": { x: ["0%", "3%"], ... },
  "static":         { scale: 1 },
};
```

The active motion variant is sourced from `scene.layout.motion.image`. Animation pauses when `isAnimationPaused` is true (playback paused or hotspot being dragged).

**Scene Transitions:**
Scene changes trigger a brief overlay flash (white → transparent) for visual continuity.

**Tech View Handling:**
For `tech_view` scenes, the image fades out (opacity → 0) to reveal the 3D canvas underneath.

**Hotspot Rendering:**
Conditionally renders either `HotspotLayer` (playback mode) or `EditorHotspotLayer` (editor mode) inside the Ken Burns animated div, ensuring hotspots move with the image.

### 18.3 Slide Content Layer

**File:** `components/AutoSense/layers/SlideContentLayer.jsx` (~470 lines)

The glass-card content overlay. This is the largest layer component and handles all 4 scene types.

**Content blur effect:** When `activeHotspotId` is set, the entire content layer applies `blur(8px)` and `opacity: 0.3` to draw attention to the expanded hotspot card.

**Scene type rendering:**

#### `intro_view`:

```
┌─────────────────────────────────┐
│                                 │
│     [subtitle text]             │
│     [TITLE TEXT]                │ ← Large display font
│     [▶ Start Experience]       │ ← Calls startExperience()
│                                 │
└─────────────────────────────────┘
```

#### `slide_view` / `tech_view`:

```
┌─────────────────────────────────┐
│  [Badge] [Badge]                │ ← Badge pills with hover cards
│                                 │
│  HEADLINE                       │ ← Max 5 words
│  Paragraph text describing      │ ← Max 40 words
│  the feature in detail.         │
│                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ 280  │ │ 4.5  │ │ AWD  │    │ ← Key stats (max 3)
│  │  HP  │ │  sec │ │      │    │
│  └──────┘ └──────┘ └──────┘    │
│                                 │
│  [Primary] [Secondary] [Free]   │ ← Camera controls (tech_view only)
└─────────────────────────────────┘
```

**Alignment:** Controlled by `scene.slide_content.alignment` or `scene.layout.content_alignment`:

- `left` → `items-start text-left` (glass card on left side)
- `right` → `items-end text-right`
- `center` → `items-center text-center`
- `tech_view` forces `right` alignment

#### `outro_view`:

```
┌─────────────────────────────────┐
│                                 │
│     HEADLINE                    │
│     Subheadline text            │
│                                 │
│     [Primary CTA]  [Secondary]  │
│                                 │
└─────────────────────────────────┘
```

Primary CTA supports `REPLAY_STORY` action (resets to scene 0 and plays).

**Badge Rendering System:**

`getBadgeIcon(badge)` maps badge IDs/categories to Lucide icons:

| Pattern Match              | Icon          |
| -------------------------- | ------------- |
| CARPLAY                    | `Smartphone`  |
| ANDROID                    | `Smartphone`  |
| BLUETOOTH                  | `Bluetooth`   |
| WIFI                       | `Wifi`        |
| NHTSA, NCAP                | `ShieldCheck` |
| JDPOWER                    | `Medal`       |
| KBB                        | `BookOpen`    |
| Category: SAFETY           | `Shield`      |
| Category: PERFORMANCE      | `Gauge`       |
| Category: ECO / REGULATORY | `Leaf`        |
| Category: AWARD            | `Trophy`      |
| Category: TECHNOLOGY       | `Cpu`         |
| Default                    | `Award`       |

`getBadgeColor(badge)` maps categories to Tailwind color classes:

| Category         | Color                              |
| ---------------- | ---------------------------------- |
| SAFETY           | `text-blue-400 bg-blue-500/10`     |
| PERFORMANCE      | `text-red-400 bg-red-500/10`       |
| ECO / REGULATORY | `text-green-400 bg-green-500/10`   |
| AWARD            | `text-amber-400 bg-amber-500/10`   |
| TECHNOLOGY       | `text-purple-400 bg-purple-500/10` |
| TRUST            | `text-cyan-400 bg-cyan-500/10`     |

Badge images load from Supabase Storage: `https://{supabase_host}/storage/v1/object/public/badges/{badge.visuals.image_path}`.

**Smart Stats Renderer:**

Cleans raw stat values for display:

- Boolean strings: `"yes"` → `"Active"`, `"no"` → `"N/A"`, `"standard"` → `"Standard"` (with color coding — green/red/amber)
- Filler units suppressed: units matching `feature`, `system`, `type`, `mode`, `level`, `standard`, `rating`, `class`, `style`, `available`, `active` are hidden

**Camera View Labels** (tech_view only):

| Theme       | Primary       | Secondary    | Tertiary      |
| ----------- | ------------- | ------------ | ------------- |
| SAFETY      | Front Sensors | Rear Sensors | 360° Top View |
| UTILITY     | Dimensions    | Cargo Volume | —             |
| PERFORMANCE | Powertrain    | Axle View    | —             |
| Default     | View A        | View B       | —             |

---

## 18.4 Minimal Tech Theme System

The AutoSense Player supports two visual themes controlled by `storyData.meta.template`:

- **Cinematic** (default) — dark, dramatic, glowing, additive-blending effects
- **Minimal Tech** — light-mode, clinical, high-contrast on white

The theme is derived everywhere via:

```javascript
const isMinimalTech =
  (storyData?.meta?.template || "").toLowerCase().replace(/[\s-]/g, "") ===
  "minimaltech";
```

### 18.4.1 Canvas & Environment (MT)

| Property                | Cinematic                       | Minimal Tech                                                                               |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| Canvas background       | `#050505` (near-black)          | `#f5f5f4` (warm stone-100)                                                                 |
| Wrapper div             | `bg-black`                      | `bg-neutral-100`                                                                           |
| `toneMappingExposure`   | 1.0                             | 1.5                                                                                        |
| Bloom                   | threshold 1, intensity 1.5      | threshold 4, intensity 0.2 (near-disabled)                                                 |
| Vignette / Noise        | Yes                             | Disabled                                                                                   |
| Contact Shadows         | blur 2, opacity 0.5, black      | blur 1, opacity 0.25, gray                                                                 |
| Lighting                | Dramatic rim lights (cool/warm) | Even studio fill — 2 extra spots + ambient                                                 |
| **Infinite Grid Floor** | Not used                        | Rendered on all tech_view modes (PERFORMANCE, SAFETY, UTILITY) via `<Grid infiniteGrid />` |

### 18.4.2 Generic Model Label

A text label is shown in the top-left corner of all `tech_view` scenes (both themes):

- **Minimal Tech**: `"This is a preview of a generic SUV/Sedan car model"` — `bg-white/80 text-zinc-500 border-zinc-200`
- **Cinematic**: `"Preview — Generic SUV/Sedan 3D Model"` — `bg-black/60 text-white/60 border-white/10`

### 18.4.3 3D Materials (MT)

Additional materials in the library for Minimal Tech:

| Key              | Type                 | Usage                                                                                              |
| ---------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `mtFrostedGlass` | MeshPhysicalMaterial | Body panels — translucent white, transmission 0.5, opacity 0.65, clearcoat 0.3                     |
| `mtEngine`       | MeshStandardMaterial | Anodized crimson engine block — metalness 0.7                                                      |
| `mtSteel`        | MeshStandardMaterial | Brushed steel drivetrain — metalness 0.9                                                           |
| `mtWhiteMatte`   | MeshStandardMaterial | Pure matte white clay (Utility body)                                                               |
| `mtBlackOutline` | LineBasicMaterial    | Dark contour edges (Utility edges)                                                                 |
| `mtWireframe`    | MeshBasicMaterial    | Gray wireframe (legacy, replaced by mtFrostedGlass for Safety body)                                |
| `mtDarkChrome`   | MeshStandardMaterial | Dark chrome wheels                                                                                 |
| `mtMedical`      | MeshPhysicalMaterial | Pale blue ghost body (legacy Safety, replaced)                                                     |
| `mtAirbagRed`    | MeshBasicMaterial    | Red airbags — `depthTest: false`, `toneMapped: false`, renders on top of chassis (renderOrder 999) |
| `mtAxleGlow`     | MeshStandardMaterial | Blue emissive axles/wheels — emissive `#2563eb`, intensity 1.5                                     |

### 18.4.4 Mode Switching (MT)

| Mode        | Body                           | Glass            | Wheels                                     | Special                                                                                      |
| ----------- | ------------------------------ | ---------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| SAFETY      | `mtFrostedGlass` (translucent) | `mtFrostedGlass` | `mtFrostedGlass` (hologram-like)           | Airbags render on top (x-ray), `tintedGlass` for head/taillights (3D volumetric), grid floor |
| PERFORMANCE | `mtFrostedGlass`               | `mtFrostedGlass` | `mtAxleGlow` (blue emissive, matches flow) | Axles use `mtAxleGlow`, PowerFlow uses blue NormalBlending plasma shader, grid floor         |
| UTILITY     | `mtWhiteMatte` (clay)          | `mtFrostedGlass` | `mtDarkChrome`                             | Black contour edges on body, grid floor, blue cargo volume box                               |

### 18.4.5 PowerFlow Shader (MT)

The MT flow shader matches the cinematic plasma pattern (`sin()` dash + `smoothstep` + base glow) but uses:

- Color: `#2563eb` (blue-600) instead of `#00ffff` (cyan)
- Blending: `NormalBlending` (stays vivid on white background vs AdditiveBlending which washes out)
- Base glow: 0.25 (stronger than cinematic's 0.1)
- Beam radius: 0.055 (thicker than cinematic's 0.04)

### 18.4.6 Cargo Volume (MT)

- Color: blue (`#2563eb`) with emissive `#1e40af` (matches PowerFlow blue language)
- Edge outline: dark blue `#1e40af` at 90% opacity
- Trunk stays closed (no open animation in any theme/mode)

### 18.4.7 UI Overlay Components (MT)

All 6 overlay components are themed:

| Component           | Cinematic                                      | Minimal Tech                                                                   |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `BreathingHotspot`  | Pulsing white dot with breathing ring          | Filled dark dot (`bg-zinc-800`) with pulsing ring border, turns blue on active |
| `PearlyHoverCard`   | `bg-white/10 backdrop-blur-xl border-white/20` | `bg-white border-zinc-200 shadow-lg`, dark text                                |
| `SceneLayer`        | Ken Burns active, gradient overlays            | Ken Burns disabled (`scale:1`), no gradients                                   |
| `SlideContentLayer` | Dark glass card, white text, orange/cyan stats | White card, dark text, emerald/blue stats, inverted buttons                    |
| `StoryContainer`    | Free roam exit: dark translucent               | Free roam exit: white with dark text, hover inverts                            |
| `HotspotLayer`      | Passes `isMinimalTech` to children             | Same                                                                           |

### 18.4.8 Utility Modules (MT)

- **Dimensions**: Lines, ticks, and labels are dark (`#18181b`) with light outline (`#f5f5f4`)
- **WindLines**: Dark gray (`#3f3f46`), `NormalBlending`, 18% opacity

### 18.4.9 Safety Modules (MT)

- **LidarScanner**: `NormalBlending`, hexagonal ring segments (6 sides), solid cyan `#06b6d4`
- **BlindSpotSensor**: `NormalBlending`, low-poly spheres (6 segments), flattened Z-scale (disc-like), safety yellow `#eab308`

---

## 19. AutoSense Interactive System

### 19.1 Hotspot Layer

**File:** `components/AutoSense/interactive/HotspotLayer.jsx` (~75 lines)

Renders positioned hotspot dots over the scene image. Each hotspot is absolutely positioned using `left: x%`, `top: y%` from the hotspot's coordinate data (0–100 scale).

Renders `BreathingHotspot` for each entry, with `PearlyHoverCard` appearing on hover.

### 19.2 Breathing Hotspot

**File:** `components/AutoSense/interactive/BreathingHotspot.jsx` (~62 lines)

Animated pulsing dot with two visual modes:

**Cinematic (default):**

1. **Inner dot:** 12px white circle with subtle shadow
2. **Outer ring:** Animated scale (1 → 1.8 → 1) with opacity (0.6 → 0 → 0.6), 2-second loop

**Minimal Tech:**

1. **Center dot:** 10px filled circle (`bg-zinc-800`, turns `bg-blue-600` when active)
2. **Static ring:** `border-2 border-zinc-800` (turns `border-blue-600` when active)
3. **Pulsing ring:** Same animation as cinematic outer ring, high contrast on white

On click, sets `activeHotspotId` in the store, which triggers the content blur effect and shows the `PearlyHoverCard`.

### 19.3 Pearly Hover Card

**File:** `components/AutoSense/interactive/PearlyHoverCard.jsx` (~100 lines)

Glassmorphic info card that appears near a hotspot when clicked or hovered.

**Design:**

- Background: `bg-white/10 backdrop-blur-xl`
- Border: `border border-white/20`
- Shadow: soft white glow

**Content:**

- `detail_title` — bold heading
- `detail_body` — description text

**Positioning:** Smart directional placement — detects if the hotspot is near the edge of the viewport and flips the card direction (left/right/top/bottom) to keep it visible. Uses Framer Motion spring animation for entry (`scale: 0.9 → 1`, `opacity: 0 → 1`).

**Dismiss:** Clicking outside or clicking the hotspot again clears `activeHotspotId`.

---

## 20. AutoSense Playback System

### 20.1 Playback View

**File:** `components/AutoSense/playback/PlaybackView.jsx` (~120 lines)

Full-screen viewer composing all playback components:

```jsx
<div className="relative w-screen h-screen bg-black overflow-hidden">
  <StoryContainer />
  <PlaybackControls />
  <KeyboardShortcuts />
  <ChatbotWidget />
  <AIIntentOrchestrator />
</div>
```

Manages auto-advance logic: when audio ends and `autoAdvance` is true, advances to next scene after a 1-second delay. On the intro scene, clicking "Start Experience" triggers `startExperience()` which plays and navigates to scene 1.

### 20.2 Playback Controls

**File:** `components/AutoSense/playback/PlaybackControls.jsx` (~230 lines)

Transport bar at the bottom of the screen:

```
┌──────────────────────────────────────────────────────────────────┐
│ [◀] [⏯] [▶]  │  Scene 2 of 5  │  [🔊] [⏩] [📋] [⌨] [⬛]    │
└──────────────────────────────────────────────────────────────────┘
```

**Controls:**

| Button          | Action                                         |
| --------------- | ---------------------------------------------- |
| ◀ Previous      | `prevScene()`                                  |
| ⏯ Play/Pause   | `togglePlayPause()`                            |
| ▶ Next          | `nextScene()`                                  |
| Scene Dropdown  | Scene selector with type badges                |
| 🔊 Audio        | Toggle audio mute                              |
| ⏩ Auto-Advance | Toggle `setAutoAdvance()`                      |
| 📋 Timeline     | Toggle timeline visibility                     |
| ⌨ Shortcuts     | Toggle keyboard shortcut overlay               |
| ⬛ Fullscreen   | `document.documentElement.requestFullscreen()` |

**Auto-hide:** The transport bar fades out after 3 seconds of mouse inactivity (except when hovering over the bar itself).

### 20.3 Audio Player

**File:** `components/AutoSense/playback/AudioPlayer.jsx` (~70 lines)

Hidden `<audio>` element that:

- Loads `currentScene.audio_url` as source
- Syncs playback state with `useStoryStore` (`isPlaying` → `play()`/`pause()`)
- Updates `audioCurrentTime` via `timeupdate` event (for subtitle sync)
- Fires `onEnded` callback for auto-advance logic
- Resets and loads new source on scene change

### 20.4 Subtitles

**File:** `components/AutoSense/playback/Subtitles.jsx` (~40 lines)

Time-synced subtitle display. Reads `currentScene.subtitles[]` (array of `{ text, start, end }`) and matches against `audioCurrentTime` to find the active subtitle segment.

**Rendering:**

```jsx
<AnimatePresence mode="wait">
  {activeSubtitle && (
    <motion.div className="absolute bottom-24 left-1/2 -translate-x-1/2 ...">
      {activeSubtitle.text}
    </motion.div>
  )}
</AnimatePresence>
```

Positioned above the transport bar. Animated with fade transitions between segments.

### 20.5 Timeline

**File:** `components/AutoSense/playback/Timeline.jsx` (~200 lines)

Scrubbing timeline with scene markers:

```
[Intro]────[Slide 1]────[3D Tech]────[Slide 2]────[Outro]
  ●─────────●━━━━━━━━━━━●────────────●────────────●
```

**Features:**

- Scene markers positioned proportionally along the bar
- Active scene highlighted with filled dot
- Click on any marker to jump to that scene
- Drag support for scrubbing through scenes
- Scene type icons (Play, Image, Box, Flag) per marker
- Hover tooltip showing scene title

### 20.6 Keyboard Shortcuts

**File:** `components/AutoSense/playback/KeyboardShortcuts.jsx` (~95 lines)

`?` key toggles an overlay showing all keyboard shortcuts:

| Key      | Action                 |
| -------- | ---------------------- |
| `Space`  | Play / Pause           |
| `→`      | Next Scene             |
| `←`      | Previous Scene         |
| `Escape` | Exit Free Roam / Close |
| `F`      | Toggle Fullscreen      |
| `M`      | Toggle Mute            |
| `A`      | Toggle Auto-Advance    |
| `?`      | Toggle This Overlay    |

Shortcuts are registered via `useEffect` + `keydown` event listener.

---

## 21. AutoSense AI System (Chatbot)

### 21.1 Chatbot Widget

**File:** `components/AutoSense/ai/ChatbotWidget.jsx` (~230 lines)

Floating chat window triggered by a fab button in the bottom-right corner of the player.

**Features:**

- Animated open/close via Framer Motion (scale + opacity)
- Message list with auto-scroll to bottom
- Typing indicator (3 bouncing dots) while `isTyping` is true
- Contextual suggestion chips below the input
- Chat header with close button and car model name
- Integrates `ChatInput` and `ChatMessage` components

**Context Awareness:**
Passes current scene data and car specs to the `ChatbotService` for context-aware responses.

### 21.2 Chat Input

**File:** `components/AutoSense/ai/ChatInput.jsx` (~100 lines)

Text input with:

- Submit on Enter (Shift+Enter for newline)
- Suggestion chips rendered above the input when available
- Clicking a chip auto-submits it as a message
- Input clears on submit

### 21.3 Chat Message

**File:** `components/AutoSense/ai/ChatMessage.jsx` (~35 lines)

Renders message bubbles:

- **Bot messages:** Left-aligned, gray background, bot avatar icon
- **User messages:** Right-aligned, primary purple background, no avatar

### 21.4 Chatbot Service

**File:** `components/AutoSense/services/ChatbotService.js` (~640 lines)

Rule-based chatbot backend running entirely client-side (no API calls). Instantiated as a singleton.

**Architecture:**

```
User message
    │
    ▼
generateResponse(message, carData, currentScene)
    │
    ├─ Check 20+ intent patterns (keyword matching)
    │    ├─ Identity → "This is a {year} {make} {model} {trim}"
    │    ├─ Color → "This {model} comes in {color}"
    │    ├─ Price → formatPrice() with payment estimate
    │    ├─ Safety → rating + badge labels
    │    ├─ HP → "{hp} horsepower with {cylinders} engine"
    │    ├─ Torque → "{torque} Nm of torque"
    │    ├─ Drivetrain → AWD/FWD/RWD explanation
    │    ├─ 0-60 → "0 to 60 mph in {time} seconds"
    │    ├─ Fuel → fuel type + economy
    │    ├─ Range → "{range} km range"
    │    ├─ Dimensions → length/width/height
    │    ├─ Cargo → "{trunk}L trunk capacity"
    │    ├─ Seats → "{seats} passengers"
    │    ├─ Full specs → complete spec summary
    │    └─ ... (20+ more)
    │
    ├─ Scene context fallback
    │    └─ Searches current scene's key_stats and paragraph
    │
    ├─ General knowledge fallback
    │    └─ Matches against generalKnowledge dictionary
    │
    └─ Default fallback
        └─ "I'm not sure about that. Try asking about..."
```

**Key Dictionaries:**

`generalKnowledge` (11 entries): Pre-written answers for common generic questions (range, mpg, safety, carplay, android auto, bluetooth, awd, fwd, rwd, turbo, hybrid).

`badgeLabels` (11 entries): Human-readable translations for badge IDs used in award/safety responses.

**`getContextualSuggestions(currentScene)`:**

Returns 3 contextual follow-up suggestions based on the scene's theme:

| Theme             | Example Suggestions                              |
| ----------------- | ------------------------------------------------ |
| Performance       | "What's the 0-60?", "Tell me about the engine"   |
| Efficiency        | "What's the fuel economy?", "How far can it go?" |
| Safety            | "What safety features?", "Crash test rating?"    |
| Utility           | "Trunk capacity?", "How many passengers?"        |
| Design / Exterior | "What color is it?", "Body type?"                |
| Interior          | "Interior features?", "Infotainment system?"     |

### 21.5 AI Intent Orchestrator

**File:** `components/AutoSense/ai/AIIntentOrchestrator.jsx` (~35 lines)

Placeholder component for future AI intent routing. Currently renders an `AIWhisper` sub-component that shows subtle AI-suggested actions as floating whispers. Not fully implemented — serves as the architecture hook for future intent-based UX orchestration.

---

## 22. AutoSense Editor

The editor system is comprehensively documented in **[EDITOR_ARCHITECTURE.md](EDITOR_ARCHITECTURE.md)**. Key files:

| File                            | Lines | Purpose                                                            |
| ------------------------------- | ----- | ------------------------------------------------------------------ |
| `editor/EditorView.jsx`         | ~470  | Main layout: header + scene list + preview                         |
| `editor/InlineEditOverlay.jsx`  | ~700  | WYSIWYG text editing over live preview                             |
| `editor/FloatingToolbar.jsx`    | ~130  | Vertical panel bar (5 panel types)                                 |
| `editor/ScriptDock.jsx`         | ~400  | Voiceover editing with TTS regeneration                            |
| `editor/EditorHotspotLayer.jsx` | ~250  | Draggable hotspot positioning                                      |
| `editor/AddSceneModal.jsx`      | ~280  | Manual + AI scene creation                                         |
| `editor/CopilotChat.jsx`        | ~350  | AI copilot side panel                                              |
| `editor/panels/` (7 files)      | ~1250 | Layout, Badges, Hotspots, Image, Animation, Content, Script panels |

---

## 23. Services & Utilities

### `config/supabaseClient.js`

```javascript
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Uses the **anon key** (not service role) for client-side RLS-protected access.

### `hooks/useImageUpload.js`

Custom React hook for uploading images to Supabase Storage:

1. Validates file type (images only) and size (max 2MB)
2. Generates unique path: `{user_id}/{timestamp}.{ext}`
3. Uploads to specified bucket
4. Returns public URL

Used by: `BrandingStep` (logo upload), `AddCarModal` (car photos).

### `lib/utils.js`

```javascript
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

Standard utility for conditional Tailwind class merging.

### `services/carSpecsService.js`

RapidAPI Car-Specs integration:

**`normalizeCarData(apiData)`:**

1. Extracts identity fields (make, model, year, trim, bodyType, driveType, transmission, engineHp)
2. Flattens remaining fields into `{ id, key, label, value }` specs array
3. Filters out null/empty/N/A values
4. Converts camelCase keys to Title Case labels (e.g., `maxTorqueNM` → `"Max Torque NM"`)
5. Assigns UUID to each spec for React list rendering

**`fetchTrimSpecs(trimId)`:**

```
GET https://car-specs.p.rapidapi.com/v2/cars/trims/{trimId}
Headers: x-rapidapi-key, x-rapidapi-host
→ normalizeCarData(response.data)
→ { identity, specsList }
```

---

## 24. Environment Variables

```env
# Client (.env in client/)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_RAPIDAPI_KEY=...
VITE_RAPIDAPI_HOST=car-specs.p.rapidapi.com
```

All client-side env vars use the `VITE_` prefix (required by Vite for public exposure).

---

## 25. Full Component Tree

```
ReactDOM.createRoot(#root)
  └── React.StrictMode
      └── Redux Provider (store: auth, dealer, inventory, studio, microsite)
          └── BrowserRouter
              └── HeroUIProvider
                  └── App
                      ├── /                          → Home (landing page)
                      │
                      ├── /login                     → AuthLayout > Login
                      │
                      ├── /onboarding/*              → OnboardingLayout
                      │   ├── account                 → AccountStep
                      │   ├── payment                 → PaymentStep
                      │   └── branding                → BrandingStep
                      │
                      ├── /dashboard/*               → ProtectedRoute > DashboardLayout
                      │   │                              ├── PrimaryRail (icon nav)
                      │   │                              └── SecondarySidebar (context nav)
                      │   │
                      │   ├── (index)                 → DashboardHome
                      │   │
                      │   ├── inventory               → Inventory
                      │   │                              ├── AddCarModal
                      │   │                              │   └── SpecsDrawer
                      │   │                              └── InventoryTable
                      │   │
                      │   ├── studio                  → StudioPage
                      │   │                              └── StudioCard (×N)
                      │   │
                      │   ├── studio/wizard           → StudioWizard
                      │   │                              ├── CarSelectorStep
                      │   │                              ├── ConfigStep
                      │   │                              └── GenerationVisualizer
                      │   │
                      │   └── editor/:storyId         → EditorPage
                      │                                  └── AutoSenseLoader
                      │                                      └── EditorView
                      │                                          ├── SceneList (Reorder.Group)
                      │                                          ├── StoryContainer
                      │                                          │   ├── CanvasWrapper > CarModel
                      │                                          │   ├── SceneLayer > EditorHotspotLayer
                      │                                          │   ├── SlideContentLayer
                      │                                          │   ├── Subtitles
                      │                                          │   └── AudioPlayer
                      │                                          ├── InlineEditOverlay
                      │                                          ├── FloatingToolbar > Panels
                      │                                          ├── ScriptDock
                      │                                          ├── HotspotDragBar
                      │                                          ├── AddSceneModal
                      │                                          └── CopilotChat
                      │
                      ├── /experience/:storyId        → ViewerPage
                      │                                  └── AutoSenseLoader
                      │                                      └── PlaybackView
                      │                                          ├── StoryContainer
                      │                                          │   ├── CanvasWrapper > CarModel
                      │                                          │   ├── SceneLayer > HotspotLayer
                      │                                          │   │                └── BreathingHotspot
                      │                                          │   │                └── PearlyHoverCard
                      │                                          │   ├── SlideContentLayer
                      │                                          │   ├── Subtitles
                      │                                          │   └── AudioPlayer
                      │                                          ├── PlaybackControls
                      │                                          ├── Timeline
                      │                                          ├── KeyboardShortcuts
                      │                                          ├── ChatbotWidget
                      │                                          │   ├── ChatInput
                      │                                          │   └── ChatMessage (×N)
                      │                                          └── AIIntentOrchestrator
                      │
                      └── /sites/:dealerId/*          → PublicLayout
                          │                              ├── PublicNavbar
                          │                              └── Footer
                          │
                          ├── (index)                 → Showroom
                          │                              ├── FilterSidebar
                          │                              └── PublicCarCard (×N)
                          │
                          └── inventory/:carId        → VehicleDetail
                                                        ├── Photo Gallery
                                                        ├── Experience (3D)
                                                        │   ├── Exterior
                                                        │   └── GlossyFloor
                                                        ├── Interior (360°)
                                                        └── Contact Form
```
