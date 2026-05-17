# Phase 1: Overlay-Ready Export - Research

**Researched:** 2026-05-17
**Domain:** WebCodecs VideoEncoder pipeline, canvas 2D composition, memory-safe frame lifecycle
**Confidence:** HIGH

## Summary

This phase refactors the existing monolithic export loop (lines 400–516 of `src/main.ts`) into a modular, memory-safe pipeline that composites overlay graphics onto video frames before encoding. The existing code already follows the correct VideoFrame create→encode→close pattern but lacks backpressure handling and any overlay injection point.

The WebCodecs API provides all primitives needed: `encoder.encodeQueueSize` + `dequeue` event for backpressure, canvas 2D as the composition surface, and `VideoFrame` constructible from canvas. No new dependencies are required — this is pure API usage and architectural restructuring.

**Primary recommendation:** Split into `src/export.ts` and `src/overlay.ts`, insert `renderOverlay(ctx, t, encW, encH)` call between `ctx.drawImage` and `new VideoFrame`, wrap frame lifecycle in try/finally, and gate encoding on `encodeQueueSize > 5` using the `dequeue` event.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Overlay composition as layered canvas draw — same canvas context, no second canvas/OffscreenCanvas
- **D-02:** Injection point is `renderOverlay(ctx, t, encW, encH)` between drawImage and new VideoFrame
- **D-03:** Encoder backpressure via `encoder.encodeQueueSize` threshold ~5 frames
- **D-04:** Explicit `frame.close()` with try/finally
- **D-05:** Safety sweep after loop finishes
- **D-06:** Split into `src/export.ts`, `src/overlay.ts`, `src/main.ts`
- **D-07:** Export module exposes single async `exportVideo(config)` function
- **D-08:** Test overlay is semi-transparent rectangle in lower-third with "OVERLAY TEST" text
- **D-09:** Test overlay renders on every frame at fixed position

