# Architecture Research: Client-Side Video Overlay Composition

**Domain:** Browser-based video export with HTML/GSAP overlay compositing
**Researched:** 2025-05-17
**Overall confidence:** HIGH (core techniques verified via official APIs and multiple sources)

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Export Loop** (existing) | Seeks video frames, manages encoding timeline | Overlay Renderer, VideoEncoder |
| **Overlay Renderer** | Drives GSAP timeline to time T, rasterizes DOM to canvas | Template Loader, Export Loop |
| **Template Loader** | Lazy-loads composition HTML+JS, initializes GSAP timeline | Overlay Renderer |
| **Composition Host** | Hidden DOM container where overlay HTML lives during export | Overlay Renderer, Template Loader |
| **Canvas Compositor** | Draws video frame + overlay bitmap into final canvas | Export Loop |

### Separation Principle

```
Export Loop (orchestrator)
  │
  ├─ seeks video to time T
  ├─ draws video frame to canvas
  │
  ├─ tells Overlay Renderer: "render at time T"
  │   └─ Overlay Renderer:
  │       ├─ tl.seek(T, true)  // GSAP positions all elements
  │       ├─ snapdom(container).toCanvas()  // rasterizes DOM state
  │       └─ returns ImageBitmap
  │
  ├─ composites: ctx.drawImage(overlayBitmap, 0, 0)
  └─ encodes composited canvas as VideoFrame
```

## Rendering Pipeline

### Pipeline Stages (per frame)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 1. Seek      │───▶│ 2. Draw      │───▶│ 3. Overlay   │───▶│ 4. Encode    │
│    Video     │    │    Base Frame │    │    Composite │    │    Frame     │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
  videoEl.          ctx.drawImage(       tl.seek(t)          new VideoFrame(
  currentTime=t     videoEl, crop...)    snapdom → bitmap    canvas, {ts})
                                         ctx.drawImage(bmp)  encoder.encode()
```

### Concrete Implementation

```typescript
// Inside the existing export for-loop (line 453 of main.ts)
for (let i = 0; i < totalFrames; i++) {
  const t = i / fps;
  if (skipRanges.some(r => t >= r.start && t < r.end)) continue;

  // Stage 1: Seek video
  videoEl.currentTime = t;
  await new Promise(r => videoEl!.addEventListener("seeked", r, { once: true }));

  // Stage 2: Draw base video frame (cropped)
  const cropX = getPositionAtTime(t, duration);
  const srcX = Math.max(0, Math.min(maxX, maxX * cropX));
  ctx.drawImage(videoEl, srcX, 0, cropSrcW, srcH, 0, 0, encW, encH);

  // Stage 3: Overlay composite (NEW)
  if (overlayRenderer) {
    const overlayBitmap = await overlayRenderer.renderAtTime(t);
    ctx.drawImage(overlayBitmap, 0, 0, encW, encH);
    overlayBitmap.close(); // free memory
  }

  // Stage 4: Encode
  const frame = new VideoFrame(canvas, {
    timestamp: encodedFrames * (1_000_000 / fps),
    duration: 1_000_000 / fps,
  });
  encoder.encode(frame, { keyFrame: encodedFrames % 60 === 0 });
  frame.close();
  encodedFrames++;
}
```

### DOM Rasterization Strategy

**Recommended: SnapDOM** (confidence: MEDIUM-HIGH)

SnapDOM is the fastest DOM-to-canvas library available (up to 150× faster than html2canvas, 8× faster than html-to-image). For frame-by-frame rendering where we call it 900+ times per export, speed is critical.

```typescript
import { snapdom } from "@nicepkg/snapdom";

