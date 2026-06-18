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

/**
 * Decode a source (File/Blob, preferred — or an <img>) into a downscaled canvas
 * ready for both backends. Uses createImageBitmap for File/Blob: it decodes the
 * bytes directly (no <img> element, no object-URL lifecycle to get "broken"),
 * applies EXIF orientation, and throws a clear error — including the file type —
 * for formats the browser can't decode (e.g. HEIC in Chrome).
 */
async function sourceToCanvas(source, maxDim = MAX_DETECT_DIM) {
  let drawable
  let width
  let height

  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    if (!source.complete && source.decode) {
      try {
        await source.decode()
      } catch {
        /* fall through; drawImage below will surface a real failure */
      }
    }
    drawable = source
    width = source.naturalWidth || source.width
    height = source.naturalHeight || source.height
  } else {
    try {
      drawable = await createImageBitmap(source)
    } catch (err) {
      const type = source?.type || 'unknown type'
      throw new Error(
        `couldn't decode the image (${type}). HEIC photos aren't supported in this browser — try a JPEG or PNG.`,
        { cause: err },
      )
    }
    width = drawable.width
    height = drawable.height
  }

  const scale = Math.min(1, maxDim / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  canvas.getContext('2d').drawImage(drawable, 0, 0, canvas.width, canvas.height)
  if (drawable.close) drawable.close() // free the ImageBitmap
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

async function detectWithGemini(canvas, apiKey) {
  const base64 = canvasToJpegBase64(canvas)
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
        // Force a clean JSON response (no markdown fences) — parseGeminiItems
        // still strips fences defensively in case the model ignores this.
        generationConfig: { responseMimeType: 'application/json' },
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
  'sports ball': 'small',
  frisbee: 'small',
  'baseball glove': 'small',
  banana: 'small',
  apple: 'small',
  orange: 'small',
  donut: 'small',
  cake: 'small',
  sandwich: 'small',
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
  'tennis racket': 'medium',
  'baseball bat': 'medium',
  // large — furniture / big appliance / vehicles
  couch: 'large',
  bed: 'large',
  'dining table': 'large',
  refrigerator: 'large',
  oven: 'large',
  bicycle: 'large',
  motorcycle: 'large',
  skis: 'large',
  snowboard: 'large',
  surfboard: 'large',
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

async function detectWithCoco(canvas) {
  // Lazy-load TF + the model so it's code-split out of the initial bundle.
  if (!cocoModelPromise) {
    cocoModelPromise = (async () => {
      await import('@tensorflow/tfjs')
      const cocoSsd = await import('@tensorflow-models/coco-ssd')
      return cocoSsd.load()
    })()
  }
  let model
  try {
    model = await cocoModelPromise
  } catch (err) {
    // Don't cache a failed load (e.g. a blocked model download) — allow a retry.
    cocoModelPromise = null
    throw err
  }
  // Allow more boxes for cluttered scenes and pass the lower score floor so
  // marginal objects still surface.
  const detections = await model.detect(canvas, 30, MIN_SCORE)
  return cocoDetectionsToItems(detections)
}

// ---------------------------------------------------------------------------
// Public interface — swappable backend
// ---------------------------------------------------------------------------

/**
 * Detect movable items in a photo.
 *
 * @param {File | Blob | HTMLImageElement} source — a File/Blob (preferred) is
 *   decoded directly to a canvas via createImageBitmap, sidestepping any <img>
 *   element / object-URL lifecycle that can leave an image "broken".
 * @returns {Promise<Array<{ name: string, size: 'small'|'medium'|'large' }>>}
 */
export async function detectItems(source) {
  const canvas = await sourceToCanvas(source)

  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY
  if (apiKey) {
    try {
      return await detectWithGemini(canvas, apiKey)
    } catch (err) {
      // Gemini is best-effort; fall back to the in-browser model.
      console.warn('Gemini detection failed; falling back to COCO-SSD:', err)
    }
  }
  return detectWithCoco(canvas)
}
