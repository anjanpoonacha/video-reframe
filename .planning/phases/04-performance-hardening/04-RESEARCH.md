# Phase 4: Performance Hardening - Research

**Researched:** 2026-05-18
**Domain:** Client-side video encoding performance optimization (Canvas2D, WebCodecs, memory management)
**Confidence:** HIGH

## Summary

This phase optimizes the existing overlay export pipeline to run reliably on Snapdragon 770 class devices (4GB RAM). The primary attack vectors are: (1) adaptive backpressure tuning based on device memory class, (2) resolution downscaling on constrained devices, (3) eliminating the expensive per-frame `getImageData()` call in the cross-fade path, and (4) frame-timing-based thermal throttle detection with adaptive yield intervals.

The existing export.ts code is well-structured for these changes — the backpressure gate, yield pattern, and canvas reuse are already in place. The main performance wins come from parameterizing existing constants (queue depth, yield frequency, output resolution) based on a device tier detection utility, plus eliminating the `getImageData`/`putImageData` path in cross-fade blending.

**Primary recommendation:** Implement a `DeviceTier` utility that classifies devices into "high"/"low" tiers using `navigator.deviceMemory` (Chrome Android) with conservative fallback, then thread that tier through `ExportConfig` to control queue depth (3 vs 5), yield frequency (3 vs 5 frames), and output resolution (720p vs 1080p).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Memory ceiling: 150MB working set for the export pipeline
- **D-02:** ImageBitmap budget: max 2 active at any time
- **D-03:** Cross-fade buffer reuse: OffscreenCanvas allocated once before loop
- **D-04:** Canvas context: reuse single ctx instance for entire export
- **D-05:** GSAP seek() target: < 1ms per call
- **D-06:** Canvas draw operations target: < 50ms total per frame at 1080x1920
- **D-07:** Text measurement caching at template create() time
- **D-08:** Batch ctx.save()/restore() — one pair per major component
- **D-09:** Encoder queue threshold: adaptive — default 5, reduce to 3 on low-memory
- **D-10:** Yield every 3 frames on low-end (was every 5)
- **D-11:** If deviceMemory <= 4: apply conservative preset
- **D-12:** Cap output at 720x1280 on deviceMemory <= 4 devices
- **D-13:** Resolution selection is automatic — no user setting
- **D-14:** Target: overlay export within 3x plain export time
- **D-15:** Do NOT change seek-based extraction — future phase
- **D-16:** Skip overlay rendering when no overlay is visible
- **D-17:** Monitor battery/thermal events, increase yield on thermal pressure
- **D-18:** Never encode more than 60 consecutive frames without yield

### Claude's Discretion
- Exact navigator.deviceMemory thresholds for tier classification
- Whether to add performance.now() per-frame profiling mode for development
- Exact setTimeout delay values (0ms vs 16ms vs 32ms) for different device tiers
- Whether to warn the user before export if device appears low-memory

### Deferred Ideas (OUT OF SCOPE)
- WebCodecs VideoDecoder for sequential frame extraction
- Web Worker offloading for overlay rendering
- WASM-based canvas operations
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Full export with overlays completes within 3× plain export time | Device tier adaptive settings (D-09/10/12), skip-overlay optimization (D-16), cross-fade optimization |
| PERF-02 | No OOM crashes on 4GB RAM devices (60s video max) | 150MB memory ceiling (D-01), resolution adaptation (D-12), ImageBitmap budget (D-02), eliminate getImageData |
| PERF-03 | Overlay rendering < 100ms per frame average on target hardware | GSAP seek < 1ms (D-05), canvas ops < 50ms (D-06), text cache (D-07), batched state changes (D-08) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Device tier detection | Browser / Client | — | Uses navigator.deviceMemory + heuristics, pure client-side |
| Resolution adaptation | Browser / Client | — | Canvas sizing decision before export loop |
| Backpressure tuning | Browser / Client | — | VideoEncoder queue management in export loop |
| Thermal detection | Browser / Client | — | RAF timing heuristic runs client-side |
| Overlay render optimization | Browser / Client | — | Canvas2D draw call batching, text caching |
| Cross-fade optimization | Browser / Client | — | Replace getImageData with drawImage compositing |

