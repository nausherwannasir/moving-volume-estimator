// Detection layer for the Moving Volume Estimator.
//
// Photo scanning is "detect items, user confirms sizes" — NOT pixel-accurate
// measurement. A single photo has no scale reference, so each detected item gets
// a coarse small/medium/large guess that the user edits before estimating.
//
// Everything here outputs the SAME `{ name, size }[]` shape that manual entry
// produces, so detections feed straight into estimateBoxes() / recommendVehicle()
// with no change to that logic. The backend is swappable behind detectItems():
//   - Default: COCO-SSD, fully in-browser, no API key.
//   - Optional: Gemini vision, used automatically when VITE_GEMINI_API_KEY is set
//     (with COCO as the fallback if the call fails).
//
// TensorFlow.js is loaded lazily inside detectWithCoco() via dynamic import, so
// the heavy model isn't in the initial bundle and these pure helpers stay
// unit-testable without pulling TF into the test environment.

export const SIZES = ['small', 'medium', 'large']

/** Clamp an arbitrary value to a known size; default 'medium' (user confirms). */
export function normalizeSize(size) {
  return SIZES.includes(size) ? size : 'medium'
}

// Phone photos are ~12 MP. Running detection on the full-resolution image makes
// COCO-SSD slow and memory-heavy — a cluttered shot can stall (or OOM) the tab —
// and Gemini doesn't need the extra pixels. Downscale so the longest side is
// <= this before any inference.
const MAX_DETECT_DIM = 640

/** Draw an <img> onto a canvas, scaled so its longest side is <= maxDim. */
function downscaleForDetection(imageEl, maxDim = MAX_DETECT_DIM) {
  const w = imageEl.naturalWidth || imageEl.width || maxDim
  const h = imageEl.naturalHeight || imageEl.height || maxDim
  const scale = Math.min(1, maxDim / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  canvas.getContext('2d').drawImage(imageEl, 0, 0, canvas.width, canvas.height)
  return canvas
}

// ---------------------------------------------------------------------------
// Gemini backend (primary when a key is present)
// ---------------------------------------------------------------------------

// A current Gemini multimodal model. Easy to bump; only used when a key is set.
const GEMINI_MODEL = 'gemini-2.5-flash'

const GEMINI_PROMPT = `You are helping someone plan a house move. Look at this photo and list the distinct movable belongings you can see.
Return ONLY a JSON array — no prose, no markdown fences. Each element must be {"name": string, "size": "small" | "medium" | "large"}.
Choose "size" from the TYPICAL real-world size of that kind of object (book = small, microwave = medium, sofa = large), NOT how large it appears in the photo — there is no scale reference. If unsure, make your best guess. Do not include people or pets.`

/**
 * Parse Gemini's text response into items. Defensive by design: strips markdown
 * fences, JSON.parse inside try/catch, and filters anything that isn't a usable
 * {name,size}. Returns [] on junk rather than throwing.
 */
export function parseGeminiItems(text) {
  if (typeof text !== 'string') return []
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  let data
  try {
    data = JSON.parse(cleaned)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []

  return data
    .filter((it) => it && typeof it.name === 'string' && it.name.trim())
    .map((it) => ({ name: it.name.trim(), size: normalizeSize(it.size) }))
}

async function detectWithGemini(imageEl, apiKey) {
  const base64 = canvasToJpegBase64(downscaleForDetection(imageEl))
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: GEMINI_PROMPT },
              { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            ],
          },
        ],
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return parseGeminiItems(text)
}

/** Canvas → raw base64 JPEG (no data-URL prefix), for Gemini's inline_data. */
function canvasToJpegBase64(canvas) {
  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
}

// ---------------------------------------------------------------------------
// COCO-SSD backend (default, no key)
// ---------------------------------------------------------------------------

