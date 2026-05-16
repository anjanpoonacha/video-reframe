---
spike: 002
name: frame-timeline-ui
type: standard
validates: "Given extracted frames, when displayed as a scrollable filmstrip, then the user can visually browse and select frames intuitively"
verdict: PARTIAL
related: [001, 003a, 003b, 004]
tags: [ui, filmstrip, navigation, mobile]
---

# Spike 002: Frame Timeline UI

## What This Validates
Given extracted frames, when displayed as a scrollable filmstrip, then the user can visually browse and select frames intuitively.

## Research
Key UX patterns for video frame navigation:
- **Filmstrip scrubbing** (iMovie, CapCut) — horizontal scroll of thumbnails, tap to jump
- **Scroll-snap** — CSS `scroll-snap-type: x mandatory` for discrete frame landing
- **Dual mode** — separate navigate vs. multi-select modes to avoid accidental selection
- **Keyboard** — arrow keys for frame-by-frame, space to select, delete to remove

**Chosen approach:** Mobile-first filmstrip with scroll-snap, dual mode (navigate/select), keyboard shortcuts for desktop. Deleted frames shown dimmed with × overlay, skipped during navigation.

## How to Run
```bash
bun .planning/spikes/002-frame-timeline-ui/serve.ts
```
Open http://localhost:3002

## What to Expect
1. Load a video → auto-extracts ~2fps thumbnail filmstrip
2. **Navigate mode (default):** tap any frame to preview full-res, use ← → arrows
3. **Select mode:** toggle with "S" key or button, tap frames to select (green border)
4. **Delete:** select frames, press "D" or Delete button — frames dim and are skipped in navigation
5. Mobile: horizontal swipe on filmstrip, tap to navigate

## Investigation Trail
- Built with 9:16 aspect thumbnails (matching output format)
- Scroll-snap gives satisfying frame-by-frame feel
- Dual mode prevents accidental select during browse
- Deleted frames visually distinct but remain in timeline (non-destructive)

## Results
**PARTIAL** — Functionally works but UX is "ok I guess" — not delightful. The filmstrip navigation concept is valid but needs polish. Likely needs: larger thumbnails, smoother scroll inertia, better active-frame highlight, or a different visual treatment to feel premium.
