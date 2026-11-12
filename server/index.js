const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
require("dotenv").config();

const ingestionRoutes = require("./src/routes/ingestionRoutes");
const editorRoutes = require("./src/routes/editorRoutes");
const ragRoutes = require("./src/routes/ragRoutes");
const carSpecsRoutes = require("./src/routes/carSpecsRoutes");
const leadsRoutes = require("./src/routes/leadsRoutes");
const chatbotVoiceRoutes = require("./src/routes/chatbotVoiceRoutes");
const editorVoiceRoutes = require("./src/routes/editorVoiceRoutes");
const { handleVoiceConnection } = require("./src/services/chatbotWsHandler");
const workflowRoutes = require("./src/routes/workflowRoutes");
const rateLimit = require("express-rate-limit");

process.on("uncaughtException", (err) => {
  if (err.message && err.message.includes("failed to capture frame")) {
    console.warn(
      "[LiveKit] Suppressed stale captureFrame error after disconnect.",
    );
    return;
  }
  console.error("Uncaught exception:", err);
  process.exit(1);
});

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 8080;

const generationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 generations per 15 minutes
  message: {
    success: false,
    error: "Too many generations requested. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const workflowLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
});

function parseAllowedOrigins() {
  const configured = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaults = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://revv-os.live",
  ];
  return new Set([...defaults, ...configured]);
}

const allowedOrigins = parseAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isLocalhost = /localhost:\d+$/.test(origin);
      const isLvhMe = origin.includes("lvh.me");
      const isProduction =
        /\.revv-os\.live$/.test(origin) || origin === "https://revv-os.live";
      if (
        isLocalhost ||
        isLvhMe ||
        isProduction ||
        allowedOrigins.has(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));

app.use("/api/ingest", generationLimiter, ingestionRoutes);
app.use("/api/editor", editorRoutes);
app.use("/api/editor/voice", editorVoiceRoutes);
app.use("/api/rag", ragRoutes);
app.use("/api/rag/voice", chatbotVoiceRoutes);
app.use("/api/car-specs", carSpecsRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/workflow", workflowLimiter, workflowRoutes);
app.get("/", (req, res) => {
  res.status(200).json({ status: "Online", service: "AutoSight AI Backend" });
});

app.use((err, req, res, next) => {
  console.error("🔥 Unhandled Server Error:", err.stack);
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    details: err.message,
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`)
    .pathname;

  if (pathname === "/api/rag/voice/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleVoiceConnection(ws, request).catch((error) => {
        console.error("[ChatbotWS] Fatal session error:", error);
        try {
          ws.close(1011, "Voice session failed");
        } catch {}
      });
    });
    return;
  }

  socket.destroy();
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`
  🚗 ========================================
  🚗 AutoSense AI Backend Active
  🚗 Port:    ${PORT}
  🚗 Origins: Dynamic (*.lvh.me, *.axle.com, localhost)
  🚗 ========================================
  `);
});
