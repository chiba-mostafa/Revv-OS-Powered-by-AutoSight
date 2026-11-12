/**
 * RAG Ingestion Routes
 *
 * POST /api/rag/ingest  — multipart/form-data (car_id + PDF file)
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const {
  ingestCarDocument,
  getCarDocuments,
  deleteCarDocument,
  chatWithCar,
  ensureDir,
  TEMP_DIR,
} = require("../controllers/ragController");

const router = express.Router();

// ---------------------------------------------------------------------------
// Multer config — save PDFs to server/temp/
// ---------------------------------------------------------------------------
ensureDir(TEMP_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDir(TEMP_DIR);
    cb(null, TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted."), false);
    }
  },
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
router.post("/ingest", upload.array("documents", 10), ingestCarDocument);
router.post("/chat", chatWithCar);
router.get("/documents/:carId", getCarDocuments);
router.delete("/documents/:docId", deleteCarDocument);

module.exports = router;
