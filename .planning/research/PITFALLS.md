# Pitfalls Research: Browser-Based Video Overlay on Mobile

**Domain:** PWA video compositing with animated overlays
**Target Device:** Snapdragon 770 / Adreno 619 / 4-6GB RAM
**Constraint:** 60-second 1080x1920 export, must not crash
**Researched:** 2026-05-17
**Overall Confidence:** HIGH (verified via official docs, Chromium issues, WebKit bugs)

---

## Critical (Will Break on Mobile)

### 1. VideoFrame Memory Leak — Unbounded Frame Accumulation

**What goes wrong:** VideoFrame objects hold GPU-backed memory (~7.9 MiB per 1080x1920 RGBA frame). If you don't call `frame.close()` immediately after use, or if the encoder queue grows unbounded, the browser tab crashes with OOM.

**Why it happens:** VideoFrame.close() is easy to miss in error paths, transform chains, or when frames are passed between workers. The garbage collector does NOT reliably free GPU memory — explicit close is mandatory.

**Consequences:** Browser tab crash, OS-level low-memory kill on Android (no graceful recovery).

**Prevention:**
```js
// Always close in finally blocks
try {
  encoder.encode(frame);
} finally {
  frame.close();
}
```

**Detection:** Memory grows linearly during export. Chrome DevTools → Performance Monitor → GPU Memory.

**Severity on target device:** At 30fps, 10 leaked frames = ~79 MiB. With 4GB RAM and OS overhead, you have maybe 1-2GB headroom. 150 leaked frames (~1.2 GB) = crash within 5 seconds of export.

---

### 2. Encoder Backpressure — Queue Overflow on Slower Hardware

**What goes wrong:** Frame production outpaces encoder throughput. The `encodeQueueSize` grows unbounded, each queued frame holding a full-resolution buffer. Adreno 619 hardware encoder is slower than desktop GPUs.

**Why it happens:** Desktop dev machines encode faster than frames arrive. On Snapdragon 770, hardware H.264 encoding at 1080x1920@30fps is near the ceiling — any overlay compositing delay creates bursts that pile up.

**Consequences:** Sudden memory spike → crash. Or encoder silently drops frames producing choppy output.

**Prevention:**
```js
const MAX_QUEUE = 2; // Conservative for mobile

function submitFrame(frame) {
  if (encoder.encodeQueueSize >= MAX_QUEUE) {
    // Wait, don't drop — use a promise-based throttle
    await waitForQueueDrain();
  }
  encoder.encode(frame);
  frame.close();
}
```

**Detection:** Monitor `encoder.encodeQueueSize` in production. Alert if > 3.

---

### 3. Safari iOS — flush() Hangs Forever

**What goes wrong:** `VideoEncoder.flush()` never resolves on certain Safari iOS versions (16.4–18.x). The export process hangs indefinitely at the end.

**Why it happens:** WebKit WebCodecs implementation has bugs around state transitions and flush synchronization. Safari's support is partial (video only, no audio WebCodecs until Safari 26.0).

**Consequences:** Export appears to hang at 99%. User force-closes the app. No encoded output produced.

**Prevention:**
```js
// Don't rely on flush() as the completion signal on Safari
let pendingFrames = 0;

const encoder = new VideoEncoder({
  output(chunk) {
    pendingFrames--;
    muxer.addChunk(chunk);
    if (pendingFrames === 0) onComplete();
  },
  error(e) { onError(e); }
});

// Track submissions
function encode(frame) {
  pendingFrames++;
  encoder.encode(frame);
  frame.close();
}

// Timeout-based fallback for flush
const flushTimeout = Promise.race([
  encoder.flush(),
  new Promise((_, reject) => setTimeout(() => reject('flush_timeout'), 5000))
]);
```

**Detection:** Feature-detect Safari with UA + test `flush()` with a single frame during init.

---

### 4. Safari iOS — No AudioEncoder/AudioDecoder (Pre-Safari 26)

