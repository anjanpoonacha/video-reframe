# Roadmap: Video Reframe

## Overview

Transform the existing crop-and-export pipeline into a branded content production tool by adding overlay composition to the export loop, a brand kit + template system, animated overlay library, and performance hardening for mid-range mobile devices. Four phases deliver end-to-end: each phase produces a working export with progressively richer output.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Overlay-Ready Export** - Memory-safe export pipeline with overlay composition injection point
- [ ] **Phase 2: Brand Kit & Templates** - User configures brand identity and template engine renders overlays frame-by-frame
- [ ] **Phase 3: Animated Overlays** - Full branded output with intro, lower third, text, watermark, and transitions
- [ ] **Phase 4: Performance Hardening** - Smooth export on Snapdragon 770 class devices without OOM or thermal throttle

## Phase Details

### Phase 1: Overlay-Ready Export
**Goal**: Export pipeline safely composites overlay graphics onto video frames without leaking memory or crashing the encoder
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03
**Success Criteria** (what must be TRUE):
  1. User can export a video with a hardcoded test overlay composited onto every frame
  2. Export completes a 60s video without memory warnings or OOM crash on a 4GB device
  3. Export never drops frames or corrupts output when encoder queue is saturated
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

### Phase 2: Brand Kit & Templates
**Goal**: User sets up their channel brand (logo, colors) once, and the template engine renders overlays frame-by-frame using GSAP seek + SnapDOM
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: BRAND-01, BRAND-02, BRAND-03, BRAND-04, TMPL-01, TMPL-02
**Success Criteria** (what must be TRUE):
  1. User can upload a logo and pick brand colors that persist across sessions
  2. User can choose a logo corner position (TL/TR/BL/BR) and see it applied in export
  3. Template engine renders a GSAP-driven HTML overlay frame-by-frame via seek(t) + canvas rasterization
  4. Brand kit values (colors, logo) flow into template rendering automatically
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 02-01: TBD

### Phase 3: Animated Overlays
**Goal**: Exported video looks professionally produced — animated intro, lower third, kinetic text, persistent watermark, and smooth transitions between cuts
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: OVRL-01, OVRL-02, OVRL-03, OVRL-04, OVRL-05, TMPL-03
**Success Criteria** (what must be TRUE):
  1. Exported video starts with a 2-3s animated intro bumper using the user's brand colors and logo
  2. Lower third overlay with channel name/handle animates in during playback
  3. At least one kinetic text style with high-energy animated entrance is available
  4. Logo watermark appears on every frame at the user's chosen position
  5. Skip-range cuts produce smooth animated transitions instead of hard jumps
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD

### Phase 4: Performance Hardening
**Goal**: Full overlay export runs reliably on Snapdragon 770 devices within acceptable time and memory budgets
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. Export with all overlays completes within 3× the time of a plain (no-overlay) export
  2. A 60s video exports without OOM crash on a 4GB RAM device
  3. Overlay rendering averages under 100ms per frame on target hardware
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Overlay-Ready Export | 0/? | Not started | - |
| 2. Brand Kit & Templates | 0/? | Not started | - |
| 3. Animated Overlays | 0/? | Not started | - |
| 4. Performance Hardening | 0/? | Not started | - |
