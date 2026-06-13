// --- Fastest video analysis using WebCodecs VideoDecoder + mp4box.js ---
// Linear hardware-accelerated decode — no seeks, no playback.
// Available: Chrome 94+ desktop, Chrome Android 147+, Edge 94+.
// NOT available: Safari iOS, older Android Chrome.

import { createFile, DataStream } from "mp4box";

interface AnalyzeResult {
  positions: { time: number; x: number }[];
  frameBitmaps: ImageBitmap[];
}

/**
 * Analyze video by decoding directly with WebCodecs VideoDecoder.
 * Fastest possible — linear decode with hardware acceleration.
 * For a 60s video: ~2-5 seconds total.
 */
export async function analyzeVideoWebCodecs(
  file: File,
  videoWidth: number,
  videoHeight: number,
  targetSamples: number,
  onProgress: (pct: number) => void,
): Promise<AnalyzeResult> {
  const pos: { time: number; x: number }[] = [];
  const bitmaps: ImageBitmap[] = [];

  // Motion detection canvas (small)
  const dw = 160;
  const dh = Math.round(160 * (videoHeight / videoWidth));
  const motionCanvas = new OffscreenCanvas(dw, dh);
  const motionCtx = motionCanvas.getContext("2d", { willReadFrequently: true })!;

  // Thumbnail canvas
  const thumbW = 36 * 2;
  const thumbH = 64 * 2;
  const thumbCanvas = new OffscreenCanvas(thumbW, thumbH);
  const thumbCtx = thumbCanvas.getContext("2d")!;

  const cropW = videoHeight * (9 / 16);
  const maxX = videoWidth - cropW;
  let prev: ImageData | null = null;

  // Determine sample interval based on total duration
  const arrayBuffer = await file.arrayBuffer();

  return new Promise<AnalyzeResult>((resolve, reject) => {
    const mp4boxFile = createFile();
    let totalDuration = 0;
    let sampleInterval = 0;
    let lastSampleTime = -Infinity;
    let samplesCollected = 0;
    let decoder: VideoDecoder;

    function processFrame(frame: VideoFrame) {
      const t = frame.timestamp / 1_000_000; // microseconds → seconds

      // Only sample at target interval
      if (t - lastSampleTime < sampleInterval * 0.8 && samplesCollected > 0) {
        frame.close();
        return;
      }
      lastSampleTime = t;
      samplesCollected++;

      // --- Motion detection ---
      motionCtx.drawImage(frame, 0, 0, dw, dh);
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
      thumbCtx.drawImage(frame, srcX, 0, cropW, videoHeight, 0, 0, thumbW, thumbH);

      frame.close();

      // Create bitmap from thumbnail
      createImageBitmap(thumbCanvas).then((bmp) => bitmaps.push(bmp));

      onProgress(Math.min(99, Math.round((samplesCollected / targetSamples) * 100)));

      // Stop if we have enough samples
      if (samplesCollected >= targetSamples) {
        decoder.close();
        setTimeout(() => resolve({ positions: pos, frameBitmaps: bitmaps }), 50);
      }
    }

    mp4boxFile.onError = (e: string) => reject(new Error(`MP4Box error: ${e}`));

    mp4boxFile.onReady = (info: any) => {
      const videoTrack = info.tracks.find((t: any) => t.type === "video");
      if (!videoTrack) {
        reject(new Error("No video track found"));
        return;
      }

      totalDuration = videoTrack.duration / videoTrack.timescale;
      sampleInterval = totalDuration / targetSamples;

      decoder = new VideoDecoder({
        output: processFrame,
        error: (e) => reject(e),
      });

      decoder.configure({
        codec: videoTrack.codec,
        codedWidth: videoTrack.video.width,
        codedHeight: videoTrack.video.height,
        description: getDescription(mp4boxFile, videoTrack.id),
      });

      mp4boxFile.setExtractionOptions(videoTrack.id);
      mp4boxFile.start();
    };

    mp4boxFile.onSamples = (_id: number, _user: any, samples: any[]) => {
      for (const sample of samples) {
        if (samplesCollected >= targetSamples) break;

        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: (sample.cts * 1_000_000) / sample.timescale,
          duration: (sample.duration * 1_000_000) / sample.timescale,
          data: sample.data,
        });
        decoder.decode(chunk);
      }
    };

    // Feed data to mp4box
    (arrayBuffer as any).fileStart = 0;
    mp4boxFile.appendBuffer(arrayBuffer);
    mp4boxFile.flush();
  });
}

/**
 * Extract codec description (avcC/hvcC box) needed for VideoDecoder.configure
 */
function getDescription(mp4boxFile: any, trackId: number): Uint8Array | undefined {
  const track = mp4boxFile.getTrackById(trackId);
  if (!track) return undefined;

  const entry = track.mdia?.minf?.stbl?.stsd?.entries?.[0];
  if (!entry) return undefined;

  // For H.264: avcC box; for H.265: hvcC box
  const box = entry.avcC || entry.hvcC;
  if (!box) return undefined;

  const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
  box.write(stream);
  return new Uint8Array(stream.buffer, 8); // skip box header (size + type)
}

/**
 * Check if WebCodecs VideoDecoder is available
 */
export function hasWebCodecs(): boolean {
  return typeof VideoDecoder !== "undefined";
}