**What goes wrong:** Code assumes full WebCodecs support after detecting VideoEncoder. AudioEncoder/AudioDecoder are `undefined` on Safari 16.4–18.x.

**Why it happens:** Safari shipped video WebCodecs first; audio came later in Safari 26.0.

**Consequences:** Runtime error when trying to encode audio track. Export produces silent video or crashes.

**Prevention:** Always check each constructor independently:
```js
const hasVideoEncoder = typeof VideoEncoder !== 'undefined';
const hasAudioEncoder = typeof AudioEncoder !== 'undefined';
// Fall back to MediaRecorder or server-side for audio on older Safari
```

---

### 5. GPU Memory Exhaustion with Multiple Full-Resolution Buffers

**What goes wrong:** Compositing pipeline keeps multiple 1080x1920 canvases alive simultaneously: source video frame + overlay canvas + composited output + encoder input buffer. Each RGBA buffer = ~7.9 MiB on GPU.

**Why it happens:** Adreno 619 shares system memory with GPU (no dedicated VRAM). Android OOM killer is aggressive — the browser process gets killed without warning.

**Consequences:** App disappears mid-export. No error handler fires.

**Prevention:**
- Maximum 2-3 full-res buffers alive at any moment
- Reuse a single OffscreenCanvas for compositing (don't create new ones per frame)
- Use `canvas.width = canvas.width` to force deallocation when done
- Prefer WebGL textures with explicit `deleteTexture()` over 2D canvases

**Budget calculation for 60s@30fps on Snapdragon 770:**
- 3 concurrent RGBA 1080x1920 buffers = ~24 MiB GPU
- Encoder internal buffers = ~15-30 MiB
- Source video decode buffers = ~15-30 MiB
- Total pipeline: ~60-85 MiB — safe within budget
- Danger zone: >150 MiB concurrent = risk of kill

---

## Moderate (Degraded Experience)

### 6. html2canvas Fails on iOS Safari with foreignObject

**What goes wrong:** Using `foreignObjectRendering: true` produces blank/corrupt output on iOS Safari. Custom fonts render as system defaults. Background images disappear.

**Why it happens:** Safari's foreignObject SVG rendering has long-standing bugs with fonts, images, and CORS resources.

**Consequences:** Overlay text renders in wrong font or not at all. Users see broken preview vs. what they designed.

**Prevention:**
- Never use `foreignObjectRendering: true` — always set to `false`
- Pre-render overlays to canvas using Canvas 2D API directly
- If using html2canvas at all, use the DOM-walking renderer (slower but reliable)
- **Best approach:** Skip html2canvas entirely. Render overlay elements directly to canvas with custom drawing code.

---

### 7. Custom Fonts Not Available During Canvas Draw

**What goes wrong:** `ctx.fillText()` renders in fallback font because the custom font hasn't loaded yet, or the font name doesn't exactly match.

**Why it happens:** Canvas text rendering uses whatever font is available at draw time. Unlike DOM rendering, there's no automatic re-paint when fonts load. On iOS, `document.fonts.ready` can resolve before fonts are actually usable in canvas.

**Consequences:** Exported video has wrong typography. Particularly bad for branded content.

**Prevention:**
```js
// Load explicitly via FontFace API
const font = new FontFace('BrandFont', 'url(/fonts/brand.woff2)');
const loaded = await font.load();
document.fonts.add(loaded);

// Double-check: measure text width to confirm font is active
ctx.font = '48px BrandFont';
const testWidth = ctx.measureText('W').width;
// Compare against known width for this font — if default, retry
```

**Additional iOS quirk:** Pre-render a hidden DOM element with the font to force iOS to rasterize it before canvas use.

---

### 8. GSAP Ticker vs. Export Pipeline Conflict

**What goes wrong:** GSAP's ticker (which drives all animations) is tied to `requestAnimationFrame`. During export, you need to step through animation frames at a fixed rate regardless of wall-clock time. GSAP animations play at wrong speed or skip during export.

**Why it happens:** rAF doesn't fire at consistent intervals under load. GSAP uses delta-time by default. Export needs deterministic frame stepping.

**Consequences:** Overlay animations are out of sync with video. Animations run too fast or too slow in export vs. preview.

**Prevention:**
```js
// During export: disable GSAP's ticker and manually seek
gsap.ticker.sleep(); // Pause auto-updates

for (let frame = 0; frame < totalFrames; frame++) {
  const time = frame / fps;
  gsap.globalTimeline.seek(time); // Deterministic seek
  renderFrame(); // Draw canvas at this exact time
  await encodeFrame();
}

gsap.ticker.wake(); // Resume after export
```

---

### 9. OffscreenCanvas WebGL Not Available on Older iOS

**What goes wrong:** Code paths that use `OffscreenCanvas.getContext('webgl')` in a Worker return `null` on iOS Safari < 17.

**Why it happens:** Safari 16.4 added OffscreenCanvas but only for 2D context. WebGL in OffscreenCanvas came in Safari 17+.

**Consequences:** Worker-based GPU compositing silently fails. Falls back to main thread, causing jank or crash.

**Prevention:**
```js
// Feature detect before relying on it
function supportsOffscreenWebGL() {
  try {
    const canvas = new OffscreenCanvas(1, 1);
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return !!gl;
  } catch { return false; }
}

// Fallback: use main-thread canvas with transferControlToOffscreen for 2D
```

---

### 10. Frame Timing Drift in Long Exports

**What goes wrong:** Using wall-clock time or rAF timestamps for frame generation causes drift over 60 seconds. Frame N might be at t=1.98s instead of t=2.00s, causing visible stutter in overlay animations.

**Why it happens:** `performance.now()` drift, rAF not firing at exact intervals, GC pauses creating time jumps.

**Consequences:** Overlay animations jitter or desync from video by end of 60-second clip.

**Prevention:**
```js
// Never use wall-clock for export frame timing
// Use integer frame counter with fixed FPS
const fps = 30;
for (let i = 0; i < totalFrames; i++) {
  const exactTime = i / fps; // Perfectly deterministic
  seekVideoTo(exactTime);
  seekOverlayTo(exactTime);
  composite();
  encode();
}
```

---

### 11. Canvas Composite Operations Expensive on Mobile GPU

**What goes wrong:** Using `globalCompositeOperation` modes like `multiply`, `screen`, `overlay` on mobile triggers software fallback or extreme slowdown.

**Why it happens:** Mobile GPUs (Adreno 619) have limited blend mode support in hardware. Complex blend modes fall back to CPU compositing.

**Consequences:** Frame generation time exceeds 33ms budget. Export takes 10x longer than expected.

**Prevention:**
- Stick to `source-over` (default) for overlay compositing
- If blend modes are needed, use WebGL shaders instead of Canvas 2D blend modes
- Pre-composite blend effects into the overlay PNG/texture

---

## Low Risk (Edge Cases)

### 12. CORS Taint on Video Frames

**What goes wrong:** Drawing a cross-origin video to canvas taints it, preventing `toDataURL()` or `VideoFrame` creation from that canvas.

**Why it happens:** Video source doesn't have proper CORS headers. Common with user-uploaded content served from CDN.

**Prevention:** Always serve video with `Access-Control-Allow-Origin`. Set `video.crossOrigin = 'anonymous'`.

---

### 13. H.264 Codec String Variations Across Browsers

**What goes wrong:** `VideoEncoder.isConfigSupported({codec: 'avc1.42E01E'})` returns `true` on Chrome but the specific profile/level combo fails on Safari.

**Why it happens:** Safari supports H.264 but with different profile/level strings than Chrome. Mobile hardware may not support High Profile.

**Prevention:** Use Baseline Profile for maximum compatibility:
```js
const config = {
  codec: 'avc1.42001E', // Baseline Level 3.0
  width: 1080,
  height: 1920,
  bitrate: 8_000_000,
};
// Always verify before configure
const { supported } = await VideoEncoder.isConfigSupported(config);
```

---

### 14. Android WebView vs. Chrome — Different WebCodecs Behavior

**What goes wrong:** PWA installed via "Add to Home Screen" on some Android devices uses WebView instead of Chrome, which may have different WebCodecs support.

**Prevention:** Detect WebView environment and warn users to open in Chrome if critical APIs are missing.

---

### 15. Video Rotation Metadata Not Handled by WebCodecs

**What goes wrong:** Phone-recorded video has rotation metadata (e.g., 90 degrees). `VideoDecoder` outputs frames without applying rotation. Overlay is composed at wrong orientation.

**Prevention:** Read rotation from MP4 metadata (via mp4box.js or similar demuxer) and apply transform matrix when drawing decoded frames to canvas.

---

## Prevention Strategies

### Memory Management Protocol

1. **Frame lifecycle rule:** Every `new VideoFrame()` or decoder output must have a corresponding `.close()` within the same tick or in a `finally` block
2. **Buffer cap:** Never exceed 3 concurrent full-resolution RGBA buffers
3. **Reuse, don't recreate:** One compositing canvas, one output canvas, reused every frame
4. **Explicit cleanup:** `encoder.close()`, `decoder.close()` when pipeline shuts down
5. **Monitor in production:** Log `encodeQueueSize` and frame count periodically

### Safari Compatibility Protocol

1. Feature-detect every WebCodecs interface independently
2. Never rely on `flush()` as sole completion signal — track pending count
3. Use `avc1` (H.264 Baseline) as primary codec, VP8 as fallback
4. Avoid OffscreenCanvas WebGL on iOS < 17 — fall back to 2D or main thread
5. Skip `foreignObjectRendering` entirely

### Export Pipeline Architecture

1. **Deterministic timing:** Integer frame counter, not wall-clock
2. **Backpressure:** Throttle frame production to encoder speed
3. **Single-threaded fallback:** If Worker/OffscreenCanvas unavailable, run on main thread with chunked processing (encode N frames, yield to UI, repeat)
4. **Progress reporting:** Report actual encoded frame count, not estimated time
5. **Graceful degradation:** If device is too slow, offer 720p export option

### Font Safety Protocol

1. Load all custom fonts via FontFace API before export begins
2. Verify font is active by measuring text width against known value
3. Pre-render a hidden DOM element with each font to force iOS rasterization
4. Bundle font files with the PWA (service worker cache), never rely on CDN during export

### Testing Requirements

| Scenario | Must Pass |
|----------|-----------|
| 60s export on Snapdragon 770 | No crash, completes within 3x realtime |
| Export with 3 animated overlays | Memory stays under 200 MiB |
| Safari iOS 17 export | Produces valid MP4 with video |
| Network offline during export | Completes (all assets cached) |
| Low battery / power saver mode | Completes (slower is OK) |

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Video decode pipeline | Frame leak in error paths | Wrap all decode callbacks in try/finally with close() |
| Overlay animation system | GSAP ticker conflict with export | Implement manual seek mode for export vs. rAF for preview |
| Canvas compositing | GPU memory from multiple canvases | Single reusable compositing surface |
| Export/encoding | Encoder backpressure crash | Monitor encodeQueueSize, throttle at 2 |
| Font/text overlays | Wrong font in export | FontFace API load + verification before export |
| Safari support | flush() hang + no audio | Pending-count tracking + codec fallback |
| PWA offline | Missing font/asset during export | Service worker pre-cache all export-critical assets |

---

## Sources

- Chromium Issue #40944632 — WebCodecs resource exhaustion crashes
- Chromium Issue #404905689 — VideoFrame memory not freed
- W3C WebCodecs spec — frame lifecycle requirements
- WebKit Bug Reports — Safari flush() non-resolution
- Chrome DevRel — WebCodecs best practices (developer.chrome.com)
- MDN — VideoEncoder, VideoFrame, OffscreenCanvas documentation
- caniuse.com — OffscreenCanvas, WebCodecs browser support matrices
- html2canvas GitHub issues #1295, #2031, #3053 — Safari foreignObject failures
- GSAP forums — mobile performance threads, ticker conflicts