async function rasterizeOverlay(container: HTMLElement): Promise<ImageBitmap> {
  const result = await snapdom(container, {
    scale: 1, // already at target resolution
    compress: false,
    embedFonts: true,
  });
  const canvas = await result.toCanvas();
  return createImageBitmap(canvas);
}
```

**Fallback: foreignObject SVG approach** (confidence: MEDIUM)

For simpler compositions without external assets, the SVG foreignObject → Image → canvas path avoids library dependencies but has security/tainting constraints:
- Requires ALL styles inlined
- Requires ALL fonts embedded as data URIs
- No external images (must be base64)
- Canvas tainting risk varies by browser

**Not recommended:**
- `html2canvas`: Too slow for frame-by-frame (reconstructs entire DOM per call)
- OffscreenCanvas direct: Cannot render DOM, only useful for the final composition step

## GSAP Frame-by-Frame Technique

### Core Pattern (HIGH confidence — verified via GSAP official docs)

```typescript
class OverlayRenderer {
  private tl: gsap.core.Timeline;
  private container: HTMLElement;

  constructor(timeline: gsap.core.Timeline, container: HTMLElement) {
    this.tl = timeline;
    this.container = container;
    // Timeline MUST be paused for frame-by-frame control
    this.tl.pause();
  }

  async renderAtTime(time: number): Promise<ImageBitmap> {
    // 1. Seek timeline — positions all animated elements deterministically
    this.tl.seek(time, true); // true = suppress onUpdate/onComplete callbacks

    // 2. Force browser to compute layout after GSAP mutations
    // Reading offsetHeight forces synchronous reflow
    void this.container.offsetHeight;

    // 3. Rasterize the current DOM state
    return await rasterizeOverlay(this.container);
  }
}
```

### Critical Details

1. **`tl.seek(time, true)`** — The second argument suppresses event callbacks. This prevents side effects during export that could mutate state unexpectedly.

2. **Nested timelines work** — Seeking the parent timeline correctly propagates to all child timelines. No special handling needed.

3. **Deterministic state** — GSAP timelines are pure state machines. `seek(t)` always produces the same DOM state for the same `t`, regardless of playback history. This is what makes frame-by-frame export possible.

4. **Forced reflow** — After `seek()`, GSAP has applied inline style mutations via `element.style.transform = ...` etc. The browser batches these. Reading `offsetHeight` forces layout computation before rasterization.

5. **Timeline must be `paused: true`** — If the timeline is playing, the ticker will fight with our seek calls.

### Handling Overlay Duration vs Video Duration

```typescript
// Overlay composition has its own duration (e.g., 5s intro animation)
// Map overlay time relative to video time

interface OverlayConfig {
  startTime: number;  // when overlay starts in video timeline (seconds)
  template: string;   // template ID to load
}

function getOverlayTime(videoTime: number, config: OverlayConfig): number | null {
  const overlayTime = videoTime - config.startTime;
  if (overlayTime < 0) return null;  // overlay hasn't started
  if (overlayTime > overlayDuration) return null;  // overlay has ended
  return overlayTime;
}
```

### Font Loading Guarantee

Fonts must be fully loaded before first rasterization. GSAP seek is synchronous but font rendering is not:

```typescript
// Before starting export loop
await document.fonts.ready;
// Additionally wait for any @font-face in the overlay template
await document.fonts.load("bold 48px 'CustomFont'");
```

## Integration With Existing Export Loop

### Minimal Change Integration Point

The existing export loop (lines 400-516 of `src/main.ts`) has a clear injection point. The loop already:
1. Seeks video (`videoEl.currentTime = t`)
2. Waits for seek (`addEventListener("seeked", ...)`)
3. Draws to canvas (`ctx.drawImage(videoEl, ...)`)
4. Creates VideoFrame and encodes

**Insert overlay rendering between steps 3 and 4:**

```typescript
// Line ~468 in current code (after ctx.drawImage)
ctx.drawImage(videoEl, srcX, 0, cropSrcW, srcH, 0, 0, encW, encH);

// === INSERT OVERLAY COMPOSITING HERE ===
if (activeOverlay && overlayRenderer) {
  const overlayT = t - activeOverlay.startTime;
  if (overlayT >= 0 && overlayT <= overlayRenderer.duration) {
    const bitmap = await overlayRenderer.renderAtTime(overlayT);
    ctx.drawImage(bitmap, 0, 0, encW, encH);
    bitmap.close();
  }
}
// === END INSERT ===

