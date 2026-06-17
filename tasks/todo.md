# TODO: Ship Moving Volume Estimator v1

Goal: a working v1, live and shareable, that works on mobile. Full detail in
[`plan.md`](./plan.md). Check off acceptance criteria as you go.

## Phase 1 — Refine the estimate (~25m)

- [x] **Task 1 — Item quantity in `estimateBoxes`** (S · `src/lib/boxes.js`, `boxes.test.js`)
  - [x] `{size:'small', quantity:8}` adds 8 to the small tally
  - [x] Missing quantity = 1; `0`/negative = 0; fractional handled deterministically
  - [x] All 9 existing tests still pass
- [x] **Task 2 — Fragile/heavy → smaller sturdier box** (S · `boxes.js`, `boxes.test.js`) · _dep: Task 1_
  - [x] `{size:'large', fragile:true}` → file box, not large box (test)
  - [x] No-fragile list → `file:0`, same s/m/l counts as before
  - [x] Quantity + fragile compose
  - [x] Sample test updated for the new `file` row
- [x] **Task 3 — Real vehicle data + `recommendVehicle()`** (S · `src/lib/vehicles.js`+test, new) · _parallel with 1–2_
  - [x] Real, cited cargo volumes (no placeholders): car ~15, SUV ~75, van ~245, 10' ~402, 15' ~764, 20' ~1016, 26' ~1682 cu ft
  - [x] Returns smallest vehicle whose usable capacity (rated × load factor) ≥ total
  - [x] Edge: `0` → none; over-largest → largest + "more than one trip"
  - [x] Framework-free (no React import)

### ✅ Checkpoint — Foundation
- [x] `npm test` green (27 passing) · `npm run build` clean · `npm run lint` clean
- [x] Quantity + fragile rule + real vehicle recommendation all demonstrable
- [ ] Review with human before UI

## Phase 2 — Styling & usability (~30m)

- [x] **Task 4 — Item entry + add/remove list** (M · `App.jsx`, `App.css`) · _dep: 1, 2_
  - [x] Add item: name, size, quantity, fragile/heavy toggle
  - [x] Remove any item; list updates immediately
  - [x] In-memory session state; graceful empty/invalid input (qty floored to ≥1, name defaults)
- [x] **Task 5 — Live summary: boxes by type + vehicle** (M · `App.jsx`, `App.css`) · _dep: 3, 4_
  - [x] Per-box-type breakdown + totals
  - [x] Recommended vehicle (+ multi-trip note)
  - [x] Updates live via useMemo on add/remove; empty list = clean zero state
- [x] **Task 6 — Mobile-responsive styling pass** (M · `App.css`, `index.css`) · _dep: 4, 5_
  - [x] Mobile-first CSS: single column, 16px inputs (no iOS zoom), 36–46px tap targets, no fixed-width overflow
  - [x] Form/list/summary visually distinct cards; reuse theme + dark mode
  - [x] Removed leftover template style noise (`#social`, `.counter`)

### ✅ Checkpoint — Working app
- [x] Add/remove → live box + vehicle summary, end to end (logic + wiring verified)
- [x] `npm run build` clean · `npm test` green (27) · `npm run lint` clean · dev server serves with no compile errors
- [ ] Visual confirmation on a real phone (no browser tool here — eyeball via `npm run dev`, also gets a live mobile check in Phase 3)
- [ ] Review with human before deploy

## Phase 3 — Deploy (~25m)

- [ ] **Task 7 — Deploy to Vercel (public URL)** (S · zero-config) · _dep: 6_
  - [ ] Production build deploys, no errors
  - [ ] Public URL loads; full flow works
  - [ ] Works on a real mobile browser
  - [ ] ⚠️ May need user to run `! vercel login` or import the repo in the dashboard
  - [ ] Capture the live URL for the README

## Phase 4 — README & proof (~10m)

- [ ] **Task 8 — README usage + live link + proof** (S · `README.md`, image) · _dep: 7_
  - [ ] Usage section (add items → summary flow)
  - [ ] Live URL, clickable, near the top
  - [ ] One screenshot or short GIF that renders on GitHub

### ✅ Checkpoint — Shippable
- [ ] Live URL works on mobile · tests green · build clean
- [ ] README: usage + live link + proof image
- [ ] All four goal "Done =" conditions met · final review