// COCO-SSD reports a class label, not a real-world size, so this is a static,
// deliberately coarse class → size lookup. Anything unlisted defaults to
// 'medium'. Coarse is fine: the user confirms every size before estimating.
export const COCO_SIZE = {
  // small — handheld / tabletop
  book: 'small',
  cup: 'small',
  'wine glass': 'small',
  bottle: 'small',
  bowl: 'small',
  fork: 'small',
  knife: 'small',
  spoon: 'small',
  remote: 'small',
  mouse: 'small',
  keyboard: 'small',
  'cell phone': 'small',
  clock: 'small',
  vase: 'small',
  scissors: 'small',
  toothbrush: 'small',
  'hair drier': 'small',
  'teddy bear': 'small',
  handbag: 'small',
  tie: 'small',
  // medium — two-hands / appliance
  laptop: 'medium',
  tv: 'medium',
  microwave: 'medium',
  toaster: 'medium',
  backpack: 'medium',
  suitcase: 'medium',
  umbrella: 'medium',
  skateboard: 'medium',
  'potted plant': 'medium',
  chair: 'medium',
  sink: 'medium',
  toilet: 'medium',
  // large — furniture / big appliance
  couch: 'large',
  bed: 'large',
  'dining table': 'large',
  refrigerator: 'large',
  oven: 'large',
}

// Living things COCO detects but that nobody is packing into a box.
const COCO_EXCLUDE = new Set([
  'person',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
])

// Confidence floor for COCO detections. Lower than COCO's 0.5 default to favor
// recall — e.g. a transparent water bottle at ~0.4 — since the user confirms
// every size anyway.
const MIN_SCORE = 0.35

/** Map a COCO class label to a coarse size; unmapped → 'medium'. */
export function cocoClassToSize(className) {
  return COCO_SIZE[className] ?? 'medium'
}

/**
 * Turn raw COCO-SSD detections (`[{ class, score, bbox }]`) into estimator
 * items. Drops low-confidence hits and excludes living things.
 */
export function cocoDetectionsToItems(detections, { minScore = MIN_SCORE } = {}) {
  if (!Array.isArray(detections)) return []
  return detections
    .filter(
      (d) =>
        d &&
        typeof d.class === 'string' &&
        !COCO_EXCLUDE.has(d.class) &&
        (d.score ?? 0) >= minScore,
    )
    .map((d) => ({ name: titleCase(d.class), size: cocoClassToSize(d.class) }))
}

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

let cocoModelPromise = null

async function detectWithCoco(imageEl) {
  // Lazy-load TF + the model so it's code-split out of the initial bundle.
  if (!cocoModelPromise) {
    cocoModelPromise = (async () => {
      await import('@tensorflow/tfjs')
      const cocoSsd = await import('@tensorflow-models/coco-ssd')
      return cocoSsd.load()
    })()
  }
  const model = await cocoModelPromise
  // Detect on a downscaled canvas; allow more boxes for cluttered scenes and pass
  // the lower score floor so marginal objects still surface.
  const source = downscaleForDetection(imageEl)
  const detections = await model.detect(source, 30, MIN_SCORE)
  return cocoDetectionsToItems(detections)
}

// ---------------------------------------------------------------------------
// Public interface — swappable backend
// ---------------------------------------------------------------------------

/**
 * Detect movable items in a photo.
 *
 * @param {HTMLImageElement} imageEl — a loaded <img> (e.g. the on-screen preview)
 * @returns {Promise<Array<{ name: string, size: 'small'|'medium'|'large' }>>}
 */
export async function detectItems(imageEl) {
  // Make sure the image is decoded before COCO/canvas read from it.
  if (imageEl && imageEl.complete === false && imageEl.decode) {
    try {
      await imageEl.decode()
    } catch {
      /* fall through — detect will surface a real failure if it can't read */
    }
  }

  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY
  if (apiKey) {
    try {
      return await detectWithGemini(imageEl, apiKey)
    } catch (err) {
      // Gemini is best-effort; fall back to the in-browser model.
      console.warn('Gemini detection failed; falling back to COCO-SSD:', err)
    }
  }
  return detectWithCoco(imageEl)
}
