import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import "./styles.css";

// --- Types ---
interface FrameData {
  time: number;
  x: number; // 0-1 normalized crop position
  bitmap: ImageBitmap;
  skipped: boolean;
}

// --- State ---
let videoEl: HTMLVideoElement | null = null;
let frames: FrameData[] = [];
let currentIdx = 0;
let skipRanges: { start: number; end: number }[] = [];
let markStartTime: number | null = null;
let dragging = false;

const $ = (id: string) => document.getElementById(id)!;

// --- Upload ---
$("fileInput").addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  videoEl = document.createElement("video");
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.preload = "auto";
  videoEl.src = URL.createObjectURL(file);
  await new Promise((r) =>
    videoEl!.addEventListener("loadeddata", r, { once: true })
  );

  $("fileStatus").textContent = `${videoEl.videoWidth}x${videoEl.videoHeight} · ${videoEl.duration.toFixed(1)}s · ${(file.size / 1024 / 1024).toFixed(1)}MB`;
  $("fileStatus").className = "status success";
  $("analyzeCard").classList.remove("hidden");
});

// --- Analyze (motion detection) ---
$("analyzeBtn").addEventListener("click", async () => {
  if (!videoEl) return;
  ($("analyzeBtn") as HTMLButtonElement).disabled = true;
  $("analyzeStatus").textContent = "Detecting motion...";

  const duration = videoEl.duration;
  const numSamples = Math.min(200, Math.round(duration * 3));
  const step = duration / numSamples;

  // Detect motion
  const positions = await detectMotion(videoEl, numSamples);
  const smoothed = smoothPositions(positions);

  // Extract thumbnails and build frame data
  $("analyzeStatus").textContent = "Building filmstrip...";
  const thumbW = 36 * 2;
  const thumbH = 64 * 2;
  const canvas = document.createElement("canvas");
  canvas.width = thumbW;
  canvas.height = thumbH;
  const ctx = canvas.getContext("2d")!;

  frames = [];
  for (let i = 0; i < numSamples; i++) {
    videoEl.currentTime = i * step;
    await new Promise((r) =>
      videoEl!.addEventListener("seeked", r, { once: true })
    );

    // Draw 9:16 crop region as thumbnail
    const cropW = videoEl.videoHeight * (9 / 16);
    const maxX = videoEl.videoWidth - cropW;
    const srcX = maxX * (smoothed[i]?.x ?? 0.5);
    ctx.drawImage(videoEl, srcX, 0, cropW, videoEl.videoHeight, 0, 0, thumbW, thumbH);
    const bitmap = await createImageBitmap(canvas);

    frames.push({
      time: i * step,
      x: smoothed[i]?.x ?? 0.5,
      bitmap,
      skipped: false,
    });

    ($("analyzeProgress") as HTMLElement).style.width =
      Math.round(((i + 1) / numSamples) * 100) + "%";
  }

  $("analyzeStatus").textContent = `${numSamples} frames analyzed`;
  $("analyzeStatus").className = "status success";

  // Show editor
  $("editorCard").classList.remove("hidden");
  $("exportCard").classList.remove("hidden");
  renderFilmstrip();
  goToFrame(0);
  renderSkipBar();
});

// --- Filmstrip ---
function renderFilmstrip() {
  const container = $("filmstrip");
  container.innerHTML = "";

  for (let i = 0; i < frames.length; i++) {
    const div = document.createElement("div");
    div.className = "thumb";
    if (i === currentIdx) div.classList.add("active");
    if (frames[i]!.skipped) div.classList.add("skipped");

    const c = document.createElement("canvas");
    c.width = 36 * 2;
    c.height = 64 * 2;
    c.getContext("2d")!.drawImage(frames[i]!.bitmap, 0, 0);
    div.appendChild(c);
    div.addEventListener("click", () => goToFrame(i));
    container.appendChild(div);
  }
}

