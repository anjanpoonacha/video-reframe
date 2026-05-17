---
phase: 04-performance-hardening
plan: 01
subsystem: export
tags: [webcodecs, canvas, performance, device-memory, backpressure]

# Dependency graph
requires:
  - phase: 03-animated-overlays
    provides: Cross-fade transitions with OffscreenCanvas double-buffer
provides:
  - Device tier detection utility (DeviceTier, PerformancePreset)
  - Adaptive export pipeline with tier-aware resolution, backpressure, and yield
  - OOM-safe cross-fade via canvas-to-canvas drawImage (no getImageData)
affects: [04-performance-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns: [device-tier-adaptive-settings, canvas-to-canvas-copy, consecutive-frame-yield-counter]

key-files:
  created: [src/device-tier.ts]
  modified: [src/export.ts]

key-decisions:
  - "Two-tier device classification (high/low) using navigator.deviceMemory with UA fallback"
  - "Low-tier preset: 720x1280, queue=3, yield every 3, 16ms yield delay"
  - "Eliminated getImageData OOM vector with prevCanvas drawImage approach"
  - "Hard yield cap of 60 consecutive frames regardless of device tier"

patterns-established:
  - "Device tier detection: navigator.deviceMemory with conservative mobile fallback"
  - "Adaptive preset pattern: detect tier → get preset → thread through pipeline constants"
  - "Canvas-to-canvas copy for frame buffer instead of ImageData allocation"

requirements-completed: [PERF-01, PERF-02]

# Metrics
duration: 2min
completed: 2026-05-17
---

# Phase 4 Plan 01: Device Tier Detection & Adaptive Export Summary

**Device tier detection with adaptive 720p/1080p resolution, backpressure tuning, yield frequency, and getImageData OOM elimination via canvas-to-canvas drawImage**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-17T19:16:30Z
- **Completed:** 2026-05-17T19:18:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created device tier detection utility classifying devices as high/low based on navigator.deviceMemory
- Adapted export pipeline resolution from hardcoded 1080x1920 to tier-aware (720x1280 low / 1080x1920 high)
- Eliminated per-frame getImageData OOM vector — replaced with GPU-accelerated drawImage between OffscreenCanvases
- Implemented adaptive backpressure (queue threshold 3 vs 5) and yield frequency (every 3 vs 5 frames)
- Enforced hard cap of 60 consecutive frames without yield regardless of tier

## Task Commits

Each task was committed atomically:

1. **Task 1: Create device tier detection utility** - `8d62f7f` (feat)
2. **Task 2: Adapt export pipeline for tier-aware settings** - `ee1b989` (feat)

## Files Created/Modified
- `src/device-tier.ts` - Device classification utility with DeviceTier type, PerformancePreset interface, detectDeviceTier and getPerformancePreset functions
- `src/export.ts` - Refactored export pipeline using adaptive preset settings, prevCanvas for cross-fade, consecutiveFrames yield counter

## Decisions Made
- Two-tier (high/low) classification is sufficient — mid-tier adds complexity without clear benefit for the target device class
- 16ms yield delay on low-tier matches requestAnimationFrame cadence, giving GPU time to drain
- prevCanvas allocated once before loop (not per-frame) per D-03/D-04 constraints
- Optional deviceTier in ExportConfig allows testing/overriding without touching detection logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing @types/dom-webcodecs type conflict (`BufferSource` vs `AllowSharedBufferSource`) requires --skipLibCheck; unrelated to this plan's changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Device tier detection and adaptive export are complete
- Ready for additional performance hardening plans (thermal detection, text measurement caching, overlay skip optimization)

---
*Phase: 04-performance-hardening*
*Completed: 2026-05-17*
