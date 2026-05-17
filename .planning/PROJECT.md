# Video Reframe

## What This Is

A mobile-first web app that converts 16:9 landscape videos into 9:16 portrait shorts with intelligent motion-based cropping, keyframe editing, and professional branded overlays. Built for content creators who post daily to Reels/TikTok/Shorts and need high-budget production value from their phone — running entirely on-device (no uploads, no server costs).

## Core Value

Landscape video → professional-looking branded vertical short in under 2 minutes, from a phone.

## Requirements

### Validated

- ✓ Upload video and detect motion for auto-crop positioning — Phase 0
- ✓ Keyframe-based crop editing with smooth interpolation — Phase 0
- ✓ Skip range marking (cut sections from output) — Phase 0
- ✓ WebCodecs-based 9:16 export with crop positions — Phase 0
- ✓ Session persistence (survives page refresh) — Phase 0

### Active

- [ ] Hyperframes integration — render animated overlays via HTML+GSAP compositions in-browser
- [ ] Branded logo/watermark overlay — user uploads channel logo, positioned on output
- [ ] Template system — pick a visual style (kinetic typography look) that applies cohesive branding
- [ ] Performance optimization — must run smoothly on Snapdragon 770 class devices
- [ ] High-budget visual feel — motion graphics, animated elements that make output look "produced"

### Out of Scope

- Captions/subtitles — deferred, no transcript source yet
- Server-side rendering — everything must run on-device
- Audio processing — video-only for now
- Multi-video editing — one video at a time

## Context

- Target device: Snapdragon 770 phones (mid-range Android 2024)
- Existing Hyperframes engine in sibling project (`short-video-creator/hyperframes-engine/`)
- Hyperframes uses HTML + GSAP timelines rendered at 1080x1920, composited as overlays
- Current export pipeline uses WebCodecs (VideoEncoder + mp4-muxer)
- Users are daily content creators — speed and consistency matter more than flexibility
- App deployed via GitHub Pages as a PWA

## Constraints

- **Performance**: Must render smoothly on Snapdragon 770 (limit GSAP complexity, minimize DOM nodes)
- **On-device**: Zero server dependencies — all rendering client-side
- **Bundle size**: Keep fast load on mobile networks — lazy-load Hyperframes compositions
- **Browser support**: Safari iOS 16+ and Chrome Android 90+ (WebCodecs required)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Browser rendering over CLI | Must work on phone, no Node/Bun available client-side | — Pending |
| Hyperframes for overlays | Already proven in sibling project, GSAP animations are lightweight | — Pending |
| Template-based (not freeform editor) | Speed for daily creators > flexibility for power users | — Pending |
| Kinetic typography style | High perceived production value with minimal rendering cost | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

---
*Last updated: 2026-05-17 after initialization*
