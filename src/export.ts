// --- Export pipeline with overlay injection, backpressure, and adaptive performance ---

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import type { OverlayRenderFn } from "./overlay";
import { detectDeviceTier, getPerformancePreset, type DeviceTier } from "./device-tier";

export interface ExportConfig {
  videoEl: HTMLVideoElement;
  keyframes: { time: number; x: number; auto: boolean }[];
  skipRanges: { start: number; end: number }[];
  overlay: OverlayRenderFn;
  onProgress: (pct: number) => void;
  maxDuration?: number;
  deviceTier?: DeviceTier;
  signal?: AbortSignal;
  sourceFile?: File; // for WebCodecs decode path (avoids seeks)
}

function getPositionAtTime(
  time: number,
  keyframes: { time: number; x: number; auto: boolean }[],
): number {
  if (keyframes.length === 0) return 0.5;
  if (keyframes.length === 1) return keyframes[0]!.x;

  if (time <= keyframes[0]!.time) return keyframes[0]!.x;
  if (time >= keyframes[keyframes.length - 1]!.time)
    return keyframes[keyframes.length - 1]!.x;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]!;
    const b = keyframes[i + 1]!;
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / (b.time - a.time);
      return a.x * (1 - t) + b.x * t;
    }
  }
  return keyframes[keyframes.length - 1]!.x;
}

