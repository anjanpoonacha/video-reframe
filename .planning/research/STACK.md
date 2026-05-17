# Stack Research

**Project:** Video Reframe — PWA with branded overlays
**Domain:** Browser-based video composition, mobile-first
**Researched:** 2025-05-17
**Target:** 1080x1920 portrait output, Snapdragon 770-class Android

---

## Recommended Stack

### Rendering Pipeline

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| WebCodecs API | Chrome 147+ | Decode/encode video frames | Only viable path for frame-level video manipulation client-side. H.264 HW-accelerated on target devices. |
| Canvas 2D | — | Composite overlays onto decoded frames | Simpler than WebGL for text/logo overlays. Avoids WebGL context limits. Sufficient for <10 overlay elements per frame. |
| OffscreenCanvas + Worker | — | Move composition off main thread | Keeps UI responsive during export. Well-supported on Chrome Android. |
| GSAP 3.x | 3.12+ | Kinetic typography / motion design | Free for commercial use. Best-in-class timeline API. Deterministic — can seek to any timestamp for frame-by-frame capture. |
| Lottie (lottie-web) | 5.12+ | Pre-designed animated brand elements | Small file size, vector-based, designer-friendly pipeline (After Effects → Bodymovin → JSON). |

### Encoding

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| VideoEncoder (WebCodecs) | — | Encode composited frames to H.264 | HW-accelerated on Snapdragon. Use `avc1.42E01E` baseline profile for max compatibility. |
| MP4 muxer (mp4-muxer) | 5.x | Mux encoded chunks into MP4 | Lightweight, no WASM. Works with WebCodecs VideoEncoder output directly. |

### Animation Authoring

| Technology | Purpose | Notes |
|------------|---------|-------|
| GSAP | Programmatic kinetic text, position/scale/opacity tweens | Seek to frame timestamp → render to canvas |
| Lottie JSON | Designer-created branded animations (logos, intros) | Render frame at specific time via `goToAndStop()` |

---

## Library Versions

| Package | npm | Min Version | Notes |
|---------|-----|-------------|-------|
| gsap | `gsap` | 3.12.0 | Free license covers this use case. No competing-tool restriction applies. |
| lottie-web | `lottie-web` | 5.12.0 | Use `svg` renderer for preview, `canvas` renderer for export compositing. |
| mp4-muxer | `mp4-muxer` | 5.0.0 | Pure JS MP4 muxing. No ffmpeg.wasm needed for simple cases. |
| @aspect-build/rules_js | — | — | NOT needed — Bun handles bundling |

### Browser Requirements
- Chrome Android 147+ (WebCodecs full support)
- `VideoEncoder.isConfigSupported()` for runtime capability check
- `OffscreenCanvas` (Chrome 69+, well-supported)
- Cross-Origin Isolation headers (COOP/COEP) if using SharedArrayBuffer

---

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| **Hyperframes (HeyGen)** | Server-side headless Chromium + FFmpeg pipeline. NOT a client-side rendering solution. Requires `npx hyperframes render` on a server with Puppeteer. Useless for on-device PWA rendering. |
| **Remotion** | React-based but renders via headless browser on server. Same problem as Hyperframes — designed for server-side video generation, not mobile client-side composition. |
| **ffmpeg.wasm** | 25MB+ WASM payload. Slow to load on mobile. Requires SharedArrayBuffer + COOP/COEP. WebCodecs is faster and lighter for encode/decode. Only use if you need format conversion WebCodecs can't handle. |
| **WebGL for overlays** | Overkill for <10 text/logo elements. Context creation is slow on mobile. Context limits (max 8-16 per page) create fragility. Canvas 2D is faster for this workload. |
| **Rive** | Better than Lottie for interactive state machines, but overlays here are passive playback animations — Lottie's simpler pipeline wins. Designer tooling (After Effects) is more established. |
| **IMG.LY CreativeEditor SDK** | Full editor component, not a compositing library. Heavy, opinionated, wrong abstraction level. |
| **CSS Animations for export** | Cannot be rendered frame-by-frame deterministically without a headless browser. GSAP's `.seek()` can. |
| **MediaRecorder API** | Records in real-time only. For frame-by-frame composition at arbitrary speed, WebCodecs + manual encode is required. |

---

## Performance Notes for Mobile

### Snapdragon 770 Realities

**Decode:** H.264 1080p30 hardware decode is reliable. H.265/HEVC decode also available. VP9 may fall back to software.

**Encode:** H.264 1080p30 hardware encode works but is NOT guaranteed. Always check:
```js
const supported = await VideoEncoder.isConfigSupported({
  codec: "avc1.42E01E",  // Baseline profile
  width: 1080,
  height: 1920,
  bitrate: 8_000_000,
  framerate: 30,
});
```

