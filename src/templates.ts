import { gsap } from "gsap";
import type { OverlayRenderFn } from "./overlay";
import { loadBrandKit, type BrandKit } from "./brand-kit";

// --- Interfaces ---

export interface TemplateInstance {
  render: OverlayRenderFn;
  dispose(): void;
}

export interface TemplateDefinition {
  name: string;
  duration: number;
  create(brandKit: BrandKit): Promise<TemplateInstance>;
}

// --- Safe zone constants (conservative cross-platform) ---
// YouTube Shorts: largest bottom UI at 20%
// TikTok/Reels: right engagement stack 9%, bottom 15%

const SAFE_ZONE = {
  top: 0.10,
  bottom: 0.20,
  left: 0.05,
  right: 0.12,
};

// --- Color helpers ---

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// --- Logo helpers ---

function getLogoPosition(
  position: "TL" | "TR" | "BL" | "BR",
  logoW: number,
  logoH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const insetX = canvasW * SAFE_ZONE.left;
  const insetY = canvasH * SAFE_ZONE.top;
  const rightInset = canvasW * SAFE_ZONE.right;
  const bottomInset = canvasH * SAFE_ZONE.bottom;

  switch (position) {
    case "TL": return { x: insetX, y: insetY };
    case "TR": return { x: canvasW - rightInset - logoW, y: insetY };
    case "BL": return { x: insetX, y: canvasH - bottomInset - logoH };
    case "BR": return { x: canvasW - rightInset - logoW, y: canvasH - bottomInset - logoH };
  }
}

async function decodeLogo(dataUrl: string): Promise<ImageBitmap> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

// --- Default logo: clean circular monogram ---

function drawDefaultLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  brandKit: BrandKit,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const radius = size / 2;

  // Circular background with brand accent
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = brandKit.accentColor;
  ctx.fill();

  // Monogram letter (first letter of channel name)
  const letter = (brandKit.channelName || "M")[0]!.toUpperCase();
  const { r, g, b } = hexToRgb(brandKit.accentColor);
  const isDark = rgbToLuminance(r, g, b) < 0.5;
  ctx.fillStyle = isDark ? "#ffffff" : "#000000";
  ctx.font = `bold ${Math.round(size * 0.5)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, cx, cy + 1);
}

// --- Professional Lower-Third Template ---
// Inspired by high-budget shorts: layered nameplate with accent bar,
// clean typography, subtle glass effect, breathing negative space

export const lowerThirdTemplate: TemplateDefinition = {
  name: "Pro Lower Third",
  duration: 4.0,

  async create(brandKit: BrandKit): Promise<TemplateInstance> {
    const logoBitmap = brandKit.logo ? await decodeLogo(brandKit.logo) : null;

    // D-07: Pre-compute text widths at create() time (avoid per-frame measureText)
    const measureCanvas = new OffscreenCanvas(1, 1);
    const measureCtx = measureCanvas.getContext("2d")!;
    measureCtx.font = `600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const channelNameWidth = measureCtx.measureText(brandKit.channelName).width;

    // Animation state driven by GSAP seek
    const state = {
      accentBarWidth: 0,
      plateAlpha: 0,
      plateSlide: 20,
      textAlpha: 0,
      logoAlpha: 0,
      logoScale: 0.8,
      masterAlpha: 1,
    };

    // Premium animation: intro (1.2s) → hold (2s) → fade out (0.8s) = ~4s total
    const tl = gsap.timeline({ paused: true });
    // Intro: accent bar → plate slides in → text fades → logo pops
    tl.to(state, { accentBarWidth: 1, duration: 0.25, ease: "power3.out" })
      .to(state, { plateAlpha: 1, plateSlide: 0, duration: 0.35, ease: "power2.out" }, 0.1)
      .to(state, { textAlpha: 1, duration: 0.3, ease: "power1.out" }, 0.25)
      .to(state, { logoAlpha: 1, logoScale: 1, duration: 0.4, ease: "back.out(1.4)" }, 0.15)
      // Hold for 2s then fade out everything
      .to(state, { masterAlpha: 0, duration: 0.8, ease: "power2.inOut" }, 3.2);

    const render: OverlayRenderFn = (ctx, time, w, h) => {
      // Skip rendering entirely after fade-out completes
      if (time > 4.0) return;

      ctx.save();
      tl.seek(time);

      const m = state.masterAlpha; // Master fade multiplier
      const scale = w / 1080; // Design at 1080 baseline, scale proportionally

      // --- Lower-third nameplate ---
      const plateH = Math.round(56 * scale);
      const plateY = h - h * SAFE_ZONE.bottom - plateH - Math.round(16 * scale);
      const plateX = Math.round(w * SAFE_ZONE.left) + state.plateSlide * scale;
      const plateW = Math.round(w * 0.65);
      const cornerRadius = Math.round(6 * scale);

      // Accent bar (thin colored line above plate)
      const accentH = Math.round(3 * scale);
      ctx.globalAlpha = (state.accentBarWidth > 0 ? 0.95 : 0) * m;
      ctx.fillStyle = brandKit.accentColor;
      ctx.fillRect(plateX, plateY - accentH - 2 * scale, plateW * state.accentBarWidth, accentH);

      // Plate background (frosted glass — light, airy, non-intrusive)
      ctx.globalAlpha = state.plateAlpha * 0.55 * m;
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.roundRect(plateX, plateY, plateW, plateH, cornerRadius);
      ctx.fill();

      // Soft glow border (subtle light edge instead of hard outline)
      ctx.globalAlpha = state.plateAlpha * 0.15 * m;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.roundRect(plateX + 0.5, plateY + 0.5, plateW - 1, plateH - 1, cornerRadius);
      ctx.stroke();

      // Primary color left edge accent (thin, elegant)
      ctx.globalAlpha = state.plateAlpha * 0.9 * m;
      ctx.fillStyle = brandKit.primaryColor;
      ctx.beginPath();
      ctx.roundRect(plateX, plateY, Math.round(3 * scale), plateH, [cornerRadius, 0, 0, cornerRadius]);
      ctx.fill();

      // Channel name text
      ctx.globalAlpha = state.textAlpha * m;
      ctx.fillStyle = "#ffffff";
      const fontSize = Math.round(18 * scale);
      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const textX = plateX + Math.round(16 * scale);
      ctx.fillText(brandKit.channelName, textX, plateY + plateH / 2);

      // --- Logo at chosen corner ---
      const logoSize = Math.round(48 * scale);
      const pos = getLogoPosition(brandKit.logoPosition, logoSize, logoSize, w, h);

      ctx.globalAlpha = state.logoAlpha * m;
      const logoDrawSize = logoSize * state.logoScale;
      const logoOffset = (logoSize - logoDrawSize) / 2;

      if (logoBitmap) {
        // Circular clip for uploaded logo
        ctx.save();
        ctx.beginPath();
        ctx.arc(
          pos.x + logoSize / 2,
          pos.y + logoSize / 2,
          logoDrawSize / 2,
          0,
          Math.PI * 2,
        );
        ctx.clip();
        ctx.drawImage(
          logoBitmap,
          pos.x + logoOffset,
          pos.y + logoOffset,
          logoDrawSize,
          logoDrawSize,
        );
        ctx.restore();

        // Ring border around logo
        ctx.globalAlpha = state.logoAlpha * 0.6 * m;
        ctx.strokeStyle = brandKit.primaryColor;
        ctx.lineWidth = Math.round(2 * scale);
        ctx.beginPath();
        ctx.arc(pos.x + logoSize / 2, pos.y + logoSize / 2, logoDrawSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Default monogram logo
        drawDefaultLogo(ctx, pos.x + logoOffset, pos.y + logoOffset, logoDrawSize, brandKit);
      }

      ctx.restore();
    };

    const dispose = () => {
      tl.kill();
      logoBitmap?.close();
    };

    return { render, dispose };
  },
};

// --- Pro Pack Composite Template ---
// Bundles: animated intro bumper, enhanced lower-third with handle,
// and persistent watermark into one cohesive overlay.

