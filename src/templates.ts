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

const SAFE_ZONE = {
  top: 0.10,
  bottom: 0.20,
  left: 0.09,
  right: 0.09,
};

// --- Helpers ---

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

// --- Lower-Third Template ---

export const lowerThirdTemplate: TemplateDefinition = {
  name: "Lower Third",
  duration: 1.0,

  async create(brandKit: BrandKit): Promise<TemplateInstance> {
    const logoBitmap = brandKit.logo ? await decodeLogo(brandKit.logo) : null;

    const state = { barWidth: 0, textAlpha: 0, logoAlpha: 0 };

    const tl = gsap.timeline({ paused: true });
    tl.to(state, { barWidth: 1, duration: 0.4, ease: "power2.out" })
      .to(state, { textAlpha: 1, duration: 0.3 }, "-=0.1")
      .to(state, { logoAlpha: 1, duration: 0.3 }, "-=0.2");

    const render: OverlayRenderFn = (ctx, time, w, h) => {
      ctx.save();

      tl.seek(time);

      // Lower-third bar
      const barH = h * 0.10;
      const barY = h - barH - h * SAFE_ZONE.bottom;
      const barW = w * state.barWidth;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = brandKit.primaryColor;
      ctx.fillRect(0, barY, barW, barH);

      // Text on bar
      ctx.globalAlpha = state.textAlpha;
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(barH * 0.45)}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText("Channel", w * 0.04, barY + barH / 2);

      // Logo at chosen corner
      if (logoBitmap) {
        const logoSize = Math.round(w * 0.06);
        const pos = getLogoPosition(brandKit.logoPosition, logoSize, logoSize, w, h);
        ctx.globalAlpha = state.logoAlpha;
        ctx.drawImage(logoBitmap, pos.x, pos.y, logoSize, logoSize);
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
