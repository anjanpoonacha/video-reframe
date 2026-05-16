---
spike: 003a
name: frame-crop-drag
type: comparison
validates: "Given a selected frame, when the user drags the crop region, then the reframe position updates visually in real-time"
verdict: VALIDATED
related: [003b, 001, 002]
tags: [ui, crop, interaction, drag, touch]
---

# Spike 003a: Drag Crop

## What This Validates
Given a selected frame, when the user drags the crop region, then the reframe position updates visually in real-time.

## Research
Drag-based crop editing is the dominant pattern in mobile video editors (CapCut, InShot, Instagram Reels editor). The key UX considerations:
- Must work with touch (not just mouse)
- Visual feedback must be immediate (no lag between drag and update)
- The dimmed area outside crop provides spatial context
- Click-anywhere-to-set is a good shortcut for quick repositioning

## How to Run
```bash
bun .planning/spikes/003-a-frame-crop-drag/serve.ts
```
Open http://localhost:3003

## What to Expect
1. Load video → see full-width frame with 9:16 crop region overlay
2. Drag the highlighted crop region left/right → result preview updates instantly
3. Click anywhere on the frame → crop snaps to that position
4. Seek slider lets you check crop on different frames
5. Touch works on mobile

## Investigation Trail
- Built with pointer events for unified mouse+touch handling
- Box-shadow trick creates the dimmed overlay without extra elements
- Result canvas redraws on every drag frame — testing if this causes jank

## Results
**VALIDATED (WINNER)** — Direct drag feels intuitive and immediate. User chose this over keyframe approach. The real-time preview update during drag provides the right feedback loop. This is the UX pattern to use for crop editing in the real build.
