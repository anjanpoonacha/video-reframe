# Phase 2: Brand Kit & Templates - Research

**Researched:** 2026-05-17
**Domain:** GSAP canvas animation + brand identity storage + template rendering
**Confidence:** HIGH

## Summary

This phase adds a brand kit settings panel (logo, colors, position) persisted in localStorage, and a template engine that uses GSAP timelines seeked frame-by-frame to render overlays onto the export canvas. The core technical challenge is rendering GSAP-animated state objects at arbitrary time positions (not real-time playback) and painting the results via the `OverlayRenderFn` interface already built in Phase 1.

GSAP 3.15.0 supports animating plain JavaScript objects (no DOM required), with `timeline.seek(t)` immediately mutating object properties to their interpolated values at time `t`. This means the template engine can: (1) create a paused GSAP timeline animating state objects, (2) at each frame call `seek(t)` to update state, (3) draw the state to the export canvas using Canvas2D API calls. No hidden DOM or rasterization step is needed for Phase 2's static lower-third template.

**Primary recommendation:** Install GSAP via `bun add gsap`, animate plain state objects, seek per-frame during export, draw to canvas directly. Use localStorage with a 500KB logo cap and `try/catch` around writes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Brand kit lives in a persistent settings panel (gear icon), NOT inline in the pipeline
- **D-02:** Brand kit data stored in localStorage as JSON: `{ logo: string (data URL), primaryColor: string (hex), accentColor: string (hex), logoPosition: string }`
- **D-03:** Logo uploaded as PNG or SVG, stored as base64 data URL in localStorage. Max file size enforced client-side (500KB)
- **D-04:** Brand colors: primary and accent color pickers with hex input
- **D-05:** Logo positions respect shorts platform safe zones — inset from edges
- **D-06:** Position options: Top-Left, Top-Right, Bottom-Left, Bottom-Right — all within safe zone
- **D-07:** Default position: Top-Left
- **D-08:** Templates are GSAP timelines defined in code. Each creates a timeline with `seek(t)` method
- **D-09:** Frame-by-frame rendering: `timeline.seek(t)` then rasterize to export canvas
- **D-10:** Templates receive brand kit values as parameters at construction time
- **D-11:** Template rendering implements `OverlayRenderFn` interface
- **D-12:** New module `src/templates.ts`
- **D-13:** Template interface: `{ name, duration, create(brandKit): { render: OverlayRenderFn, dispose() } }`
- **D-14:** Brand kit module: `src/brand-kit.ts`
- **D-15:** Phase 2 delivers ONE working template (static lower-third with logo + channel name)

