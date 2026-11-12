# AutoSight AI Backend — Current Architecture Reference

> This document reflects the current Google/Gemini-only backend runtime in `server/`.

---

## Table of Contents

1. [Overview & Stack](#1-overview--stack)
2. [File Map — Current Backend Files](#2-file-map--current-backend-files)
3. [Configuration Layer](#3-configuration-layer)
4. [API Layer (Routes & Controllers)](#4-api-layer-routes--controllers)
5. [Ingestion Pipeline](#5-ingestion-pipeline)
6. [Badge Intelligence System](#6-badge-intelligence-system)
7. [Multi-Agent Orchestrator](#7-multi-agent-orchestrator)
8. [Gemini Agent System](#8-gemini-agent-system)
   - [Analyst Agent](#81-analyst-agent)
   - [Director Agent](#82-director-agent)
   - [Scriptwriter Agent](#83-scriptwriter-agent)
9. [Media Generation & Voice Pipeline](#9-media-generation--voice-pipeline)
   - [Visualizer Agent](#91-visualizer-agent)
   - [Google Image Service](#92-google-image-service)
   - [Prompt Builder](#93-prompt-builder)
   - [Vision Enricher](#94-vision-enricher)
   - [Vision Scanner](#95-vision-scanner)
   - [Google Voice Service](#96-google-voice-service)
   - [Audio Agent](#97-audio-agent)
   - [Transcription & Subtitle Parsing](#98-transcription--subtitle-parsing)
10. [Editor Service (Live Editing API)](#10-editor-service-live-editing-api)
11. [RAG Document Ingestion Pipeline](#11-rag-document-ingestion-pipeline)

- [Python PDF Shredder](#111-python-pdf-shredder)
- [Embedding Service](#112-embedding-service)
- [RAG Controller](#113-rag-controller)
- [Supabase Vector Store](#114-supabase-vector-store)

12. [Multimodal RAG Chatbot](#12-multimodal-rag-chatbot)

- [Tier 0 — Booking Intent Tool Gate](#tier-0--booking-intent-tool-gate)
- [Tier 1 — Context Check](#tier-1--context-check)
- [Tier 2 — Vector Search](#tier-2--vector-search)
- [Tier 3 — Grounded Synthesis](#tier-3--grounded-synthesis)

13. [Test Drive Booking Flow](#13-test-drive-booking-flow)
14. [Realtime Voice Systems](#14-realtime-voice-systems)

- [Chatbot Voice — WebSocket + Gemini Live](#141-chatbot-voice--websocket--gemini-live)
- [Editor Voice — LiveKit + Gemini Live](#142-editor-voice--livekit--gemini-live)

15. [Quality Assurance & Final Story Shape](#15-quality-assurance--final-story-shape)
16. [Data Schemas](#16-data-schemas)
17. [Environment Variables](#17-environment-variables)
18. [End-to-End Flow Diagram](#18-end-to-end-flow-diagram)

---

## 1. Overview & Stack

The AutoSight backend is an Express 5 application that turns a `car_id` into a finished interactive vehicle story, powers document-grounded chat, and supports both text and voice editing.

At a high level it:

1. Reads vehicle data and dealer assets from Supabase
2. Builds a normalized `CarContext`
3. Verifies badges through rule logic, government APIs, and Gemini-grounded web search
4. Uses Gemini agents to analyze the car, plan scenes, and write copy
5. Generates story images with Google image models
6. Generates voiceover with Google Cloud TTS and subtitle timing with Google STT + Gemini
7. Stores the final story JSON in Supabase
8. Ingests PDF brochures/spec sheets into pgvector for RAG search
9. Answers shopper questions through a multi-tier Gemini RAG pipeline
10. Supports realtime voice flows with Gemini Live

### Current Technology Stack

| Component                   | Current Runtime                                              |
| --------------------------- | ------------------------------------------------------------ |
| Runtime                     | Node.js (CommonJS)                                           |
| HTTP framework              | Express 5.2                                                  |
| Primary text models         | Gemini Flash + Gemini Pro via `@google/genai`                |
| Structured output           | Gemini function-calling + Zod via `generateStructuredData()` |
| Experience image generation | Google Imagen via `models.generateImages()`                  |
| Editor image generation     | Gemini image generation via `models.generateContent()`       |
| Vision prompt enrichment    | Gemini multimodal analysis                                   |
| Hotspot localization        | Gemini multimodal structured bounding boxes                  |
| Voiceover synthesis         | Google Cloud Text-to-Speech (Chirp HD voices)                |
| Speech recognition          | Google Cloud Speech-to-Text                                  |
| Subtitle grouping           | Gemini Flash JSON segmentation + rule-based fallback         |
| Realtime voice agent        | Gemini Live native audio                                     |
| Search grounding            | Gemini `googleSearch` tool                                   |
| Embeddings                  | `gemini-embedding-001`                                       |
| Database                    | Supabase Postgres                                            |
| Object storage              | Supabase Storage                                             |
| Vector store                | Supabase pgvector (`car_knowledge_base`)                     |
| Vehicle data API            | RapidAPI Car Specs v2                                        |
| Badge verification APIs     | NHTSA Safety Ratings API, EPA Fuel Economy API               |
| PDF processing              | Python 3.14, PyMuPDF, pdfplumber                             |
| Image processing            | `sharp`                                                      |
| Realtime transport          | Native WebSocket (`ws`) and LiveKit                          |

### Deployment Model

- Text, image, and embedding calls can run through Vertex AI or API-key mode, depending on environment configuration in `server/src/config/aiConfig.js`.
- Realtime Gemini Live sessions are implemented as Vertex-first flows and require a Google Cloud project configuration.
- Google Cloud TTS/STT also rely on Google Cloud credentials in the runtime environment.

---

## 2. File Map — Current Backend Files

```text
server/
├── index.js                          # Express app, CORS, HTTP server, WS upgrade for chatbot voice
├── package.json                      # Backend runtime dependencies
└── src/
    ├── config/
    │   ├── aiConfig.js               # Gemini client creation, model aliases, text/image/embed helpers
    │   ├── rapidApi.js               # RapidAPI client for car specs lookups
    │   └── supabase.js               # Shared Supabase client
    │
    ├── controllers/
    │   ├── ingestionController.js    # POST /api/ingest/context
    │   ├── editorController.js       # POST /api/editor/* handlers
    │   ├── ragController.js          # PDF ingest, doc CRUD, RAG chat
    │   └── leadsController.js        # Test drive booking + dealer lookup
    │
    ├── routes/
    │   ├── ingestionRoutes.js        # /api/ingest/*
    │   ├── editorRoutes.js           # /api/editor/*
    │   ├── editorVoiceRoutes.js      # /api/editor/voice/* (LiveKit + Gemini Live)
    │   ├── ragRoutes.js              # /api/rag/*
    │   ├── chatbotVoiceRoutes.js     # /api/rag/voice/* config + SSE helpers for chatbot voice
    │   ├── carSpecsRoutes.js         # /api/car-specs/* proxy routes
    │   └── leadsRoutes.js            # /api/leads/*
    │
    ├── services/
    │   ├── orchestrator.js           # Master pipeline and final story assembly
    │   ├── editorService.js          # Editor image, voice, scene generation, text copilot
    │   ├── ragChatService.js         # 4-tier Gemini RAG chatbot pipeline
    │   ├── embeddingService.js       # Gemini embeddings wrapper
    │   ├── chatbotVoiceService.js    # Gemini Live chatbot voice session logic
    │   ├── chatbotWsHandler.js       # WS protocol handler for shopper voice chat
    │   ├── chatbotEventBus.js        # SSE bus for shopper voice events
    │   ├── chatbotLivekitAgent.js    # Alternate chatbot LiveKit bridge kept in repo; not current mounted route path
    │   ├── editorVoiceService.js     # Gemini Live editor copilot session logic
    │   ├── editorLivekitAgent.js     # LiveKit room bot for editor voice copilot
    │   ├── editorEventBus.js         # SSE bus for editor voice events
    │   │
    │   ├── ai/
    │   │   ├── analystAgent.js       # Agent 1: marketing/positioning analysis
    │   │   ├── directorAgent.js      # Agent 2: scene planning + tech_view shaping
    │   │   ├── scriptwriterAgent.js  # Agent 3: scene copy, voiceover, hotspots
    │   │   ├── prompts/
    │   │   │   ├── analystPrompt.js
    │   │   │   ├── directorPrompt.js
    │   │   │   └── scriptPrompt.js
    │   │   └── schemas/
    │   │       ├── analystSchema.js
    │   │       ├── directorSchema.js
    │   │       ├── editorSchemas.js
    │   │       └── scriptSchema.js
    │   │
    │   ├── badges/
    │   │   ├── badgeOrchestrator.js  # Parallel collection + ranking + dedup
    │   │   ├── badgeRegistry.js      # Badge definitions and visuals metadata
    │   │   └── collectors/
    │   │       ├── logicCollector.js # Rules-driven badges
    │   │       ├── apiCollector.js   # NHTSA + EPA badge lookup
    │   │       └── searchCollector.js# Gemini-grounded web search badge extraction
    │   │
    │   ├── ingestion/
    │   │   ├── ingestionService.js   # Builds normalized CarContext from DB rows
    │   │   ├── normalizer.js         # cleanNum, cleanInt, normalizeDrivetrain
    │   │   ├── schemas.js            # CarContext Zod schema
    │   │   └── badgeLogic.js         # Legacy helper retained in repo, superseded by badge system
    │   │
    │   ├── media/
    │   │   ├── visualizerAgent.js    # Image generation + hotspot scan pipeline
    │   │   ├── googleImageService.js # Experience/editor image generation + upload
    │   │   ├── googleVideoService.js # Intro video generation (Veo) from image + upload
    │   │   ├── googleVoiceService.js # Google TTS + STT wrappers
    │   │   ├── promptBuilder.js      # Theme-aware image prompt builder
    │   │   ├── visionEnricher.js     # Dealer photo analysis for prompt enrichment
    │   │   ├── visionScanner.js      # Gemini bounding-box hotspot localization
    │   │   ├── audioAgent.js         # Per-scene audio generation orchestrator
    │   │   ├── audioGenerator.js     # Thin wrapper around Google TTS service
    │   │   ├── transcriptionService.js # Word timings + Gemini subtitle grouping
    │   │   └── subtitleParser.js     # Rule-based subtitle fallback
    │   │
    │   └── utils/
    │       └── storyLogger.js        # Updates stories.current_agent during generation
    │
    ├── utils/
    │   └── zodToJsonSchema.js        # Zod -> JSON Schema conversion helper
    │
    └── scripts/
        └── python_shredder/
            ├── extractor.py          # PDF text/table/image extraction
            ├── requirements.txt      # Python dependencies
            └── venv/                 # Local virtual env (runtime support only)
```

---

## 3. Configuration Layer

### `index.js` — Server Entry Point

`index.js` wires the entire backend together:

- Creates the Express app
- Applies CORS with `CORS_ORIGINS` plus localhost defaults
- Mounts all REST route groups
- Creates an `http.Server`
- Registers a WebSocket upgrade path for `/api/rag/voice/ws`
- Installs a narrow `uncaughtException` guard for a known LiveKit FFI disconnect error

### Mounted Routes

| Mount Path          | Router                  | Purpose                                         |
| ------------------- | ----------------------- | ----------------------------------------------- |
| `/api/ingest`       | `ingestionRoutes.js`    | Story generation entrypoint                     |
| `/api/editor`       | `editorRoutes.js`       | Editor image/voice/scene/text copilot APIs      |
| `/api/editor/voice` | `editorVoiceRoutes.js`  | Dealer voice copilot over LiveKit + Gemini Live |
| `/api/rag`          | `ragRoutes.js`          | PDF ingest, document management, RAG chat       |
| `/api/rag/voice`    | `chatbotVoiceRoutes.js` | Chatbot voice config + SSE support              |
| `/api/car-specs`    | `carSpecsRoutes.js`     | RapidAPI trim/spec proxy                        |
| `/api/leads`        | `leadsRoutes.js`        | Test drive booking                              |

### WebSocket Upgrade

Only one upgrade path is currently mounted:

```text
/api/rag/voice/ws -> chatbotWsHandler.handleVoiceConnection()
```

All other upgrade requests are rejected.

### `config/aiConfig.js` — Gemini Client & Model Registry

`aiConfig.js` is the central runtime switchboard for Gemini usage.

It provides:

- Model alias normalization
- Default model selection for text, images, embeddings, and Live helpers
- Vertex-vs-API-key client creation
- Shared `generateText()` helper
- Shared `generateStructuredData()` helper with Zod validation
- Utility helpers for inline image/audio parts

### Active Model Registry

```javascript
const GEMINI_MODELS = {
  FLASH: process.env.GEMINI_FLASH_MODEL || "gemini-3-flash-preview",
  PRO: process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview",
  IMAGE: process.env.EDITOR_IMAGE_MODEL || "gemini-2.5-flash-image",
  EMBEDDING: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
};
```

### Client Creation Rules

`getGeminiClient()` behaves like this:

1. If `GOOGLE_CLOUD_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT` is set, build a Vertex AI client
2. Otherwise, fall back to `GOOGLE_API_KEY` or `GEMINI_API_KEY`
3. Reuse the client through a simple cache

`createGeminiClient()` is the same idea, but allows a specific region/project override for realtime Gemini Live sessions.

### Structured Output Helper

`generateStructuredData()` does not use LangChain. It:

- Converts a Zod schema to JSON Schema
- Declares a Gemini function named `emit_structured_response`
- Forces the model to return structured output
- Validates the returned payload against the original Zod schema

This helper is what powers the Analyst, Director, Scriptwriter, and many other structured flows.

### `config/supabase.js`

Creates the shared app-level Supabase client from:

- `SUPABASE_URL`
- `SUPABASE_KEY`

The ingestion service separately creates a service-role-capable client from `SUPABASE_SERVICE_KEY` or `SUPABASE_SECRET` for pipeline work.

### `config/rapidApi.js`

Creates the Axios client used for:

- `/api/car-specs/trims/:trimId`
- Any future backend-side trim/spec lookups

Headers are populated from `RAPIDAPI_KEY` and `RAPIDAPI_HOST`.

### `utils/zodToJsonSchema.js`

This utility converts Zod definitions into plain JSON Schema objects.

It is used by the Gemini structured output layer and supports:

- strings, numbers, booleans, enums, literals
- arrays and objects
- unions and discriminated unions
- optional, nullable, default, catch, branded, readonly wrappers

---

## 4. API Layer (Routes & Controllers)

### Ingestion API

| Endpoint              | Method | Controller        | Purpose                     |
| --------------------- | ------ | ----------------- | --------------------------- |
| `/api/ingest/context` | POST   | `generateContext` | Start full story generation |

### Request Body

```json
{
  "car_id": "uuid",
  "template": "cinematic",
  "scenes": "automatic",
  "language": "en"
}
```

Notes:

- `template` is passed through as-is and normalized downstream by consumers
- the current frontend sends Google/Gemini-only story settings; there are no provider toggles in the active runtime

### Controller Behavior

`ingestionController.generateContext()`:

1. Validates `car_id`
2. Reads `dealer_id` from `cars`
3. Upserts a `stories` row with `generation_status: "processing"`
4. Returns immediately with `{ success, storyId }`
5. Starts `runAutoSensePipeline(storyId, req.body)` asynchronously

### Editor API

| Endpoint                           | Method | Controller                  | Purpose                           |
| ---------------------------------- | ------ | --------------------------- | --------------------------------- |
| `/api/editor/regenerate-voiceover` | POST   | `handleRegenerateVoiceover` | Recreate scene audio + subtitles  |
| `/api/editor/regenerate-image`     | POST   | `handleRegenerateImage`     | Recreate a scene image            |
| `/api/editor/generate-scene`       | POST   | `handleGenerateScene`       | Generate a new `slide_view` scene |
| `/api/editor/copilot`              | POST   | `handleCopilot`             | Text-based story editing copilot  |
| `/api/editor/upload-image`         | POST   | `handleUploadImage`         | Upload a custom editor image      |

`editorRoutes.js` uses Multer memory storage for `/upload-image` with a 10 MB image limit.

### RAG API

| Endpoint                    | Method | Controller          | Purpose                             |
| --------------------------- | ------ | ------------------- | ----------------------------------- |
| `/api/rag/ingest`           | POST   | `ingestCarDocument` | Upload PDFs, shred, embed, store    |
| `/api/rag/chat`             | POST   | `chatWithCar`       | Shopper-facing multi-tier RAG chat  |
| `/api/rag/documents/:carId` | GET    | `getCarDocuments`   | List uploaded documents             |
| `/api/rag/documents/:docId` | DELETE | `deleteCarDocument` | Delete a stored PDF tracking record |

### Car Specs API

| Endpoint                       | Method | Route File          | Purpose                          |
| ------------------------------ | ------ | ------------------- | -------------------------------- |
| `/api/car-specs/trims/:trimId` | GET    | `carSpecsRoutes.js` | Proxy trim details from RapidAPI |

The route validates that `trimId` is numeric before forwarding the request.

### Leads API

| Endpoint            | Method | Controller         | Purpose                               |
| ------------------- | ------ | ------------------ | ------------------------------------- |
| `/api/leads/book`   | POST   | `bookTestDrive`    | Persist a booking in `leads`          |
| `/api/leads/dealer` | GET    | `getDealerByCarId` | Lookup `dealer_id` for legacy stories |

### Booking Request Shape

```json
{
  "car_id": "uuid",
  "dealer_id": "uuid",
  "customer_name": "Ada Lovelace",
  "phone": "+1 555 123 4567",
  "appointment_date": "2026-03-20",
  "appointment_time": "10:00"
}
```

In the current backend implementation, `appointment_date` and `appointment_time` are required at the controller layer.

---

## 5. Ingestion Pipeline

**File:** `server/src/services/ingestion/ingestionService.js`

`buildCarContext(requestParams)` builds the normalized object used everywhere else in the pipeline.

### Step 1 — Read the Vehicle Row

If `requestParams.car_id` exists, the ingestion service reads:

```text
cars.id = requestParams.car_id
```

It loads the entire row, including:

- identity fields (`make`, `model`, `year`, `trim`, `vin`)
- pricing and mileage
- `specs_raw`
- `dealer_id`
- `photos`

### Step 2 — Pull Story-Generation RAG Context

The service reads brochure-derived content from `car_knowledge_base`:

- `content_type IN ('text', 'table')`
- joined with blank lines
- truncated to 10,000 characters
- stored as `document_context`

This means uploaded documents influence the main story-generation pipeline, not just chat.

### Step 3 — Fetch Dealer Branding

If the car row has a `dealer_id`, ingestion also reads the `dealers` table and attaches:

```javascript
dealer: {
  id,
  logo_url,
  dealership_name,
}
```

### Step 4 — Derive Dealer Photo

`extractDealerPhoto(dbCar)` pulls `photos[0]` when available. That URL becomes `dealer_photo_url`, which is later used by the vision enrichment step.

### Step 5 — Normalize Specs

Normalization uses helpers from `normalizer.js`:

| Helper                       | Purpose                                 |
| ---------------------------- | --------------------------------------- |
| `cleanNum(value)`            | Extract numeric floats from messy input |
| `cleanInt(value)`            | Extract numeric integers                |
| `normalizeDrivetrain(value)` | Normalize drivetrain labels             |

The service produces grouped specs for:

- `performance`
- `efficiency`
- `dimensions`
- `safety`

### Step 6 — Extract Safety Data

`extractSafetyData(raw)` derives:

- `rating_text`
- `airbags`
- `assist_systems`

`extractAssistSystems()` scans the raw JSON dump for real feature keywords such as ABS, blind-spot monitoring, lane assist, adaptive cruise, parking sensors, backup camera, and AEB.

### Step 7 — Derived Intelligence

The ingestion layer computes:

- `is_sport_car`
- `is_family_car`
- `is_eco_car`
- `mileage_category`
- `is_new`
- `is_low_mileage`

### Step 8 — Badge Collection

The temporary context is passed to `collectAllBadges()` before final schema validation.

### Step 9 — Zod Validation

The final runtime object is validated with `CarContextSchema`.

### Output Shape

```javascript
{
  context_id: "ctx_uuid",
  car_id: "uuid",
  dealer_id: "uuid",
  created_at: "...",
  request_params: {
    template_style: "cinematic",
    dealer_color_input: "Blue",
    dealer_mileage_input: 12000
  },
  identity: { vin, make, model, trim, year, body_type, generation, series },
  visual_directives: {
    image_prompt_color,
    body_shape_prompt,
    interior_prompt
  },
  normalized_specs: {
    performance,
    efficiency,
    dimensions,
    safety
  },
  derived_intelligence: {
    vehicle_state,
    classification,
    badges_to_suggest
  },
  certifications: [/* badge objects */],
  dealer: { id, logo_url, dealership_name },
  document_context: "...",
  dealer_photo_url: "https://...",
  raw_api_dump: {/* specs_raw */}
}
```

`dealer_id` is carried as a passthrough runtime field and later embedded into the final story for booking workflows.

---

## 6. Badge Intelligence System

The badge system is implemented in `server/src/services/badges/` and collects badges from three active sources.

### 6.1 Badge Orchestrator

**File:** `badgeOrchestrator.js`

`collectAllBadges(context)` runs these collectors in parallel with `Promise.allSettled()`:

1. `collectLogicBadges()`
2. `collectApiBadges()`
3. `collectSearchBadges()`

It then:

- merges all badge results
- deduplicates by `logic_config.group`
- keeps the highest-ranked badge in each group
- sorts by category priority

### 6.2 Badge Registry

**File:** `badgeRegistry.js`

This file contains the badge metadata catalog:

- `id`
- `label`
- `category`
- `logic_config.group`
- `logic_config.rank`
- visuals metadata used by the frontend

### 6.3 Logic Collector

**File:** `collectors/logicCollector.js`

Rule-based badges are derived from:

- EV / hybrid / gas / diesel / hydrogen classification
- emission standard heuristics
- raw feature keywords
- model year defaults for things like CarPlay and Bluetooth
- history keywords such as one-owner, clean history, TÜV, DEKRA

### 6.4 API Collector

**File:** `collectors/apiCollector.js`

This collector calls:

- NHTSA Safety Ratings API
- EPA Fuel Economy API

Both requests use a 4.5 second timeout and are skipped for makes that clearly do not target the US market.

### 6.5 Search Collector

**File:** `collectors/searchCollector.js`

The active search collector is Gemini-grounded web search, not a separate legacy search provider.

It works in two passes:

1. `generateText()` with `tools: [{ googleSearch: {} }]` gathers grounded answer text and source metadata
2. `generateStructuredData()` converts that grounded evidence into a list of allowed badge IDs with confidence labels

Only `HIGH` confidence badges that exist in `BADGE_REGISTRY` are accepted.

---

## 7. Multi-Agent Orchestrator

**File:** `server/src/services/orchestrator.js`

`runAutoSensePipeline(storyId, inputData)` is the master story-generation function.

### Current Stage Order

```text
SYSTEM
 -> INGESTION
 -> BADGE_ORCHESTRATOR
 -> ANALYST
 -> DIRECTOR
 -> SCRIPTWRITER
 -> IMAGE_GENERATOR
 -> VISION_SCANNER
 -> AUDIO_ENGINE
 -> QA_SYSTEM
 -> COMPLETE
```

### Current Behavior

1. Build `carContext`
2. Run `analyzeCar()`
3. Run `planStory()`
4. Run `writeScript()`
5. Run `visualizeStory()`
6. Run `produceAudio()`
7. Run `runQualityAssurance()`
8. Save the final story into Supabase

### Runtime Inputs That Matter Today

The active runtime threads through:

- `car_id`
- `template`
- `scenes`
- `language`

There are no active provider-selection flags in the current backend pipeline.

### Logging & Progress

`storyLogger.logStep(storyId, stepKey, message)`:

- logs the phase to stdout
- updates `stories.current_agent`
- updates `stories.updated_at`

The UI progress model is therefore agent-based, not provider-toggle-based.

### Failure Path

If any stage throws, the orchestrator marks the story as:

```json
{
  "generation_status": "failed",
  "current_agent": "ERROR",
  "progress_logs": ["Error: ..."]
}
```

---

## 8. Gemini Agent System

All three core generation agents use the shared helpers from `aiConfig.js`.

### Common Pattern

- Analyst -> Gemini Flash
- Director -> Gemini Pro
- Scriptwriter -> Gemini Pro
- All structured outputs -> Zod validation through `generateStructuredData()`

### 8.1 Analyst Agent

**Files:** `analystAgent.js`, `prompts/analystPrompt.js`, `schemas/analystSchema.js`

**Role:** marketing strategist

**Input:**

- car identity
- normalized specs
- derived intelligence
- certifications
- `document_context`
- template style

**Current model selection:**

```javascript
const activeModel = selectTextModel({ prefer: "flash" });
```

**Output fields:**

- `marketing_persona`
- `target_audience`
- `suggested_tone`
- `prioritized_features[]`
- `narrative_angle`
- `highlight_badges[]`

### 8.2 Director Agent

**Files:** `directorAgent.js`, `prompts/directorPrompt.js`, `schemas/directorSchema.js`

**Role:** scene planner and tech-view router

**Current model selection:**

```javascript
const activeModel = selectTextModel({ prefer: "pro" });
```

**Responsibilities:**

- decide intro / slide / tech / outro structure
- set `theme_tag`
- return `visual_direction`
- return `layout`
- respect requested scene count or `automatic`

### Director Post-Processing

After Gemini returns the storyboard, `postProcessStoryboard()`:

- detects scenes that should become `tech_view`
- limits total tech views
- prevents duplicate tech modes
- builds `tech_config` for `PERFORMANCE`, `SAFETY`, and `UTILITY`
- normalizes `card_position`

### 8.3 Scriptwriter Agent

**Files:** `scriptwriterAgent.js`, `prompts/scriptPrompt.js`, `schemas/scriptSchema.js`

**Role:** narrative copywriter and hotspot suggester

**Current model selection:**

```javascript
const activeModel = selectTextModel({ prefer: "pro" });
```

**Responsibilities:**

- generate `intro_content`, `slide_content`, or `outro_content`
- generate `voiceover_text`
- generate up to 3 `key_stats`
- generate up to 2 `suggested_hotspots`
- attach badge subsets based on scene theme
- inject `brand_logo` from `carContext.dealer?.logo_url`

### Fallback Protection

If a scene comes back empty or partially invalid, `ensureSceneContent()` builds fallback content from normalized specs so the story remains renderable.

---

## 9. Media Generation & Voice Pipeline

## 9.1 Visualizer Agent

**File:** `server/src/services/media/visualizerAgent.js`

`visualizeStory(carContext, storyboard, templateStyle)` is the image-stage orchestrator.

### Current Rules

- `tech_view` scenes skip background image generation entirely
- non-tech scenes get one generated image each
- hotspot scanning only runs after image generation
- scenes are processed with concurrency `1`
- for cinematic templates, `intro_view` scenes convert the generated intro image into a 6-second looping video and store it as `intro_content.background_video`

### Dealer Photo Enrichment

If `carContext.dealer_photo_url` exists, the visualizer calls `analyzeCarPhoto()` once before processing scenes. That single one-sentence description is then injected into all scene prompts.

## 9.2 Google Image Service

**File:** `server/src/services/media/googleImageService.js`

The backend has two active image generation flows.

### Experience Images

`generateExperienceImage(prompt, seed)`:

- preferred model: `EXPERIENCE_IMAGE_MODEL` or `imagen-4.0-ultra-generate-001`
- fallback model: `imagen-4.0-generate-001`
- API path: `models.generateImages()`
- output: JPEG uploaded to Supabase `story_images/generated/...`

### Editor Images

`generateEditorImage(prompt, seed)`:

- preferred model: `EDITOR_IMAGE_MODEL` or `gemini-2.5-flash-image`
- fallback model: `gemini-3.1-flash-image-preview`
- API path: `models.generateContent()` with `responseModalities: ["IMAGE"]`
- output: JPEG uploaded to Supabase `story_images/generated/...`

### Retry Behavior

For retryable quota errors:

- up to 4 attempts
- backoff: 5s -> 10s -> 20s

### Access Fallbacks

If the preferred model is unavailable for the project, the service falls back to the configured secondary model.

## 9.3 Prompt Builder

**File:** `server/src/services/media/promptBuilder.js`

`buildImagePrompt(scene, carContext, templateStyle, visionDescription)` assembles the final image prompt.

### Current Prompt Features

- undefined-safe subject construction
- theme-aware style suffixes
- optional vision-enrichment clause
- interior vs exterior composition rules
- `card_position`-aware subject placement
- explicit blank-license-plate rule

### Composition Logic

- if the card is on the left, push the car to the right
- if the card is on the right, push the car to the left
- interior scenes shift perspective based on the same rule

## 9.4 Vision Enricher

**File:** `server/src/services/media/visionEnricher.js`

This service analyzes the dealer's real photo to extract visible physical traits such as:

- wheel/rim style
- grille shape
- trim accents
- body-shape details

### Image Normalization

Before sending the image to Gemini, unsupported formats are converted to JPEG using `sharp`.

Supported runtime formats are:

- PNG
- JPEG
- GIF
- WebP

### Output

Returns one short sentence or `null` if the step fails.

## 9.5 Vision Scanner

**File:** `server/src/services/media/visionScanner.js`

The current hotspot scanner is Gemini-based structured localization.

`scanHotspots(imageUrl, hotspots)`:

1. downloads the generated scene image
2. sends the image plus hotspot labels to Gemini Pro
3. expects `box_2d` arrays in `[y_min, x_min, y_max, x_max]` format normalized to `0..1000`
4. converts boxes into `x` / `y` percentages for the frontend

If localization fails, the scene continues without hotspot coordinates.

## 9.6 Google Voice Service

**File:** `server/src/services/media/googleVoiceService.js`

This file wraps:

- Google Cloud Text-to-Speech v1beta1
- Google Cloud Speech-to-Text v1

### Supported Voices

| Voice ID           | Language | Typical Use            |
| ------------------ | -------- | ---------------------- |
| `en-US-Chirp-HD-D` | English  | Cinematic default      |
| `en-US-Chirp-HD-F` | English  | Minimal Tech default   |
| `fr-FR-Chirp-HD-D` | French   | Alternate French voice |
| `fr-FR-Chirp-HD-F` | French   | French default         |

### Main Functions

- `resolveVoiceSelection()`
- `synthesizeVoiceover()`
- `transcribeAudioWithWordOffsets()`

All generated MP3 files are uploaded to `story_voiceover/generated/...`.

## 9.7 Audio Agent

**File:** `server/src/services/media/audioAgent.js`

`produceAudio(carContext, storyboard, language, templateStyle)` runs scene audio work in parallel.

For each scene with `raw_voiceover`:

1. call `generateAudio()`
2. call `getWordTimestamps()`
3. call `getGeminiSubtitlesFromWords()`
4. fall back to `parseSubtitles()` when needed
5. attach `audio_url` and `subtitles`

## 9.8 Transcription & Subtitle Parsing

**Files:** `transcriptionService.js`, `subtitleParser.js`, `audioGenerator.js`

### `audioGenerator.js`

This is now a thin wrapper around `googleVoiceService.synthesizeVoiceover()`.

### `transcriptionService.js`

Provides:

- `getWordTimestamps(audioBuffer, language, fallbackText)`
- `getGeminiSubtitlesFromWords(words)`
- `estimateWordDurationsFromText(text)`

If Google STT is unavailable or returns no words, estimated word durations are generated from the original script text.

### `subtitleParser.js`

The fallback parser splits subtitles by:

- max 42 characters
- max 3.5 seconds
- silence gap > 0.3s
- punctuation boundaries

---

## 10. Editor Service (Live Editing API)

**File:** `server/src/services/editorService.js`

This service powers the text-based editor features behind `POST /api/editor/*`.

### `regenerateVoiceover()`

- resolves the requested Google voice
- synthesizes MP3 audio
- derives word timings via Google STT
- groups subtitles via Gemini
- falls back to the rule-based parser when necessary

### `regenerateImage()`

- normalizes the requested theme
- applies the same spatial composition logic used by the main pipeline
- uses `generateEditorImage()`

### `generateScene()`

- uses Gemini Flash with `SceneSchema`
- forces `slide_view`
- builds an image prompt from generated scene metadata
- generates the initial scene image immediately

### `processCopilotMessage()`

The text copilot is a structured Gemini Pro workflow that returns:

```json
{
  "message": "...",
  "actions": [
    /* structured action list */
  ]
}
```

Supported action types include:

- `UPDATE_SCENE`
- `ADD_SCENE`
- `REMOVE_SCENE`
- `GO_TO_SCENE`
- `REGENERATE_SCENE`
- `UPDATE_META`
- `UPDATE_ALL_SCENES`

The action schema is defined in `server/src/services/ai/schemas/editorSchemas.js`.

### `uploadImage()`

Uploads a manually provided editor image to the `story_images` bucket and returns a public URL.

---

## 11. RAG Document Ingestion Pipeline

The RAG pipeline lets dealers upload brochures, spec sheets, and similar PDFs for a specific vehicle.

## 11.1 Python PDF Shredder

**File:** `server/src/scripts/python_shredder/extractor.py`

The Python script extracts:

- text chunks
- markdown tables
- images

### Extraction Strategy

- text via PyMuPDF
- tables via pdfplumber
- images via PyMuPDF `extract_image()`

It prints a single JSON array to stdout for the Node controller to consume.

## 11.2 Embedding Service

**File:** `server/src/services/embeddingService.js`

This service produces the current RAG vector space.

### Text Embeddings

```javascript
await getGeminiClient().models.embedContent({
  model: GEMINI_MODELS.EMBEDDING,
  contents: inputText,
  config: {
    taskType: "RETRIEVAL_DOCUMENT",
    outputDimensionality: 1024,
    autoTruncate: true,
  },
});
```

### Image Embeddings

The runtime image path is:

```text
image -> Gemini description -> text embedding -> 1024-dim vector
```

This keeps text, tables, queries, and extracted images in one comparable vector space.

## 11.3 RAG Controller

**File:** `server/src/controllers/ragController.js`

### `POST /api/rag/ingest`

The controller:

1. accepts up to 10 PDFs via Multer
2. stores them in `server/temp/`
3. runs `extractor.py` per PDF
4. uploads the original PDF to `knowledge_base_documents`
5. inserts a `car_documents` tracking row
6. processes each extracted element sequentially
7. uploads extracted images to `knowledge_base_images`
8. inserts embedded elements into `car_knowledge_base`

### Per-Element Processing

- text/table -> sanitize -> Gemini embedding -> `car_knowledge_base`
- image -> upload -> describe + embed -> `car_knowledge_base`

### Document Deletion Behavior

`DELETE /api/rag/documents/:docId` removes:

- the stored PDF file from `knowledge_base_documents`
- the `car_documents` row

It does not currently cascade-delete previously embedded `car_knowledge_base` rows.

## 11.4 Supabase Vector Store

### `car_knowledge_base`

```sql
CREATE TABLE public.car_knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'table', 'image')),
  content TEXT NOT NULL,
  embedding VECTOR(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `car_documents`

```sql
CREATE TABLE public.car_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Match RPC

The chatbot expects a cosine-similarity RPC shaped like:

```sql
CREATE OR REPLACE FUNCTION match_car_knowledge (
  query_embedding VECTOR(1024),
  target_car_id UUID,
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  content_type TEXT,
  content TEXT,
  similarity FLOAT
)
```

---

## 12. Multimodal RAG Chatbot

**File:** `server/src/services/ragChatService.js`

The active chatbot uses a four-stage Gemini pipeline.

```text
Tier 0  -> booking intent tool gate
Tier 1  -> answer from carContext JSON if possible
Tier 2  -> embed question + search pgvector
Tier 3  -> synthesize grounded answer
```

### Tier 0 — Booking Intent Tool Gate

`checkBookingIntent(question, carContext, conversationHistory)` runs first.

Current behavior:

- model preference: Gemini Pro
- tool: `draft_test_drive`
- function-calling mode: `AUTO`
- allowed function names: only `draft_test_drive`

The system prompt explicitly says that feature/spec questions are not booking requests, including examples like:

- climate controls
- AC buttons
- steering-wheel buttons
- physical controls
- infotainment questions

That change prevents ordinary feature questions from opening the booking widget.

### Tier 1 — Context Check

`tier1ContextCheck()` uses Gemini Flash to decide whether the question can be answered directly from `carContext`.

It must either:

- answer directly
- or return the sentinel string `SEARCH_DOCUMENTS`

### Tier 2 — Vector Search

`tier2VectorSearch()`:

- embeds the question with `generateMultimodalEmbedding()`
- calls `match_car_knowledge`
- uses `SIMILARITY_THRESHOLD = 0.25`
- returns up to `MAX_RESULTS = 5`

### Tier 3 — Grounded Synthesis

`tier3Synthesis()` uses Gemini Pro to combine:

- the user question
- retrieved text/table chunks
- retrieved image URLs
- basic vehicle specs
- recent conversation history

If an image is relevant, the model appends:

```text
IMAGE: <url>
```

The service strips that line and returns `{ text, image_url }`.

### API Contract

**Request**

```json
{
  "car_id": "uuid",
  "question": "Does it have physical AC buttons?",
  "car_context": { "year": 2024, "make": "Honda", "model": "Civic" },
  "conversation_history": [
    { "type": "user", "text": "Tell me about the cabin" }
  ]
}
```

**Response — text answer**

```json
{
  "success": true,
  "text": "...",
  "image_url": null,
  "tier": 1
}
```

**Response — booking widget**

```json
{
  "success": true,
  "type": "widget",
  "widget_type": "booking_draft",
  "text": "I'd love to help you schedule a test drive! Let me pull up the booking form for you.",
  "prefilled_data": {
    "date": null,
    "time": null,
    "name": null,
    "phone": null
  },
  "tier": 0
}
```

---

## 13. Test Drive Booking Flow

The booking flow is owned by `leadsController.js` and is invoked by both text and voice chatbot experiences.

### `POST /api/leads/book`

Controller validation requires:

- `car_id`
- `dealer_id`
- `customer_name`
- `phone`
- `appointment_date`
- `appointment_time`

Successful inserts return the new lead ID and timestamp.

### `GET /api/leads/dealer?car_id=<uuid>`

This endpoint exists as a compatibility fallback for stories that do not already contain `story.car.dealer_id`.

### Booking Widget Integration

The chatbot APIs surface a widget payload rather than directly creating a booking. The frontend collects or confirms details, then calls `/api/leads/book`.

---

## 14. Realtime Voice Systems

## 14.1 Chatbot Voice — WebSocket + Gemini Live

The active shopper voice path is:

```text
Browser mic
 -> WebSocket /api/rag/voice/ws
 -> chatbotWsHandler.js
 -> chatbotVoiceService.js
 -> Gemini Live
```

### Mounted HTTP Pieces

- `chatbotVoiceRoutes.js`
  - `GET /api/rag/voice/config`
  - `GET /api/rag/voice/events`
  - `POST /api/rag/voice/stop`
- `index.js`
  - upgrades `/api/rag/voice/ws` to the WS handler

### WebSocket Protocol

**Client -> server**

- JSON `{ type: "start", car_context, chat_history }`
- binary PCM16 mono 16kHz audio frames
- JSON `{ type: "audio_end" }`
- JSON `{ type: "stop" }`

**Server -> client**

- JSON status / transcript / tool-call events
- binary PCM16 mono 24kHz audio frames

### `chatbotVoiceService.js`

This file creates the realtime Gemini Live session.

Current defaults:

- model: `GEMINI_LIVE_CHATBOT_MODEL` or `gemini-live-2.5-flash-native-audio`
- location: `GEMINI_LIVE_LOCATION` or regional fallback
- voice: `GEMINI_LIVE_VOICE` or `Aoede`

### Chatbot Voice Tools

Two tools are registered:

1. `draft_test_drive`
2. `search_vehicle_docs`

`search_vehicle_docs` calls back into `processChat()` so voice responses stay grounded in the same RAG system used by text chat.

### SSE Event Bus

`chatbotEventBus.js` broadcasts:

- `user_transcript`
- `ai_response`
- `tool_call`
- `status`

### Important Note on `chatbotLivekitAgent.js`

`chatbotLivekitAgent.js` is still present in the repository, but the current mounted shopper voice path is the WebSocket handler in `chatbotWsHandler.js`.

## 14.2 Editor Voice — LiveKit + Gemini Live

The dealer voice copilot uses LiveKit plus Gemini Live.

### Route Surface

`editorVoiceRoutes.js` exposes:

- `POST /api/editor/voice/start`
- `POST /api/editor/voice/stop`
- `GET /api/editor/voice/events`

### Session Flow

```text
Dealer browser
 -> LiveKit room
 -> EditorLivekitAgent
 -> editorVoiceService
 -> Gemini Live
 -> SSE status/tool/transcript events via editorEventBus
```

### `editorLivekitAgent.js`

This agent:

- creates a bot token
- joins the room
- publishes a bot audio track
- waits for the dealer's audio track
- forwards PCM audio to `startEditorVoiceSession()`
- plays Gemini audio back into the room in realtime

### `editorVoiceService.js`

This file runs the actual Gemini Live editor session.

Current defaults:

- model: `GEMINI_LIVE_EDITOR_MODEL` or `GEMINI_LIVE_CHATBOT_MODEL` or `gemini-live-2.5-flash-native-audio`
- location: `GEMINI_LIVE_EDITOR_LOCATION` or `GEMINI_LIVE_LOCATION` or regional fallback
- voice: `GEMINI_LIVE_EDITOR_VOICE` or `GEMINI_LIVE_VOICE` or `Aoede`

### Editor Voice Tools

The editor copilot exposes 9 tool operations:

- `update_scene_text`
- `change_layout`
- `change_theme`
- `update_meta`
- `navigate_scene`
- `add_scene`
- `remove_scene`
- `regenerate_scene`
- `update_all_scenes`

### Editor Event Bus

`editorEventBus.js` broadcasts:

- `user_transcript`
- `ai_response`
- `tool_call`
- `status`

---

## 15. Quality Assurance & Final Story Shape

**Function:** `runQualityAssurance()` in `server/src/services/orchestrator.js`

This is the deterministic final assembly pass.

### Responsibilities

- normalize scene shape for the frontend
- convert `scene_type` -> `type`
- guarantee `card_position`
- sync `slide_content.alignment`
- enrich `tech_config` from real specs
- attach `badges`
- attach `car`
- attach flattened `car_specs`

### Final Story Skeleton

```javascript
{
  story_id,
  car_id,
  title,
  narrative_arc_summary,
  meta: {
    schema_version: "1.1.0",
    template,
    language,
    theme_color: "#007AFF",
    generated_at,
    features: {
      has_tech_views,
      tech_view_count
    }
  },
  scenes: [/* normalized scenes */],
  badges: [/* certifications */],
  car: {
    make,
    model,
    year,
    trim,
    body_type,
    color,
    dealer_id
  },
  car_specs: {
    performance,
    safety,
    dimensions,
    efficiency
  }
}
```

If an image is missing for a non-tech scene, QA uses a placeholder URL instead of crashing the story shape.

---

## 16. Data Schemas

### `CarContextSchema`

Defined in `server/src/services/ingestion/schemas.js`.

Validates:

- identity
- visual directives
- normalized specs
- derived intelligence
- certifications
- dealer info
- `document_context`
- `dealer_photo_url`

The schema uses `.passthrough()` so runtime fields such as `dealer_id` can flow through safely.

### `AnalystReportSchema`

Defined in `server/src/services/ai/schemas/analystSchema.js`.

Key fields:

- `marketing_persona`
- `target_audience`
- `suggested_tone`
- `prioritized_features[]`
- `narrative_angle`
- `highlight_badges[]`

### `DirectorOutputSchema`

Defined in `server/src/services/ai/schemas/directorSchema.js`.

Key fields:

- `title`
- `narrative_arc_summary`
- `scenes[]`

Per-scene structure includes:

- `scene_id`
- `scene_type`
- `main_feature_slug`
- `theme_tag`
- `visual_direction`
- `layout`
- `use_3d_mode`

### `ScriptOutputSchema`

Defined in `server/src/services/ai/schemas/scriptSchema.js`.

Supports one of:

- `slide_content`
- `intro_content`
- `outro_content`

`slide_content.voiceover_text` is validated for a 5-60 word range.

### `editorSchemas.js`

Defines the editor-side structured shapes used by the text copilot, including:

- `SceneSchema`
- `LayoutSchema`
- `TechConfigSchema`
- `CopilotActionSchema`
- `CopilotResponseSchema`

### `leads` Table

```sql
CREATE TABLE public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id),
  dealer_id UUID NOT NULL REFERENCES public.auth.users(id),
  customer_name TEXT NOT NULL,
  phone TEXT,
  appointment_date DATE,
  appointment_time TIME,
  message TEXT DEFAULT 'Test drive booking via AutoSense chatbot',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 17. Environment Variables

```env
# Server
PORT=3000
CORS_ORIGINS=http://localhost:5173,http://localhost:5174

# Google / Gemini core
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
# or GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_API_KEY=...
# or GEMINI_API_KEY=...
GOOGLE_GENAI_API_VERSION=v1

GEMINI_FLASH_MODEL=gemini-3-flash-preview
GEMINI_PRO_MODEL=gemini-3.1-pro-preview
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
EXPERIENCE_IMAGE_MODEL=imagen-4.0-ultra-generate-001
EDITOR_IMAGE_MODEL=gemini-2.5-flash-image

# Gemini Live
GEMINI_LIVE_CHATBOT_MODEL=gemini-live-2.5-flash-native-audio
GEMINI_LIVE_EDITOR_MODEL=gemini-live-2.5-flash-native-audio
GEMINI_LIVE_LOCATION=us-central1
GEMINI_LIVE_EDITOR_LOCATION=us-central1
GEMINI_LIVE_VOICE=Aoede
GEMINI_LIVE_EDITOR_VOICE=Aoede

# Veo (intro video)
VEO_VIDEO_MODEL=veo-3.1-fast-generate-001

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=...
SUPABASE_SERVICE_KEY=...
# or SUPABASE_SECRET=...

# RapidAPI car specs
RAPIDAPI_KEY=...
RAPIDAPI_HOST=car-specs.p.rapidapi.com

# LiveKit (editor voice)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

### Important Notes

- Text, image, and embeddings can run through Vertex AI or API-key mode.
- Realtime Gemini Live flows are implemented as Vertex-project flows in the current backend.
- Google Cloud TTS/STT also require valid Google Cloud credentials in the environment.
- If `GOOGLE_CLOUD_LOCATION=global`, the realtime voice services intentionally shift to a regional endpoint for Gemini Live.

---

## 18. End-to-End Flow Diagram

```text
Client POST /api/ingest/context
  { car_id, template, scenes, language }
        |
        v
ingestionController.generateContext()
  -> upsert stories row
  -> return { storyId }
  -> runAutoSensePipeline(storyId, input)
        |
        v
buildCarContext()
  -> cars row
  -> car_knowledge_base text/table chunks
  -> dealers row
  -> normalized specs
  -> derived intelligence
  -> badge collection
  -> CarContextSchema validation
        |
        v
analyzeCar()          -> Gemini Flash
        |
        v
planStory()           -> Gemini Pro
        |
        v
writeScript()         -> Gemini Pro
        |
        v
visualizeStory()
  -> visionEnricher (Gemini multimodal)
  -> Google image generation
  -> visionScanner (Gemini bounding boxes)
        |
        v
produceAudio()
  -> Google TTS
  -> Google STT word offsets
  -> Gemini subtitle grouping
  -> subtitle parser fallback
        |
        v
runQualityAssurance()
  -> final story shape
        |
        v
Supabase UPDATE stories.content
```

---

This file intentionally documents only the active Google/Gemini runtime.
