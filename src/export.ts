// --- Export pipeline with overlay injection and backpressure ---

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import type { OverlayRenderFn } from "./overlay";

export interface ExportConfig {
  videoEl: HTMLVideoElement;
  keyframes: { time: number; x: number; auto: boolean }[];
  skipRanges: { start: number; end: number }[];
  overlay: OverlayRenderFn;
  onProgress: (pct: number) => void;
  maxDuration?: number;
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
  const { videoEl, keyframes, skipRanges, overlay, onProgress, maxDuration } = config;

  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;
  const duration = maxDuration
    ? Math.min(videoEl.duration, maxDuration)
    : videoEl.duration;
  const fps = 30;
  const totalFrames = Math.round(duration * fps);
  const outW = Math.min(1080, Math.round(srcH * (9 / 16)));
  const outH = Math.min(1920, srcH);
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

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: encW, height: encH },
    fastStart: "in-memory",
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: console.error,
  });

  encoder.configure({
    codec: "avc1.640028",
    width: encW,
    height: encH,
    bitrate: 4_000_000,
    framerate: fps,
  });

  const canvas = document.createElement("canvas");
  canvas.width = encW;
  canvas.height = encH;
  const ctx = canvas.getContext("2d")!;

  // Secondary canvas for cross-fade blending (D-20)
  const fadeCanvas = new OffscreenCanvas(encW, encH);
  const fadeCtx = fadeCanvas.getContext("2d")!;

  let encodedFrames = 0;
  let lastRenderedFrame: ImageData | null = null;

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;

    // Skip if in a skip range
    if (skipRanges.some((r) => t >= r.start && t < r.end)) continue;

    // Get interpolated crop position from keyframes
    const cropX = getPositionAtTime(t, keyframes);
    const maxX = srcW - cropSrcW;
    const srcX = Math.max(0, Math.min(maxX, maxX * cropX));

    videoEl.currentTime = t;
    await new Promise((r) =>
      videoEl.addEventListener("seeked", r, { once: true })
    );

    // Cross-fade at cut boundaries (D-19, D-20, D-21)
    if (cutEntryFrames.has(i) && lastRenderedFrame) {
      for (let j = 0; j < FADE_FRAMES; j++) {
        const alpha = (j + 1) / (FADE_FRAMES + 1);

        // Draw current frame content onto fade canvas
        fadeCtx.drawImage(videoEl, srcX, 0, cropSrcW, srcH, 0, 0, encW, encH);
        overlay(fadeCtx, t, encW, encH);

        // Blend: put previous frame on main, overlay new at progressive alpha
        ctx.putImageData(lastRenderedFrame, 0, 0);
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

          while (encoder.encodeQueueSize > 5) {
            await new Promise((r) =>
              encoder.addEventListener("dequeue", r, { once: true })
            );
          }

          encoder.encode(frame, { keyFrame: encodedFrames % 60 === 0 });
        } finally {
          frame?.close();
        }

        encodedFrames++;
      }
    }

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
      while (encoder.encodeQueueSize > 5) {
        await new Promise((r) =>
          encoder.addEventListener("dequeue", r, { once: true })
        );
      }

      encoder.encode(frame, { keyFrame: encodedFrames % 60 === 0 });
    } finally {
      frame?.close();
    }

    // Store rendered frame for potential cross-fade at next cut boundary
    lastRenderedFrame = ctx.getImageData(0, 0, encW, encH);

    encodedFrames++;
    onProgress(Math.round((i / progressTotal) * 100));

    // UI yield every 5 frames
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  // D-05: Safety sweep — no-op since frames are closed per-iteration in try/finally.
  // If refactored to batch frames, this becomes critical.

  await encoder.flush();
  muxer.finalize();

  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
