# Implementation Plan: Moving Volume Estimator — Ship v1

## Goal

Today's outcome: **a working v1 that is live and shareable on a public URL and works
on mobile.** Scanning stays in a later milestone. The arc is: foundation (done
yesterday) → **ship it (today)** → camera feature (later).

The four timed goals from the brief map onto the four phases below:

| Phase | Goal | Budget | Done when |
|-------|------|--------|-----------|
| 1 | Refine the estimate | ~25m | Logic handles item **quantity** ("8 books"), has **one box-choice rule beyond raw volume** (fragile/heavy → smaller sturdier box), and **box + vehicle numbers are real values**. |
| 2 | Styling & usability | ~30m | You can **add and remove** items; result is a **clear summary** (boxes by type + recommended vehicle); it **doesn't look like an unstyled form on your phone**. |
| 3 | Deploy | ~25m | A **public URL** on Vercel/Netlify that loads and works on mobile. |
| 4 | README & proof | ~10m | README has a **usage section, the live link, and one screenshot/GIF**. |

## Current State (verified baseline)

- `src/lib/boxes.js` — framework-free `BOXES`, `ITEM_SIZES`, `SIZE_TO_BOX`,
  `estimateBoxes(items)`. Item shape today: `{ name?, size }`. **No quantity, no
  fragile/heavy rule.**
- Box volumes are **already real** (U-Haul published, June 2026) — file 1.0,
  small 1.5, medium 3.0, large 4.5, x-large 6.0 cu ft. ✓
- **No `vehicles.js` yet** — vehicle recommendation logic does not exist.
- `src/App.jsx` — Milestone-1 placeholder page only. No item entry, add/remove,
  or summary.
- `src/index.css` / `src/App.css` — generic Vite template styling.
- `npm test` → 9 passing. `npm run build` → clean. Remote:
  `github.com/nausherwannasir/moving-volume-estimator`. Node v22.
- No deploy config. README has roadmap but **no usage / live link / screenshot**.

## Architecture Decisions

1. **Keep estimation logic framework-free in `src/lib/`.** This is the project's
   core design principle (manual entry today, scanner later both feed the same
   `estimateBoxes` pipeline). All new logic — quantity, the fragile rule, vehicle
   lookup — lands in `src/lib/`, not in React components. The UI only collects
   items and renders results.

2. **Item model extends, does not break.** New shape:
   `{ name?, size: 'small'|'medium'|'large', quantity?: number (default 1), fragile?: boolean }`.
   `quantity` defaults to 1 and `fragile` defaults to false, so **every existing
   test that omits them keeps the same result** (backward compatible). The UI's
   "Fragile / heavy" toggle sets one `fragile` boolean (we treat fragile and
   heavy as the same routing case for the MVP).

3. **The box-choice rule beyond raw volume:** fragile/heavy items are packed into
   the **book/file box** (`file`, 1.0 cu ft) — the smallest, sturdiest, double-walled
   box, at a **reduced items-per-box capacity** — regardless of their size tag.
   This is a real moving heuristic (heavy/fragile → small sturdy box so it's not
   too heavy to lift and is better protected). Consequence: `counts` and
   `breakdown` gain a `file` category; **the existing sample test must be updated**
   to expect a `file` row (0 when no items are fragile).

4. **Vehicle lookup is a separate module** `src/lib/vehicles.js`:
   `VEHICLES` catalog (real cargo volumes, cu ft) + `recommendVehicle(totalCubicFeet)`.
   Kept separate from boxes for single responsibility; the UI calls both.
   Recommendation = smallest vehicle whose **usable** capacity ≥ total volume,
   where usable = rated capacity × a load factor (~0.8) because you can't pack a
   truck to 100%. Edge cases are explicit acceptance criteria (empty → none;
   over-capacity → largest + "more than one trip" note).

5. **Deploy on Vercel via the existing GitHub remote.** Vite is a zero-config
   preset on Vercel (build `npm run build`, output `dist`). SPA with no routing,
   so no rewrites/redirects config is required. Netlify is an equivalent
   fallback if Vercel auth is a problem.

6. **No new runtime dependencies.** Plain React state (`useState`) for the
   in-memory item list — no router, no state library, no UI kit. Styling is
   hand-written CSS building on the existing custom-property theme.

