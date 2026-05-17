# Research Summary

**Project:** Video Reframe — PWA with branded overlays
**Domain:** Browser-based mobile video composition with animated branding
**Researched:** 2026-05-17
**Confidence:** HIGH

## Recommended Approach

Video Reframe is a client-side video compositing tool that applies branded animated overlays (intros, lower thirds, text, logos) to short-form vertical video. The proven approach is: decode video frames via WebCodecs, composite overlays using Canvas 2D + GSAP-driven animations rasterized per-frame, then re-encode to H.264 MP4 — all on-device in a Worker thread.

The key architectural insight is that GSAP timelines are deterministic state machines. You can `seek(t)` to any time and get the exact same DOM state, then rasterize that DOM to a canvas bitmap. This eliminates the need for server-side rendering (Remotion, Hyperframes) and enables a fully offline PWA. The existing export loop already has the right shape — overlay rendering inserts between "draw video frame" and "encode VideoFrame" with minimal refactoring.

The primary risk is mobile memory constraints. Snapdragon 770 shares system RAM with GPU, and VideoFrame objects leak ~8MB each if not explicitly closed. A disciplined memory management protocol (close-in-finally, 2-frame encoder queue cap, single reusable canvas) is non-negotiable. Safari iOS has partial WebCodecs support with known flush() bugs — Chrome Android is the primary target.

## Stack

**Core rendering pipeline:**
- **WebCodecs (VideoDecoder/VideoEncoder)** — HW-accelerated H.264 decode/encode on Chrome Android 147+
- **Canvas 2D + OffscreenCanvas** — Composite overlays onto video frames in a Worker; simpler and more reliable than WebGL for <10 overlay elements
- **GSAP 3.12+** — Deterministic animation timelines with `seek(t, true)` for frame-by-frame export; free for commercial use
- **SnapDOM** — DOM-to-canvas rasterization at 150× html2canvas speed; critical for per-frame overlay capture
- **Lottie (lottie-web 5.12+)** — Pre-designed animated brand elements via After Effects → JSON pipeline
- **mp4-muxer 5.x** — Lightweight pure-JS MP4 muxing, no WASM

**What NOT to use:** Remotion/Hyperframes (server-only), ffmpeg.wasm (25MB+ payload), WebGL for overlays (overkill), MediaRecorder (real-time only), html2canvas (too slow for per-frame use).

**Codec:** H.264 Baseline `avc1.42E01E` for maximum Android device compatibility + universal playback.

## Key Features for v1

**Table stakes (missing = amateur):**
- Logo/watermark with position + opacity control
- Consistent color palette (3-5 color brand kit)
- Animated intro bumper (1-3s)
- Lower third with animated entrance
- Text overlays with brand fonts (hooks, CTAs)
- Proper 9:16 aspect ratio framing

**Differentiators ("After Effects feel, CapCut speed"):**
- Animated brand kit — logo animates in, text has entrance effects, configured once and applied everywhere
- Frame/border overlays — instant structure to raw phone footage
- Gradient/glow accents — cheap to render, massive perceived quality boost
- Energy level slider — "calm" to "hype" adjusts overlay intensity

**Killer UX principle:** Templates are "styles not layouts." User footage is the layout; templates define visual treatment. Layer-based brand kit (configured once) × overlay packs (mix-and-match) = combinatorial variety without template paralysis.