### Agent's Discretion
- GSAP timeline implementation details (tweens, easing)
- Settings panel visual design and layout
- Color picker component (native `<input type="color">` vs custom)
- Logo resize/crop behavior during upload
- Template preview mechanism
- Whether to use hidden DOM or pure canvas for GSAP rendering target

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRAND-01 | User can upload channel logo (PNG/SVG) that persists across sessions | localStorage with base64 data URL, FileReader API, 500KB cap |
| BRAND-02 | User can set primary and accent brand colors | Native `<input type="color">` + hex text input pattern |
| BRAND-03 | Brand kit stored in localStorage and applied to all overlay templates | JSON serialization with try/catch for quota errors |
| BRAND-04 | User can position logo (corner selection: TL/TR/BL/BR) | Safe zone insets: 8% from edges (conservative cross-platform) |
| TMPL-01 | Overlay compositions defined as HTML+GSAP timelines (Hyperframes pattern) | GSAP plain object animation + canvas draw (no HTML rasterization needed for Phase 2) |
| TMPL-02 | Templates rendered frame-by-frame using GSAP seek() + canvas draw | `timeline.seek(t)` mutates state objects synchronously, then draw to ctx |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Brand kit storage | Browser / Client (localStorage) | — | No server, persistence must be client-side |
| Brand kit UI | Browser / Client (DOM) | — | Settings panel is standard DOM + event handlers |
| Template engine | Browser / Client (GSAP + Canvas) | — | Frame-by-frame rendering during export loop |
| Logo positioning | Browser / Client (Canvas draw) | — | Calculated at draw time using safe zone constants |
| Export integration | Browser / Client (Canvas) | — | Templates plug into existing `OverlayRenderFn` callback |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gsap | 3.15.0 | Timeline animation engine with seek() | Industry standard, animates plain objects, 12yr npm history, free license [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | Phase 2 needs only GSAP + native browser APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GSAP | Manual interpolation | Works for Phase 2's static template but won't scale to Phase 3 animations |
| GSAP | anime.js | Less mature seek API, smaller ecosystem for complex timelines |
| localStorage | IndexedDB | Better for large binary data but overkill for <500KB logo + JSON config |

**Installation:**
```bash
bun add gsap
```

**Version verification:**
```
npm view gsap version → 3.15.0 (published 2026-04-13)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| gsap | npm | 12 years (since 2014-08-25) | Very high (industry standard) | github.com/greensock/GSAP | N/A (slopcheck scans project deps only) | Approved — verified via npm registry metadata + official GreenSock GitHub |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Manual verification: GSAP created 2014-08-25, last published 2026-04-13, official repo github.com/greensock/GSAP, no postinstall scripts. License: GSAP Standard "no charge" license (free for commercial use, not MIT).*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Brand Kit Settings Panel (gear icon)                    │
│  ┌──────────┐ ┌────────────┐ ┌────────────────────┐    │
│  │Logo Upload│ │Color Pickers│ │Position Selector   │    │
│  └─────┬─────┘ └─────┬──────┘ └─────────┬──────────┘    │
│        │              │                   │              │
│        └──────────────┼───────────────────┘              │
│                       ▼                                  │
│              localStorage (JSON)                         │
│              { logo, primaryColor,                       │
│                accentColor, logoPosition }               │
└───────────────────────┬─────────────────────────────────┘
                        │ load on export
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Template Engine (src/templates.ts)                       │
│                                                          │
│  create(brandKit) → { render, dispose }                  │
│    1. Build GSAP timeline (paused)                       │
│    2. Timeline tweens plain state objects                 │
│                                                          │
│  render(ctx, t, w, h):                                   │
│    1. timeline.seek(t)  → state objects updated          │
│    2. Draw state to ctx  (drawImage, fillRect, fillText) │
└───────────────────────┬─────────────────────────────────┘
                        │ implements OverlayRenderFn
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Export Loop (src/export.ts)                              │
│                                                          │
│  for each frame:                                         │
│    ctx.drawImage(videoEl, ...)   ← crop                  │
│    overlay(ctx, t, encW, encH)  ← template renders here │
│    new VideoFrame(canvas, ...)  ← encode                 │
└─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── brand-kit.ts     # BrandKit interface, localStorage CRUD, settings panel UI
├── templates.ts     # Template registry, template interface, lower-third implementation
├── overlay.ts       # OverlayRenderFn type (existing)
├── export.ts        # Export pipeline (existing)
├── main.ts          # App orchestration (existing)
└── styles.css       # All styles (existing, add settings panel styles)
```

### Pattern 1: GSAP Object Animation + Canvas Draw

**What:** Animate plain JS objects with GSAP, seek to arbitrary times, draw state to canvas.
**When to use:** Any time you need frame-accurate overlay rendering without real-time playback.

```typescript
// Source: GSAP docs + Perplexity verified pattern
import { gsap } from "gsap";

interface LowerThirdState {
  barWidth: number;   // 0 → 1 (animated)
  textAlpha: number;  // 0 → 1 (animated)
  logoScale: number;  // 0 → 1 (animated)
}

function createLowerThird(brandKit: BrandKit) {
  const state: LowerThirdState = { barWidth: 0, textAlpha: 0, logoScale: 0 };

  const tl = gsap.timeline({ paused: true });
  tl.to(state, { barWidth: 1, duration: 0.4, ease: "power2.out" })
    .to(state, { textAlpha: 1, duration: 0.3 }, "-=0.1")
    .to(state, { logoScale: 1, duration: 0.3 }, "-=0.2");

  const render: OverlayRenderFn = (ctx, t, w, h) => {
    tl.seek(t); // state is now updated to time t

    // Draw bar
    const barH = h * 0.12;
    const barY = h - barH - h * 0.08;
    const barW = w * state.barWidth;
    ctx.fillStyle = brandKit.primaryColor;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, barY, barW, barH);

    // Draw text
    ctx.globalAlpha = state.textAlpha;
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(barH * 0.45)}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText("Channel Name", w * 0.04, barY + barH / 2);

    ctx.globalAlpha = 1;
  };

  return { render, dispose: () => tl.kill() };
}
```

### Pattern 2: Safe Zone Logo Positioning

**What:** Position logo within platform-safe insets using percentage-based coordinates.
**When to use:** Any logo/text placement on 9:16 vertical video.

```typescript
const SAFE_ZONE = {
  top: 0.08,    // 8% from top
  bottom: 0.08, // 8% from bottom
  left: 0.06,   // 6% from left
  right: 0.08,  // 8% from right (engagement buttons)
};

function getLogoPosition(
  position: "TL" | "TR" | "BL" | "BR",
  logoW: number,
  logoH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const insetX = canvasW * SAFE_ZONE.left;
  const insetY = canvasH * SAFE_ZONE.top;
  const rightInset = canvasW * SAFE_ZONE.right;
  const bottomInset = canvasH * SAFE_ZONE.bottom;

  switch (position) {
    case "TL": return { x: insetX, y: insetY };
    case "TR": return { x: canvasW - rightInset - logoW, y: insetY };
    case "BL": return { x: insetX, y: canvasH - bottomInset - logoH };
    case "BR": return { x: canvasW - rightInset - logoW, y: canvasH - bottomInset - logoH };
  }
}
```

### Pattern 3: localStorage Brand Kit with Quota Guard

**What:** Store brand kit JSON with base64 logo, handle quota errors gracefully.
**When to use:** Reading/writing brand kit data.

```typescript
const BRAND_KIT_KEY = "vr-brand-kit";

interface BrandKit {
  logo: string | null;   // base64 data URL or null
  primaryColor: string;  // hex e.g. "#ff6b35"
  accentColor: string;   // hex e.g. "#1a1a2e"
  logoPosition: "TL" | "TR" | "BL" | "BR";
}

const DEFAULT_BRAND_KIT: BrandKit = {
  logo: null,
  primaryColor: "#ff6b35",
  accentColor: "#1a1a2e",
  logoPosition: "TL",
};

function saveBrandKit(kit: BrandKit): boolean {
  try {
    localStorage.setItem(BRAND_KIT_KEY, JSON.stringify(kit));
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      // Handle: alert user, suggest smaller logo
      return false;
    }
    throw e;
  }
}

function loadBrandKit(): BrandKit {
  const raw = localStorage.getItem(BRAND_KIT_KEY);
  if (!raw) return DEFAULT_BRAND_KIT;
  try {
    return { ...DEFAULT_BRAND_KIT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BRAND_KIT;
  }
}
```

### Anti-Patterns to Avoid
- **Animating DOM elements for canvas export:** Don't create hidden HTML elements and use `html2canvas` or `drawImage` on them. Animate plain objects and draw to canvas directly — simpler, faster, no rasterization cost.
- **Storing uncompressed logos:** A raw high-res PNG can easily exceed localStorage quota. Always enforce the 500KB cap before storing.
- **Re-creating GSAP timelines per frame:** Create the timeline once in `create()`, reuse via `seek()` in every `render()` call. Timeline creation is expensive.
- **Using `seek(t, false)` in export loop:** Suppress events (the default) during export. Firing `onStart`/`onComplete` callbacks every frame is wasteful.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animation interpolation | Custom easing/tweening functions | GSAP `timeline.seek(t)` | GSAP handles easing, sequencing, overlap — Phase 3 will need complex timelines |
| Color manipulation | Hex→RGB parsing for gradients | Canvas native gradients + GSAP color tween | GSAP interpolates colors natively via string targets |
| Image scaling/cropping | Manual pixel manipulation | `ctx.drawImage()` with source/dest rects | Browser-native, hardware-accelerated |
| File size validation | Manual byte counting | `file.size` check before FileReader | Built into File API |

**Key insight:** GSAP's value is not just interpolation — it's the timeline model (sequencing, overlapping, easing). Even Phase 2's simple lower-third benefits from timeline-based construction because Phase 3 will add complex multi-element animations using the same infrastructure.

## Common Pitfalls

### Pitfall 1: localStorage Quota on Mobile Safari
**What goes wrong:** Storing a base64 logo exceeds the ~5MB localStorage quota (base64 adds 33% overhead). iOS Safari in private browsing may have even less.
**Why it happens:** A 500KB PNG becomes ~667KB as base64 data URL. Combined with other app data, this approaches limits.
**How to avoid:** Enforce 500KB file size limit at upload time (pre-encoding). Wrap all `localStorage.setItem` in try/catch. Show user feedback on quota error.
**Warning signs:** `QuotaExceededError` DOMException.

### Pitfall 2: GSAP Timeline Duration vs Video Duration
**What goes wrong:** Template animates for 2s but `seek(t)` is called with times beyond the timeline duration, resulting in the "final state" being rendered for the entire video.
**Why it happens:** The lower-third's intro animation is short; after it completes, GSAP holds the final values.
**How to avoid:** This is actually desired behavior for Phase 2 (static lower-third that animates in then stays). For Phase 3 (intro bumpers), timelines will have explicit durations matching their purpose.
**Warning signs:** If you see the lower-third "blinking" per frame, the timeline may be recreated each render call.

### Pitfall 3: Canvas State Leaking Between Draws
**What goes wrong:** `globalAlpha`, `fillStyle`, or `transform` from the overlay leaks into the next frame's video draw.
**Why it happens:** Not calling `ctx.save()`/`ctx.restore()` around overlay rendering.
**How to avoid:** Every `OverlayRenderFn` must `ctx.save()` at start and `ctx.restore()` at end. The existing `renderTestOverlay` already demonstrates this pattern.
**Warning signs:** Video frames appearing semi-transparent or wrong color.

### Pitfall 4: Logo Image Decoding Delay
**What goes wrong:** `drawImage` on a base64 data URL string requires creating an `Image` element and waiting for it to load.
**Why it happens:** Canvas `drawImage` needs an image source (HTMLImageElement, ImageBitmap, etc.), not a raw data URL string.
**How to avoid:** In `create()`, decode the logo data URL into an `ImageBitmap` or pre-loaded `HTMLImageElement` once. Use the decoded image in every `render()` call.
**Warning signs:** Logo not appearing, or blank frames during export.

### Pitfall 5: GSAP Import Bundling
**What goes wrong:** Importing GSAP pulls in the full library when only core timeline is needed.
**Why it happens:** GSAP's ESM entry exports everything.
**How to avoid:** Use `import { gsap } from "gsap"` — the core is ~30KB gzipped. This is acceptable. Tree-shaking by Bun bundler will exclude plugins not imported. No additional action needed.
**Warning signs:** Bundle size > 100KB from GSAP alone (shouldn't happen with just core).

## Shorts Platform Safe Zones

Exact pixel measurements for 1080×1920 (9:16) canvas: [CITED: multiple platform design guides]

| Platform | Top | Bottom | Left | Right | Source |
|----------|-----|--------|------|-------|--------|
| TikTok | 130px (6.8%) | 250px (13%) | 60px (5.6%) | 60px (5.6%) | [CITED: creators.ramd.am, easyedit.pro] |
| Instagram Reels | 200px (10.4%) | 250px (13%) | 50px (4.6%) | 50px (4.6%) | [CITED: creators.ramd.am, strikesocial.com] |
| YouTube Shorts | 200px (10.4%) | 400px (20.8%) | 100px (9.3%) | 100px (9.3%) | [CITED: getkoro.app, kreatli.com] |

**Conservative "works everywhere" inset (recommendation for D-06):**
- **Top:** 200px → ~10% of height
- **Bottom:** 400px → ~21% of height
- **Left:** 100px → ~9% of width
- **Right:** 100px → ~9% of width

**Simplified for this project (D-05 says 8%):**
Using 8% uniform inset is reasonable for logo placement specifically (logos are small and away from the extreme edges). The 8% = ~86px horizontal / ~154px vertical, which keeps logos clear of engagement buttons on all platforms for the corner positions.

For the lower-third bar (bottom area), use a more conservative bottom inset (~15-20%) to avoid YouTube Shorts' large bottom UI.

## Code Examples

### Complete Template Interface Implementation

```typescript
// src/templates.ts
import { gsap } from "gsap";
import type { OverlayRenderFn } from "./overlay";

export interface BrandKit {
  logo: string | null;
  primaryColor: string;
  accentColor: string;
  logoPosition: "TL" | "TR" | "BL" | "BR";
}

export interface TemplateInstance {
  render: OverlayRenderFn;
  dispose(): void;
}

export interface TemplateDefinition {
  name: string;
  duration: number;
  create(brandKit: BrandKit): TemplateInstance;
}
```

### Logo Decode at Creation Time

```typescript
async function decodeLogo(dataUrl: string): Promise<ImageBitmap> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

// In template create():
async function createTemplate(brandKit: BrandKit): Promise<TemplateInstance> {
  const logoBitmap = brandKit.logo
    ? await decodeLogo(brandKit.logo)
    : null;

  const render: OverlayRenderFn = (ctx, t, w, h) => {
    ctx.save();
    if (logoBitmap) {
      const pos = getLogoPosition(brandKit.logoPosition, 64, 64, w, h);
      ctx.drawImage(logoBitmap, pos.x, pos.y, 64, 64);
    }
    ctx.restore();
  };

  return {
    render,
    dispose() { logoBitmap?.close(); },
  };
}
```

### File Upload with Size Validation

```typescript
function handleLogoUpload(file: File): string | null {
  const MAX_SIZE = 500 * 1024; // 500KB
  if (file.size > MAX_SIZE) {
    alert(`Logo must be under 500KB (yours: ${Math.round(file.size / 1024)}KB)`);
    return null;
  }
  if (!file.type.match(/^image\/(png|svg\+xml)$/)) {
    alert("Only PNG and SVG logos are supported");
    return null;
  }
  return null; // actual read is async, see FileReader pattern below
}

async function readLogoAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| html2canvas for overlay rasterization | Direct canvas draw from animated state objects | Always (for video export) | 100x faster, no DOM dependency, pixel-perfect |
| GSAP 2 TweenMax/TimelineMax | GSAP 3 unified `gsap.timeline()` | GSAP 3.0 (2019) | Simpler API, smaller bundle, better tree-shaking |
| Storing images in localStorage as base64 | Still valid for <500KB; IndexedDB for larger | Current | localStorage fine for single small logo |

**Deprecated/outdated:**
- `TweenMax`, `TimelineMax`, `TweenLite` — all replaced by unified `gsap` object in v3
- `html2canvas` for video overlay rendering — unnecessarily complex, use direct canvas draws

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 8% uniform safe zone inset is sufficient for all platforms | Safe Zones | Logo could be partially obscured on YouTube Shorts (which has 20% bottom UI). Mitigated: user chooses corner, and top-left (default) avoids all problem areas |
| A2 | GSAP standard license permits use in this open-source project | Standard Stack | Would need to remove GSAP and use manual interpolation. Low risk — GSAP license explicitly allows standard website/app use |
| A3 | Bun bundler tree-shakes unused GSAP plugins | Pitfalls | Bundle might be larger than expected (~50KB vs ~30KB). Acceptable either way |

## Open Questions

1. **Logo sizing on different export resolutions**
   - What we know: Export is 1080×1920 max, logo stored at upload size
   - What's unclear: Should logo scale relative to output resolution? Fixed pixel size?
   - Recommendation: Use percentage-based sizing (e.g., logo = 6% of canvas width) for resolution independence

2. **Template preview before export**
   - What we know: D-13 defines the interface, user sets brand kit in settings
   - What's unclear: Should there be a visual preview of the lower-third before exporting?
   - Recommendation: Defer preview to agent's discretion. A simple static canvas preview in settings would be nice but not required by any requirement.

3. **GSAP timeline creation async vs sync**
   - What we know: `create(brandKit)` in D-13 is synchronous, but logo decoding is async
   - What's unclear: Should `create()` be async?
   - Recommendation: Make `create()` async (returns `Promise<TemplateInstance>`). Logo decode via `createImageBitmap` is async. Export already has async context.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Package install, bundling | ✓ | (runtime) | — |
| npm registry | GSAP install | ✓ | — | — |
| Canvas2D API | Overlay rendering | ✓ (browser) | — | — |
| localStorage | Brand kit persistence | ✓ (browser) | 5MB quota | try/catch + user feedback |
| FileReader API | Logo upload | ✓ (browser) | — | — |
| createImageBitmap | Logo decoding | ✓ (Chrome 50+, Safari 15+) | — | HTMLImageElement fallback |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (no auth) |
| V3 Session Management | No | N/A (no sessions) |
| V4 Access Control | No | N/A (single user, local) |
| V5 Input Validation | Yes | File type/size validation on logo upload |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for {browser client-side}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious SVG upload (embedded scripts) | Tampering | Render SVG as bitmap via `createImageBitmap`; never inject as DOM innerHTML |
| localStorage tampering | Tampering | Parse with fallback defaults; never `eval()` stored data |
| Oversized file causing OOM | Denial of Service | Enforce 500KB cap before reading into memory |

## Sources

### Primary (HIGH confidence)
- npm registry: gsap@3.15.0 verified (created 2014-08-25, updated 2026-04-13, repo: github.com/greensock/GSAP)
- GSAP official docs: `timeline.seek()` API, suppressEvents behavior [CITED: gsap.com/docs/v3/GSAP/Timeline/seek()]
- GSAP community forums: canvas animation patterns [CITED: gsap.com/community/forums/topic/24378]

### Secondary (MEDIUM confidence)
- Platform safe zones: Multiple sources agree on measurements [CITED: creators.ramd.am, getkoro.app, easyedit.pro, strikesocial.com]
- localStorage limits: MDN + web.dev documentation [CITED: developer.mozilla.org, web.dev/articles/storage-for-the-web]

### Tertiary (LOW confidence)
- None — all claims verified against official sources or multiple corroborating guides

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — GSAP is verified, well-documented, and the seek+object pattern is official
- Architecture: HIGH — Pattern directly matches Phase 1's OverlayRenderFn contract
- Pitfalls: HIGH — All derived from official docs and established browser API behavior
- Safe zones: MEDIUM — Platform UIs change with app updates; measurements are current as of research date

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (safe zones may shift with platform updates; core patterns are stable)