if (useWC && encoder) {
  const frame = new VideoFrame(canvas, { ... });
```

### Architectural Decision: Sync vs Async Overlay

**Option A: Synchronous (rasterize in export loop)** — RECOMMENDED
- Simpler mental model
- Each frame waits for overlay rasterization
- Total export time = video_seek + overlay_rasterize + encode per frame
- ~20-50ms per overlay frame (SnapDOM) is acceptable given video seek is ~30-100ms

**Option B: Pre-render overlay to image sequence**
- Render all overlay frames upfront into ImageBitmap[]
- Export loop just does `ctx.drawImage(overlayFrames[i])`
- Pro: Faster export loop, decoupled
- Con: Memory explosion (900 frames × 1080×1920 × 4 bytes = ~7GB)
- NOT VIABLE for full-length videos

**Option C: Pre-render to lower resolution, upscale**
- Render overlay at 540×960, scale up during composite
- Pro: 4× less memory, faster rasterization
- Con: Visibly blurry text/graphics
- NOT RECOMMENDED for text-heavy compositions

### Export Function Refactored Interface

```typescript
interface ExportOptions {
  video: HTMLVideoElement;
  keyframes: Keyframe[];
  skipRanges: SkipRange[];
  fps: number;
  overlay?: {
    templateId: string;
    startTime: number;
    duration: number;
  };
  onProgress: (pct: number) => void;
}

async function exportVideo(opts: ExportOptions): Promise<Blob> {
  // 1. Setup encoder + muxer (existing)
  // 2. If overlay, load template and create renderer
  let overlayRenderer: OverlayRenderer | null = null;
  if (opts.overlay) {
    overlayRenderer = await loadAndInitOverlay(opts.overlay.templateId);
  }
  // 3. Frame loop with overlay injection
  // 4. Finalize and return blob
}
```

## Template Loading Strategy

### Architecture: Lazy-Load Compositions

Compositions are full HTML documents (1080×1920) with GSAP timelines. They should NOT be in the main bundle.

```
src/
  overlays/
    registry.ts          # Maps template IDs to lazy loaders (tiny, in bundle)
    types.ts             # Shared types
  templates/             # Each template is a separate chunk
    intro-bold/
      index.ts           # GSAP timeline factory
      styles.css         # Scoped styles
    lower-third/
      index.ts
      styles.css
```

### Registry Pattern

```typescript
// src/overlays/registry.ts — always in bundle, tiny
export interface OverlayTemplate {
  id: string;
  name: string;
  duration: number;  // seconds
  load: () => Promise<OverlayModule>;
}

export interface OverlayModule {
  createTimeline: (container: HTMLElement) => gsap.core.Timeline;
  html: string;  // template HTML
  css: string;   // scoped CSS
}

export const templates: OverlayTemplate[] = [
  {
    id: "intro-bold",
    name: "Bold Intro",
    duration: 3,
    load: () => import("../templates/intro-bold/index.ts"),
  },
  {
    id: "lower-third",
    name: "Lower Third",
    duration: 5,
    load: () => import("../templates/lower-third/index.ts"),
  },
];
```

### Template Module Contract

Each template exports:

```typescript
// templates/intro-bold/index.ts
import gsap from "gsap";

export const html = `
  <div class="intro-bold">
    <h1 class="title">{{title}}</h1>
    <p class="subtitle">{{subtitle}}</p>
  </div>
`;

export const css = `
  .intro-bold { /* scoped styles */ }
  .title { font-size: 72px; font-weight: 900; }
`;

export function createTimeline(container: HTMLElement): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  tl.from(container.querySelector(".title"), { y: 100, opacity: 0, duration: 0.8 });
  tl.from(container.querySelector(".subtitle"), { y: 50, opacity: 0, duration: 0.6 }, "-=0.3");
  return tl;
}
```

### Composition Host (Hidden DOM Container)

```typescript
class CompositionHost {
  private host: HTMLElement;