function goToFrame(idx: number) {
  if (idx < 0 || idx >= frames.length || !videoEl) return;
  currentIdx = idx;

  // Update filmstrip active
  document.querySelectorAll(".filmstrip .thumb").forEach((el, i) => {
    el.classList.toggle("active", i === idx);
  });

  // Scroll into view
  const thumbs = document.querySelectorAll(".filmstrip .thumb");
  thumbs[idx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

  // Draw source frame with crop overlay
  drawCropEditor();

  // Update info
  const f = frames[idx]!;
  $("frameCounter").textContent = `Frame ${idx + 1} / ${frames.length}`;
  $("frameTime").textContent = formatTime(f.time);
}

async function drawCropEditor() {
  if (!videoEl) return;
  const f = frames[currentIdx]!;

  videoEl.currentTime = f.time;
  await new Promise((r) =>
    videoEl!.addEventListener("seeked", r, { once: true })
  );

  // Source canvas
  const srcCanvas = $("sourceCanvas") as HTMLCanvasElement;
  srcCanvas.width = videoEl.videoWidth;
  srcCanvas.height = videoEl.videoHeight;
  srcCanvas.getContext("2d")!.drawImage(videoEl, 0, 0);

  // Position crop region overlay
  const cropW = videoEl.videoHeight * (9 / 16);
  const maxX = videoEl.videoWidth - cropW;
  const cropLeft = maxX * f.x;
  const container = $("cropContainer");
  const displayScale = container.clientWidth / videoEl.videoWidth;
  const region = $("cropRegion") as HTMLElement;
  region.style.width = cropW * displayScale + "px";
  region.style.left = cropLeft * displayScale + "px";

  // Result canvas (9:16 preview)
  const resCanvas = $("resultCanvas") as HTMLCanvasElement;
  const resH = 180;
  const resW = resH * (9 / 16);
  resCanvas.width = resW;
  resCanvas.height = resH;
  resCanvas.getContext("2d")!.drawImage(
    videoEl, cropLeft, 0, cropW, videoEl.videoHeight,
    0, 0, resW, resH
  );
}

// --- Drag crop editing ---
function setupCropDrag() {
  const region = $("cropRegion");
  const container = $("cropContainer");
  let startX = 0;
  let startPos = 0;

  function onStart(clientX: number) {
    dragging = true;
    startX = clientX;
    startPos = frames[currentIdx]!.x;
  }

  function onMove(clientX: number) {
    if (!dragging || !videoEl) return;
    const containerW = container.clientWidth;
    const dx = clientX - startX;
    const dxNorm = dx / containerW;
    const newX = Math.max(0, Math.min(1, startPos + dxNorm));
    frames[currentIdx]!.x = newX;
    drawCropEditor();
  }

  function onEnd() {
    dragging = false;
  }

  region.addEventListener("mousedown", (e) => { e.preventDefault(); onStart(e.clientX); });
  window.addEventListener("mousemove", (e) => onMove(e.clientX));
  window.addEventListener("mouseup", onEnd);

  region.addEventListener("touchstart", (e) => { e.preventDefault(); onStart(e.touches[0]!.clientX); });
  window.addEventListener("touchmove", (e) => { if (dragging) onMove(e.touches[0]!.clientX); });
  window.addEventListener("touchend", onEnd);

  // Click on source canvas to reposition
  container.addEventListener("click", (e) => {
    if (dragging) return;
    const rect = container.getBoundingClientRect();
    const newX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    frames[currentIdx]!.x = newX;
    drawCropEditor();
  });
}

// --- Skip ranges ---
$("markStartBtn").addEventListener("click", () => {
  markStartTime = frames[currentIdx]!.time;
  $("markStartBtn").textContent = `Start: ${markStartTime.toFixed(1)}s ✓`;
});

$("markEndBtn").addEventListener("click", () => {
  const endTime = frames[currentIdx]!.time;
  if (markStartTime === null || endTime <= markStartTime) return;

  skipRanges.push({ start: markStartTime, end: endTime });
  markStartTime = null;
  $("markStartBtn").textContent = "Mark Start";
  applySkipRanges();
  renderSkipBar();
  renderFilmstrip();
});

$("undoSkipBtn").addEventListener("click", () => {
  skipRanges.pop();
  applySkipRanges();
  renderSkipBar();
  renderFilmstrip();
});

function applySkipRanges() {
  for (const f of frames) {
    f.skipped = skipRanges.some((r) => f.time >= r.start && f.time < r.end);
  }
}

function renderSkipBar() {
  const container = $("skipBar");
  container.innerHTML = "";

  if (!videoEl) return;
  const duration = videoEl.duration;
  const sorted = [...skipRanges].sort((a, b) => a.start - b.start);

  let pos = 0;
  for (const range of sorted) {
    if (range.start > pos) {
      const seg = document.createElement("div");
      seg.className = "seg keep";
      seg.style.width = ((range.start - pos) / duration) * 100 + "%";
      container.appendChild(seg);
    }
    const seg = document.createElement("div");
    seg.className = "seg skip";
    seg.style.width = ((range.end - range.start) / duration) * 100 + "%";
    container.appendChild(seg);
    pos = range.end;
  }
  if (pos < duration) {
    const seg = document.createElement("div");
    seg.className = "seg keep";
    seg.style.width = ((duration - pos) / duration) * 100 + "%";
    container.appendChild(seg);
  }

  // Stats
  const skipTotal = skipRanges.reduce((sum, r) => sum + (r.end - r.start), 0);
  $("skipStats").textContent = skipRanges.length > 0
    ? `${skipRanges.length} cut${skipRanges.length > 1 ? "s" : ""} · ${skipTotal.toFixed(1)}s skipped · ${(duration - skipTotal).toFixed(1)}s output`
    : "";
}

// --- Export ---
$("exportBtn").addEventListener("click", async () => {
  if (!videoEl) return;
  ($("exportBtn") as HTMLButtonElement).disabled = true;
  $("exportStatus").textContent = "Encoding...";

  const totalStart = performance.now();
  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;
  const duration = videoEl.duration;
  const fps = 30;
  const totalFrames = Math.round(duration * fps);
  const outW = Math.min(1080, Math.round(srcH * (9 / 16)));
  const outH = Math.min(1920, srcH);
  const encW = outW - (outW % 2);
  const encH = outH - (outH % 2);
  const cropSrcW = srcH * (9 / 16);

  const useWC = "VideoEncoder" in window;
  let muxer: Muxer<ArrayBufferTarget> | undefined;
  let encoder: VideoEncoder | undefined;

  if (useWC) {
    muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: "avc", width: encW, height: encH },
      fastStart: "in-memory",
    });
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer!.addVideoChunk(chunk, meta),
      error: console.error,
    });
    encoder.configure({
      codec: "avc1.640028",
      width: encW,
      height: encH,
      bitrate: 4_000_000,
      framerate: fps,
    });
  }

  const canvas = document.createElement("canvas");
  canvas.width = encW;
  canvas.height = encH;
  const ctx = canvas.getContext("2d")!;

  let encodedFrames = 0;

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;

    // Skip if in a skip range
    if (skipRanges.some((r) => t >= r.start && t < r.end)) continue;

    // Get interpolated crop position from frames array
    const cropX = getPositionAtTime(t, duration);
    const maxX = srcW - cropSrcW;
    const srcX = Math.max(0, Math.min(maxX, maxX * cropX));

    videoEl.currentTime = t;
    await new Promise((r) =>
      videoEl!.addEventListener("seeked", r, { once: true })
    );
    ctx.drawImage(videoEl, srcX, 0, cropSrcW, srcH, 0, 0, encW, encH);

    if (useWC && encoder) {
      const frame = new VideoFrame(canvas, {
        timestamp: encodedFrames * (1_000_000 / fps),
        duration: 1_000_000 / fps,
      });
      encoder.encode(frame, { keyFrame: encodedFrames % 60 === 0 });
      frame.close();
    }

    encodedFrames++;
    const pct = Math.round((i / totalFrames) * 100);
    ($("exportProgress") as HTMLElement).style.width = pct + "%";
    $("exportStatus").textContent = `Encoding... ${pct}%`;
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  // Finalize
  let blob: Blob;
  if (useWC && encoder && muxer) {
    await encoder.flush();
    muxer.finalize();
    blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  } else {
    blob = new Blob([], { type: "video/mp4" });
  }

  ($("exportProgress") as HTMLElement).style.width = "100%";
  const totalTime = ((performance.now() - totalStart) / 1000).toFixed(1);
  $("exportStatus").textContent = "Done!";
  $("exportStatus").className = "status success";

  const url = URL.createObjectURL(blob);
  ($("outputVideo") as HTMLVideoElement).src = url;
  $("metricSize").textContent = (blob.size / 1024 / 1024).toFixed(1) + "MB";
  $("metricTotal").textContent = totalTime + "s";
  $("metricRes").textContent = `${encW}x${encH}`;
  $("resultCard").classList.remove("hidden");
  $("downloadBtn").onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "reframed_9x16.mp4";
    a.click();
  };
  ($("exportBtn") as HTMLButtonElement).disabled = false;
});