**Canvas 2D at 1080x1920:** Feasible for simple overlays (logo + 2-3 text elements). Budget ~4-8ms per frame for overlay drawing. Total frame budget at 30fps = 33ms.

### Frame Pipeline Budget (30fps target)

| Step | Budget | Notes |
|------|--------|-------|
| VideoDecoder → VideoFrame | ~5ms | HW-accelerated, mostly free |
| Draw frame to canvas | ~3ms | `ctx.drawImage(videoFrame, ...)` |
| GSAP seek + render text | ~4ms | Transform-only tweens; avoid filters/shadows |
| Lottie render overlay | ~3ms | Simple vector; `goToAndStop(frame)` |
| Create new VideoFrame from canvas | ~2ms | `new VideoFrame(canvas, { timestamp })` |
| VideoEncoder.encode() | ~8ms | HW path; may spike on keyframes |
| **Total** | **~25ms** | Leaves ~8ms headroom |

### Critical Mobile Optimizations

1. **Use OffscreenCanvas in a Worker** — Moves all composition off main thread. UI stays responsive during export.
2. **Batch frame processing** — Don't await each encode; queue frames and let encoder drain asynchronously.
3. **Avoid per-frame allocations** — Reuse canvas, pre-create text styles, cache logo ImageBitmap.
4. **GSAP: transform-only tweens** — `x`, `y`, `scale`, `rotation`, `opacity`. Never `filter`, `boxShadow`, `blur`.
5. **Limit Lottie complexity** — <50 shapes, no masks, no expressions. Test on real device.
6. **Thermal throttling** — Sustained encoding will heat the device. Process in chunks with brief pauses if export >30s.
7. **Memory management** — Always `frame.close()` after use. VideoFrames leak GPU memory fast.
8. **Progressive fallback** — If `VideoEncoder.isConfigSupported()` returns false for 1080p, fall back to 720p encode.

### Architecture Pattern

```
Main Thread                    Worker Thread
─────────────                  ─────────────
UI / Preview                   OffscreenCanvas
  │                              │
  ├─ User taps "Export"          │
  │                              │
  ├──── postMessage(config) ────►│
  │                              ├─ VideoDecoder (HW)
  │                              ├─ drawImage(frame)
  │                              ├─ GSAP.seek(t) → draw text
  │                              ├─ Lottie.goToAndStop(t)
  │                              ├─ new VideoFrame(canvas)
  │                              ├─ VideoEncoder.encode()
  │                              │
  │◄── postMessage(progress) ────┤
  │                              │
  │◄── transferable(mp4Blob) ────┤
  ▼                              ▼
Download / Share               Done
```

### Codec Recommendation

Use **H.264 Baseline** (`avc1.42E01E`) for maximum device compatibility:
- Hardware encode support on nearly all Android devices
- Plays everywhere (WhatsApp, Instagram, any player)
- Baseline profile avoids B-frames which simplify encoding

For higher quality at same bitrate, try **H.264 High** (`avc1.640028`) but verify support first.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| WebCodecs as core pipeline | HIGH | W3C standard, Chrome 147+ on Android, well-documented |
| Canvas 2D for overlay compositing | HIGH | Proven pattern, sufficient for this workload |
| GSAP for kinetic text | HIGH | Free, deterministic seek, transform tweens are GPU-composited |
| Lottie for brand animations | MEDIUM | Works well if animations are kept simple; complex ones lag on mobile |
| Hardware encode on Snapdragon 770 | MEDIUM | Likely but not guaranteed; runtime check required |
| OffscreenCanvas in Worker | HIGH | Chrome Android 69+, stable, well-tested pattern |
| Hyperframes = not usable client-side | HIGH | Confirmed server-only (Puppeteer + FFmpeg pipeline) |

---

## Sources

- WebCodecs: https://developer.chrome.com/docs/web-platform/best-practices/webcodecs
- WebCodecs browser support: https://caniuse.com/webcodecs
- GSAP license: https://gsap.com/pricing/ (free for commercial use as of 2025)
- Hyperframes: https://github.com/heygen-com/hyperframes (headless Chromium rendering)
- OffscreenCanvas: https://web.dev/articles/offscreen-canvas
- mp4-muxer: https://github.com/niccokunzmann/mp4-muxer
- Lottie-web: https://github.com/airbnb/lottie-web
- Qualcomm MediaCodec: https://www.qualcomm.com/developer/blog/2023/07/building-media-rich-android-apps-mediacodec-and-vendor-extensions
