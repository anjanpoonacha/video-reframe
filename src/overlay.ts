// --- Overlay types and implementations ---

export type OverlayRenderFn = (
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number,
) => void;

export const renderTestOverlay: OverlayRenderFn = (ctx, _t, w, h) => {
  ctx.save();

  // Lower-third semi-transparent bar (12% height, 8% from bottom)
  const barH = h * 0.12;
  const barY = h - barH - h * 0.08;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, barY, w, barH);

  // White text centered in bar
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(barH * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OVERLAY TEST", w / 2, barY + barH / 2);

  ctx.restore();
};