## Standard Stack

### Core (no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gsap | 3.15.0 | Timeline seek for overlay state | Already installed; seek() on plain objects is sub-millisecond [CITED: gsap.com/docs/v3/GSAP/Timeline/seek()] |
| mp4-muxer | ^5.2.2 | MP4 container muxing | Already installed; no change needed |

### Supporting (no new installs)
This phase adds **zero new dependencies**. All optimizations use built-in browser APIs:
- `navigator.deviceMemory` — device memory detection
- `VideoEncoder.encodeQueueSize` — backpressure signal (already used)
- `performance.now()` — frame timing measurement
- Canvas2D `globalAlpha` + `drawImage` — compositing (already used)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| navigator.deviceMemory | performance.memory (Chrome) | Less accurate, deprecated path, non-standard |
| Frame timing heuristic | Compute Pressure API | Not available on Android Chrome — useless for target device |
| getImageData cross-fade | WebGL blend | Overkill for 4-frame transition; drawImage compositing is sufficient |

## Package Legitimacy Audit

> No new packages installed in this phase. All optimizations use existing dependencies and browser APIs.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — | — | — | — | — | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Export Pipeline (export.ts)                 │
│                                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │ Device Tier  │────▶│ ExportConfig │────▶│ Export Loop   │ │
│  │ Detection    │     │ (adaptive    │     │ (per-frame)   │ │
│  │              │     │  settings)   │     │               │ │
│  └──────────────┘     └──────────────┘     └──────┬───────┘ │
│                                                     │         │
│  ┌─────────────────────────────────────────────────▼───────┐ │
│  │                    Per-Frame Pipeline                     │ │
│  │                                                           │ │
│  │  seek video ──▶ drawImage crop ──▶ overlay? ──▶ encode   │ │
│  │  (~8ms)         (~2-3ms)           (0-50ms)     (async)  │ │
│  │                                                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐ │ │
│  │  │ Thermal     │  │ Backpressure│  │ Yield Gate       │ │ │
│  │  │ Monitor     │──│ Gate        │──│ (adaptive freq)  │ │ │
│  │  │ (RAF timing)│  │ (queue <= N)│  │ (every 3 or 5)  │ │ │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── export.ts          # Export pipeline (modify: parameterize backpressure/resolution)
├── templates.ts       # Pro Pack template (modify: text measurement caching, batched state)
├── device-tier.ts     # NEW: Device classification utility
├── overlay.ts         # Overlay types (no change)
└── brand-kit.ts       # Brand kit (no change)
```

### Pattern 1: Device Tier Detection
**What:** Classify device into "high" or "low" performance tier at app startup
**When to use:** Before export begins, to select adaptive settings

```typescript
// Source: W3C Device Memory spec + MDN docs
export type DeviceTier = "high" | "low";

export function detectDeviceTier(): DeviceTier {
  // navigator.deviceMemory: Chrome Android only, returns buckets (0.25, 0.5, 1, 2, 4, 8)
  // A 4GB physical RAM device reports deviceMemory === 4
  // A 3GB device also reports 4 (rounds to nearest power of 2)
  // So <= 4 catches 3-4GB devices; > 4 means 6GB+
  const mem = (navigator as any).deviceMemory as number | undefined;
  if (mem !== undefined && mem <= 4) return "low";
  if (mem !== undefined && mem > 4) return "high";

  // Fallback: assume low on mobile (conservative)
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  return isMobile ? "low" : "high";
}

