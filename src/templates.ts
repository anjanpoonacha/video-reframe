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

      // Plate background (dark glass effect)
      ctx.globalAlpha = state.plateAlpha * 0.88 * m;
      ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
      ctx.beginPath();
      ctx.roundRect(plateX, plateY, plateW, plateH, cornerRadius);
      ctx.fill();

      // Subtle inner border (glass edge)
      ctx.strokeStyle = `rgba(255, 255, 255, ${state.plateAlpha * 0.08 * m})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(plateX + 0.5, plateY + 0.5, plateW - 1, plateH - 1, cornerRadius);
      ctx.stroke();

      // Primary color left edge accent
      ctx.globalAlpha = state.plateAlpha * 0.95 * m;
      ctx.fillStyle = brandKit.primaryColor;
      ctx.beginPath();
      ctx.roundRect(plateX, plateY, Math.round(4 * scale), plateH, [cornerRadius, 0, 0, cornerRadius]);
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

// --- Template Registry ---

export const TEMPLATE_REGISTRY: TemplateDefinition[] = [lowerThirdTemplate];

// --- Active template accessor ---

export async function getActiveTemplate(): Promise<TemplateInstance> {
  const brandKit = loadBrandKit();
  return lowerThirdTemplate.create(brandKit);
}

export type { BrandKit };
