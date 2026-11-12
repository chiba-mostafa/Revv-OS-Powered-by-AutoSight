# 🏎️ Revv OS — Powered by AutoSight & PayPal

**Autonomous AI 3D car showrooms for modern dealerships, with PayPal checkout built in.**

Revv OS is a multi-tenant B2B SaaS platform for automotive dealerships. Powered by **AutoSight**, a 7-agent Gemini engine, it turns raw vehicle data, photos, and owner manuals into cinematic, interactive 2D/3D showrooms in under two minutes.

**PayPal** closes the commerce loop on both sides of the marketplace: dealers subscribe to their platform tier through PayPal Smart Buttons, and buyers reserve vehicles with a refundable $500 hold deposit directly inside the 3D experience and AI assistant.

- **Live Demo:** [https://revv-os.live](https://revv-os.live)
- **GitHub Repository:** [https://github.com/chiba-mostafa/Revv-OS-Powered-by-AutoSight](https://github.com/chiba-mostafa/Revv-OS-Powered-by-AutoSight)
- **Demo Video:** _[Watch on YouTube](https://youtu.be/_krPwZcmktI)_
- **Hackathon:** [PayPal AI Hackathon on Devpost](https://paypalaihackathon.devpost.com/)

---

## 📑 Table of Contents

- [🧪 Testing Instructions & Credentials](#-testing-instructions--credentials)
- [⚡ What It Does](#-what-it-does)
- [💳 PayPal Integration](#-paypal-integration)
- [🏗️ Architecture](#️-architecture)
- [💻 Tech Stack](#-tech-stack)
- [🛡️ Guardrails & Safety](#️-guardrails--safety)
- [🛠️ Local Setup](#️-local-setup)
- [📁 Project Structure](#-project-structure)
- [👥 Authors & License](#-authors--license)

---

## 🧪 Testing Instructions & Credentials

### 1. Quick Access Credentials

- **Live Application URL:** [https://revv-os.live](https://revv-os.live)
- **Demo Dealership Login & PayPal Sandbox Credentials:**
  > 🔒 **For Hackathon Judges:** To protect test accounts, credentials for both the **Pre-Configured Demo Dealership Account** (pre-populated with full inventory and generated 3D car stories) and the **PayPal Sandbox Buyer Account** are provided directly in the **"Testing instructions or credentials"** field of our [Devpost Hackathon Submission](https://paypalaihackathon.devpost.com/).
  >
  > Please consult the Devpost submission text to log in immediately and test checkouts with zero real money.

> _All payment transactions in this project run against the PayPal Sandbox environment. No real funds are ever charged._

---

### 2. Recommended Testing Paths for Judges

#### Path A: Immediate 3D Showroom & In-Experience PayPal Reservation ($500 Deposit)

_Use this path to explore pre-generated vehicles, test the 3D player, and test vehicle reservation without waiting to generate new stories:_

1. Sign in with the **Demo Dealership Account** (credentials provided in the Devpost submission).
2. From the **Inventory** tab, select any vehicle (e.g., Kia Telluride) and open its 3D interactive showroom or public microsite.
3. Interact with the 3D WebGL car, camera director views, and interactive hotspots.
4. Click **"Reserve Vehicle ($500 PayPal Deposit)"** in the playback control bar, or request a reservation from the **AutoSense AI assistant**.
5. When the PayPal window opens, log in with the **PayPal Sandbox Buyer Account** to authorize the refundable \$500 hold deposit.
6. Observe the instant on-screen payment confirmation modal displaying the verified **PayPal Transaction ID**, buyer receipt info, and active 48-hour vehicle reservation status (securely stored in the dealership database).

#### Path B: Full Dealer Onboarding & PayPal SaaS Subscription ($49/month)

_Use this path to test the complete dealer registration and recurring PayPal subscription flow from scratch:_

1. On the landing page, click **Sign Up** (or navigate to `/register`) and create a new dealership account.
2. Confirm the verification email to land directly on the `/onboarding/payment` step.
3. Select the **Pro Dealer Plan** (\$49/month).
4. Click the yellow **PayPal** button, log in with the **PayPal Sandbox Buyer Account**, and complete the subscription authorization.
5. On the **Branding Step**, enter your dealership name, brand color, and store URL to launch your live dealership platform.

---

## ⚡ What It Does

### 1. Revv — The Dealership Platform

A multi-tenant B2B operating system where dealerships manage everything from one unified dashboard:

- **Inventory Management:** Centralized vehicle catalog with automated technical spec enrichment.
- **Studio & AI Creation:** Automated 3D story generation and timeline editing suite.
- **White-Label Branding:** Custom logos, color palettes, voice tones, and localized languages.
- **Micro-Site Builder:** Branded public landing pages with custom subdomain routing.
- **Lead & Reservation Capture:** Database-backed capture of test-drive bookings and verified PayPal deposit transactions.

---

### 2. AutoSight — The 7-Agent Creation Pipeline

When a dealer selects a vehicle, a theme, scene count, and language, seven specialized Gemini agents—orchestrated as a Google Cloud Workflows state machine—build the interactive experience:

| Agent                             | Role                                                                                                | Models & Services                                    |
| :-------------------------------- | :-------------------------------------------------------------------------------------------------- | :--------------------------------------------------- |
| **Ingestion & Badge Collector**   | Retrieves the vehicle's golden record, validates 50+ certifications, and pulls market value data    | Gemini Flash + Google Search Grounding, NHTSA, EPA   |
| **Analyst (The Strategist)**      | Defines the target buyer persona (e.g., adventurous family) and key selling points                  | Gemini 3 Flash                                       |
| **Director (The Architect)**      | Builds the storyboard and decides 2D cinematic view vs. interactive 3D WebGL view per scene         | Gemini 3.1 Pro                                       |
| **Scriptwriter**                  | Converts technical spec sheets into an emotionally compelling, localized narrative                  | Gemini 3.1 Pro                                       |
| **Visualizer (The Photographer)** | Generates photorealistic backgrounds and videos, and detects hotspot coordinates via spatial vision | Imagen 4 Ultra, Veo 3.1 Fast, Gemini Multimodal Vision |
| **Audio (The Voice)**             | Synthesizes neural voiceover and generates millisecond-synchronized subtitles                       | Cloud TTS (Chirp HD), Cloud Speech-to-Text, Gemini 3 Flash |
| **Assembler / QA**                | Compiles, validates, and optimizes all media and geometry into a structured story JSON              | Gemini 3 Flash, Zod Validation                       |

> **Verified Badges:** Three parallel collectors (rule-based logic, government APIs from NHTSA/EPA, and Google Search Grounding) verify real-world awards. Only `HIGH` confidence badges from the registry are accepted, deduplicated, and ranked by category.

---

### 3. Adaptive 2D & 3D Spatial Storytelling

Every story consists of structured, purposeful scene types:

- **Intro & Outro Views:** Looping cinematic video backgrounds, dealer branding, and test-drive booking CTAs.
- **Slide Views (2D):** Ken Burns panning background imagery, key technical metrics, and interactive component hotspots placed by Gemini Vision.
- **Tech Views (3D WebGL):** Interactive 3D spatial explainers featuring:
  - **Safety Mode:** Lidar scanner, ghost chassis, and dynamic airbag deployment.
  - **Performance Mode:** X-ray powertrain, all-wheel drivetrain, and aerodynamic plasma-flow lines.
  - **Utility Mode:** Blueprint dimension overlays and volumetric cargo capacity visualization.
- **Themes:**
  - _Cinematic Theme:_ Dark glassmorphism, dramatic Three.js lighting (ACESFilmic), and purple pulsing hotspot rings.
  - _Minimal Tech Theme:_ Clean white/graphite CAD aesthetic, monospace typography, and flat studio lighting.

---

### 4. WYSIWYG Live Studio

AI generates the initial draft, and dealers can refine it directly over the live canvas:

- **In-Place Editing:** Click any headline, paragraph, stat badge, or button label to edit in place.
- **Layout Panel:** Adjust composition, alignment, and toggle themes per scene or globally.
- **Hotspots Panel:** Create, label, and drag hotspot pins with real-time X/Y coordinate normalization.
- **Image Panel:** Upload dealer photography or regenerate AI backgrounds on demand.
- **Script Dock:** Edit voiceover copy, select neural voices, and regenerate audio with millisecond subtitle re-syncing.
- **Scene Management:** Add new scenes manually or let AI generate new scenes from natural language prompts.

---

### 5. AutoSight Copilot (Voice-to-Scene Mutations)

A Gemini function-calling agent that understands the vehicle's full context and executes complex mutations from natural language commands:

- **Targeted Edits:** _"Add a 3D tech view showing cargo capacity"_ or _"Make scene 6 highlight a dramatic drive through a rainstorm."_
- **Full Transformations:** _"Switch to the minimal tech theme and translate everything to French."_ One sentence swaps themes, translates all copy, switches to a native French neural voice, re-synthesizes audio tracks, and recalculates subtitle timings.
- **7 Action Types:** `UPDATE_SCENE`, `ADD_SCENE`, `REMOVE_SCENE`, `GO_TO_SCENE`, `REGENERATE_SCENE`, `UPDATE_META`, and `UPDATE_ALL_SCENES`.

---

### 6. Live Buyer Agent with Multimodal RAG

Shoppers can converse with the car in real time through a bidirectional Gemini Live speech-to-speech assistant grounded in the official manufacturer owner manual:

| Tier   | Function                | Description                                                                                      |
| :----- | :---------------------- | :----------------------------------------------------------------------------------------------- |
| **T0** | **Booking Intent Gate** | Function calling intercepts test-drive requests and pushes an interactive appointment widget     |
| **T1** | **Context Check**       | Fast-path check answering directly from vehicle specs JSON                                       |
| **T2** | **Vector Search**       | Embeds queries and searches 1024-dimensional manual chunks in `pgvector` ($\text{sim} \ge 0.25$) |
| **T3** | **Grounded Synthesis**  | Synthesizes retrieved text, tables, and AI-described schematics into a factual answer            |

---

## 💳 PayPal Integration

PayPal transforms Revv from a passive media visualizer into a **closed-loop commerce platform** across both sides of the automotive transaction:

| Flow                         | Who Pays             | Amount                        | PayPal Technology                           |
| :--------------------------- | :------------------- | :---------------------------- | :------------------------------------------ |
| **Dealer SaaS Checkout**     | Dealership → Revv OS | $49 / month (Pro Plan)        | `@paypal/react-paypal-js` Smart Buttons     |
| **Vehicle Reservation Hold** | Buyer → Dealership   | $500 (Refundable, 48-hr hold) | PayPal Smart Checkout with Buyer Protection |

1. **Dealer SaaS Onboarding:** During registration, dealers select the Pro tier and authorize the monthly subscription through PayPal Smart Buttons. The backend activates their subscription tier, provisions multi-tenant database records, and advances them to custom branding.
2. **In-Experience Vehicle Hold:** Shoppers exploring the 3D player or conversing with the voice assistant can instantly lock down high-demand vehicles with a \$500 hold deposit. The transaction generates an official PayPal Transaction ID, sets a 48-hour reservation hold, and records a verified purchase reservation with full transaction metadata directly into the dealership database.
3. **Human-in-the-Loop Security:** The AI identifies buyer intent and presents the checkout modal, but the human user always reviews and authorizes payment inside the secure PayPal modal.

---

## 🏗️ Architecture

```text
┌────────────────────────────────────────────────────────┐
│                     CLIENT BROWSER                     │
│    React 18 + Vite · Three.js / WebGL · Framer Motion  │
│         @paypal/react-paypal-js Smart Buttons          │
└───────────────┬────────────────────────┬───────────────┘
                │ API / WebSocket        │ Auth / Data
                ▼                        ▼
┌──────────────────────────────┐ ┌───────────────────────────────┐
│     AI BACKEND (server/)     │ │        SUPABASE CLOUD         │
│      Node.js + Express       │◄┼►│     PostgreSQL + pgvector     │
│       AutoSight Agents       │ │       Auth · Storage          │
│    Editor & Copilot APIs     │ │ Inventory · Stories · Leads   │
│ RAG + Python Manual Shredder │ │    Dealer-Level Isolation     │
│ Gemini Live WebSocket Bridge │ └───────────────────────────────┘
└───────────────┬──────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────┐
│                 GOOGLE CLOUD / GEMINI                  │
│ Cloud Workflows · Gemini 3.1 Pro / 3 Flash · Imagen 4  │
│ Veo 3.1 · gemini-embedding-001 · Cloud TTS (Chirp HD)  │
└────────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack

| Layer | Technology | Usage |
| :--- | :--- | :--- |
| **Primary Text AI** | Gemini 3.1 Pro | Director, Scriptwriter, Copilot, RAG |
| **Fast Text AI** | Gemini 3 Flash | Analyst, context checks, subtitles |
| **Experience Images** | Imagen 4 Ultra | Scene backgrounds |
| **Editor Images** | Gemini 2.5 Flash Image | On-demand image regeneration |
| **Intro Videos** | Veo 3.1 Fast | 6-second looping background videos |
| **Embeddings** | gemini-embedding-001 | 1024-dim RAG vectors |
| **Voice TTS** | Cloud TTS Chirp HD | Neural voiceover narration |
| **Voice STT** | Cloud Speech-to-Text | Word-level timestamps |
| **Live Voice** | Gemini Live Native Audio | Speech-to-speech real-time |
| **Search** | Google Search Grounding | Real-time badge verification |
| **Structured Output** | Gemini Function Calling | Zod-validated JSON via `emit_structured_response` |
| **Spatial Vision** | Gemini Multimodal | Bounding-box hotspot localization |
| **Commerce & Payments** | PayPal Smart Buttons, PayPal Smart Checkout (`@paypal/react-paypal-js`) | Recurring SaaS subscriptions ($49/mo), refundable vehicle reservation deposits ($500) |
| **Backend & Data** | Node.js, Express, Supabase Cloud (PostgreSQL with `pgvector`), Python (PyMuPDF, pdfplumber) | Multi-tenant backend, semantic manual RAG, vector storage |
| **Frontend & 3D** | React 18, Vite, Three.js, React Three Fiber (R3F), HeroUI, Tailwind CSS | Zero-install interactive WebGL spatial canvas, glassmorphism UI |
| **Orchestration** | Google Cloud Workflows | Asynchronous multi-agent execution pipeline |

---

## 🛡️ Guardrails & Safety

- **Strict Schema Validation:** Every AI agent returns schema-enforced JSON validated with Zod before being accepted into the story graph.
- **Deterministic Verification:** Awards and ratings require validation across government APIs (NHTSA, EPA) or high-confidence search grounding.
- **Golden-Record Fallback:** In the event of external API timeouts, the pipeline reverts to verified vehicle specifications rather than hallucinating stats.
- **Intent-Gated Purchases:** Questions about vehicle features never trigger payment prompts; purchase holds require explicit buyer intent.
- **Zero Autonomous Money Movement:** The AI surfaces payment options; transaction confirmation is handled entirely within PayPal's secure modal.

---

## 🛠️ Local Setup

### Prerequisites

- **Node.js:** 20+
- **Python:** 3.11+
- **Supabase:** Account & project with `pgvector` enabled
- **Google Cloud:** Project with Vertex AI, Cloud Text-to-Speech, and Speech-to-Text enabled
- **PayPal:** Developer account with Sandbox App credentials

---

### 1. Clone the Repository

```bash
git clone https://github.com/chiba-mostafa/Revv-OS-Powered-by-AutoSight.git
cd Revv-OS-Powered-by-AutoSight
```

---

### 2. Backend Setup (`server/`)

```bash
cd server
npm install
```

Create `server/.env` with the following variables:

```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-key

# Google Cloud & Gemini
GOOGLE_APPLICATION_CREDENTIALS=./src/config/gcp-credentials.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=global

# RapidAPI (Car Specs)
RAPIDAPI_KEY=your-rapidapi-key
RAPIDAPI_HOST=car-specs.p.rapidapi.com

```

Start the backend:

```bash
npm start
```

---

### 3. Frontend Setup (`client/`)

```bash
cd ../client
npm install
```

Create `client/.env` with the following variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_RAPIDAPI_KEY=your-rapidapi-key
VITE_RAPIDAPI_HOST=car-specs.p.rapidapi.com
VITE_API_BASE_URL=http://localhost:3000

# PayPal Sandbox
VITE_PAYPAL_CLIENT_ID=your-paypal-sandbox-client-id
```

Start the frontend development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📁 Project Structure

```text
.
├── client/                     # React + Vite frontend application
│   ├── src/
│   │   ├── components/AutoSense/  # 3D player, WebGL canvas, PayPal modals, editor
│   │   ├── pages/Dashboard/       # Dealership management, inventory, studio wizard
│   │   ├── pages/Onboarding/      # Plan selection, PayPal Pro checkout, branding
│   │   ├── pages/Microsite/       # Public dealer showroom & vehicle detail
│   │   └── store/                 # Redux Toolkit & Zustand state slices
├── server/                     # Node.js + Express AI microservices
│   ├── src/
│   │   ├── services/ai/           # 7 Gemini agents (Director, Scriptwriter, Analyst...)
│   │   ├── services/badges/       # Multi-collector badge verification engine
│   │   ├── services/media/        # Imagen, Veo, Cloud TTS, audio sync pipelines
│   │   ├── services/ragChatService.js  # Multimodal manual RAG engine
│   │   └── scripts/python_shredder/    # PDF manual text, table & diagram extractor
├── AI_BACKEND_ARCHITECTURE.md  # Deep dive into agentic pipeline & prompt contracts
├── CLIENT_ARCHITECTURE.md      # Deep dive into Three.js canvas & frontend layout
├── EDITOR_ARCHITECTURE.md      # Deep dive into live canvas editor & copilot actions
└── README.md                   # Project documentation
```

---

## 👥 Authors & License

- **Project:** Revv OS & AutoSight
- **Hackathon:** Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/)
- **Repository:** [https://github.com/chiba-mostafa/Revv-OS-Powered-by-AutoSight](https://github.com/chiba-mostafa/Revv-OS-Powered-by-AutoSight)
- **License:** Licensed under the [MIT License](LICENSE).
