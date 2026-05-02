/**
 * useImageUpload — shared hook for all image uploads across the platform.
 *
 * What it does:
 *  - Accepts any image (JPEG, PNG, WEBP, GIF, HEIC…) up to MAX_FILE_MB
 *  - Auto-compresses large images on the canvas before base64-encoding them
 *    so the JSON payload stays well under the 150 MB Express body limit
 *  - Exposes upload progress (0-100) so the UI can show a bar
 *  - Returns a human-readable error string on failure
 *
 * Limits (intentional):
 *  - MAX_FILE_MB = 5   → raw file size cap before compression
 *  - TARGET_PX  = 800  → max width/height after compression (avatar-sized)
 *  - QUALITY    = 0.82 → good quality with significantly smaller output
 *
 * GIFs are NOT compressed (canvas kills animation); they pass through raw.
 * SVGs are rejected — they can embed arbitrary JS.
 */

const MAX_FILE_MB = 5;                // raw file cap before compression
const MAX_BYTES   = MAX_FILE_MB * 1024 * 1024;
const TARGET_PX   = 800;              // max dimension after compression (avatar-sized)
const QUALITY     = 0.82;             // good quality, smaller output

const ALLOWED_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/gif",  "image/heic", "image/heif", "image/avif",
  "image/bmp",  "image/tiff",
];

/** Resize + re-encode an image file via canvas. Returns a base64 data-URL. */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only downscale — never upscale
      if (width > TARGET_PX || height > TARGET_PX) {
        if (width >= height) {
          height = Math.round((height / width) * TARGET_PX);
          width  = TARGET_PX;
        } else {
          width  = Math.round((width / height) * TARGET_PX);
          height = TARGET_PX;
        }
      }

      const canvas  = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer webp for best compression; fallback to jpeg
      const mime   = "image/webp";
      const result = canvas.toDataURL(mime, QUALITY);
      resolve(result);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };

    img.src = url;
  });
}

/**
 * Main hook.
 *
 * Returns:
 *   { value, preview, progress, error, processing, pickFile, setUrl, clear }
 *
 *   value     — base64 data-URL ready to send to the API (or an https:// URL)
 *   preview   — same as value, used for <img src={preview} />
 *   progress  — 0-100 during processing, 100 when done
 *   error     — human-readable string, or ""
 *   processing— true while compressing
 *   pickFile(File) — call with a File object from <input type="file">
 *   setUrl(str)    — call with a remote URL (skips compression)
 *   clear()        — reset everything
 */
import { useState, useCallback } from "react";

export function useImageUpload() {
  const [value,      setValue]      = useState("");
  const [preview,    setPreview]    = useState(null);
  const [progress,   setProgress]   = useState(0);
  const [error,      setError]      = useState("");
  const [processing, setProcessing] = useState(false);

  const clear = useCallback(() => {
    setValue("");
    setPreview(null);
    setProgress(0);
    setError("");
    setProcessing(false);
  }, []);

  const setUrl = useCallback((url) => {
    setError("");
    setValue(url);
    setPreview(url);
    setProgress(100);
  }, []);

  const pickFile = useCallback(async (file) => {
    if (!file) return;

    setError("");
    setProgress(0);

    // ── Type check ───────────────────────────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`Unsupported file type: ${file.type || "unknown"}. Use JPEG, PNG, WEBP, or GIF.`);
      return;
    }

    // ── Size check ───────────────────────────────────────────────────────────
    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setError(`File too large (${mb} MB). Maximum is ${MAX_FILE_MB} MB per upload.`);
      return;
    }

    setProcessing(true);
    setProgress(10);

    try {
      // GIFs: skip canvas (kills animation) — read raw as base64
      if (file.type === "image/gif") {
        setProgress(40);
        await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            setProgress(90);
            setValue(e.target.result);
            setPreview(e.target.result);
            setProgress(100);
            res();
          };
          reader.readAsDataURL(file);
        });
      } else {
        // All other formats: compress via canvas
        setProgress(30);
        const compressed = await compressImage(file);
        setProgress(95);
        setValue(compressed);
        setPreview(compressed);
        setProgress(100);
      }
    } catch (err) {
      setError(err.message || "Failed to process image. Try a different file.");
      setProgress(0);
    } finally {
      setProcessing(false);
    }
  }, []);

  return { value, preview, progress, error, processing, pickFile, setUrl, clear };
}