export const proPackTemplate: TemplateDefinition = {
  name: "Pro Pack",
  duration: Infinity,

  async create(brandKit: BrandKit): Promise<TemplateInstance> {
    const logoBitmap = brandKit.logo ? await decodeLogo(brandKit.logo) : null;

    // D-07: Pre-compute text widths at create() time (avoid per-frame measureText)
    const measureCanvas = new OffscreenCanvas(1, 1);
    const measureCtx = measureCanvas.getContext("2d")!;
    measureCtx.font = `600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const channelNameWidth = measureCtx.measureText(brandKit.channelName).width;
    measureCtx.font = `500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const channelHandleWidth = measureCtx.measureText(brandKit.channelHandle || "").width;

    const state = {
      // Intro bumper
      introLogoScale: 0.8,
      introLogoAlpha: 0,
      introNameAlpha: 0,
      introVignetteAlpha: 0,
      // Lower third
      lowerBarWidth: 0,
      lowerPlateAlpha: 0,
      lowerTextAlpha: 0,
      lowerHandleAlpha: 0,
      lowerMasterAlpha: 1,
      // Watermark
      watermarkAlpha: 0,
    };

    const tl = gsap.timeline({ paused: true });

    // INTRO BUMPER (0–2.5s)
    // Logo scales 80%→100% + fade-in over 0.6s
    tl.to(state, { introLogoScale: 1, introLogoAlpha: 1, duration: 0.6, ease: "power2.out" }, 0)
      .to(state, { introVignetteAlpha: 1, duration: 0.6, ease: "power2.out" }, 0)
      // Channel name fades in at 0.6s
      .to(state, { introNameAlpha: 1, duration: 0.4, ease: "power2.out" }, 0.6)
      // Everything fades out at 2.0s
      .to(state, { introLogoAlpha: 0, introNameAlpha: 0, introVignetteAlpha: 0, duration: 0.5, ease: "power2.inOut" }, 2.0);

    // WATERMARK snaps to visible at 2.5s (no animation per D-18)
    tl.set(state, { watermarkAlpha: 1 }, 2.5);

    // LOWER THIRD (2.5s–6.3s)
    tl.to(state, { lowerBarWidth: 1, duration: 0.25, ease: "power3.out" }, 2.5)
      .to(state, { lowerPlateAlpha: 1, duration: 0.35, ease: "power2.out" }, 2.6)
      .to(state, { lowerTextAlpha: 1, duration: 0.3, ease: "power2.out" }, 2.75)
      .to(state, { lowerHandleAlpha: 1, duration: 0.3, ease: "power2.out" }, 2.8)
      // Fade out at 5.5s (3s hold from 2.5s)
      .to(state, { lowerMasterAlpha: 0, duration: 0.8, ease: "power2.inOut" }, 5.5);

    const render: OverlayRenderFn = (ctx, time, w, h) => {
      ctx.save();
      tl.seek(time);

      const scale = w / 1080;

      // D-16: Watermark-only fast path — after lower-third fades (6.3s+), only watermark
      // renders. Skip intro and lower-third drawing entirely for the majority of frames.
      if (time >= 6.3) {
        const wmSize = Math.round(w * 0.05);
        const pos = getLogoPosition(brandKit.logoPosition, wmSize, wmSize, w, h);
        ctx.globalAlpha = state.watermarkAlpha * 0.25;

        if (logoBitmap) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x + wmSize / 2, pos.y + wmSize / 2, wmSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(logoBitmap, pos.x, pos.y, wmSize, wmSize);
          ctx.restore();
        } else {
          drawDefaultLogo(ctx, pos.x, pos.y, wmSize, brandKit);
        }

        ctx.restore();
        return;
      }

      // --- INTRO BUMPER (renders if time < 2.5s) ---
      if (time < 2.5) {
        // Dark vignette
        if (state.introVignetteAlpha > 0) {
          ctx.globalAlpha = state.introVignetteAlpha;
          const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(1, "rgba(0,0,0,0.3)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }

        // Logo centered
        if (state.introLogoAlpha > 0) {
          const logoSize = w * 0.15;
          const logoX = (w - logoSize) / 2;
          const logoY = (h - logoSize) / 2 - 20 * scale;
          const drawSize = logoSize * state.introLogoScale;
          const offset = (logoSize - drawSize) / 2;

          ctx.globalAlpha = state.introLogoAlpha;
          if (logoBitmap) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, drawSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(logoBitmap, logoX + offset, logoY + offset, drawSize, drawSize);
            ctx.restore();
          } else {
            drawDefaultLogo(ctx, logoX + offset, logoY + offset, drawSize, brandKit);
          }

          // Channel name below logo
          if (state.introNameAlpha > 0) {
            ctx.globalAlpha = state.introNameAlpha;
            ctx.fillStyle = "#ffffff";
            const fontSize = Math.round(w * 0.04);
            ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(brandKit.channelName, w / 2, logoY + logoSize + 12 * scale);
          }
        }
      }

      // --- WATERMARK (renders if time >= 2.5s) ---
      if (time >= 2.5 && state.watermarkAlpha > 0) {
        const wmSize = Math.round(w * 0.05);
        const pos = getLogoPosition(brandKit.logoPosition, wmSize, wmSize, w, h);
        ctx.globalAlpha = state.watermarkAlpha * 0.25;

        if (logoBitmap) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x + wmSize / 2, pos.y + wmSize / 2, wmSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(logoBitmap, pos.x, pos.y, wmSize, wmSize);
          ctx.restore();
        } else {
          drawDefaultLogo(ctx, pos.x, pos.y, wmSize, brandKit);
        }
      }

      // --- LOWER THIRD (renders if time >= 2.5 AND time < 6.3) ---
      if (time >= 2.5 && time < 6.3) {
        const m = state.lowerMasterAlpha;
        if (m > 0) {
          const plateH = Math.round(56 * scale);
          const plateY = h - h * SAFE_ZONE.bottom - plateH - Math.round(16 * scale);
          const plateX = Math.round(w * SAFE_ZONE.left);
          const plateW = Math.round(w * 0.65);
          const cornerRadius = Math.round(6 * scale);

          // Accent bar
          const accentH = Math.round(3 * scale);
          ctx.globalAlpha = (state.lowerBarWidth > 0 ? 0.95 : 0) * m;
          ctx.fillStyle = brandKit.accentColor;
          ctx.fillRect(plateX, plateY - accentH - 2 * scale, plateW * state.lowerBarWidth, accentH);

          // Plate background
          ctx.globalAlpha = state.lowerPlateAlpha * 0.55 * m;
          ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
          ctx.beginPath();
          ctx.roundRect(plateX, plateY, plateW, plateH, cornerRadius);
          ctx.fill();

          // Soft glow border
          ctx.globalAlpha = state.lowerPlateAlpha * 0.15 * m;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.roundRect(plateX + 0.5, plateY + 0.5, plateW - 1, plateH - 1, cornerRadius);
          ctx.stroke();

          // Primary color left edge
          ctx.globalAlpha = state.lowerPlateAlpha * 0.9 * m;
          ctx.fillStyle = brandKit.primaryColor;
          ctx.beginPath();
          ctx.roundRect(plateX, plateY, Math.round(3 * scale), plateH, [cornerRadius, 0, 0, cornerRadius]);
          ctx.fill();

          // Channel name text
          ctx.globalAlpha = state.lowerTextAlpha * m;
          ctx.fillStyle = "#ffffff";
          const fontSize = Math.round(18 * scale);
          ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          const textX = plateX + Math.round(16 * scale);
          const nameY = brandKit.channelHandle ? plateY + plateH * 0.38 : plateY + plateH / 2;
          ctx.fillText(brandKit.channelName, textX, nameY);

          // Handle text (second line, lighter, smaller)
          if (brandKit.channelHandle) {
            ctx.globalAlpha = state.lowerHandleAlpha * 0.6 * m;
            ctx.fillStyle = "#ffffff";
            const handleFontSize = Math.round(14 * scale);
            ctx.font = `500 ${handleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            ctx.fillText(brandKit.channelHandle, textX, plateY + plateH * 0.66);
          }
        }
      }



      ctx.restore();
    };

    const dispose = () => {
      tl.kill();
      logoBitmap?.close();
    };

    return { render, dispose };
  },
};

// --- Template Registry ---

export const TEMPLATE_REGISTRY: TemplateDefinition[] = [lowerThirdTemplate, proPackTemplate];

// --- Active template accessor ---

export interface EffectOptions {
  intro: boolean;
  lowerThird: boolean;
  watermark: boolean;
}

export async function getActiveTemplate(effects?: EffectOptions): Promise<TemplateInstance> {
  const brandKit = loadBrandKit();
  const instance = await proPackTemplate.create(brandKit);

  if (!effects || (effects.intro && effects.lowerThird && effects.watermark)) {
    return instance;
  }

  // Wrap render to skip disabled effects by time gating
  const originalRender = instance.render;
  const wrappedRender: typeof instance.render = (ctx, time, w, h) => {
    // Intro: 0–2.5s, Lower third: 2.5–6.3s, Watermark: 2.5s+
    const introActive = time < 2.5;
    const lowerThirdActive = time >= 2.5 && time < 6.3;
    const watermarkOnly = time >= 6.3;

    if (introActive && !effects.intro) return;
    if (watermarkOnly && !effects.watermark) return;
    if (lowerThirdActive && !effects.lowerThird && !effects.watermark) return;

    originalRender(ctx, time, w, h);
  };

  return { render: wrappedRender, dispose: instance.dispose };
}

export type { BrandKit };
