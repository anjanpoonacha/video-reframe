---
spike: 003b
name: frame-crop-keyframe
type: comparison
validates: "Given the timeline, when the user sets keyframe positions at specific frames, then the crop path interpolates smoothly between them"
verdict: INVALIDATED
related: [003a, 001, 002]
tags: [ui, keyframes, interpolation, animation]
---

# Spike 003b: Keyframe Crop

## What This Validates
Given the timeline, when the user sets keyframe positions at specific frames, then the crop path interpolates smoothly between them.

## Research
Keyframe-based editing is the professional approach (After Effects, DaVinci Resolve, CapCut Pro). Key considerations:
- Users set positions at specific moments, software interpolates between them
- Smooth (ease in-out) interpolation feels more natural than linear
- Visual: dots on timeline show where keyframes are set
- "Play Preview" lets user see the full interpolated path

**Interpolation:** smoothstep `t² × (3 - 2t)` — same as CSS ease-in-out, avoids harsh transitions.

## How to Run
```bash
bun .planning/spikes/003-b-frame-crop-keyframe/serve.ts
```
Open http://localhost:3004

## What to Expect
1. Load video → see frame with crop overlay
2. Seek to a time, adjust crop position, click "Add Keyframe"
3. Repeat at different times → dots appear on timeline
4. Seek between keyframes → position auto-interpolates
5. Click "Play Preview" → see smooth crop path animate through video

## Investigation Trail
- Smoothstep interpolation for natural motion between keyframes
- Keyframe markers on timeline (clickable to jump)
- List view for managing keyframes (with remove)
- Play preview at 10fps to verify smoothness

## Results
**INVALIDATED** — Did not work in testing. The keyframe approach is too complex for this use case — requires understanding the concept of keyframes, adds cognitive load with the timeline markers, and the interpolation preview isn't intuitive enough. Direct drag (003a) won decisively. Do NOT use keyframes for crop editing in the real build.
