# Phase 4: Performance Hardening - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure full overlay export (Pro Pack + cross-fade transitions) runs reliably on Snapdragon 770 class devices (4GB RAM) without OOM crashes, thermal throttle stalls, or unacceptable export duration. Pure engineering optimization — no visual or feature changes.

</domain>

<decisions>
## Implementation Decisions

### Memory Budget Management
- **D-01:** Memory ceiling: 150MB working set for the export pipeline. Monitor via `performance.memory` where available, fall back to heuristic-based guards.
- **D-02:** ImageBitmap budget: max 2 active at any time (logo + one transition buffer). Pro Pack logo decoded once at `create()`, reused across all frames.
- **D-03:** Cross-fade buffer reuse: the OffscreenCanvas for transitions is allocated once before the loop, not per-cut. Already implemented — verify no additional allocations creep in.
- **D-04:** Canvas context: reuse single `ctx` instance for entire export. Never create/destroy canvas elements mid-loop.

### Frame Rendering Performance
- **D-05:** GSAP `seek()` target: < 1ms per call (GSAP animates plain state objects, no DOM). Profile to confirm. If slower, pre-compute keyframe states.
- **D-06:** Canvas draw operations target: < 50ms total per frame for all overlay components (at 1080x1920). Budget: intro draw ~15ms, lower-third ~10ms, watermark ~5ms, cross-fade blend ~20ms.
- **D-07:** Text measurement caching: `ctx.measureText()` is expensive. Cache channel name width at template `create()` time, not per-frame.
- **D-08:** Reduce canvas state changes: batch `ctx.save()`/`ctx.restore()` calls. One save/restore pair per major component, not per draw call.

### Backpressure Tuning
- **D-09:** Encoder queue threshold: adaptive based on device memory. Default 5 (from Phase 1), reduce to 3 on low-memory devices (< 4GB total RAM detected via `navigator.deviceMemory`).
- **D-10:** Yield frequency: every 3 frames on low-end devices (was every 5). Prevents thermal throttle by giving the GPU time to drain.
- **D-11:** If `navigator.deviceMemory <= 4`: apply conservative preset (queue threshold 3, yield every 3 frames, reduced canvas resolution).

### Resolution Adaptation
- **D-12:** On devices with `navigator.deviceMemory <= 4`: cap output resolution at 720x1280 instead of 1080x1920. Reduces canvas pixel operations by 56% with minimal visual impact on mobile screens.
- **D-13:** Resolution selection is automatic — no user setting. User always gets the best quality their device can handle smoothly.

### Export Duration Optimization
- **D-14:** Target: full overlay export completes within 3x the time of plain (no-overlay) export for the same video. Benchmark: 30s video plain = ~45s, overlay should be < 135s.
- **D-15:** Primary bottleneck is seek-based frame extraction (from Phase 1). This phase does NOT change the seek approach — that's a future architectural change (WebCodecs VideoDecoder). Focus on reducing per-frame overlay cost.
- **D-16:** Skip overlay rendering for frames where no overlay is visible (time > template duration AND no watermark active). Early-return optimization in render function.

### Thermal Management
- **D-17:** Monitor `navigator.getBattery()` temperature events where available. If device reports thermal pressure, automatically increase yield interval (double the setTimeout gap).
- **D-18:** Never encode more than 60 consecutive frames without a yield. Hard cap regardless of device class.

### the agent's Discretion
- Exact `navigator.deviceMemory` thresholds for tier classification
- Whether to add a `performance.now()` per-frame profiling mode for development
- Exact setTimeout delay values (0ms vs 16ms vs 32ms) for different device tiers
- Whether to warn the user before export if device appears low-memory

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Export Implementation
- `src/export.ts` — Export pipeline with backpressure, overlay injection, cross-fade transitions
- `src/templates.ts` — Pro Pack template with GSAP seek + canvas render

### Requirements
- `.planning/REQUIREMENTS.md` — PERF-01 (3x time), PERF-02 (no OOM 4GB), PERF-03 (< 100ms/frame)
- `.planning/ROADMAP.md` — Phase 4 success criteria

### Prior Phase Context
- `.planning/phases/01-overlay-ready-export/01-CONTEXT.md` — Original backpressure design (D-03)
- `.planning/phases/03-animated-overlays/03-CONTEXT.md` — Overlay timing architecture

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Backpressure gate in export.ts (`encodeQueueSize > 5`) — needs parameterization
- `setTimeout(r, 0)` yield pattern every 5 frames — needs adaptive frequency
- GSAP timeline already uses plain objects (no DOM) — inherently fast

### Established Patterns
- try/finally for VideoFrame lifecycle (Phase 1)
- Single canvas reuse throughout export loop
- OffscreenCanvas for cross-fade buffer (Phase 3)

### Integration Points
- `ExportConfig` interface — add optional `deviceTier` or performance preset
- Export loop frame iteration — where yields and resolution adaptation apply
- Template `create()` — where text measurement caching belongs

</code_context>

<specifics>
## Specific Ideas

- No visual changes — this phase is invisible to the user
- Must work on the user's target device (Snapdragon 770 / 4GB RAM class)
- If the export already works on the user's device without issues, this phase may be very lightweight

</specifics>

<deferred>
## Deferred Ideas

- WebCodecs VideoDecoder for sequential frame extraction (replaces seek-based approach — major architectural change, different phase)
- Web Worker offloading for overlay rendering
- WASM-based canvas operations for ultra-low-end devices

</deferred>

---

*Phase: 04-performance-hardening*
*Context gathered: 2026-05-18*
