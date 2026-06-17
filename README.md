# 📦 Moving Volume Estimator

A small web app that helps someone planning a move figure out **(1) how many
boxes they'll need** and **(2) what vehicle or truck will fit it all**.

**▶️ Live app: <https://moving-volume-estimator.vercel.app/>**

![The Moving Volume Estimator: an item-entry form above a live summary showing boxes by type and a recommended vehicle](docs/screenshot.jpg)

## Usage

1. **Add your items.** For each thing you're moving, type a name (optional),
   pick a **size** (small / medium / large), set the **quantity** (e.g. 8 books),
   and tick **Fragile or heavy** if it needs a sturdier box. Tap **Add item**.
2. **Build your list.** Each item appears below the form with its size,
   quantity, and a fragile/heavy tag. Remove any item with the **✕** button.
3. **Read your estimate.** The summary updates live as you edit the list:
   - how many **boxes of each type** (and the volume each adds),
   - the **total box count** and **total volume** in cubic feet, and
   - the **recommended vehicle** — from a car trunk up to a 26' moving truck —
     with a heads-up when the load will likely take **more than one trip**.

No sign-up and no backend — everything runs in your browser for the session.

## How the estimate works

- **Quantity** — one item can stand for many (`8 books`), so you don't add
  eight rows.
- **Fragile / heavy rule** — beyond raw volume, anything tagged fragile or heavy
  is routed into the small, sturdy **book/file box** (so a heavy box stays
  liftable and a fragile one is better protected), instead of the larger box its
  size alone would pick.
- **Real box & vehicle sizes** — box volumes use U-Haul's published dimensions
  (book box 1.0 → extra-large 6.0 cu ft); vehicle capacities use real published
  cargo volumes (cargo van 245, 10' 402, 15' 764, 20' 1,016, 26' 1,682 cu ft,
  plus a typical car trunk and SUV). The per-box packing capacities are
  deliberate MVP assumptions, not a precise logistics model.

## v1 — manual entry

The flow in v1 is fully manual:

> **manual item entry → box estimate → vehicle suggestion**

Everything runs in the browser. There is **no backend, database, or account** —
all state is held in memory for the session.

## Roadmap — later milestones

- **📷 Photo / camera scanning** _(planned, not in v1)_ — instead of typing items
  in, you'll point your camera at a room, the app detects items, and you confirm
  each item's size category. Scanning ultimately produces the **same "list of
  items with size categories"** that manual entry produces, so it feeds the
  exact same estimation pipeline.

Because of this, the estimation and vehicle-lookup logic is deliberately kept
**decoupled from the input method**: it lives in plain, framework-free modules
under `src/lib/` (no React imports) that take a list of sized items and return
estimates. Manual entry, and later the scanner, are just two ways to build that
list.

## Tech stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) (JavaScript)
- [Vitest](https://vitest.dev/) for unit tests on the estimation logic
- Deployed on [Vercel](https://vercel.com/)
- No backend, no database, no auth — in-memory state only

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build
npm test         # run unit tests
```

## Project structure

```
src/
  lib/
    boxes.js      # framework-free box catalog + estimateBoxes()
    vehicles.js   # framework-free vehicle catalog + recommendVehicle()
  App.jsx         # manual-entry UI (item list + live estimate)
```

## Out of scope for v1

Photo/camera scanning, image processing, any backend or API, a database, and
user accounts. v1 is a focused MVP, not a precise logistics engine.