export interface PerformancePreset {
  maxEncodeQueue: number;  // D-09: 3 (low) or 5 (high)
  yieldEvery: number;      // D-10: 3 (low) or 5 (high)
  maxConsecutive: number;  // D-18: 60 always
  outputWidth: number;     // D-12: 720 (low) or 1080 (high)
  outputHeight: number;    // D-12: 1280 (low) or 1920 (high)
  yieldMs: number;         // 16ms (low) or 0ms (high)
}

export function getPerformancePreset(tier: DeviceTier): PerformancePreset {
  if (tier === "low") {
    return {
      maxEncodeQueue: 3,
      yieldEvery: 3,
      maxConsecutive: 60,
      outputWidth: 720,
      outputHeight: 1280,
      yieldMs: 16,
    };
  }
  return {
    maxEncodeQueue: 5,
    yieldEvery: 5,
    maxConsecutive: 60,
    outputWidth: 1080,
    outputHeight: 1920,
    yieldMs: 0,
  };
}
```

### Pattern 2: Adaptive Backpressure Gate
**What:** Replace hardcoded `encodeQueueSize > 5` with tier-aware threshold
**When to use:** In the export frame loop

```typescript
// Replace: while (encoder.encodeQueueSize > 5)
// With:
while (encoder.encodeQueueSize > preset.maxEncodeQueue) {
  await new Promise((r) =>
    encoder.addEventListener("dequeue", r, { once: true })
  );
}
```

### Pattern 3: Cross-Fade Without getImageData
**What:** Replace expensive `getImageData`/`putImageData` with `drawImage` + `globalAlpha` compositing
**When to use:** At cut boundaries in the export loop

```typescript
// CURRENT (expensive — forces GPU readback per cut):
// lastRenderedFrame = ctx.getImageData(0, 0, encW, encH);
// ctx.putImageData(lastRenderedFrame, 0, 0);

// BETTER — use a third OffscreenCanvas to store last frame:
const prevCanvas = new OffscreenCanvas(encW, encH);
const prevCtx = prevCanvas.getContext("2d")!;

// After rendering a normal frame, snapshot it:
prevCtx.drawImage(canvas, 0, 0);  // drawImage is GPU-accelerated

// At cross-fade:
ctx.drawImage(prevCanvas, 0, 0);  // previous frame (alpha 1.0)
ctx.globalAlpha = alpha;
ctx.drawImage(fadeCanvas, 0, 0);  // new frame blended on top
ctx.globalAlpha = 1.0;
```

### Pattern 4: Thermal Throttle Detection via Frame Timing
**What:** Detect sustained performance degradation by monitoring encode loop timing
**When to use:** During export — increase yield interval if degradation detected

```typescript
// Compute Pressure API is NOT available on Android Chrome.
// navigator.getBattery() does NOT report thermal state.
// Fallback: measure per-frame encode time and detect drift.

let recentFrameTimes: number[] = [];
const THERMAL_WINDOW = 20; // frames
const THERMAL_THRESHOLD = 1.8; // 1.8x baseline = likely throttled

