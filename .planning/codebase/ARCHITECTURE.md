# Architecture

<!-- refreshed: 2026-05-16 -->
**Analysis Date:** 2026-05-16

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
├──────────────────┬──────────────────┬───────────────────────┤
│  Upload UI       │  Pipeline UI     │    Result/Download     │
│  `index.html`    │  `index.html`    │   `index.html`        │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Application Logic (Single Module)               │
│         `src/main.ts`                                        │
│   ┌─────────────┬──────────────┬────────────────────┐       │
│   │detectMotion │  runPipeline │  encodeFallback     │       │
│   └─────────────┴──────────────┴────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
         │                  │
         ▼                  ▼
┌──────────────────┐  ┌──────────────────────────────────────┐
│  Canvas 2D API   │  │  WebCodecs API / MediaRecorder        │
│  (motion detect) │  │  + mp4-muxer (encoding)               │
└──────────────────┘  └──────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Dev Server | Serve `index.html` with HMR during development | `serve.ts` |
| HTML Shell | UI layout, upload zone, pipeline cards, result display | `index.html` |
| Main Logic | Video processing pipeline (motion detect → reframe → encode) | `src/main.ts` |
| Styles | Dark-theme mobile-first UI styling | `src/styles.css` |
| PWA Manifest | Installable web app metadata | `manifest.json` |
| CI/CD | Build and deploy to GitHub Pages on push to main | `.github/workflows/deploy.yml` |

## Pattern Overview

**Overall:** Single-page application with imperative DOM manipulation

**Key Characteristics:**
- No framework — vanilla TypeScript with direct DOM access
- Single-file application logic (all processing in one module)
- Progressive enhancement: uses WebCodecs API when available, falls back to MediaRecorder
- 100% client-side processing — no backend API calls
- Pipeline pattern for sequential video processing steps

## Layers

**Presentation (HTML + CSS):**
- Purpose: Render UI and display processing state
- Location: `index.html`, `src/styles.css`
- Contains: Static markup with id-based DOM hooks, CSS variables for theming
- Depends on: Nothing
- Used by: `src/main.ts` manipulates DOM elements via `getElementById`

**Application Logic:**
- Purpose: Orchestrate video processing pipeline
- Location: `src/main.ts`
- Contains: Event handlers, motion detection, frame reframing, video encoding
- Depends on: Browser APIs (Canvas, WebCodecs, MediaRecorder), `mp4-muxer`
- Used by: Invoked by DOM events (file input change, button click)

**Build/Dev Tooling:**
- Purpose: Development server and production builds
- Location: `serve.ts`, `package.json`
- Contains: Bun.serve() config, build scripts
- Depends on: Bun runtime
- Used by: Developer workflow and CI

## Data Flow

### Primary Request Path (Video Reframing)

1. User selects video file via `<input type="file">` (`index.html:31`)
2. File loaded into hidden `<video>` element, metadata extracted (`src/main.ts:12-29`)
3. Pipeline triggered by "Reframe & Export" button click (`src/main.ts:31`)
4. **Step 1 — Motion Detection:** Sample frames at low resolution, compute pixel diffs to find horizontal motion center (`src/main.ts:209-260`)
5. **Step 2 — Reframe + Encode:** Seek frame-by-frame, crop 9:16 window following smoothed motion positions, encode via WebCodecs (`src/main.ts:59-118`)
6. **Step 3 — Finalize:** Flush encoder, mux to MP4 blob via `mp4-muxer` (`src/main.ts:124-137`)
7. Display result video and metrics, offer download (`src/main.ts:144-161`)

### Fallback Encoding Path

1. When `VideoEncoder` is unavailable (older browsers), `encodeFallback()` is called (`src/main.ts:164-207`)
2. Uses `canvas.captureStream()` + `MediaRecorder` to produce WebM output
3. Same frame-by-frame seek and crop logic, different encoding backend

**State Management:**
- Module-level `videoEl` variable holds reference to the loaded source video
- Processing state communicated to UI via direct DOM manipulation (class toggling, textContent updates)
- No external state management library

## Key Abstractions

**MotionPosition:**
- Purpose: Represents detected horizontal motion center at a point in time
- Examples: `src/main.ts:4-7`
- Pattern: Simple interface `{ time: number; x: number }` where `x` is normalized 0–1

**Pipeline Steps:**
- Purpose: Sequential processing stages with visual progress indicators
- Examples: `src/main.ts:48-57`, `src/main.ts:59-122`, `src/main.ts:124-141`
- Pattern: Each step updates step icon state and timing via `setStep()` helper

## Entry Points

**Development:**
- Location: `serve.ts`
- Triggers: `bun --hot serve.ts` (via `bun run dev`)
- Responsibilities: Serve HTML with HMR, serve `manifest.json`

**Browser Runtime:**
- Location: `src/main.ts` (loaded via `<script type="module">` in `index.html:91`)
- Triggers: Page load
- Responsibilities: Register event listeners, define processing functions

**Build:**
- Location: `package.json` scripts → `bun build ./index.html --outdir ./dist`
- Triggers: `bun run build` (CI or manual)
- Responsibilities: Bundle HTML/TS/CSS into `dist/` for static deployment

## Architectural Constraints

- **Threading:** Single-threaded main thread. Video decoding uses browser-native seeking (`video.currentTime` + `seeked` event). Yields to event loop every 5 frames via `setTimeout(r, 0)` to keep UI responsive.
- **Global state:** Single module-level `videoEl` variable in `src/main.ts:10`. All other state is local to `runPipeline()`.
- **Circular imports:** None — single module with no internal imports.
- **Browser API dependency:** Requires Canvas 2D, HTMLVideoElement seeking, and either WebCodecs or MediaRecorder. Not usable in Node/Bun runtime.
- **Frame-by-frame seeking:** Performance bottleneck — each frame requires a seek + wait for `seeked` event. Not suitable for real-time processing.

## Anti-Patterns

### Monolithic Processing Function

**What happens:** `runPipeline()` is a ~130-line function that handles decoding, reframing, encoding, and UI updates in one scope.
**Why it's wrong:** Difficult to test individual stages, hard to add new steps or modify existing ones independently.
**Do this instead:** Extract each pipeline stage into its own module with defined inputs/outputs. See existing `detectMotion()` and `smoothPositions()` as partial examples of this pattern.

### DOM Coupling in Business Logic

**What happens:** Processing functions directly update DOM elements (`$("progressFill").style.width = ...`).
**Why it's wrong:** Prevents reuse of processing logic (e.g., in a Web Worker) and makes unit testing impossible without DOM mocking.
**Do this instead:** Emit progress via a callback parameter and wire DOM updates in the event handler layer.

## Error Handling

**Strategy:** Minimal — relies on browser defaults

**Patterns:**
- `VideoEncoder` error callback logs to `console.error` (`src/main.ts:75`)
- No try/catch around pipeline execution
- No user-facing error display for processing failures
- File input guard: early return if no file selected (`src/main.ts:14`)

## Cross-Cutting Concerns

**Logging:** None (only `console.log` in `serve.ts:15` for server URL)
**Validation:** Minimal — file type restricted by `accept="video/*"` on input element
**Authentication:** None — fully client-side, no server communication

---

*Architecture analysis: 2026-05-16*