// --- Helpers ---

function getPositionAtTime(time: number, duration: number): number {
  if (frames.length === 0) return 0.5;
  // Find surrounding frames and interpolate
  const idx = (time / duration) * frames.length;
  const lo = Math.max(0, Math.floor(idx));
  const hi = Math.min(frames.length - 1, Math.ceil(idx));
  if (lo === hi) return frames[lo]?.x ?? 0.5;
  const t = idx - lo;
  return (frames[lo]?.x ?? 0.5) * (1 - t) + (frames[hi]?.x ?? 0.5) * t;
}

async function detectMotion(
  video: HTMLVideoElement,
  n: number
): Promise<{ time: number; x: number }[]> {
  const pos: { time: number; x: number }[] = [];
  const step = video.duration / n;
  const dw = 160;
  const dh = Math.round(160 * (video.videoHeight / video.videoWidth));
  const c = document.createElement("canvas");
  c.width = dw;
  c.height = dh;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  let prev: ImageData | null = null;

  for (let i = 0; i < n; i++) {
    video.currentTime = i * step;
    await new Promise((r) =>
      video.addEventListener("seeked", r, { once: true })
    );
    ctx.drawImage(video, 0, 0, dw, dh);
    const d = ctx.getImageData(0, 0, dw, dh);

    if (prev) {
      let sx = 0;
      let cnt = 0;
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
      pos.push({
        time: i * step,
        x: cnt > 50 ? sx / cnt / dw : (pos[pos.length - 1]?.x ?? 0.5),
      });
    } else {
      pos.push({ time: 0, x: 0.5 });
    }

    prev = d;
    ($("analyzeProgress") as HTMLElement).style.width =
      Math.round((i / n) * 100) + "%";
  }
  return pos;
}