export async function exportVideo(config: ExportConfig): Promise<Blob> {
  const { videoEl, keyframes, skipRanges, overlay, onProgress, maxDuration, signal } = config;

  function checkAbort() {
    if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
  }

  const tier = config.deviceTier ?? detectDeviceTier();
  const preset = getPerformancePreset(tier);

  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;
  const duration = maxDuration
    ? Math.min(videoEl.duration, maxDuration)
    : videoEl.duration;
  const fps = 30;
  const totalFrames = Math.round(duration * fps);
  const outW = Math.min(preset.outputWidth, Math.round(srcH * (9 / 16)));
  const outH = Math.min(preset.outputHeight, srcH);
  const encW = outW - (outW % 2);
  const encH = outH - (outH % 2);
  const cropSrcW = srcH * (9 / 16);
  const frameDuration = 1_000_000 / fps;

  // Cross-fade parameters (D-19: 0.15s ≈ 4 frames at 30fps)
  const FADE_FRAMES = 4;

  // Pre-compute cut entry frames: first rendered frame after a skip range ends
  const cutEntryFrames = new Set<number>();
  const sortedSkips = [...skipRanges].sort((a, b) => a.start - b.start);
  for (let i = 1; i < totalFrames; i++) {
    const tPrev = (i - 1) / fps;
    const tCurr = i / fps;
    const prevSkipped = sortedSkips.some((r) => tPrev >= r.start && tPrev < r.end);
    const currSkipped = sortedSkips.some((r) => tCurr >= r.start && tCurr < r.end);
    if (prevSkipped && !currSkipped) {
      cutEntryFrames.add(i);
    }
  }

  // Adjust progress denominator to account for transition frames
  const progressTotal = totalFrames + cutEntryFrames.size * FADE_FRAMES;

  // Select best available codec: AV1 > HEVC > H.264
  // AV1/HEVC encode ~same speed on hardware but produce better quality at lower bitrate
  const codecCandidates: { codec: string; muxCodec: "av1" | "hevc" | "avc"; bitrate: number }[] = [
    { codec: "av01.0.04M.08", muxCodec: "av1", bitrate: 2_500_000 },
    { codec: "hev1.1.6.L93.B0", muxCodec: "hevc", bitrate: 2_500_000 },
    { codec: "avc1.640028", muxCodec: "avc", bitrate: 3_000_000 },
  ];

  let selectedCodec = codecCandidates[codecCandidates.length - 1]!; // H.264 fallback
  for (const candidate of codecCandidates) {
    const support = await VideoEncoder.isConfigSupported({
      codec: candidate.codec,
      width: encW,
      height: encH,
      bitrate: candidate.bitrate,
      framerate: fps,
    });
    if (support.supported) {
      selectedCodec = candidate;
      break;
    }
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: selectedCodec.muxCodec, width: encW, height: encH },
    fastStart: "in-memory",
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: console.error,
  });

  encoder.configure({
    codec: selectedCodec.codec,
    width: encW,
    height: encH,
    bitrate: selectedCodec.bitrate,
    bitrateMode: "variable",
    framerate: fps,
    latencyMode: "quality",
    hardwareAcceleration: "no-preference",
  });

  const canvas = document.createElement("canvas");
  canvas.width = encW;
  canvas.height = encH;
  const ctx = canvas.getContext("2d")!;

  // Secondary canvas for cross-fade blending (D-20)
  const fadeCanvas = new OffscreenCanvas(encW, encH);
  const fadeCtx = fadeCanvas.getContext("2d")! as unknown as CanvasRenderingContext2D;

  // Previous frame buffer for cross-fade — allocated once, reused via drawImage (D-03, D-04)
  const prevCanvas = new OffscreenCanvas(encW, encH);
  const prevCtx = prevCanvas.getContext("2d")! as unknown as CanvasRenderingContext2D;
  let hasPrevFrame = false;

  let encodedFrames = 0;
  let consecutiveFrames = 0;

  // D-17: Thermal pressure detection via frame timing instrumentation
  let baselineFrameTime = 0;
  let frameCount = 0;
  const recentFrameTimes: number[] = [];
  const THERMAL_WINDOW = 20;
  const THERMAL_THRESHOLD = 1.8;
  let effectiveYieldEvery = preset.yieldEvery;

  function checkThermalPressure(frameTime: number): void {
    // Establish baseline from first 10 frames
    if (frameCount < 10) {
      baselineFrameTime = ((baselineFrameTime * frameCount) + frameTime) / (frameCount + 1);
    }
    frameCount++;

    // After baseline established, monitor for thermal degradation
    if (frameCount >= 10) {
      recentFrameTimes.push(frameTime);
      if (recentFrameTimes.length > THERMAL_WINDOW) {
        recentFrameTimes.shift();
      }
      if (recentFrameTimes.length === THERMAL_WINDOW) {
        // Compute median of recent frame times
        const sorted = [...recentFrameTimes].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)]!;
        if (median > baselineFrameTime * THERMAL_THRESHOLD) {
          // Thermal pressure detected — yield more frequently
          effectiveYieldEvery = Math.max(2, Math.floor(preset.yieldEvery / 2));
        } else {
          effectiveYieldEvery = preset.yieldEvery;
        }
      }
    }
  }

  // Frame source: use rVFC playback if available (eliminates ~100ms/frame seek cost)
  const usePlayback = "requestVideoFrameCallback" in videoEl;

  // Pre-build set of skipped frame indices for O(1) lookup
  const skippedFrames = new Set<number>();
  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    if (skipRanges.some((r) => t >= r.start && t < r.end)) skippedFrames.add(i);
  }

  // Frame iterator: yields frame index sequentially
  let frameQueue: { resolve: () => void }[] = [];
  let currentFrameIdx = 0;

  if (usePlayback) {
    // Play-based export: real-time but no seek overhead
    // Export takes exactly video_duration seconds but avoids 50-150ms per-frame seek penalty
    videoEl.currentTime = 0;
    videoEl.muted = true;
    videoEl.setAttribute("playsinline", "");

    const frameReady = () => new Promise<void>((resolve) => {
      function onFrame(_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) {
        const targetTime = currentFrameIdx / fps;
        // If current media time is close enough to our target, resolve
        if (metadata.mediaTime >= targetTime - 0.02) {
          resolve();
        } else {
          videoEl.requestVideoFrameCallback(onFrame);
        }
      }
      videoEl.requestVideoFrameCallback(onFrame);
    });

    // Play at 2x — rVFC fires at compositor rate (frames arrive at 2x wall-clock speed)
    // iOS Safari caps reliable decode at 2x, Android may drop frames above 2x
    videoEl.playbackRate = 2;
    await videoEl.play();

    for (let i = 0; i < totalFrames; i++) {
      checkAbort();
      currentFrameIdx = i;
      const t = i / fps;

      // Skip if in a skip range
      if (skippedFrames.has(i)) continue;

      // Wait for playback to reach this frame
      await frameReady();
      checkAbort();

      // Get interpolated crop position from keyframes
      const cropX = getPositionAtTime(t, keyframes);
      const maxX = srcW - cropSrcW;
      const srcX = Math.max(0, Math.min(maxX, maxX * cropX));

      // --- encode frame (shared logic below) ---
      await encodeOneFrame(i, t, srcX);
    }

    videoEl.pause();
    videoEl.playbackRate = 1;
    videoEl.muted = false;
  } else {
    // Fallback: seek-based (slow but universal)
    for (let i = 0; i < totalFrames; i++) {
      checkAbort();
      const t = i / fps;

      if (skippedFrames.has(i)) continue;

      const cropX = getPositionAtTime(t, keyframes);
      const maxX = srcW - cropSrcW;
      const srcX = Math.max(0, Math.min(maxX, maxX * cropX));

      videoEl.currentTime = t;
      await new Promise((r) =>
        videoEl.addEventListener("seeked", r, { once: true })
      );
      checkAbort();

      await encodeOneFrame(i, t, srcX);
    }
  }

  // Shared encode logic extracted into local function
  async function encodeOneFrame(i: number, t: number, srcX: number) {

    // Cross-fade at cut boundaries (D-19, D-20, D-21)
    if (cutEntryFrames.has(i) && hasPrevFrame) {
      for (let j = 0; j < FADE_FRAMES; j++) {
        checkAbort();
        const fadeFrameStart = performance.now();
        const alpha = (j + 1) / (FADE_FRAMES + 1);

        // Draw current frame content onto fade canvas
        fadeCtx.drawImage(videoEl, srcX, 0, cropSrcW, srcH, 0, 0, encW, encH);
        overlay(fadeCtx, t, encW, encH);

        // Blend: draw previous frame on main, overlay new at progressive alpha
        ctx.drawImage(prevCanvas, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.drawImage(fadeCanvas, 0, 0);
        ctx.globalAlpha = 1.0;

        // Encode blended frame
        let frame: VideoFrame | null = null;
        try {
          frame = new VideoFrame(canvas, {
            timestamp: encodedFrames * frameDuration,
            duration: frameDuration,
          });

          while (encoder.encodeQueueSize > preset.maxEncodeQueue) {
            await new Promise((r) =>
              encoder.addEventListener("dequeue", r, { once: true })
            );
          }

          encoder.encode(frame, { keyFrame: encodedFrames % 150 === 0 });
        } finally {
          frame?.close();
        }

        encodedFrames++;
        consecutiveFrames++;
        checkThermalPressure(performance.now() - fadeFrameStart);

        // Yield gate: adaptive frequency + hard cap (D-18)
        if (consecutiveFrames >= effectiveYieldEvery || consecutiveFrames >= preset.maxConsecutive) {
          await new Promise((r) => setTimeout(r, preset.yieldMs));
          consecutiveFrames = 0;
        }
      }
    }

    const frameStart = performance.now();

    // Draw crop
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

      // Backpressure gate: wait if encoder queue is saturated
      while (encoder.encodeQueueSize > preset.maxEncodeQueue) {
        await new Promise((r) =>
          encoder.addEventListener("dequeue", r, { once: true })
        );
        checkAbort();
      }

      encoder.encode(frame, { keyFrame: encodedFrames % 150 === 0 });
    } finally {
      frame?.close();
    }

    // Store rendered frame for potential cross-fade at next cut boundary (GPU-accelerated copy)
    prevCtx.drawImage(canvas, 0, 0);
    hasPrevFrame = true;

    encodedFrames++;
    consecutiveFrames++;
    checkThermalPressure(performance.now() - frameStart);
    onProgress(Math.round((i / progressTotal) * 100));

    // Yield gate: adaptive frequency + hard cap (D-18)
    if (consecutiveFrames >= effectiveYieldEvery || consecutiveFrames >= preset.maxConsecutive) {
      await new Promise((r) => setTimeout(r, preset.yieldMs));
      consecutiveFrames = 0;
      checkAbort();
    }
  }

  // D-05: Safety sweep — no-op since frames are closed per-iteration in try/finally.
  // If refactored to batch frames, this becomes critical.

  checkAbort();
  await encoder.flush();
  muxer.finalize();

  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
