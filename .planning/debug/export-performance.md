# Export Performance: Approaches Tried

## The Problem

Exporting a 60s video at 30fps 720×1280 H.264.
- **Mac:** 10 seconds (acceptable)
- **Pixel 9 Pro:** 3-5 minutes (unacceptable)

Root cause: `video.currentTime` seeking costs 80-150ms per frame on mobile (1800 seeks = 144s wasted). Mac unified memory makes the same operation near-instant.

---

## Approaches Tried

### 1. Seek-based (original, prod)
```
for each frame: video.currentTime = t → await seeked → drawImage → encode
```
- **Mac:** ~20s ✓
- **Mobile:** 90-270s ✗
- **Issue:** Each seek flushes the hardware decoder, restarts from nearest keyframe
- **Status:** FALLBACK (used when nothing else works)

### 2. rVFC continuous playback at 2x
```
video.playbackRate = 2 → play() → rVFC fires → encode without pausing
```
- **Mac:** Fast ✓
- **Mobile:** Got to 63% then STUCK ✗
- **Issue:** Video races ahead while encoding — when video ends, rVFC stops firing, promise hangs forever
- **Status:** REJECTED

### 3. VideoDecoder + mp4box.js (sequential decode)
```
mp4box demux → VideoDecoder → decoded VideoFrame → drawImage → encode
```
- **Mac:** 10s ✓✓✓ AMAZING
- **Mobile:** 30s for 10% (projected 5 min) ✗
- **Issue:** `drawImage(VideoFrame → canvas)` forces GPU→CPU readback on mobile. On Mac unified memory = free. On mobile = 15-25ms per frame.
- **Status:** DESKTOP ONLY (keep for Mac/PC)

### 4. AV1/HEVC codec selection
```
isConfigSupported → pick AV1 > HEVC > H.264
```
- **Issue:** `isConfigSupported` returns true for AV1 but it's SOFTWARE encoding (no hardware AV1 encoder on most phones). Encoder closed silently after a few frames.
- **Status:** REJECTED (H.264 is the only universally hardware-accelerated codec)

### 5. `prefer-hardware` + `bitrateMode: variable` + `latencyMode: realtime`
- `prefer-hardware`: Crashes on devices without hardware encoder for selected codec
- `bitrateMode: variable`: Not universally supported, config mismatch causes silent close
- `latencyMode: realtime`: Silently DROPS frames under thermal pressure
- **Status:** Only `prefer-hardware` kept (with H.264 which always has hardware support)

### 6. Reduced resolution (540p) / framerate (24fps)
- Works but USER REJECTED — quality compromise not acceptable
- **Status:** REJECTED by user

### 7. rVFC play-pause-encode ← CURRENT MOBILE APPROACH
```
play() → rVFC fires → pause() → drawImage → encode → play() → repeat
```
- **Mac:** Not tested (VideoDecoder is faster)
- **Mobile:** Should be ~real-time (60s for 60s). No seek overhead.
- **Issue:** TBD — needs mobile testing
- **Key insight:** Browser's hardware decoder stays "warm" (no flush between frames). Sequential decode is what the hardware is optimized for.
- **Status:** ACTIVE (mobile path)

---

## Final Architecture

```
Export triggered
  ↓
Is desktop (no mobile UA)?
  → YES: VideoDecoder path (10s for 60s video)
  → NO (mobile):
      Has requestVideoFrameCallback?
        → YES: rVFC play-pause-encode (~60s for 60s)
        → NO: Seek-based fallback (3-5 min, old browsers only)
```

## Key Learnings

1. **Seek = death on mobile.** Every `video.currentTime` assignment flushes the hardware decoder pipeline. Sequential playback is 10-50x faster.

2. **VideoDecoder is desktop-only gold.** Unified memory (Mac) makes `drawImage(VideoFrame)` near-free. Mobile's tile-based GPUs with separate CPU/GPU memory make the same call 15-25ms.

3. **Don't trust `isConfigSupported`.** It says "yes I can encode AV1" but means "in software, at 2fps." Always stick with H.264 for hardware encode on mobile.

4. **`latencyMode: realtime` drops frames silently.** Never use for offline export where every frame matters.

5. **rVFC at >1x playback races the encoder.** The video keeps playing while you encode. Must pause between frames.

6. **Bounded queues are critical on mobile.** Unbounded VideoFrame queues → OOM in seconds (100 frames × 3.7MB = 370MB).
