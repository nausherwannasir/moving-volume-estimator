import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { ITEM_SIZES, estimateBoxes } from './lib/boxes.js'
import { recommendVehicle } from './lib/vehicles.js'
import { detectItems } from './lib/detect.js'
import { detectionsToItems } from './lib/items.js'

const SIZE_LABELS = { small: 'Small', medium: 'Medium', large: 'Large' }

// Simple incrementing key for list rows — no persistence, session-only.
let nextId = 1

const EMPTY_DRAFT = { name: '', size: 'medium', quantity: 1, fragile: false }

/**
 * Manual-entry UI: collect a list of items, then show a live box + vehicle
 * estimate. All estimation logic lives in src/lib (framework-free); this
 * component only gathers items and renders the result.
 */
function App() {
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [photo, setPhoto] = useState(null) // { file, url } — session-only preview
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState('')
  const [detectNotice, setDetectNotice] = useState('')

  // Derived estimate — recomputed from the list on every add/remove.
  const estimate = useMemo(() => estimateBoxes(items), [items])
  const recommendation = useMemo(
    () => recommendVehicle(estimate.totalCubicFeet),
    [estimate.totalCubicFeet],
  )

  // Release the object URL when the photo is replaced or the app unmounts.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url)
    }
  }, [photo])

  function onPhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setPhoto({ file, url: URL.createObjectURL(file) })
    // A new photo invalidates any previous detection messaging.
    setDetectError('')
    setDetectNotice('')
    // Reset so picking the same file again still fires onChange.
    event.target.value = ''
  }

  async function runDetection() {
    if (!photo) return
    setDetecting(true)
    setDetectError('')
    setDetectNotice('')
    try {
      const found = await detectItems(photo.file)
      const detected = detectionsToItems(found).map((item) => ({
        id: nextId++,
        ...item,
      }))
      if (detected.length === 0) {
        setDetectError(
          'No items recognized. The in-browser detector only knows ~80 common ' +
            'objects, so it misses clothing, instruments, and décor — add those ' +
            'by hand below.',
        )
      } else {
        // Auto-fill the shared list: detected items are now editable/removable
        // exactly like manual ones and drive the live estimate.
        setItems((prev) => [...prev, ...detected])
        setDetectNotice(
          `Added ${detected.length} ${detected.length === 1 ? 'item' : 'items'} — ` +
            'review the sizes and add anything the scan missed below.',
        )
      }
    } catch (err) {
      console.error('Detection failed:', err)
      setDetectError(
        `Detection failed: ${err?.message || 'unknown error'}. You can still add items manually below.`,
      )
    } finally {
      setDetecting(false)
    }
  }

  function addItem(event) {
    event.preventDefault()
    const quantity = Math.max(1, Math.floor(Number(draft.quantity) || 1))
    const name = draft.name.trim() || `${SIZE_LABELS[draft.size]} item`
    setItems((prev) => [
      ...prev,
      { id: nextId++, name, size: draft.size, quantity, fragile: draft.fragile },
    ])
    // Keep the chosen size for fast repeated entry; reset everything else.
    setDraft({ ...EMPTY_DRAFT, size: draft.size })
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const boxRows = estimate.breakdown.filter((row) => row.count > 0)
  const hasEstimate = estimate.totalBoxes > 0

  return (
    <main className="app">
      <header className="app__header">
        <h1>📦 Moving Volume Estimator</h1>
        <p className="app__tagline">
          List what you&rsquo;re moving — get the boxes you&rsquo;ll need and the
          vehicle to fit it all.
        </p>
      </header>

      <section className="scan" aria-label="Add items from a photo">
        <h2>Scan a photo</h2>
        <p className="scan__hint">
          Take or upload a photo of a room — we&rsquo;ll suggest items and sizes
          you can edit before estimating.
        </p>
        <label className="btn btn--photo">
          {photo ? 'Choose a different photo' : '📷 Take or upload a photo'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="scan__input"
            onChange={onPhotoChange}
          />
        </label>
        {photo && (
          <>
            <img
              className="scan__preview"
              src={photo.url}
              alt="Selected room photo"
            />
            <button
              type="button"
              className="btn btn--add scan__detect"
              onClick={runDetection}
              disabled={detecting}
            >
              {detecting ? 'Detecting…' : 'Detect items'}
            </button>
            {detecting && (
              <p className="scan__subtle">
                The first scan downloads the detector — this can take a few
                seconds.
              </p>
            )}
            {detectError && <p className="scan__error">{detectError}</p>}
            {detectNotice && <p className="scan__notice">{detectNotice}</p>}
          </>
        )}
      </section>

      <form className="entry" onSubmit={addItem}>
        <div className="entry__row">
          <label className="field field--name">
            <span>Item</span>
            <input
              type="text"
              placeholder="e.g. Books"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="field field--qty">
            <span>Qty</span>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
            />
          </label>
        </div>

        <div className="entry__row">
          <label className="field field--size">
            <span>Size</span>
            <select
              value={draft.size}
              onChange={(e) => setDraft({ ...draft, size: e.target.value })}
            >
              {ITEM_SIZES.map((size) => (
                <option key={size} value={size}>
                  {SIZE_LABELS[size]}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--fragile checkbox">
            <input
              type="checkbox"
              checked={draft.fragile}
              onChange={(e) => setDraft({ ...draft, fragile: e.target.checked })}
            />
            <span>Fragile or heavy</span>
          </label>
        </div>

        <button type="submit" className="btn btn--add">
          Add item
        </button>
      </form>

      <section className="items" aria-label="Items to move">
        {items.length > 0 ? (
          <ul className="items__list">
            {items.map((item) => (
              <li key={item.id} className="item">
                <div className="item__main">
                  <span className="item__name">{item.name}</span>
                  <span className="item__meta">
                    <span className="tag">{SIZE_LABELS[item.size]}</span>
                    <span className="tag tag--qty">&times;{item.quantity}</span>
                    {item.fragile && (
                      <span className="tag tag--fragile">Fragile / heavy</span>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  className="item__remove"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => removeItem(item.id)}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="items__empty">
            No items yet — add what you&rsquo;re moving above.
          </p>
        )}
      </section>

      <section className="summary" aria-label="Estimate">
        <h2>Your estimate</h2>
        {hasEstimate ? (
          <>
            <ul className="summary__boxes">
              {boxRows.map((row) => (
                <li key={row.boxId} className="summary__box">
                  <span className="summary__box-count">{row.count}&times;</span>
                  <span className="summary__box-label">{row.label}</span>
                  <span className="summary__box-vol">
                    {row.subtotalCubicFeet} cu ft
                  </span>
                </li>
              ))}
            </ul>

            <div className="summary__totals">
              <span>
                {estimate.totalBoxes} {estimate.totalBoxes === 1 ? 'box' : 'boxes'}
              </span>
              <span>{estimate.totalCubicFeet} cu ft total</span>
            </div>

            <div className="summary__vehicle">
              <span className="summary__vehicle-label">Recommended vehicle</span>
              <strong>{recommendation.vehicle?.label ?? '—'}</strong>
              {recommendation.multipleTrips && (
                <span className="summary__trips">
                  ⚠️ Likely more than one trip
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="summary__empty">
            Add items to see your box and vehicle estimate.
          </p>
        )}
      </section>
    </main>
  )
}

export default App
