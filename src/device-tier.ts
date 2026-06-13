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

  // Fallback: assume low on mobile (conservative)
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  return isMobile ? "low" : "high";
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
  // High tier also defaults to 720p — social platforms deliver 720p to most viewers,
  // and 720p encodes ~2x faster than 1080p with negligible quality difference on phones.
  return {
    maxEncodeQueue: 5,
    yieldEvery: 5,
    maxConsecutive: 60,
    outputWidth: 720,
    outputHeight: 1280,
    yieldMs: 0,
  };
}
