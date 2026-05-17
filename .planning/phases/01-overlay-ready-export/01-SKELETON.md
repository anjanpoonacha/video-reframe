# Walking Skeleton — Video Reframe

**Phase:** 1
**Generated:** 2026-05-17

## Capability Proven End-to-End

User clicks Export and receives an MP4 where every frame has a visible semi-transparent overlay ("OVERLAY TEST") composited on top of the cropped video — proving the overlay injection pipeline works end-to-end without memory leaks or encoder crashes.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Module split | `src/export.ts` + `src/overlay.ts` extracted from monolith | Isolates encoding pipeline from UI orchestrator; enables overlay composition as a pluggable callback |
| Overlay pattern | Typed callback `OverlayRenderFn` injected via config | Decouples overlay rendering from export loop; future phases plug in GSAP/SnapDOM renderers without touching export code |
| Composition surface | Same Canvas 2D context (layered draw) | No OffscreenCanvas complexity; overlay draws on top of crop before VideoFrame creation |
| Memory safety | `encodeQueueSize` + `dequeue` event backpressure gate | Prevents OOM on 4GB devices by waiting for encoder to drain before submitting new frames |
| Frame lifecycle | `try/finally` with `frame.close()` | Guarantees GPU-backed VideoFrame memory is released even if encode throws |
| Build/dev | Bun bundler + `bun --hot serve.ts` | Already configured; no changes needed |
| Deployment | GitHub Pages static (existing CI) | Already configured; `bun build ./index.html --outdir ./dist` |

## Stack Touched in Phase 1

- [x] Module architecture — `src/export.ts` and `src/overlay.ts` created
- [x] Export pipeline — full encode loop with backpressure + overlay injection
- [x] Overlay composition — test overlay proving alpha compositing works
- [x] Memory safety — try/finally frame lifecycle + backpressure gate
- [x] Integration — main.ts calls new `exportVideo()` with overlay callback

## Out of Scope (Deferred to Later Slices)

- Brand kit UI (logo upload, color pickers) — Phase 2
- Template engine (GSAP seek + SnapDOM) — Phase 2
- Animated overlays (intro bumper, lower third, kinetic text) — Phase 3
- Performance tuning for Snapdragon 770 — Phase 4
- Worker-based encoding / OffscreenCanvas — Phase 4
- Codec fallback logic (High → Baseline profile) — Agent's discretion, low priority

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: User configures brand identity (logo, colors), template engine renders overlays frame-by-frame via GSAP seek
- Phase 3: Full animated overlay library (intro, lower third, kinetic text, watermark, transitions)
- Phase 4: Performance hardening — OffscreenCanvas, worker offload, thermal throttle mitigation
