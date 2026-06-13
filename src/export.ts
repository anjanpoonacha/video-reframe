// --- Export pipeline with overlay injection, backpressure, and adaptive performance ---

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { createFile, DataStream } from "mp4box";
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

/**
 * Extract codec description (avcC/hvcC box) needed for VideoDecoder.configure
 */
function getDescription(mp4boxFile: any, trackId: number): Uint8Array | undefined {
  const track = mp4boxFile.getTrackById(trackId);
  if (!track) return undefined;
  const entry = track.mdia?.minf?.stbl?.stsd?.entries?.[0];
  if (!entry) return undefined;
  const box = entry.avcC || entry.hvcC;
  if (!box) return undefined;
  const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
  box.write(stream);
  return new Uint8Array(stream.buffer, 8);
}

/**
 * Sequential frame decode using VideoDecoder + mp4box.js demuxer.
 * Yields decoded VideoFrames in presentation order.
 * Caller MUST close each yielded VideoFrame.
 */
async function* decodeFramesSequentially(
  file: File,
  signal?: AbortSignal,
): AsyncGenerator<VideoFrame> {
  const arrayBuffer = await file.arrayBuffer();
  const mp4boxFile = createFile();

  // Queue for decoded frames with backpressure
  const frameQueue: VideoFrame[] = [];
  let resolveFrame: (() => void) | null = null;
  let decodeError: Error | null = null;
  let decodeDone = false;

  const decoder = new VideoDecoder({
    output: (frame) => {
      frameQueue.push(frame);
      if (resolveFrame) {
        resolveFrame();
        resolveFrame = null;
      }
    },
    error: (e) => {
      decodeError = e;
      if (resolveFrame) {
        resolveFrame();
        resolveFrame = null;
      }
    },
  });

  mp4boxFile.onError = (e: string) => {
    decodeError = new Error(`MP4Box error: ${e}`);
    if (resolveFrame) {
      resolveFrame();
      resolveFrame = null;
    }
  };

  mp4boxFile.onReady = (info: any) => {
    const videoTrack = info.tracks.find((t: any) => t.type === "video");
    if (!videoTrack) {
      decodeError = new Error("No video track found");
      if (resolveFrame) {
        resolveFrame();
        resolveFrame = null;
      }
      return;
    }

    decoder.configure({
      codec: videoTrack.codec,
      codedWidth: videoTrack.video.width,
      codedHeight: videoTrack.video.height,
      description: getDescription(mp4boxFile, videoTrack.id),
      hardwareAcceleration: "prefer-hardware",
    });

    mp4boxFile.setExtractionOptions(videoTrack.id);
    mp4boxFile.start();
  };

  mp4boxFile.onSamples = (_id: number, _user: any, samples: any[]) => {
    for (const sample of samples) {
      if (signal?.aborted) break;
      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? "key" : "delta",
        timestamp: (sample.cts * 1_000_000) / sample.timescale,
        duration: (sample.duration * 1_000_000) / sample.timescale,
        data: sample.data,
      });
      decoder.decode(chunk);
    }
  };

  // Feed entire file to mp4box
  (arrayBuffer as any).fileStart = 0;
  mp4boxFile.appendBuffer(arrayBuffer);
  mp4boxFile.flush();

  // Flush decoder to signal end of input
  await decoder.flush();
  decodeDone = true;

  // Yield all frames from queue
  while (frameQueue.length > 0 || !decodeDone) {
    if (signal?.aborted) {
      // Close remaining frames
      for (const f of frameQueue) f.close();
      frameQueue.length = 0;
      throw new DOMException("Export cancelled", "AbortError");
    }

    if (decodeError) {
      for (const f of frameQueue) f.close();
      frameQueue.length = 0;
      throw decodeError;
    }

    if (frameQueue.length > 0) {
      yield frameQueue.shift()!;
    } else {
      break;
    }
  }
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

  // Use H.264 with hardware acceleration — universally supported, fastest on mobile
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: encW, height: encH },
    fastStart: "in-memory",
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encoderError = e; },
  });

  encoder.configure({
    codec: "avc1.640028",
    width: encW,
    height: encH,
    bitrate: 4_000_000,
    framerate: fps,
    hardwareAcceleration: "prefer-hardware",
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

  // --- Shared helpers for both export paths ---
  async function encodeCrossFade(
    srcImage: CanvasImageSource,
    srcX: number,
    t: number,
  ): Promise<void> {
    for (let j = 0; j < FADE_FRAMES; j++) {
      checkAbort();
      const fadeFrameStart = performance.now();
      const alpha = (j + 1) / (FADE_FRAMES + 1);

      fadeCtx.drawImage(srcImage, srcX, 0, cropSrcW, srcH, 0, 0, encW, encH);
      overlay(fadeCtx, t, encW, encH);

      ctx.drawImage(prevCanvas, 0, 0);
      ctx.globalAlpha = alpha;
      ctx.drawImage(fadeCanvas, 0, 0);
      ctx.globalAlpha = 1.0;

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

        encoder.encode(frame, { keyFrame: encodedFrames % 60 === 0 });
      } finally {
        frame?.close();
      }

      encodedFrames++;
      consecutiveFrames++;
      checkThermalPressure(performance.now() - fadeFrameStart);

      if (consecutiveFrames >= effectiveYieldEvery || consecutiveFrames >= preset.maxConsecutive) {
        await new Promise((r) => setTimeout(r, preset.yieldMs));
        consecutiveFrames = 0;
      }
    }
  }

  async function encodeFrame(t: number): Promise<void> {
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
        checkAbort();
      }

      encoder.encode(frame, { keyFrame: encodedFrames % 60 === 0 });
    } finally {
      frame?.close();
    }
  }

  // --- Fast path: VideoDecoder sequential decode (no seeks) ---
  if (typeof VideoDecoder !== "undefined" && config.sourceFile) {
    // Build a map of target frame timestamps for the export
    const targetFrames: { idx: number; t: number }[] = [];
    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      if (t >= duration) break;
      if (skipRanges.some((r) => t >= r.start && t < r.end)) continue;
      targetFrames.push({ idx: i, t });
    }

    let targetIdx = 0;

    for await (const decodedFrame of decodeFramesSequentially(config.sourceFile, signal)) {
      if (targetIdx >= targetFrames.length) {
        decodedFrame.close();
        break;
      }

      checkAbort();
      if (encoderError) {
        decodedFrame.close();
        throw encoderError;
      }

      const frameTimeSec = decodedFrame.timestamp / 1_000_000;
      const target = targetFrames[targetIdx]!;

      // Skip decoded frames that come before our next target timestamp
      if (frameTimeSec < target.t - 0.5 / fps) {
        decodedFrame.close();
        continue;
      }

      // Use this decoded frame for the current target
      try {
        const cropX = getPositionAtTime(target.t, keyframes);
        const maxX = srcW - cropSrcW;
        const srcX = Math.max(0, Math.min(maxX, maxX * cropX));

        // Cross-fade at cut boundaries
        if (cutEntryFrames.has(target.idx) && hasPrevFrame) {
          await encodeCrossFade(decodedFrame, srcX, target.t);
        }

        const frameStart = performance.now();

        // Draw crop from decoded frame
        ctx.drawImage(decodedFrame, srcX, 0, cropSrcW, srcH, 0, 0, encW, encH);

        // Overlay injection
        overlay(ctx, target.t, encW, encH);

        // Encode
        await encodeFrame(target.t);

        // Store for cross-fade
        if (cutEntryFrames.size > 0) {
          prevCtx.drawImage(canvas, 0, 0);
          hasPrevFrame = true;
        }

        encodedFrames++;
        consecutiveFrames++;
        checkThermalPressure(performance.now() - frameStart);
        onProgress(Math.round((targetIdx / progressTotal) * 100));

        if (consecutiveFrames >= effectiveYieldEvery || consecutiveFrames >= preset.maxConsecutive) {
          await new Promise((r) => setTimeout(r, preset.yieldMs));
          consecutiveFrames = 0;
          checkAbort();
        }

        targetIdx++;
      } finally {
        decodedFrame.close();
      }
    }
  } else {
    // --- Fallback: seek-based export (browsers without VideoDecoder) ---
    for (let i = 0; i < totalFrames; i++) {
      checkAbort();
      if (encoderError) throw encoderError;
      const t = i / fps;

      // Stop if we've passed the actual video duration
      if (t >= videoEl.duration) break;

      // Skip if in a skip range
      if (skipRanges.some((r) => t >= r.start && t < r.end)) continue;

      // Get interpolated crop position from keyframes
      const cropX = getPositionAtTime(t, keyframes);
      const maxX = srcW - cropSrcW;
      const srcX = Math.max(0, Math.min(maxX, maxX * cropX));

      videoEl.currentTime = t;
      await new Promise<void>((resolve) => {
        const onSeeked = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => {
          videoEl.removeEventListener("seeked", onSeeked);
          resolve(); // proceed with whatever frame is available
        }, 2000);
        videoEl.addEventListener("seeked", onSeeked, { once: true });
      });
      checkAbort();

      // Cross-fade at cut boundaries (D-19, D-20, D-21)
      if (cutEntryFrames.has(i) && hasPrevFrame) {
        await encodeCrossFade(videoEl, srcX, t);
      }

      const frameStart = performance.now();

      // Draw crop
      ctx.drawImage(videoEl, srcX, 0, cropSrcW, srcH, 0, 0, encW, encH);

      // Overlay injection (D-02)
      overlay(ctx, t, encW, encH);

      // Encode with backpressure (D-03) and safe lifecycle (D-04)
      await encodeFrame(t);

      // Store rendered frame for potential cross-fade at next cut boundary (GPU-accelerated copy)
      if (cutEntryFrames.size > 0) {
        prevCtx.drawImage(canvas, 0, 0);
        hasPrevFrame = true;
      }

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
  }

  // D-05: Safety sweep — no-op since frames are closed per-iteration in try/finally.
  // If refactored to batch frames, this becomes critical.

  checkAbort();
  await encoder.flush();
  muxer.finalize();

  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