## Dependency Graph

```
boxes.js (exists)
   │
   ├── Task 1: quantity ─────────┐
   │                             ├── Task 2: fragile/heavy sturdy-box rule
   │                             │        │
   vehicles.js                   │        │
   └── Task 3: real vehicle data + recommendVehicle()
                                 │        │
                                 ▼        ▼
                    Task 4: item entry + add/remove (UI state)
                                 │
                                 ▼
                    Task 5: live summary (boxes by type + vehicle)
                                 │
                                 ▼
                    Task 6: mobile-responsive styling pass
                                 │
                                 ▼
                    Task 7: deploy to Vercel (public URL)
                                 │
                                 ▼
                    Task 8: README usage + live link + screenshot
```

Tasks 1→2 are sequential (same function/file). Task 3 is independent of 1/2 and
**could run in parallel**. Tasks 4–8 are a strict chain.

---

## Phase 1 — Refine the estimate (~25m)

### Task 1: Item quantity support in `estimateBoxes`

**Description:** Let a single item represent a quantity ("8 books" instead of
eight separate book entries). `estimateBoxes` tallies `item.quantity` (default 1,
coerced to a non-negative integer) per size instead of counting one each.

**Acceptance criteria:**
- [ ] An item `{ size: 'small', quantity: 8 }` contributes 8 to the small tally.
- [ ] Missing/invalid `quantity` is treated as 1; `quantity: 0` or negative
      contributes 0; fractional values are handled deterministically (documented).
- [ ] All 9 existing tests still pass unchanged (they omit `quantity` → behave as 1).

**Verification:**
- [ ] `npm test` — existing + new quantity tests pass.
- [ ] Manual: `estimateBoxes([{size:'small',quantity:8}]).counts.small` → 2
      (8 ÷ 5-per-box, rounded up).

**Dependencies:** None.

**Files likely touched:** `src/lib/boxes.js`, `src/lib/boxes.test.js`.

**Estimated scope:** S (1–2 files).

### Task 2: Fragile/heavy → smaller, sturdier box rule