function checkThermalPressure(frameTimeMs: number, baselineMs: number): boolean {
  recentFrameTimes.push(frameTimeMs);
  if (recentFrameTimes.length > THERMAL_WINDOW) recentFrameTimes.shift();
  if (recentFrameTimes.length < THERMAL_WINDOW) return false;

  const median = recentFrameTimes.slice().sort((a, b) => a - b)[Math.floor(THERMAL_WINDOW / 2)]!;
  return median > baselineMs * THERMAL_THRESHOLD;
}
```

### Pattern 5: Skip Overlay When Invisible (D-16)
**What:** Early-return from overlay render when no component is visible
**When to use:** Every frame in the export loop

```typescript
// In the overlay render function:
const render: OverlayRenderFn = (ctx, time, w, h) => {
  // Pro Pack: intro ends at 2.5s, lower-third ends at 6.3s, watermark starts at 2.5s
  // If time > 6.3s, only watermark is visible — cost is ~2ms (one drawImage)
  // If watermark is disabled AND time > 6.3s, skip entirely
  if (time > 6.3 && !hasWatermark) return;

  // ... normal rendering
};
```

### Anti-Patterns to Avoid
- **getImageData per frame:** Forces GPU→CPU readback. Use drawImage between canvases instead.
- **Creating new Canvas elements mid-loop:** Allocate all canvases before the loop starts (D-04).
- **Unbounded encoder queue:** On mobile with 4GB RAM, queue depth > 5 risks OOM from accumulated VideoFrames waiting in the encoder.
- **Fixed yield interval regardless of device:** Use adaptive yield (3 frames low-end, 5 frames high-end).
- **measureText() per frame:** Cache text width at template create() time (D-07).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Device classification | Complex UA parsing | `navigator.deviceMemory` + mobile fallback | Standardized bucketed API, works on Chrome Android which is the target |
| Alpha compositing | Manual pixel blending | Canvas `globalAlpha` + `drawImage` | GPU-accelerated, avoids readback |
| Frame timing measurement | Custom Date.now() tracker | `performance.now()` | Sub-millisecond precision, monotonic |
| Animation state interpolation | Manual lerp functions | GSAP `seek()` on plain objects | Already < 1ms, handles easing/timelines correctly |

**Key insight:** This phase parameterizes existing code rather than introducing new abstractions. The export loop structure is correct — it just needs device-aware constants.

## Common Pitfalls

### Pitfall 1: getImageData Causing OOM on Mobile
**What goes wrong:** `ctx.getImageData(0, 0, 1080, 1920)` allocates a 1080×1920×4 = ~8.3MB `ImageData` every frame. Over 60s at 30fps = 1800 frames, even though only one is kept at a time, GC pressure on a 4GB device can trigger OOM.
**Why it happens:** The current cross-fade stores `lastRenderedFrame` as ImageData, re-allocated every frame.
**How to avoid:** Replace with `prevCtx.drawImage(canvas, 0, 0)` — copies pixels between canvases without allocating a new JS object.
**Warning signs:** Chrome DevTools → Memory tab shows sawtooth pattern of ~8MB allocations.

### Pitfall 2: navigator.deviceMemory Returns Undefined on Safari iOS
**What goes wrong:** Code assumes `navigator.deviceMemory` always returns a number, crashes or uses wrong tier.
**Why it happens:** Safari does not support this API. Firefox doesn't either.
**How to avoid:** Always check `!== undefined` before using. Fall back to mobile UA detection → conservative "low" tier.
**Warning signs:** `TypeError: Cannot read properties of undefined` in production logs.

### Pitfall 3: Compute Pressure API Not Available on Android
**What goes wrong:** Developer reads the spec, implements PressureObserver, it silently doesn't fire on the target device.
**Why it happens:** Chrome deprioritized Android support — telemetry access removed after Android 11. [CITED: groups.google.com/a/chromium.org/g/blink-dev/c/7leKysvPZWk]
**How to avoid:** Use frame-timing heuristic instead. Never depend on PressureObserver for the Snapdragon 770 target.
**Warning signs:** `'PressureObserver' in globalThis` returns false on target device.

### Pitfall 4: encodeQueueSize > N Without Dequeue Listener
**What goes wrong:** Polling with setTimeout instead of using the `dequeue` event wastes time between encoder completions.
**Why it happens:** setTimeout(r, 5) introduces up to 5ms latency per frame even when encoder is ready.
**How to avoid:** Use the existing pattern: `encoder.addEventListener("dequeue", r, { once: true })`.
**Warning signs:** Export time higher than expected despite low CPU utilization.

### Pitfall 5: Resolution Adaptation Breaking Aspect Ratio
**What goes wrong:** Scaling to 720×1280 without maintaining even dimensions causes VideoEncoder error.
**Why it happens:** H.264 requires even width/height. Scaling math can produce odd numbers.
**How to avoid:** Apply `- (value % 2)` to both dimensions (already done in current code for 1080 path).
**Warning signs:** `EncodingError: Invalid frame dimensions` in console.

## Code Examples

### Device Tier Integration into ExportConfig
```typescript
// Source: Pattern derived from project CONTEXT.md decisions D-09, D-11, D-12
export interface ExportConfig {
  videoEl: HTMLVideoElement;
  keyframes: { time: number; x: number; auto: boolean }[];
  skipRanges: { start: number; end: number }[];
  overlay: OverlayRenderFn;
  onProgress: (pct: number) => void;
  maxDuration?: number;
  deviceTier?: DeviceTier;  // NEW: optional, auto-detected if omitted
}
```

### Text Measurement Caching (D-07)
```typescript
// Source: Canvas2D performance best practices (web.dev/articles/canvas-performance)
// In template create():
const channelNameWidth = (() => {
  const measureCanvas = new OffscreenCanvas(1, 1);
  const measureCtx = measureCanvas.getContext("2d")!;
  measureCtx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  return measureCtx.measureText(brandKit.channelName).width;
})();
// Use channelNameWidth in render() instead of calling measureText each frame
```

### Adaptive Yield with Thermal Detection
```typescript
// Source: Heuristic pattern from RAF timing research
let yieldInterval = preset.yieldEvery;
let consecutiveFrames = 0;
let baselineFrameTime = 0;
let frameCount = 0;

