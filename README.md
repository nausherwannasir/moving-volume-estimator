# 📦 Moving Volume Estimator

A small web app that helps someone planning a move figure out **(1) how many
boxes they'll need** and **(2) what vehicle or truck will fit it all**.

## v1 — manual entry

The flow in v1 is fully manual:

> **manual item entry → box estimate → vehicle suggestion**

1. **List your items** by hand, each tagged with a size: _small_, _medium_, or
   _large_.
2. The app estimates a **box count per box type** and a **total volume** in
   cubic feet.
3. It then recommends a **vehicle** — from a car trunk up to a 26' U-Haul truck.

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
  lib/        # framework-free estimation + vehicle-lookup logic (input-agnostic)
  App.jsx     # UI
```

## Out of scope for v1

Photo/camera scanning, image processing, any backend or API, a database, user
accounts, and deployment/hosting. v1 is a focused MVP, not a precise logistics
engine.
