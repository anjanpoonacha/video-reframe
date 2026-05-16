# Spike Manifest

## Idea
Explore intuitive frame-level CRUD for the Video Reframe app — enabling users to see, navigate, edit crop positions, and delete/skip individual frames before export. Currently the app auto-detects motion and applies a single reframe pass; this spike validates whether interactive per-frame control is feasible and what UX patterns feel natural.

## Requirements

- Must work 100% client-side (no server, matches existing architecture)
- Frame access must be fast enough for interactive scrubbing (<50ms per frame seek)
- UI must be mobile-first (existing app is PWA deployed to GitHub Pages)
- Must integrate with existing Bun + TypeScript build setup
- Crop editing must use direct drag UX (not keyframes) — keyframes too complex/broken
- Frame seek P50 ~27ms is acceptable; pre-cache thumbnails for filmstrip

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | frame-extraction | standard | Given a loaded video, when the user scrubs a timeline, then individual frames render at that position in <50ms | VALIDATED | webcodecs, performance, canvas |
| 002 | frame-timeline-ui | standard | Given extracted frames, when displayed as a scrollable filmstrip, then the user can visually browse and select frames intuitively | PARTIAL | ui, filmstrip, navigation |
| 003a | frame-crop-edit-drag | comparison | Given a selected frame, when the user drags the crop region, then the reframe position updates visually in real-time | VALIDATED (WINNER) | ui, crop, interaction |
| 003b | frame-crop-edit-keyframe | comparison | Given the timeline, when the user sets keyframe positions at specific frames, then the crop path interpolates smoothly between them | INVALIDATED | ui, keyframes, interpolation |
| 004 | frame-delete-skip | standard | Given selected frames, when the user marks them for deletion, then those frames are excluded from the final export | VALIDATED | export, filtering |