**Anti-features (don't build):** Captions, full NLE timeline, stock media, social scheduling, team collaboration, over-the-top particles.

## Architecture

The existing export loop (seek → draw → encode) gains a single injection point for overlay rendering between canvas draw and VideoFrame creation.

**Components:**
1. **Export Loop** — Orchestrates frame pipeline, manages seek/encode timing
2. **Overlay Renderer** — Drives paused GSAP timeline to time T, calls SnapDOM to rasterize container, returns ImageBitmap
3. **Template Loader** — Registry of lazy-loaded template modules (HTML + CSS + GSAP timeline factory); zero bundle cost until selected
4. **Composition Host** — Hidden fixed-position DOM container (1080×1920) where overlay HTML lives during export; must be in-document for layout/font computation
5. **Canvas Compositor** — Draws video frame + overlay bitmap onto single reusable canvas

**Key pattern:** Synchronous rasterization in the export loop (Option A). Pre-rendering all frames is infeasible (7GB+ memory). Each frame: `tl.seek(t)` → force reflow → SnapDOM → `ctx.drawImage(bitmap)` → close bitmap.

**Export speed:** ~60-170ms per frame = 6-16fps export = 60-150s for a 30s video. Acceptable for client-side.

## Critical Risks

1. **VideoFrame memory leak** — Each unclosed frame leaks ~8MB of GPU memory. 150 leaked frames = 1.2GB = crash within 5s. **Prevention:** `frame.close()` in every `finally` block, never pass frames without ownership transfer.

2. **Encoder backpressure crash** — Frame production outpaces Adreno 619 hardware encoder, queue grows unbounded. **Prevention:** Cap `encodeQueueSize` at 2, throttle frame submission with promise-based drain.

3. **GSAP ticker conflict during export** — GSAP's rAF-based ticker fights with deterministic frame stepping, causing animation desync. **Prevention:** `gsap.ticker.sleep()` during export, use integer frame counter `i/fps` for timing (never wall-clock).

4. **Font not loaded during canvas draw** — Canvas renders fallback font silently. Catastrophic for branded content. **Prevention:** FontFace API load + measureText verification before export begins.

5. **Safari iOS flush() hang** — `encoder.flush()` never resolves on Safari 16-18. **Prevention:** Track pending frame count via output callback, use timeout-based fallback. Target Chrome Android primarily.

## Build Order Recommendation

### Phase 1: Core Export Pipeline Enhancement
**Rationale:** The export loop already exists. Overlay rendering is a single injection point. Must validate SnapDOM performance and memory management on real device before building template UI.
**Delivers:** Overlay renderer with a single hardcoded test overlay composited into exports.
**Avoids:** VideoFrame leak, encoder backpressure (establishes memory protocol early).

### Phase 2: Brand Kit & Template System
**Rationale:** All visual features depend on brand kit (colors, fonts, logo). Template loading architecture must exist before building individual overlays.
**Delivers:** Brand kit setup UI, template registry, lazy-loading, composition host, 2-3 starter templates (intro, lower third, watermark).
**Avoids:** Font loading failures (establishes font safety protocol).

### Phase 3: Overlay Library & Motion Design
**Rationale:** With template system in place, add the features that create perceived quality — animated intros, text styles, frame overlays, gradient accents.
**Delivers:** 5-8 template variants, energy slider, frame/border overlays, animated icon set.
**Uses:** GSAP for all motion, Lottie for designer-created brand animations.

### Phase 4: Polish & Platform Hardening
**Rationale:** Safari compat, offline reliability, graceful degradation, thermal throttling — these are polish concerns that shouldn't block core development.
**Delivers:** Safari fallbacks, offline service worker caching, 720p fallback, progress UX, thermal pause logic.
**Avoids:** Safari flush() hang, WebView detection issues.

### Phase 5: Premium Features
**Rationale:** Beat-sync and stinger transitions require audio analysis and complex animation — high effort, high wow-factor, but not MVP.
**Delivers:** Beat-synced motion, stinger transitions, kinetic emphasis system.

### Research Flags

- **Phase 1:** Standard pattern — WebCodecs + SnapDOM integration is well-documented. Skip research.
- **Phase 2:** Needs research — template variable substitution patterns, brand kit data model, font subset strategy for PWA bundle size.
- **Phase 3:** Standard pattern — GSAP animation design is creative work, not technical uncertainty.
- **Phase 5:** Needs research — Web Audio API beat detection, audio analysis libraries for mobile.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | WebCodecs + Canvas 2D + GSAP is verified via official docs and multiple implementations |
| Features | HIGH | Clear market gap identified between CapCut (generic) and After Effects (expert). Feature priorities well-reasoned |
| Architecture | HIGH | Integration point identified in existing code. SnapDOM is the key bet (150× faster claim needs device validation) |
| Pitfalls | HIGH | Sources include Chromium bug tracker, WebKit bugs, W3C spec. Memory budgets calculated |

**Overall: HIGH**

### Gaps to Address

- **SnapDOM real-device performance:** 20-50ms per frame is a range — needs benchmarking on actual Snapdragon 770 to confirm export speed is acceptable
- **Lottie canvas renderer at 1080×1920:** Performance with brand animations under thermal load untested
- **Template variable system:** How brand kit values (colors/fonts) flow into GSAP timelines needs design during Phase 2 planning

## Sources

### Primary (HIGH confidence)
- WebCodecs: developer.chrome.com/docs/web-platform/best-practices/webcodecs
- GSAP Timeline.seek(): gsap.com/docs/v3/GSAP/Timeline/seek/
- SnapDOM: snapdom.dev / github.com/nicepkg/snapdom
- Chromium Issues: #40944632, #404905689 (WebCodecs resource exhaustion)
- W3C WebCodecs spec (frame lifecycle requirements)

### Secondary (MEDIUM confidence)
- gsap-video-export pattern: github.com/workeffortwaste/gsap-video-export
- mp4-muxer: github.com/niccokunzmann/mp4-muxer
- Short-form video best practices: spintadigital.com, freshcontentsociety.com

---
*Research completed: 2026-05-17*
*Ready for roadmap: yes*
