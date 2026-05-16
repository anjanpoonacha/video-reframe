# Architecture

<!-- refreshed: 2026-05-16 -->
**Analysis Date:** 2026-05-16

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client-Only)                     │
├──────────────────┬──────────────────┬───────────────────────┤
│   Upload & UI    │  Motion Detect   │    Video Export        │
│  `index.html`    │  `src/main.ts`   │   `src/main.ts`       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Browser APIs (Canvas, WebCodecs)                │
│         HTMLVideoElement · Canvas2D · VideoEncoder           │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  MP4 Muxer (mp4-muxer library)                              │
│  In-memory ArrayBuffer → Blob download                      │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Dev Server | Serves HTML with HMR during development | `serve.ts` |
| HTML Shell | UI layout, card-based progressive disclosure | `index.html` |
| Main Module | All application logic (upload, analyze, edit, export) | `src/main.ts` |
| Styles | Dark-themed mobile-first CSS | `src/styles.css` |
| PWA Manifest | Installable web app metadata | `manifest.json` |
| CI/CD | Build and deploy to GitHub Pages | `.github/workflows/deploy.yml` |

## Pattern Overview

**Overall:** Single-page client-only application with a linear pipeline pattern

**Key Characteristics:**
- Zero server-side processing — all video work runs in the browser
- Sequential pipeline: Upload → Analyze → Edit → Export
- Imperative DOM manipulation (no framework)
- Module-level mutable state for application data
- Progressive disclosure UI (cards revealed as pipeline advances)

## Layers

**Presentation (HTML + CSS):**
- Purpose: Renders the UI with card-based progressive disclosure
- Location: `index.html`, `src/styles.css`
- Contains: Static HTML structure, all visual styling
- Depends on: Nothing
- Used by: `src/main.ts` via DOM manipulation

**Application Logic (Single Module):**
- Purpose: Entire application behavior — upload handling, motion detection, crop editing, video encoding
- Location: `src/main.ts`
- Contains: Event handlers, algorithms, canvas rendering, WebCodecs encoding
- Depends on: `mp4-muxer`, Browser APIs (Canvas, WebCodecs, VideoElement)
- Used by: Imported by `index.html` as a module script

**Dev Tooling:**
- Purpose: Local development server with HMR
- Location: `serve.ts`
- Contains: Bun.serve() configuration
- Depends on: Bun runtime, `index.html`
- Used by: `bun --hot serve.ts` (dev script)

## Data Flow

### Primary Pipeline (Upload → Export)

1. **File Upload** — User selects video file → `HTMLVideoElement` created with object URL (`src/main.ts:23-38`)
2. **Motion Detection** — Video seeked frame-by-frame → pixel diff → centroid x-position per frame (`src/main.ts:416-467`)
3. **Position Smoothing** — Moving average filter applied to raw positions (`src/main.ts:469-481`)
4. **Filmstrip Build** — Each frame rendered as 9:16 crop thumbnail → `ImageBitmap` stored in `frames[]` (`src/main.ts:64-87`)
5. **Interactive Editing** — User drags crop region → updates `frames[i].x` → redraws canvas (`src/main.ts:181-223`)
6. **Skip Range Marking** — User marks start/end times → stored in `skipRanges[]` → frames flagged as skipped (`src/main.ts:226-254`)
7. **Export Encoding** — Iterates all non-skipped frames at 30fps → WebCodecs `VideoEncoder` → `mp4-muxer` → Blob download (`src/main.ts:293-401`)

### State Management

- **`frames: FrameData[]`** — Core state: array of per-frame crop positions and thumbnails
- **`currentIdx: number`** — Currently selected frame in the editor
- **`skipRanges: {start, end}[]`** — Time ranges to exclude from export
- **`videoEl: HTMLVideoElement`** — Source video element (used for seeking/reading frames)
- **`dragging: boolean`** — Transient UI state for crop drag interaction

All state is module-level variables in `src/main.ts`. No state management library.

## Key Abstractions

**FrameData:**
- Purpose: Represents one sampled frame with its crop position and thumbnail
- Definition: `src/main.ts:5-10`
- Pattern: Plain interface with `time`, `x` (normalized 0-1), `bitmap`, `skipped` flag

**Position Interpolation:**
- Purpose: Smoothly interpolates crop position between sampled frames during export
- Implementation: `getPositionAtTime()` at `src/main.ts:405-414`
- Pattern: Linear interpolation between nearest frame samples

## Entry Points

**Browser Entry:**
- Location: `index.html` → `<script type="module" src="./src/main.ts">`
- Triggers: Page load
- Responsibilities: Initializes event listeners, sets up crop drag handler

**Dev Server Entry:**
- Location: `serve.ts`
- Triggers: `bun --hot serve.ts`
- Responsibilities: Serves HTML at port 3000 with HMR, serves manifest.json

**Build Entry:**
- Location: `index.html` (as Bun bundler entry)
- Triggers: `bun build ./index.html --outdir ./dist`
- Responsibilities: Produces static bundle in `dist/`

## Architectural Constraints

- **Threading:** Single-threaded main thread. All video processing (seek, draw, encode) blocks the UI. Periodic `setTimeout(r, 0)` yields used to allow repaints during export.
- **Global state:** All application state lives as module-level variables in `src/main.ts`. No encapsulation beyond the ES module boundary.
- **Browser API dependency:** Requires WebCodecs API (`VideoEncoder`) for MP4 export. Falls back to empty blob if unavailable.
- **Memory:** All frame thumbnails (`ImageBitmap`) held in memory simultaneously. For long videos with many samples, this could be significant.
- **Seek-based processing:** Uses `video.currentTime` + `seeked` event for frame extraction. This is sequential and slow compared to WebCodecs decode.

## Anti-Patterns

### Monolithic Module

**What happens:** All 532 lines of logic (UI, algorithms, encoding) live in one file `src/main.ts`
**Why it's wrong:** Makes it difficult to test individual pieces, reuse algorithms, or navigate the code
**Do this instead:** Split into modules: `src/motion.ts` (detection/smoothing), `src/editor.ts` (crop UI), `src/export.ts` (encoding), `src/state.ts` (shared state)

### Seek-Based Frame Extraction

**What happens:** Export loop uses `video.currentTime` + awaiting `seeked` event for every frame (`src/main.ts:351-354`)
**Why it's wrong:** Extremely slow — each seek is a random access into the video. A 60s video at 30fps = 1800 sequential seeks.
**Do this instead:** Use WebCodecs `VideoDecoder` for sequential frame decoding, which is orders of magnitude faster

## Error Handling

**Strategy:** Minimal — errors are largely unhandled

**Patterns:**
- `VideoEncoder` error callback logs to console: `error: console.error` (`src/main.ts:322`)
- No try/catch around seek operations or encoding
- No user-facing error messages for failures
- Buttons are disabled during operations to prevent re-entry

## Cross-Cutting Concerns

**Logging:** None (only `console.log` for server URL in `serve.ts`)
**Validation:** Minimal — checks `if (!file) return`, `if (!videoEl) return`
**Authentication:** None (fully client-side, no server)
**PWA Support:** Web app manifest present (`manifest.json`), no service worker

---

*Architecture analysis: 2026-05-16*
