---
status: root_cause_found
trigger: "There are some issues in the logic of the motion detection. Segment minimum time logic may be affecting motion tracking. Crop panel becomes offset after large screen pan."
created: 2026-05-17
updated: 2026-05-17
---

# Debug: Motion Detection Logic

## Symptoms

- **Expected behavior:** Correct x-position detection — crop should accurately follow subject position
- **Actual behavior:** Wide screen → character moves → crop adjusts → large screen pan → crop panel is now offset. Minimum time in segment logic suspected of interfering with motion tracking.
- **Error messages:** No errors, just wrong output
- **Timeline:** Never verified it works correctly
- **Reproduction:** Any video with movement

## Current Focus

hypothesis: Motion detection centroid algorithm collapses to ~0.5 during camera pans (whole-frame change), and never recovers because stationary subjects produce no motion to update position.
test: Trace math of detectMotion() during a pan — does sx/cnt/dw → 0.5 when all pixels change?
expecting: If all pixels change uniformly across frame, centroid = center = 0.5, regardless of subject position.
next_action: Root cause confirmed via code analysis. Propose fix.

## Evidence

- timestamp: 2026-05-17 | `src/main.ts:462-463` — centroid calculation: `x: cnt > 50 ? sx / cnt / dw : (pos[pos.length-1]?.x ?? 0.5)` — uniform pixel change during pan collapses centroid to ~0.5
- timestamp: 2026-05-17 | `src/main.ts:477-488` — `smoothPositions(w=5)` moving average spreads bad pan-frame values into adjacent good frames
- timestamp: 2026-05-17 | No "segment" or "minimum time" logic exists in the codebase — the perceived lag is centroid collapse + smoothing window interaction

## Root Cause

`detectMotion()` uses centroid-of-all-changed-pixels as crop position. During camera pans the entire frame changes uniformly, collapsing the centroid to ~0.5 (center). After the pan settles, the subject is stationary so the fallback carries the incorrect 0.5 forward indefinitely. The smoothing window (w=5) further spreads this bad value.

## Proposed Fixes

1. **Pan detection + skip:** When `cnt / (dw*dh) > 0.6`, classify as pan frame and carry forward last good position
2. **Pan detection + re-anchor:** Accumulate directional shift during pan, offset pre-pan position by accumulated shift
3. **Subject re-detection:** After pan settles, run fresh subject finder on post-pan frame to re-anchor

## Specialist Review

- Make `panThreshold` configurable (0.6 is reasonable default, but varies by content)
- Carry-forward alone creates jump artifacts when tracking resumes — route pan-recovery through existing smoothing/EMA
- Pre-compute `totalPixels = dw * dh` outside the frame loop
- Verify `pos` is a standard array (not typed array) for optional chaining to work
- Recommended: implement minimum fix (pan detect + carry-forward + smoothing) first; subject re-detection is a separate enhancement

## Eliminated

- "Minimum time in segment logic" — no such logic exists; the perceived issue is centroid collapse + smoothing

- hypothesis: Explicit "segment minimum time" logic interferes with tracking
  evidence: No such code exists in src/main.ts. No segment concept, no minimum time constants. Only smoothPositions(w=5) exists as temporal constraint.
  timestamp: 2026-05-17

## Resolution

root_cause: detectMotion() uses centroid-of-changed-pixels as position. During camera pans, the entire frame changes uniformly → centroid collapses to ~0.5 (frame center). After the pan, the subject is stationary at a new position but produces no motion → fallback carries the incorrect 0.5 forward. smoothPositions(w=5) further bleeds these bad values into neighboring frames.
fix: 
verification: 
files_changed: []