**Description:** Add the one box-choice rule beyond raw volume. Items flagged
`fragile: true` (the UI's "fragile or heavy" toggle) are routed to the book/file
box (`file`, 1.0 cu ft) at a reduced items-per-box capacity, regardless of their
size tag. The result's `breakdown`/`counts` gain a `file` category.

**Acceptance criteria:**
- [ ] A fragile/heavy item produces **file** boxes, not the box its raw size
      would otherwise pick (e.g. `{size:'large', fragile:true}` → a file box,
      not a large box), demonstrated by a test.
- [ ] Non-fragile items are unaffected; a list with no fragile items yields
      `file: 0` and the same small/medium/large counts as before.
- [ ] Quantity (Task 1) and the fragile rule compose (e.g. `{size:'medium',
      quantity:10, fragile:true}` tallies 10 into the file/sturdy bucket).
- [ ] Existing sample test updated to assert the new `file` row (0 here); total
      volume and small/medium/large counts for the sample are unchanged.

**Verification:**
- [ ] `npm test` — fragile-rule tests pass; sample/volume tests still green.
- [ ] Manual: a fragile item never increases large-box count.

**Dependencies:** Task 1.

**Files likely touched:** `src/lib/boxes.js`, `src/lib/boxes.test.js`.

**Estimated scope:** S (1–2 files).

### Task 3: Real vehicle data + `recommendVehicle()`

**Description:** Create `src/lib/vehicles.js` with a `VEHICLES` catalog of real
cargo volumes (cu ft, sourced like the box volumes) and
`recommendVehicle(totalCubicFeet)` returning the smallest vehicle that fits, using
a load factor for realistic packing.

**Reference values to verify (real, not placeholder):** typical sedan trunk
~15 cu ft; SUV seats-down ~75 cu ft; U-Haul cargo van ~245 cu ft; 10' truck
~402 cu ft; 15' truck ~764 cu ft; 20' truck ~1,016 cu ft; 26' truck ~1,682 cu ft.
Confirm each against its published source and cite in a code comment (mirroring
the U-Haul citation already in `boxes.js`).

**Acceptance criteria:**
- [ ] Every `VEHICLES` entry has a real, cited cargo volume — no round-number
      guesses or placeholders.
- [ ] `recommendVehicle` returns the **smallest** vehicle whose usable capacity
      (rated × load factor) ≥ total; verified by a test with a known volume.
- [ ] Edge cases: `0` → no vehicle / "nothing to move"; a volume above the
      largest vehicle → largest vehicle **plus a "more than one trip" flag**.
- [ ] Module is framework-free (no React import), matching `boxes.js`.

**Verification:**
- [ ] `npm test` — new `vehicles.test.js` passes.
- [ ] Manual: small load → small vehicle; large load → truck, monotonically.

**Dependencies:** None (parallelizable with Tasks 1–2).

**Files likely touched:** `src/lib/vehicles.js` (new),
`src/lib/vehicles.test.js` (new).

**Estimated scope:** S (2 files).

### Checkpoint: Foundation (after Tasks 1–3)
- [ ] `npm test` fully green (boxes + vehicles).
- [ ] `npm run build` clean.
- [ ] Logic demonstrably handles quantity, the fragile/heavy rule, and returns a
      real-valued vehicle recommendation.
- [ ] **Review with human before building UI.**

---

## Phase 2 — Styling & usability pass (~30m)

### Task 4: Item entry form + add/remove list

**Description:** Replace the placeholder `App.jsx` with a real manual-entry UI:
a form to add an item (name, size select, quantity, "fragile/heavy" toggle),
an in-memory list of added items (`useState`), and a remove control per row.

**Acceptance criteria:**
- [ ] User can add an item with name, size (small/medium/large), quantity, and a
      fragile/heavy toggle; it appears in the list.
- [ ] User can remove any item; the list updates immediately.
- [ ] State is in-memory for the session (no backend/storage), per the spec.
- [ ] Empty/invalid input is handled gracefully (e.g. quantity defaults to 1; no
      crash on empty name).

**Verification:**
- [ ] `npm run dev` — add three items, remove one; list reflects each action.
- [ ] `npm run build` clean.

**Dependencies:** Tasks 1, 2 (form fields map to the item model).

**Files likely touched:** `src/App.jsx`, `src/App.css`.

**Estimated scope:** M (component + styles).

### Task 5: Live estimate summary (boxes by type + recommended vehicle)

**Description:** Render a clear results summary that updates live as the item
list changes: boxes by type (count + volume per type), total boxes, total cubic
feet, and the recommended vehicle (with the "more than one trip" note when
relevant). Wire `estimateBoxes` + `recommendVehicle` to the list state.

**Acceptance criteria:**
- [ ] Summary shows a per-box-type breakdown (type, count) and a total.
- [ ] Summary shows the recommended vehicle from `recommendVehicle(totalCubicFeet)`.
- [ ] Adding/removing an item updates the summary immediately (derived state,
      recomputed from the list — no stale numbers).
- [ ] Empty list shows a sensible zero/empty state, not NaN or a broken card.

**Verification:**
- [ ] `npm run dev` — the sample list (2 small "books", medium, large, etc.)
      produces a coherent box + vehicle summary; numbers change live on edit.

**Dependencies:** Tasks 3, 4.

**Files likely touched:** `src/App.jsx`, `src/App.css`.

**Estimated scope:** M.

### Task 6: Mobile-responsive styling pass

**Description:** Make it not look like an unstyled default form on a phone.
Replace the leftover Vite template CSS with intentional styling for the form,
item list, and summary; ensure a clean single-column layout and tap-friendly
controls at a 375px-wide viewport.

**Acceptance criteria:**
- [ ] At 375px width: no horizontal scroll; inputs/buttons are tap-sized;
      summary is readable; layout is single-column and uncramped.
- [ ] Form, list, and summary are visually distinct (cards/sections), reusing the
      existing CSS-variable theme (incl. dark mode) where practical.
- [ ] No leftover template-only styles (e.g. unused `#social`, counter) cause
      visual noise.

**Verification:**
- [ ] `npm run dev`, browser devtools at 375px (and a real phone if available) —
      looks intentional, works thumb-only.
- [ ] `npm run build` clean.

**Dependencies:** Tasks 4, 5.

**Files likely touched:** `src/App.css`, `src/index.css`, possibly `src/App.jsx`
(class hooks).

**Estimated scope:** M.

### Checkpoint: Working app (after Tasks 4–6)
- [ ] End-to-end locally: add/remove items → live box + vehicle summary.
- [ ] Looks intentional and works at 375px width.
- [ ] `npm run build` clean, `npm test` green.
- [ ] **Review with human before deploying.**

---

## Phase 3 — Deploy (~25m)

### Task 7: Deploy to Vercel — public, mobile-working URL

**Description:** Deploy the production build to Vercel via the GitHub remote
(zero-config Vite preset: build `npm run build`, output `dist`). Get a public
URL and confirm it loads and works on a phone.

**Acceptance criteria:**
- [ ] Production build deploys with no build errors.
- [ ] A public URL loads the app and the full add/remove → summary flow works.
- [ ] It works on a real mobile browser (or accurate device emulation).

**Verification:**
- [ ] Open the public URL on a phone; add items, see the summary, remove an item.
- [ ] Capture the final URL for the README (Task 8).

**Dependencies:** Task 6 (final UI).

**Files likely touched:** none required (Vite auto-detected); optional
`vercel.json` only if a setting must be pinned.

**Estimated scope:** S. **Note:** may need the user to run interactive auth
(`! vercel login`) or click "Import Project" in the Vercel dashboard against the
existing GitHub repo — Claude can't complete browser/CLI login on the user's
behalf.

---

## Phase 4 — README & proof (~10m)

### Task 8: README usage section + live link + screenshot/GIF

**Description:** Add a **Usage** section (how to use the deployed app), the
**live URL** near the top, and **one screenshot or short GIF** of the working app
to the README.

**Acceptance criteria:**
- [ ] README has a Usage section describing the add-items → summary flow.
- [ ] The live Vercel URL is present and clickable.
- [ ] One screenshot or short GIF of the working app is embedded and renders on
      GitHub (committed image path, not a broken link).

**Verification:**
- [ ] Preview README on GitHub (or locally) — link works, image renders.

**Dependencies:** Task 7 (need the live URL + a styled app to screenshot).

**Files likely touched:** `README.md`, a new image under `docs/` or `public/`.

**Estimated scope:** S.

### Checkpoint: Shippable (after Task 8)
- [ ] Live URL works on mobile.
- [ ] `npm test` green, `npm run build` clean.
- [ ] README has usage + live link + proof image.
- [ ] All four goal "Done =" conditions met. **Final review.**

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Fragile rule changes `estimateBoxes` return shape (`file` category), breaking the existing `toEqual` sample test | Med | Expected — update the sample test in Task 2; keep `quantity`/`fragile` defaults so all *other* tests stay green. |
| Vehicle volumes hard to source precisely | Med | Use U-Haul published truck specs (same source as boxes) + typical car/SUV cargo specs; cite each in a comment; acceptance criterion forbids placeholder round numbers. |
| Vercel/CLI auth is interactive — Claude can't log in for the user | Med | Flag in Task 7; user runs `! vercel login` or imports the repo in the dashboard; Netlify drop is a fallback. |
| Styling overruns its 30m budget | Low | Single-column mobile-first layout, reuse existing CSS variables; "intentional, not unstyled" is the bar, not pixel-perfect. |
| Scope creep into scanning / precision logistics | Med | Out of scope today by the brief; capacities stay MVP assumptions; only box+vehicle *volumes* must be real. |

## Open Questions

- **Vercel vs Netlify** — plan assumes Vercel (matches the GitHub remote and
  Vite's zero-config preset). Switch to Netlify if preferred.
- **Fragile vs heavy split** — MVP treats them as one routing case (→ book/file
  box). Acceptable, or should heavy and fragile route differently?
- **Proof format** — screenshot (faster) vs short GIF (shows add/remove). Plan
  allows either; screenshot is the safe ~10m choice.

## Parallelization

- **Task 3 (vehicles)** is independent of Tasks 1–2 and can be built in parallel.
- Everything from Task 4 on is a strict chain (UI → summary → styling → deploy →
  README) and must be sequential.