### Agent's Discretion
- Exact encoder configuration values (bitrate, codec profile)
- Internal function signatures and naming (follow camelCase verb-first)
- Error message wording and UX for failure states
- Whether to use requestAnimationFrame or setTimeout for UI yields

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPORT-01 | Memory-safe VideoFrame lifecycle (close frames after encode) | try/finally pattern + safety sweep (see Architecture Patterns §1, §3) |
| EXPORT-02 | Overlay composition step between frame draw and encode | Canvas 2D layered draw pattern with renderOverlay callback (see Architecture Patterns §2) |
| EXPORT-03 | Encoder backpressure prevents queue overflow | encodeQueueSize + dequeue event gate (see Architecture Patterns §1) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Video frame seeking | Browser (HTMLVideoElement) | — | Uses native video decoder via `currentTime` + `seeked` event |
| Crop composition | Browser (Canvas 2D) | — | `ctx.drawImage()` with source rect for crop |
| Overlay rendering | Browser (Canvas 2D) | — | Same canvas context, layered draw after crop |
| Video encoding | Browser (WebCodecs) | — | Hardware-accelerated H.264 via VideoEncoder |
| Container muxing | Client JS (mp4-muxer) | — | JS library wraps encoded chunks into MP4 |
| Backpressure control | Client JS | — | Application logic monitors `encodeQueueSize` |
| File download | Browser (Blob/URL API) | — | createObjectURL → anchor download |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mp4-muxer | 5.2.2 | MP4 container muxing | Already in use, only maintained browser MP4 muxer with WebCodecs support [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/dom-webcodecs | ^0.1.18 | TypeScript types for WebCodecs API | Always (dev dependency, already installed) [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas 2D overlay | OffscreenCanvas + Worker | Better perf but D-01 locks us to same-context draw; OffscreenCanvas is Phase 4 optimization territory |
| Seek-based frame extraction | WebCodecs VideoDecoder | Much faster but architectural change beyond phase scope |

**Installation:**
```bash
# No new packages needed — all dependencies already installed
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  src/main.ts (orchestrator)                                  │
│  - UI event handlers                                         │
│  - Calls exportVideo(config) on button click                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ config: { videoEl, frames, keyframes,
                       │          skipRanges, overlay, onProgress }
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  src/export.ts                                               │
│                                                              │
│  exportVideo(config) → Promise<Blob>                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Frame Loop (for each frame time):                     │ │
│  │    1. Seek videoEl.currentTime = t                     │ │
│  │    2. await seeked event                               │ │
│  │    3. ctx.drawImage(videoEl, crop → canvas)            │ │
│  │    4. config.overlay(ctx, t, encW, encH) ← INJECTION  │ │
│  │    5. new VideoFrame(canvas, { timestamp, duration })  │ │
│  │    6. BACKPRESSURE: while encodeQueueSize > 5, await   │ │
│  │    7. encoder.encode(frame)                            │ │
│  │    8. frame.close() [in finally block]                 │ │
│  └────────────────────────────────────────────────────────┘ │
│  Safety sweep: close any leaked frames                       │
│  await encoder.flush() → muxer.finalize() → Blob            │
└─────────────────────────────────────────────────────────────┘
                       ▲
                       │ overlay callback
┌─────────────────────────────────────────────────────────────┐
│  src/overlay.ts                                              │
│                                                              │
│  renderTestOverlay(ctx, t, w, h) → void                     │
│  - Semi-transparent rect in lower-third                      │
│  - White "OVERLAY TEST" text                                 │
│                                                              │
│  type OverlayFn = (ctx, t, w, h) => void                    │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── main.ts          # UI orchestrator (slimmed down, calls exportVideo)
├── export.ts        # Export pipeline: encoder setup, frame loop, muxer
├── overlay.ts       # Overlay type + test overlay implementation
└── styles.css       # Unchanged
```

### Pattern 1: Backpressure-Gated Encoding
**What:** Wait for encoder queue to drain before submitting new frames
**When to use:** Every frame in the export loop
**Example:**
```typescript
// Source: developer.chrome.com/docs/web-platform/best-practices/webcodecs
// + MDN WebCodecs API docs
async function waitForBackpressure(encoder: VideoEncoder, threshold = 5): Promise<void> {
  while (encoder.encodeQueueSize > threshold) {
    await new Promise<void>((resolve) => {
      encoder.addEventListener("dequeue", resolve, { once: true });
    });
  }
}
```

### Pattern 2: Overlay Injection via Callback
**What:** Decouple overlay rendering from the export pipeline using a typed callback
**When to use:** Between drawImage and VideoFrame creation
**Example:**
```typescript
// Overlay function type — called once per frame
type OverlayRenderFn = (
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number,
) => void;

// In export loop:
ctx.drawImage(videoEl, srcX, 0, cropSrcW, srcH, 0, 0, encW, encH);
overlay(ctx, t, encW, encH);  // ← injection point (D-02)
const frame = new VideoFrame(canvas, { timestamp, duration });
```

### Pattern 3: Try/Finally Frame Lifecycle
**What:** Guarantee frame.close() even if encode throws
**When to use:** Every VideoFrame creation
**Example:**
```typescript
// Source: MDN WebCodecs VideoFrame docs, Chrome best practices
let frame: VideoFrame | null = null;
try {
  frame = new VideoFrame(canvas, {
    timestamp: encodedFrames * frameDuration,
    duration: frameDuration,
  });
  await waitForBackpressure(encoder);
  encoder.encode(frame, { keyFrame: encodedFrames % 60 === 0 });
} finally {
  frame?.close();
}
```

### Pattern 4: Safety Sweep
**What:** After loop completes, verify no frames leaked
**When to use:** After export loop exits, before flush
**Example:**
```typescript
// D-05: No frame references survive the loop in this pattern
// because we create and close within each iteration.
// Safety sweep is a no-op assertion — included for defensive correctness.
// If refactored to batch frames, this becomes critical.
```

### Anti-Patterns to Avoid
- **Unbounded encode queue:** Never call `encoder.encode()` without checking `encodeQueueSize` — causes OOM on 4GB devices
- **Late frame.close():** Never store VideoFrame references beyond one loop iteration — each holds GPU-backed memory
- **Blocking main thread without yields:** The existing `setTimeout(r, 0)` every 5 frames pattern is correct — maintain it for UI responsiveness
- **Double VideoFrame from canvas:** Don't create a VideoFrame from a VideoFrame — use canvas as the composition surface

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MP4 container format | Custom muxer | mp4-muxer library | Container format is complex (atom ordering, fastStart, timing) |
| H.264 encoding | WASM encoder | WebCodecs VideoEncoder | Hardware-accelerated, zero bundle cost |
| Backpressure mechanism | Manual frame counting | encodeQueueSize + dequeue event | Browser-maintained, reflects actual encoder state |

**Key insight:** All heavy lifting (encoding, container format) is handled by browser APIs and one existing library. This phase is architectural — organizing code and adding the overlay injection point + safety mechanisms.

## Common Pitfalls

### Pitfall 1: encodeQueueSize Check Timing
**What goes wrong:** Checking queue size AFTER encode means the frame is already queued — too late for backpressure
**Why it happens:** Natural to write "encode then check" but the check must precede encode
**How to avoid:** Always `await waitForBackpressure()` BEFORE `encoder.encode()`
**Warning signs:** Memory grows linearly with video length on slow devices

### Pitfall 2: VideoFrame Timestamp Units
**What goes wrong:** Timestamps passed in milliseconds instead of microseconds
**Why it happens:** Most web APIs use ms; VideoFrame uses μs (microseconds)
**How to avoid:** Use `1_000_000 / fps` for frame duration, `frameIndex * (1_000_000 / fps)` for timestamps
**Warning signs:** Video plays at wrong speed or muxer produces corrupt output

### Pitfall 3: Canvas Context State Leakage
**What goes wrong:** Overlay draw calls (globalAlpha, fillStyle, font) persist and affect next frame's crop draw
**Why it happens:** Canvas 2D context is stateful — no automatic reset between operations
**How to avoid:** Use `ctx.save()` / `ctx.restore()` around overlay rendering, or reset relevant properties after
**Warning signs:** First frame looks correct, subsequent frames have wrong colors/transparency

### Pitfall 4: Seek Race Condition
**What goes wrong:** `seeked` event fires for a previous seek, not the current one
**Why it happens:** Multiple seeks can be in-flight; events fire out of order in edge cases
**How to avoid:** Verify `videoEl.currentTime` matches expected time after seeked (existing code pattern is safe since it's sequential)
**Warning signs:** Occasional wrong frame in output (rare but documented)

### Pitfall 5: encoder.close() vs encoder.flush()
**What goes wrong:** Calling `close()` without `flush()` discards buffered frames
**Why it happens:** `close()` immediately terminates; `flush()` waits for pending work
**How to avoid:** Always `await encoder.flush()` then optionally `encoder.close()`
**Warning signs:** Last few frames missing from output video

## Code Examples

### Export Module Skeleton
```typescript
// src/export.ts
// Source: Existing codebase pattern + WebCodecs best practices
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export type OverlayRenderFn = (
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number,
) => void;

export interface ExportConfig {
  videoEl: HTMLVideoElement;
  keyframes: { time: number; x: number; auto: boolean }[];
  skipRanges: { start: number; end: number }[];
  overlay: OverlayRenderFn;
  onProgress: (pct: number) => void;
}

export async function exportVideo(config: ExportConfig): Promise<Blob> {
  const { videoEl, keyframes, skipRanges, overlay, onProgress } = config;
  // ... setup encoder, muxer, canvas
  // ... frame loop with backpressure + overlay injection
  // ... flush, finalize, return blob
}
```

### Test Overlay Implementation
```typescript
// src/overlay.ts
// Source: D-08, D-09 from CONTEXT.md
import type { OverlayRenderFn } from "./export";

export const renderTestOverlay: OverlayRenderFn = (ctx, _t, w, h) => {
  ctx.save();

  // Lower-third semi-transparent bar
  const barH = h * 0.12;
  const barY = h - barH - h * 0.08;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, barY, w, barH);

  // White text centered in bar
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(barH * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OVERLAY TEST", w / 2, barY + barH / 2);

  ctx.restore();
};
```

### Backpressure + Frame Lifecycle in Loop
```typescript
// Source: Chrome DevRel WebCodecs best practices + MDN dequeue event
const frameDuration = 1_000_000 / fps;

for (let i = 0; i < totalFrames; i++) {
  const t = i / fps;
  if (skipRanges.some((r) => t >= r.start && t < r.end)) continue;

  // Seek
  videoEl.currentTime = t;
  await new Promise<void>((r) => videoEl.addEventListener("seeked", r, { once: true }));

  // Draw crop
  const cropX = getPositionAtTime(t, keyframes);
  ctx.drawImage(videoEl, srcX, 0, cropSrcW, srcH, 0, 0, encW, encH);

  // Overlay injection (D-02)
  overlay(ctx, t, encW, encH);

  // Encode with backpressure (D-03) and safe lifecycle (D-04)
  let frame: VideoFrame | null = null;
  try {
    frame = new VideoFrame(canvas, {
      timestamp: encodedFrames * frameDuration,
      duration: frameDuration,
    });
    while (encoder.encodeQueueSize > 5) {
      await new Promise<void>((r) => encoder.addEventListener("dequeue", r, { once: true }));
    }
    encoder.encode(frame, { keyFrame: encodedFrames % 60 === 0 });
  } finally {
    frame?.close();
  }

  encodedFrames++;
  onProgress(Math.round((i / totalFrames) * 100));
  if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0)); // UI yield
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MediaRecorder for encoding | WebCodecs VideoEncoder | Chrome 94 (2021) | Direct frame control, hardware accel |
| Frame dropping for backpressure | encodeQueueSize + dequeue event | WebCodecs spec finalization | Lossless encoding with flow control |
| WASM ffmpeg in browser | Native WebCodecs | 2021-2022 | 10-50× faster, zero bundle cost |

**Deprecated/outdated:**
- `HTMLCanvasElement.captureStream()` + MediaRecorder: No frame-level control, can't composite overlays per-frame

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `encodeQueueSize` threshold of 5 is appropriate for 4GB devices | Architecture Patterns | Could OOM if too high, or be slow if too low — tunable at runtime |
| A2 | `setTimeout(r, 0)` every 5 frames is sufficient for UI responsiveness | Code Examples | Could feel janky on slow devices — tunable |
| A3 | `avc1.640028` (High Profile L4.0) is supported on target devices (Safari iOS 16+, Chrome Android 90+) | Existing code | Export would fail silently if codec string unsupported |

## Open Questions

1. **Codec string compatibility across Safari iOS 16+**
   - What we know: `avc1.640028` (H.264 High Profile L4.0) works in Chrome Android 90+
   - What's unclear: Safari iOS 16+ VideoEncoder may have different supported profile strings
   - Recommendation: Use `VideoEncoder.isConfigSupported()` before encoding (already a best practice); fall back to Baseline profile `avc1.42001E` if High unsupported. This is within Agent's Discretion.

2. **getPositionAtTime needs keyframes[] as parameter**
   - What we know: Current implementation reads module-level `keyframes` state
   - What's unclear: Whether to pass keyframes explicitly or keep module-level access
   - Recommendation: Pass explicitly to `exportVideo` config for testability and module isolation (D-07 implies config-driven)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun runtime | Dev server, build | ✓ | 1.3.11 | — |
| mp4-muxer | MP4 container muxing | ✓ | 5.2.2 | — |
| WebCodecs API | Video encoding | ✓ (browser) | Baseline 2024 | Feature detection already exists in code |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (client-only app) |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Minimal | Video file from user's device — browser sandboxing handles |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for Client-Side Video Processing

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed video causing decoder crash | Denial of Service | Browser sandboxing (handled by platform) |
| Memory exhaustion via large video | DoS | Backpressure + frame.close() (D-03, D-04) |

No server-side attack surface. Security concerns are limited to memory safety (addressed by D-03, D-04, D-05).

## Project Constraints (from AGENTS.md)

- **Performance**: Must render smoothly on Snapdragon 770 (backpressure handles this)
- **On-device**: Zero server dependencies (already satisfied — pure client-side)
- **Bundle size**: Keep fast load on mobile networks (no new dependencies added)
- **Browser support**: Safari iOS 16+ and Chrome Android 90+ (WebCodecs required — feature detection exists)
- **Code style**: camelCase verb-first naming, 2-space indent, double quotes, semicolons
- **Module pattern**: ES modules with named imports, relative paths with `./` prefix
- **No framework**: Vanilla TypeScript, imperative DOM manipulation

## Sources

### Primary (HIGH confidence)
- [Chrome DevRel WebCodecs Best Practices](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs) — encoding pattern, frame lifecycle, backpressure
- [MDN VideoEncoder.encodeQueueSize](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/encodeQueueSize) — queue monitoring API
- [W3C WebCodecs Spec](https://www.w3.org/TR/webcodecs/) — VideoFrame constructor from canvas, timestamp units
- [npm: mp4-muxer 5.2.2](https://www.npmjs.com/package/mp4-muxer) — version verification

### Secondary (MEDIUM confidence)
- [WebCodecs Fundamentals](https://webcodecsfundamentals.org/) — backpressure patterns, live streaming examples
- [FreeCodeCamp WebCodecs Handbook](https://www.freecodecamp.org/news/the-webcodecs-handbook-native-video-processing-in-the-browser/) — canvas composition patterns

### Tertiary (LOW confidence)
- None — all claims verified against official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, existing mp4-muxer verified
- Architecture: HIGH — patterns directly from Chrome DevRel docs and W3C spec
- Pitfalls: HIGH — documented in official WebCodecs guides and spec issues

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (stable APIs, no expected breaking changes)