for (let i = 0; i < totalFrames; i++) {
  const frameStart = performance.now();
  // ... encode frame ...
  const frameTime = performance.now() - frameStart;

  // Establish baseline from first 10 frames
  if (frameCount < 10) {
    baselineFrameTime = ((baselineFrameTime * frameCount) + frameTime) / (frameCount + 1);
  }
  frameCount++;

  // Thermal detection (D-17)
  if (frameCount > 10 && checkThermalPressure(frameTime, baselineFrameTime)) {
    yieldInterval = Math.max(2, Math.floor(preset.yieldEvery / 2)); // More frequent yields
  }

  consecutiveFrames++;

  // Yield gate: adaptive frequency + hard cap (D-18)
  if (consecutiveFrames >= yieldInterval || consecutiveFrames >= preset.maxConsecutive) {
    await new Promise((r) => setTimeout(r, preset.yieldMs));
    consecutiveFrames = 0;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `performance.memory` (Chrome) | `performance.measureUserAgentSpecificMemory()` | Chrome 89 | Requires cross-origin isolation — not practical for this app |
| PressureObserver (thermal) | Frame timing heuristic | 2024 (Android dropped) | PressureObserver never shipped on Android Chrome |
| Fixed encoder queue depth | Adaptive based on deviceMemory | Best practice 2023+ | Prevents OOM on constrained devices |
| getImageData for frame copy | drawImage between canvases | Always preferred | Avoids GPU→CPU readback, 10-50x faster |

**Deprecated/outdated:**
- `performance.memory`: Non-standard Chrome-only, not the same as `measureUserAgentSpecificMemory`
- Compute Pressure API on Android: Deprioritized, no telemetry access post-Android 11

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GSAP seek() on 7-tween plain-object timeline costs < 1ms | Architecture Patterns | If slower, need pre-computed keyframe table — easily fixable |
| A2 | Canvas drawImage (video→1080x1920) costs 2-3ms on Snapdragon 770 | Architecture Patterns | If slower, need resolution reduction even on "high" tier |
| A3 | 720x1280 output is acceptable quality on mobile phone screens | Pattern 1 | Users with large tablets might notice — but D-12 locks this decision |
| A4 | navigator.deviceMemory === 4 correctly identifies 4GB devices | Pattern 1 | A 3GB device also reports 4; conservative is correct behavior |
| A5 | setTimeout(r, 16) is sufficient yield for GPU to drain on low-end | Pattern 4 | May need 32ms on severely throttled devices; adjustable at runtime |

## Open Questions

1. **Exact thermal threshold multiplier**
   - What we know: Frame times increase 1.5-3x under thermal throttling
   - What's unclear: Optimal threshold for Snapdragon 770 specifically (1.5x? 2x?)
   - Recommendation: Start with 1.8x, instrument with dev profiling mode to tune on real device

2. **Whether to warn users before export on low-memory devices**
   - What we know: Detection is reliable on Chrome Android
   - What's unclear: Whether this improves UX or just creates anxiety
   - Recommendation: Skip for now (D-13 says automatic), add if users report confusion

3. **getImageData elimination — does drawImage between canvases preserve alpha correctly for cross-fade?**
   - What we know: Canvas compositing with globalAlpha works for standard blending
   - What's unclear: Whether putImageData's non-premultiplied alpha behavior was relied upon
   - Recommendation: Verify with visual test — the crossfade should look identical

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| navigator.deviceMemory | Device tier detection | ✓ (Chrome Android) / ✗ (Safari) | N/A | UA-based mobile detection → "low" tier |
| VideoEncoder (WebCodecs) | Export pipeline | ✓ | Chrome 94+, Safari 16.4+ | None (required) |
| OffscreenCanvas | Cross-fade buffer | ✓ | Chrome 69+, Safari 16.4+ | None (already used) |
| performance.now() | Frame timing | ✓ | Universal | None (required) |
| PressureObserver | Thermal detection | ✗ (Android) | N/A | Frame timing heuristic |
| navigator.getBattery() | Thermal (battery temp) | ✗ (no thermal data) | N/A | Frame timing heuristic |

**Missing dependencies with no fallback:** None — all required APIs are already available on target devices.

**Missing dependencies with fallback:**
- navigator.deviceMemory on Safari → UA-based fallback
- PressureObserver on Android → frame timing heuristic (Pattern 4)

## Security Domain

> This phase involves no authentication, no user input beyond file upload (already handled), no network requests, and no data persistence changes. Security surface is minimal.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | Video file already validated in upload flow |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious video causing encoder crash | Denial of Service | try/finally on VideoFrame (already implemented) |
| Memory exhaustion via large video | Denial of Service | 150MB ceiling + resolution cap (this phase) |

## Sources

### Primary (HIGH confidence)
- [MDN: navigator.deviceMemory](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory) — API behavior, browser support
- [Chrome DevBlog: Device Memory](https://developer.chrome.com/blog/device-memory) — Bucketing algorithm, practical usage
- [MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Using_the_WebCodecs_API) — encodeQueueSize backpressure pattern
- [web.dev: Canvas Performance](https://web.dev/articles/canvas-performance) — drawImage vs getImageData, optimization patterns
- [GSAP docs: Timeline.seek()](https://gsap.com/docs/v3/GSAP/Timeline/seek/) — suppressEvents behavior, performance characteristics
- [Chromium Blink Intent: Compute Pressure](https://groups.google.com/a/chromium.org/g/blink-dev/c/7leKysvPZWk) — Android deprioritization confirmation

### Secondary (MEDIUM confidence)
- [W3C Device Memory spec](https://www.w3.org/TR/device-memory/) — Formal API definition
- [Chrome Best Practices: WebCodecs](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs) — Queue management guidance
- [web.dev: OffscreenCanvas](https://web.dev/articles/offscreen-canvas) — Performance characteristics

### Tertiary (LOW confidence)
- Snapdragon 770 GPU specifics (Adreno 642L) — exact encode throughput numbers not available for browser context [ASSUMED]
- Canvas2D per-frame budget of 2-3ms for drawImage at 1080x1920 — based on general mobile Chrome benchmarks, not device-specific [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all browser APIs verified
- Architecture: HIGH — patterns directly map to locked decisions D-01 through D-18
- Pitfalls: HIGH — each pitfall verified against current codebase (e.g., getImageData on line 185 of export.ts)

**Research date:** 2026-05-18
**Valid until:** 2026-07-18 (stable APIs, no fast-moving dependencies)
