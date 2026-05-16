---
spike: 004
name: frame-delete-skip
type: standard
validates: "Given selected frames, when the user marks them for deletion, then those frames are excluded from the final export"
verdict: VALIDATED
related: [002, 003a, 003b]
tags: [export, filtering, range-selection]
---

# Spike 004: Frame Delete/Skip

## What This Validates
Given selected frame ranges, when the user marks them for deletion, then those frames are excluded from the final export.

## Research
Two common approaches for marking frames to skip:
1. **Individual frame selection** (Spike 002 already validates this)
2. **Range-based marking** — "start here, end here" (like trimming in most video editors)

Range-based is more practical for video because users think in time segments, not individual frames.

**Chosen approach:** Range marking with visual feedback — mark start/end points, see segments color-coded (green=keep, red=skip), preview export plays only kept segments.

## How to Run
```bash
bun .planning/spikes/004-frame-delete-skip/serve.ts
```
Open http://localhost:3005

## What to Expect
1. Load video → see timeline bar with frame previews
2. Seek to a point → "Mark Start"
3. Seek further → "Mark End" → red range appears
4. Repeat for multiple ranges
5. Segment bar shows green/red breakdown
6. Stats update: keep/skip duration, cut count, output length
7. "Preview Export" plays only the green segments

## Investigation Trail
- Range-based feels more natural than frame-by-frame for skip/delete
- Visual segment bar provides instant feedback on what will be exported
- Undo is per-range (last-in-first-out)

## Results
**VALIDATED** — Range marking (start/end) works well for skipping segments. Visual segment bar and stats provide clear feedback. The approach is sound for the real build.