function smoothPositions(
  p: { time: number; x: number }[],
  w = 5
): { time: number; x: number }[] {
  return p.map((v, i) => {
    const s = Math.max(0, i - Math.floor(w / 2));
    const e = Math.min(p.length, i + Math.ceil(w / 2));
    return {
      time: v.time,
      x: p.slice(s, e).reduce((a, b) => a + b.x, 0) / (e - s),
    };
  });
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, "0")}`;
}

// --- Play preview ---
let playing = false;

$("playPreviewBtn").addEventListener("click", async () => {
  if (playing) {
    playing = false;
    $("playPreviewBtn").textContent = "▶ Play";
    return;
  }

  playing = true;
  $("playPreviewBtn").textContent = "⏸ Stop";

  const startIdx = currentIdx;
  for (let i = startIdx; i < frames.length && playing; i++) {
    if (frames[i]!.skipped) continue;
    goToFrame(i);
    await drawCropEditor();
    // ~10fps playback
    await new Promise((r) => setTimeout(r, 100));
  }

  playing = false;
  $("playPreviewBtn").textContent = "▶ Play";
});

// --- Keyboard navigation ---
document.addEventListener("keydown", (e) => {
  if (!$("editorCard").classList.contains("hidden")) {
    if (e.key === "ArrowLeft") {
      let next = currentIdx - 1;
      while (next >= 0 && frames[next]!.skipped) next--;
      if (next >= 0) goToFrame(next);
    }
    if (e.key === "ArrowRight") {
      let next = currentIdx + 1;
      while (next < frames.length && frames[next]!.skipped) next++;
      if (next < frames.length) goToFrame(next);
    }
  }
});

// Init drag on load
setupCropDrag();
