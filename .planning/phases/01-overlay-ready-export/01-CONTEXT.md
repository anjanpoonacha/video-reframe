# Phase 1: Overlay-Ready Export - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the existing seek-based export pipeline into a memory-safe, overlay-compositing architecture. After this phase, the export loop has a clean injection point where any overlay graphic can be drawn onto each frame before encoding — without leaking memory or crashing the encoder on mid-range mobile devices.

</domain>

<decisions>
## Implementation Decisions

### Overlay Composition Architecture
- **D-01:** Overlay composition happens as a layered canvas draw — after the video crop is drawn to canvas, overlay graphics draw on top of the same canvas context before creating the VideoFrame. No second canvas or OffscreenCanvas needed.
- **D-02:** The overlay injection point is a function call (`renderOverlay(ctx, t, encW, encH)`) inserted between `ctx.drawImage(videoEl, ...)` and `new VideoFrame(canvas, ...)` in the export loop.

### Memory Safety
- **D-03:** Encoder backpressure via `encoder.encodeQueueSize` — before encoding each frame, wait/yield if the queue exceeds a threshold (e.g., 5 frames). Prevents OOM on 4GB devices.
- **D-04:** Explicit `frame.close()` on every VideoFrame immediately after `encoder.encode()` — existing pattern is correct, maintain it with defensive error handling (try/finally).
- **D-05:** Add a safety sweep after the loop finishes — if any frame references leaked, close them before finalization.

### Module Architecture
- **D-06:** Split the monolith. Extract from `src/main.ts` into:
  - `src/export.ts` — encoding pipeline (VideoEncoder setup, frame loop, muxer finalization)
  - `src/overlay.ts` — overlay composition interface and test overlay implementation
  - `src/main.ts` — remains as orchestrator (UI, upload, analyze, edit, calls export)
- **D-07:** Export module exposes a single async function (e.g., `exportVideo(config)`) that main.ts calls. Config includes the overlay render callback.

### Test Overlay
- **D-08:** Hardcoded test overlay is a semi-transparent colored rectangle in the lower-third area with white text "OVERLAY TEST" — proves alpha compositing works and is visually obvious in output.
- **D-09:** Test overlay renders on every frame at a fixed position. No animation needed — this phase proves the pipeline, not the aesthetics.

### the agent's Discretion
- Exact encoder configuration values (bitrate, codec profile) — use current defaults unless research suggests better
- Internal function signatures and naming — follow existing camelCase verb-first convention
- Error message wording and UX for failure states
- Whether to use requestAnimationFrame or setTimeout for UI yields during export

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Export Implementation
- `src/main.ts` lines 400-516 — Current export loop (seek → draw → encode → close)
- `src/main.ts` lines 5-10 — FrameData interface definition
- `src/main.ts` lines 520-529 — getPositionAtTime() interpolation helper

### Project Configuration
- `.planning/REQUIREMENTS.md` — EXPORT-01, EXPORT-02, EXPORT-03 requirement definitions
- `.planning/ROADMAP.md` — Phase 1 success criteria and goal statement

### Architecture Context
- `.planning/codebase/ARCHITECTURE.md` — System overview, anti-patterns flagged, architectural constraints

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mp4-muxer` library already configured for H.264 muxing — reuse in new export module
- `getPositionAtTime()` interpolation — extract alongside export logic
- Canvas 2D rendering pattern already established for crop draw

### Established Patterns
- Module-level mutable state with `let` declarations
- `$()` DOM helper with non-null assertions
- `async/await` with `setTimeout(r, 0)` yields every N frames for UI responsiveness
- VideoFrame create → encode → close lifecycle already inline (just needs backpressure)

### Integration Points
- `$("exportBtn")` click handler triggers export — new module called from here
- `frames[]` array and `skipRanges[]` consumed by export loop
- `videoEl` used for seeking during export — passed as dependency
- Progress UI updates (`exportProgress`, `exportStatus`) — callback or event pattern

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants production-quality code with best practices applied throughout.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-overlay-ready-export*
*Context gathered: 2026-05-17*
