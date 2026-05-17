# Requirements: Video Reframe

**Defined:** 2026-05-17
**Core Value:** Landscape video → professional-looking branded vertical short in under 2 minutes, from a phone.

## v1 Requirements

### Export Pipeline

- [ ] **EXPORT-01**: Export pipeline uses memory-safe VideoFrame lifecycle (close frames after encode)
- [ ] **EXPORT-02**: Export pipeline supports overlay composition step between frame draw and encode
- [ ] **EXPORT-03**: Encoder backpressure handling prevents queue overflow on mid-range devices

### Brand Kit

- [ ] **BRAND-01**: User can upload channel logo (PNG/SVG) that persists across sessions
- [ ] **BRAND-02**: User can set primary and accent brand colors
- [ ] **BRAND-03**: Brand kit stored in localStorage and applied to all overlay templates
- [ ] **BRAND-04**: User can position logo (corner selection: TL/TR/BL/BR)

### Overlays

- [ ] **OVRL-01**: Animated intro bumper plays at video start (2-3s, uses brand colors + logo)
- [ ] **OVRL-02**: Animated lower third overlay with channel name/handle
- [ ] **OVRL-03**: Kinetic text overlay — at least one animated text style with high-energy feel
- [ ] **OVRL-04**: Logo watermark composited onto every frame of output at chosen position
- [ ] **OVRL-05**: Smooth animated transitions between cut segments (when skip ranges create jumps)

### Template System

- [ ] **TMPL-01**: Overlay compositions defined as HTML+GSAP timelines (Hyperframes pattern)
- [ ] **TMPL-02**: Templates rendered frame-by-frame using GSAP seek() + canvas draw
- [ ] **TMPL-03**: At least 1 cohesive template that applies intro + lower third + watermark as a package

### Performance

- [ ] **PERF-01**: Full export with overlays completes within 3× the time of plain export
- [ ] **PERF-02**: No OOM crashes on devices with 4GB RAM (60s video max)
- [ ] **PERF-03**: Overlay rendering adds < 100ms per frame average on target hardware

## v2 Requirements

### Premium Overlays

- **PREM-01**: Multiple template styles to choose from (3-5 visual themes)
- **PREM-02**: Beat-sync — overlay timing aligned to audio beats
- **PREM-03**: Animated accent graphics (particles, shapes, energy bursts)
- **PREM-04**: Custom font upload for brand typography

### Platform

- **PLAT-01**: Full Safari iOS support
- **PLAT-02**: Offline mode (service worker caches templates)
- **PLAT-03**: Export progress survives app backgrounding on mobile

## Out of Scope

| Feature | Reason |
|---------|--------|
| Captions/subtitles | No transcript source, complex timing problem |
| Server-side rendering | Must be 100% on-device |
| Audio processing | Video-only for v1 |
| Multi-video editing | One video per session |
| Stock media library | Bloats bundle, off-brand content |
| Social scheduling/posting | Different product category |
| Hyperframes CLI rendering | Requires Node/Bun, not available client-side |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXPORT-01 | Phase 1 | Pending |
| EXPORT-02 | Phase 1 | Pending |
| EXPORT-03 | Phase 1 | Pending |
| BRAND-01 | Phase 2 | Pending |
| BRAND-02 | Phase 2 | Pending |
| BRAND-03 | Phase 2 | Pending |
| BRAND-04 | Phase 2 | Pending |
| TMPL-01 | Phase 2 | Pending |
| TMPL-02 | Phase 2 | Pending |
| TMPL-03 | Phase 3 | Pending |
| OVRL-01 | Phase 3 | Pending |
| OVRL-02 | Phase 3 | Pending |
| OVRL-03 | Phase 3 | Pending |
| OVRL-04 | Phase 3 | Pending |
| OVRL-05 | Phase 3 | Pending |
| PERF-01 | Phase 4 | Pending |
| PERF-02 | Phase 4 | Pending |
| PERF-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-17*
*Last updated: 2026-05-17 after initial definition*
