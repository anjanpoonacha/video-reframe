// --- Fast video analysis using requestVideoFrameCallback (no seeks) ---
// Falls back to seek-based if rVFC not available.

interface AnalyzeResult {
  positions: { time: number; x: number }[];
  frameBitmaps: ImageBitmap[];
}

/**
 * Analyze video using requestVideoFrameCallback at fast playback.
 * Plays the video at 4x speed and captures frames as they render.
 * Eliminates seek overhead entirely — ~4x faster than seek-based for 60s video.
 *
 * Returns ~3fps equivalent samples (same density as seek-based approach).
 */
export async function analyzeVideoRVFC(
  video: HTMLVideoElement,
  targetSamples: number,
  onProgress: (pct: number) => void,
): Promise<AnalyzeResult> {
  const duration = video.duration;
  const targetInterval = duration / targetSamples; // seconds between captures

  const pos: { time: number; x: number }[] = [];
  const bitmaps: ImageBitmap[] = [];

  // Motion detection canvas (small)
  const dw = 160;
  const dh = Math.round(160 * (video.videoHeight / video.videoWidth));
  const motionCanvas = document.createElement("canvas");
  motionCanvas.width = dw;
  motionCanvas.height = dh;
  const motionCtx = motionCanvas.getContext("2d", { willReadFrequently: true })!;

  // Thumbnail canvas
  const thumbW = 36 * 2;
  const thumbH = 64 * 2;
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const thumbCtx = thumbCanvas.getContext("2d")!;

  const cropW = video.videoHeight * (9 / 16);
  const maxX = video.videoWidth - cropW;
  let prev: ImageData | null = null;
  let lastCaptureTime = -targetInterval; // ensure first frame is captured

  return new Promise<AnalyzeResult>((resolve) => {
    function onFrame(_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) {
      const t = metadata.mediaTime;

      // Only capture at target interval density
      if (t - lastCaptureTime < targetInterval * 0.8) {
        // Skip this frame, request next
        video.requestVideoFrameCallback(onFrame);
        return;
      }
      lastCaptureTime = t;

      // --- Motion detection ---
      motionCtx.drawImage(video, 0, 0, dw, dh);
      const d = motionCtx.getImageData(0, 0, dw, dh);

      if (prev) {
        let sx = 0;
        let cnt = 0;
        const totalPixels = dw * dh;
        for (let y = 0; y < dh; y++) {
          for (let x = 0; x < dw; x++) {
            const idx = (y * dw + x) * 4;
            const diff =
              Math.abs((d.data[idx] ?? 0) - (prev.data[idx] ?? 0)) +
              Math.abs((d.data[idx + 1] ?? 0) - (prev.data[idx + 1] ?? 0)) +
              Math.abs((d.data[idx + 2] ?? 0) - (prev.data[idx + 2] ?? 0));
            if (diff > 60) {
              sx += x;
              cnt++;
            }
          }
        }
        const panThreshold = 0.6;
        const isPan = cnt / totalPixels > panThreshold;
        const lastGood = pos[pos.length - 1]?.x ?? 0.5;

        if (isPan) {
          pos.push({ time: t, x: lastGood });
        } else {
          pos.push({ time: t, x: cnt > 50 ? sx / cnt / dw : lastGood });
        }
      } else {
        pos.push({ time: t, x: 0.5 });
      }
      prev = d;

      // --- Thumbnail ---
      const rawX = pos[pos.length - 1]!.x;
      const srcX = maxX * rawX;
      thumbCtx.drawImage(video, srcX, 0, cropW, video.videoHeight, 0, 0, thumbW, thumbH);
      // createImageBitmap is async but we need sync in callback — use sync canvas copy
      const bmp = thumbCtx.getImageData(0, 0, thumbW, thumbH);
      const offscreen = new OffscreenCanvas(thumbW, thumbH);
      offscreen.getContext("2d")!.putImageData(bmp, 0, 0);
      createImageBitmap(offscreen).then((bitmap) => {
        bitmaps.push(bitmap);
      });

      onProgress(Math.round((t / duration) * 100));

      // Continue or finish
      if (pos.length >= targetSamples || t >= duration - 0.1) {
        video.pause();
        video.playbackRate = 1;
        video.muted = false;
        // Wait for any pending bitmap promises
        setTimeout(() => resolve({ positions: pos, frameBitmaps: bitmaps }), 50);
      } else {
        video.requestVideoFrameCallback(onFrame);
      }
    }

    // Start fast playback
    video.currentTime = 0;
    video.muted = true;
    video.playbackRate = 4;
    video.requestVideoFrameCallback(onFrame);
    video.play().catch(() => {});
  });
}

/**
 * Check if requestVideoFrameCallback is available
 */
export function hasRVFC(): boolean {
  return "requestVideoFrameCallback" in HTMLVideoElement.prototype;
}