  constructor() {
    this.host = document.createElement("div");
    this.host.id = "overlay-host";
    // Position off-screen but still rendered (not display:none)
    Object.assign(this.host.style, {
      position: "fixed",
      left: "-9999px",
      top: "0",
      width: "1080px",
      height: "1920px",
      overflow: "hidden",
      // Must be visible for fonts/layout to compute
      visibility: "hidden",
      pointerEvents: "none",
    });
    document.body.appendChild(this.host);
  }

  async loadTemplate(template: OverlayTemplate, vars: Record<string, string>): Promise<{
    container: HTMLElement;
    timeline: gsap.core.Timeline;
  }> {
    const mod = await template.load();

    // Inject HTML with variable substitution
    let html = mod.html;
    for (const [key, val] of Object.entries(vars)) {
      html = html.replaceAll(`{{${key}}}`, val);
    }
    this.host.innerHTML = html;

    // Inject scoped styles
    const style = document.createElement("style");
    style.textContent = mod.css;
    this.host.prepend(style);

    // Wait for fonts referenced in CSS
    await document.fonts.ready;

    // Create GSAP timeline
    const timeline = mod.createTimeline(this.host);

    return { container: this.host, timeline };
  }

  destroy() {
    this.host.remove();
  }
}
```

### Why NOT iframe isolation

- iframes add cross-document complexity
- Same-origin iframes still require DOM access gymnastics
- Font loading becomes harder to synchronize
- No performance benefit (SnapDOM works on same-document DOM)
- Added latency from iframe document lifecycle

### Bundle Size Impact

| What | Size | When Loaded |
|------|------|-------------|
| Registry (template metadata) | ~1KB | Always (in main bundle) |
| GSAP core | ~60KB gzipped | Only when user selects overlay |
| SnapDOM | ~8KB gzipped | Only during export with overlay |
| Individual template | ~2-5KB each | Only the selected template |
| Template fonts | Variable | Via CSS @font-face, lazy |

**Main bundle increase: ~1KB** (just the registry). Everything else is lazy.

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rasterization lib | SnapDOM | 150× faster than html2canvas, critical for per-frame use |
| GSAP control | `seek(t, true)` | Deterministic, suppresses callbacks, works with nested timelines |
| Composition host | Hidden fixed div | Must be in-document for layout/fonts but invisible to user |
| Template loading | Dynamic `import()` | Zero bundle cost until user selects an overlay |
| Integration point | Between canvas draw and VideoFrame creation | Minimal change to existing loop |
| Memory strategy | Rasterize per frame, close immediately | Pre-rendering is infeasible at 1080×1920 |

## Performance Expectations

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| Video seek | 30-100ms | Existing, browser-dependent |
| GSAP seek | <1ms | Pure JS property assignment |
| Forced reflow | 1-5ms | Single container, fixed size |
| SnapDOM rasterize | 20-50ms | Depends on DOM complexity |
| VideoFrame + encode | 5-15ms | Hardware-accelerated |
| **Total per frame** | **~60-170ms** | ~6-16 fps export speed |
| **30s video @ 30fps** | **~60-150s export** | Acceptable for client-side |

## Sources

- GSAP Timeline.seek() docs: https://gsap.com/docs/v3/GSAP/Timeline/seek/
- GSAP Timeline API: https://gsap.com/docs/v3/GSAP/Timeline/
- WebCodecs API: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
- SnapDOM: https://snapdom.dev / https://github.com/nicepkg/snapdom
- gsap-video-export pattern: https://github.com/workeffortwaste/gsap-video-export
- foreignObject SVG security: https://chromestatus.com/feature/5196074156032000
- Chrome WebCodecs best practices: https://developer.chrome.com/docs/web-platform/best-practices/webcodecs
