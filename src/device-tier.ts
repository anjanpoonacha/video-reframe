// --- Device tier detection and performance presets ---

export type DeviceTier = "high" | "low";

export interface PerformancePreset {
  maxEncodeQueue: number;
  yieldEvery: number;
  maxConsecutive: number;
  outputWidth: number;
  outputHeight: number;
  yieldMs: number;
}

export function detectDeviceTier(): DeviceTier {
  const mem = (navigator as any).deviceMemory as number | undefined;
  if (mem !== undefined && mem <= 4) return "low";
  if (mem !== undefined && mem > 4) return "high";

  // Fallback: check cores as secondary signal (mid-range+ phones have 6+ cores)
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    const cores = navigator.hardwareConcurrency || 4;
    return cores >= 6 ? "high" : "low";
  }
  return "high";
}

export function getPerformancePreset(tier: DeviceTier): PerformancePreset {
  if (tier === "low") {
    return {
      maxEncodeQueue: 3,
      yieldEvery: 3,
      maxConsecutive: 60,
      outputWidth: 720,
      outputHeight: 1280,
      yieldMs: 16,
    };
  }
  return {
    maxEncodeQueue: 5,
    yieldEvery: 5,
    maxConsecutive: 60,
    outputWidth: 720,
    outputHeight: 1280,
    yieldMs: 0,
  };
}
