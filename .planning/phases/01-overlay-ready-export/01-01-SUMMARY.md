---
phase: 01-overlay-ready-export
plan: 01
subsystem: export
tags: [webcodecs, canvas-2d, overlay, backpressure, mp4-muxer]

requires:
  - phase: none
    provides: existing monolithic main.ts export loop
provides:
  - "OverlayRenderFn type for pluggable overlay callbacks"
  - "exportVideo() async function with memory-safe pipeline"
  - "renderTestOverlay proving overlay injection works end-to-end"
affects: [02-hyperframes-overlay, 03-brand-kit]

tech-stack:
  added: []
  patterns: [callback-injection-for-overlays, backpressure-gated-encoding, try-finally-frame-lifecycle]

key-files:
  created: [src/overlay.ts, src/export.ts]
  modified: [src/main.ts]

key-decisions:
  - "Overlay injection via typed callback (OverlayRenderFn) between drawImage and VideoFrame"
  - "Backpressure threshold at encodeQueueSize > 5 using dequeue event"
  - "Local getPositionAtTime kept in main.ts for crop editor; export.ts has its own parameterized copy"

patterns-established:
  - "Overlay callback pattern: (ctx, time, width, height) => void"
  - "Memory-safe frame loop: try { new VideoFrame → backpressure → encode } finally { frame.close() }"
  - "Module split: main.ts orchestrator → export.ts pipeline → overlay.ts rendering"

requirements-completed: [EXPORT-01, EXPORT-02, EXPORT-03]

duration: 3min
completed: 2026-05-17
---

# Phase 1 Plan 01: Overlay-Ready Export Summary

**Modular export pipeline with overlay callback injection, backpressure-gated encoding, and try/finally VideoFrame lifecycle**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-17T07:24:14Z
- **Completed:** 2026-05-17T07:27:23Z
- **Tasks:** 2 completed (+ 1 human-verify checkpoint pending)
- **Files modified:** 3

## Accomplishments
- Extracted monolithic 116-line export loop into dedicated `src/export.ts` module
- Created `src/overlay.ts` with typed `OverlayRenderFn` callback pattern for pluggable overlays
- Added backpressure gate (`encodeQueueSize > 5`) preventing OOM on 4GB devices
- Wrapped every VideoFrame in try/finally ensuring GPU memory cleanup on errors
- Slimmed main.ts from orchestrator+exporter to pure orchestrator (net -65 lines)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create overlay module and export pipeline** - `b4fe70c` (feat)
2. **Task 2: Rewire main.ts to use new export module** - `3b791e5` (refactor)

## Files Created/Modified
- `src/overlay.ts` - OverlayRenderFn type + renderTestOverlay (semi-transparent lower-third bar)
- `src/export.ts` - ExportConfig interface + exportVideo with backpressure + overlay injection
- `src/main.ts` - Slimmed to orchestrator; calls exportVideo with renderTestOverlay callback

## Decisions Made
- Kept local `getPositionAtTime` in main.ts for crop editor (reads module-level keyframes); export.ts has parameterized version
- Used `Promise((r) => addEventListener(...))` pattern (not `Promise<void>`) to match existing codebase conventions and avoid TS overload errors
- Computed resolution metrics inline in the success handler rather than passing from exportVideo return value (keeps ExportConfig simple)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Task 3 (human-verify checkpoint) awaiting manual verification: user must export a video and confirm overlay is visible
- Architecture ready for Phase 2 (Hyperframes overlays) — any new overlay just implements OverlayRenderFn

---
*Phase: 01-overlay-ready-export*
*Completed: 2026-05-17*
