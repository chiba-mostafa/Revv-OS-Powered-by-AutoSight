"""
AutoSense PDF Shredder
Extracts text chunks, tables (as Markdown), and images from a PDF.
Outputs a JSON array to stdout for the Node.js pipeline to consume.

Usage:
    python extractor.py <path_to_pdf>
"""

import sys
import os
import json
import io
import fitz          # PyMuPDF
import pdfplumber

# Force UTF-8 stdout on Windows (avoids cp1252 UnicodeEncodeError)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CHUNK_SIZE = 500          # approximate characters per text chunk
TEMP_IMAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_images")
MIN_IMAGE_SIZE = 5_000    # skip tiny images (icons / decorations) < 5 KB


def ensure_temp_dir():
    """Create the temp_images directory if it doesn't exist."""
    os.makedirs(TEMP_IMAGE_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# 1. Text extraction  (PyMuPDF → ~500-char chunks)
# ---------------------------------------------------------------------------
def extract_text_chunks(pdf_path: str) -> list[dict]:
    """Return a list of {"type": "text", "content": "..."} items."""
    doc = fitz.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text("text") + "\n"
    doc.close()

    # Clean up excessive whitespace while preserving paragraph breaks
    lines = full_text.splitlines()
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped:
            cleaned_lines.append(stripped)
        elif cleaned_lines and cleaned_lines[-1] != "":
            cleaned_lines.append("")          # keep one blank line as separator
    full_text = "\n".join(cleaned_lines).strip()

    if not full_text:
        return []

    # Chunk into ~CHUNK_SIZE character blocks, splitting at sentence boundaries
    chunks = []
    while full_text:
        if len(full_text) <= CHUNK_SIZE:
            chunks.append(full_text)
            break

        # Find the last sentence-ending punctuation within the window
        split_at = CHUNK_SIZE
        for delim in [".\n", ". ", "!\n", "! ", "?\n", "? "]:
            pos = full_text.rfind(delim, 0, CHUNK_SIZE)
            if pos != -1:
                split_at = pos + len(delim)
                break

        chunk = full_text[:split_at].strip()
        if chunk:
            chunks.append(chunk)
        full_text = full_text[split_at:].strip()

    return [{"type": "text", "content": c} for c in chunks if len(c) > 20]


# ---------------------------------------------------------------------------
# 2. Image extraction  (PyMuPDF → temp_images/)
# ---------------------------------------------------------------------------
def extract_images(pdf_path: str) -> list[dict]:
    """Extract embedded images, save to temp_images/, return metadata."""
    ensure_temp_dir()
    doc = fitz.open(pdf_path)
    results = []
    img_counter = 0

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        image_list = page.get_images(full=True)

        for img_info in image_list:
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
            except Exception:
                continue

            image_bytes = base_image["image"]
            if len(image_bytes) < MIN_IMAGE_SIZE:
                continue                       # skip tiny decorative images

            ext = base_image.get("ext", "png")
            img_counter += 1
            filename = f"img_p{page_idx + 1}_{img_counter}.{ext}"
            filepath = os.path.join(TEMP_IMAGE_DIR, filename)

            with open(filepath, "wb") as f:
                f.write(image_bytes)

            results.append({"type": "image", "path": filepath})

    doc.close()
    return results


# ---------------------------------------------------------------------------
# 3. Table extraction  (pdfplumber → Markdown strings)
# ---------------------------------------------------------------------------
def extract_tables(pdf_path: str) -> list[dict]:
    """Extract tables and format each as a Markdown table string."""
    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            for tbl_idx, table in enumerate(tables):
                if not table or len(table) < 2:
                    continue                   # skip empty / single-row tables

                # Build Markdown table
                md_lines = []
                header = table[0]
                # Sanitise cells  (None → "")
                header = [str(c).strip() if c else "" for c in header]
                md_lines.append("| " + " | ".join(header) + " |")
                md_lines.append("| " + " | ".join(["---"] * len(header)) + " |")

                for row in table[1:]:
                    cells = [str(c).strip() if c else "" for c in row]
                    # Pad / trim to match header length
                    while len(cells) < len(header):
                        cells.append("")
                    cells = cells[: len(header)]
                    md_lines.append("| " + " | ".join(cells) + " |")

                md_str = "\n".join(md_lines)
                results.append({"type": "table", "content": md_str})

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python extractor.py <pdf_path>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.isfile(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    elements = []
    elements.extend(extract_text_chunks(pdf_path))
    elements.extend(extract_tables(pdf_path))
    elements.extend(extract_images(pdf_path))

    # Output JSON to stdout for Node.js to capture
    print(json.dumps(elements, ensure_ascii=False))


if __name__ == "__main__":
    main()
