/**
 * RAG Ingestion Controller
 *
 * Accepts a PDF via multer, runs the Python Shredder to extract text/tables/images,
 * embeds each element via Google Gemini / Vertex, and stores everything in Supabase
 * (pgvector for embeddings, storage bucket for images).
 */

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { supabase } = require("../config/supabase");
const { generateMultimodalEmbedding } = require("../services/embeddingService");

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const PYTHON_SCRIPT = path.resolve(
  __dirname,
  "../scripts/python_shredder/extractor.py",
);

const PYTHON_VENV_DIR = path.resolve(
  __dirname,
  "../scripts/python_shredder/venv",
);

// Resolve python executable inside the venv (cross-platform)
const IS_WIN = process.platform === "win32";
const PYTHON_BIN = IS_WIN
  ? path.join(PYTHON_VENV_DIR, "Scripts", "python.exe")
  : path.join(PYTHON_VENV_DIR, "bin", "python");

const TEMP_DIR = path.resolve(__dirname, "../../temp");
const TEMP_IMAGES_DIR = path.resolve(
  __dirname,
  "../scripts/python_shredder/temp_images",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeDisplayFilename(filename, fallback = "document.pdf") {
  const normalized = String(filename || "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
}

function sanitizeStorageKeyPart(value, fallback = "file") {
  const sanitized = String(value || "")
    .normalize("NFKD")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|#%{}\[\]~`]+/g, "-")
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  return sanitized || fallback;
}

function sanitizeStorageFilename(
  filename,
  fallbackBase = "document",
  fallbackExt = ".pdf",
) {
  const parsed = path.parse(String(filename || ""));
  const safeBase = sanitizeStorageKeyPart(parsed.name, fallbackBase);
  const extensionSource = parsed.ext || fallbackExt;
  const safeExt = sanitizeStorageKeyPart(
    extensionSource.replace(/^\./, ""),
    fallbackExt.replace(/^\./, ""),
  ).toLowerCase();

  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

function cleanUp(...dirs) {
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

/**
 * Read a local file and return a base64-encoded string (no data-uri prefix).
 */
function fileToBase64(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString("base64");
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * POST /api/rag/ingest
 * multipart/form-data  →  fields: car_id (string)   file: document (PDF)
 */
async function ingestCarDocument(req, res) {
  const startTime = Date.now();
  const carId = req.body.car_id;

  if (!carId) {
    return res
      .status(400)
      .json({ success: false, error: "car_id is required." });
  }
  if (!req.files || req.files.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "At least one PDF file is required." });
  }

  let totalElements = 0;
  let successCount = 0;
  let errorCount = 0;

  try {
    for (const file of req.files) {
      const pdfPath = file.path;
      const displayFilename = normalizeDisplayFilename(file.originalname);
      const storageFilename = sanitizeStorageFilename(displayFilename);

      try {
        // ---------------------------------------------------------------
        // 1. Run the Python Shredder per PDF
        // ---------------------------------------------------------------
        console.log(`📄 [RAG] Shredding PDF: ${displayFilename}`);

        const { stdout, stderr } = await execAsync(
          `"${PYTHON_BIN}" "${PYTHON_SCRIPT}" "${pdfPath}"`,
          { maxBuffer: 50 * 1024 * 1024 },
        );

        if (stderr) {
          console.warn("⚠️  [RAG] Python stderr:", stderr);
        }

        let elements;
        try {
          elements = JSON.parse(stdout);
        } catch {
          throw new Error(
            `Failed to parse Python output as JSON.\nstdout: ${stdout.slice(0, 500)}`,
          );
        }

        if (elements.error) {
          throw new Error(`Python Shredder error: ${elements.error}`);
        }

        console.log(
          `✅ [RAG] Extracted ${elements.length} elements from ${displayFilename}`,
        );
        totalElements += elements.length;

        // ---------------------------------------------------------------
        // 1b. Upload original PDF to Supabase Storage for persistence
        // ---------------------------------------------------------------
        const pdfBuffer = fs.readFileSync(pdfPath);
        const storagePath = `${carId}/${Date.now()}_${storageFilename}`;
        const { error: pdfUploadError } = await supabase.storage
          .from("knowledge_base_documents")
          .upload(storagePath, pdfBuffer, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (pdfUploadError) {
          console.warn(
            "⚠️  [RAG] PDF storage upload failed:",
            pdfUploadError.message,
          );
        } else {
          const {
            data: { publicUrl },
          } = supabase.storage
            .from("knowledge_base_documents")
            .getPublicUrl(storagePath);

          // Insert a tracking row into car_documents
          await supabase.from("car_documents").insert({
            car_id: carId,
            filename: displayFilename,
            size: file.size,
            storage_path: storagePath,
            url: publicUrl,
          });
        }

        // ---------------------------------------------------------------
        // 2. Process each element → embed + store
        // ---------------------------------------------------------------
        for (const element of elements) {
          try {
            if (element.type === "image") {
              await processImage(element, carId);
            } else {
              await processTextOrTable(element, carId);
            }
            successCount++;
          } catch (err) {
            errorCount++;
            console.error(
              `❌ [RAG] Failed to process ${element.type} element:`,
              err.message,
            );
          }
        }

        // Clean up temp images between PDFs
        cleanUp(TEMP_IMAGES_DIR);
      } finally {
        // Always remove the temp PDF
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `🏁 [RAG] Ingestion complete in ${duration}s — ${successCount} stored, ${errorCount} errors (${req.files.length} PDFs)`,
    );

    return res.status(200).json({
      success: true,
      message: `Ingested ${successCount} elements from ${req.files.length} document(s) in ${duration}s.`,
      stats: {
        documents: req.files.length,
        total: totalElements,
        stored: successCount,
        errors: errorCount,
        durationSec: Number(duration),
      },
    });
  } catch (err) {
    // Cleanup on failure
    cleanUp(TEMP_IMAGES_DIR);
    for (const file of req.files) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }

    console.error("🔥 [RAG] Ingestion failed:", err);
    return res.status(500).json({
      success: false,
      error: "Document ingestion failed.",
      details: err.message,
    });
  }
}

// ---------------------------------------------------------------------------
// Processors
// ---------------------------------------------------------------------------

/**
 * Upload image to Supabase Storage, embed with Gemini, insert row.
 */
async function processImage(element, carId) {
  const localPath = element.path;
  if (!fs.existsSync(localPath)) {
    throw new Error(`Image file not found: ${localPath}`);
  }

  const safeImageFilename = sanitizeStorageFilename(
    path.basename(localPath),
    "image",
    path.extname(localPath) || ".png",
  );
  const filename = `${carId}/${Date.now()}_${safeImageFilename}`;
  const fileBuffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).replace(".", "");
  const mimeType =
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("knowledge_base_images")
    .upload(filename, fileBuffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    throw new Error(`Supabase storage upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("knowledge_base_images").getPublicUrl(filename);

  // Derive format from file extension and pass it to the embedding service
  const imgExt = path.extname(localPath).replace(".", "").toLowerCase();
  const imgFormat = imgExt === "jpg" ? "jpeg" : imgExt || "jpeg";

  // Generate embedding from the image
  const base64Image = fileToBase64(localPath);
  const embedding = await generateMultimodalEmbedding({
    inputImage: base64Image,
    imageFormat: imgFormat,
  });

  // Insert into knowledge base
  const { error: insertError } = await supabase
    .from("car_knowledge_base")
    .insert({
      car_id: carId,
      content_type: "image",
      content: publicUrl,
      embedding: JSON.stringify(embedding),
    });

  if (insertError) {
    throw new Error(`Supabase insert failed: ${insertError.message}`);
  }
}

/**
 * Embed text/table content with Gemini and insert row.
 */
function sanitizeText(text) {
  return text
    .replace(/\r\n/g, "\n") // normalize Windows line endings
    .replace(/\t/g, " ") // replace tabs with spaces
    .replace(/\u2022/g, "-") // bullet • → -
    .replace(/\u202f/g, " ") // narrow no-break space → space
    .replace(/\u00a0/g, " ") // non-breaking space → space
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201c\u201d]/g, '"') // smart double quotes
    .replace(/[^\x00-\x7F\n]/g, (c) => {
      // replace any remaining non-ASCII
      try {
        return c.normalize("NFC");
      } catch {
        return " ";
      }
    })
    .replace(/ {2,}/g, " ") // collapse multiple spaces
    .trim()
    .slice(0, 4096); // hard cap for API limits
}

async function processTextOrTable(element, carId) {
  const content = element.content;
  if (!content || content.trim().length === 0) return;

  const embedding = await generateMultimodalEmbedding({
    inputText: sanitizeText(content),
  });

  const { error: insertError } = await supabase
    .from("car_knowledge_base")
    .insert({
      car_id: carId,
      content_type: element.type, // "text" or "table"
      content: content,
      embedding: JSON.stringify(embedding),
    });

  if (insertError) {
    throw new Error(`Supabase insert failed: ${insertError.message}`);
  }
}

// ---------------------------------------------------------------------------
// GET /api/rag/documents/:carId — list uploaded documents for a car
// ---------------------------------------------------------------------------
async function getCarDocuments(req, res) {
  const { carId } = req.params;
  if (!carId) {
    return res
      .status(400)
      .json({ success: false, error: "carId is required." });
  }

  const { data, error } = await supabase
    .from("car_documents")
    .select("id, filename, url, size, storage_path, created_at")
    .eq("car_id", carId)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.status(200).json({ success: true, documents: data || [] });
}

// ---------------------------------------------------------------------------
// DELETE /api/rag/documents/:docId — remove a document + its storage file
// ---------------------------------------------------------------------------
async function deleteCarDocument(req, res) {
  const { docId } = req.params;
  if (!docId) {
    return res
      .status(400)
      .json({ success: false, error: "docId is required." });
  }

  // Fetch the row to get storage_path
  const { data: row, error: fetchErr } = await supabase
    .from("car_documents")
    .select("storage_path")
    .eq("id", docId)
    .single();

  if (fetchErr || !row) {
    return res
      .status(404)
      .json({ success: false, error: "Document not found." });
  }

  // Remove from Supabase Storage
  if (row.storage_path) {
    await supabase.storage
      .from("knowledge_base_documents")
      .remove([row.storage_path]);
  }

  // Remove the DB row
  const { error: deleteErr } = await supabase
    .from("car_documents")
    .delete()
    .eq("id", docId);

  if (deleteErr) {
    return res.status(500).json({ success: false, error: deleteErr.message });
  }

  return res.status(200).json({ success: true, message: "Document deleted." });
}

// ---------------------------------------------------------------------------
// POST /api/rag/chat — Multimodal RAG Chat
// ---------------------------------------------------------------------------
const { processChat } = require("../services/ragChatService");

async function chatWithCar(req, res) {
  const { car_id, question, car_context, conversation_history } = req.body;

  if (!car_id || !question) {
    return res
      .status(400)
      .json({ success: false, error: "car_id and question are required." });
  }

  try {
    const result = await processChat({
      question,
      carId: car_id,
      carContext: car_context || {},
      conversationHistory: conversation_history || [],
    });

    // Widget response (booking intent detected)
    if (result.type === "widget") {
      return res.status(200).json({
        success: true,
        type: "widget",
        widget_type: result.widget_type,
        prefilled_data: result.prefilled_data,
        text: result.text,
        tier: result.tier,
      });
    }

    return res.status(200).json({
      success: true,
      text: result.text,
      image_url: result.image_url,
      tier: result.tier,
    });
  } catch (err) {
    console.error("🔥 [RAG Chat] Error:", err);
    return res.status(500).json({
      success: false,
      error: "Chat processing failed.",
      details: err.message,
    });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  ingestCarDocument,
  getCarDocuments,
  deleteCarDocument,
  chatWithCar,
  ensureDir,
  normalizeDisplayFilename,
  sanitizeStorageFilename,
  TEMP_DIR,
};
