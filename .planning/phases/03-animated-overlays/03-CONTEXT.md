# Phase 3: Animated Overlays - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Full branded output: animated intro bumper, enhanced lower third with channel name/handle, kinetic text overlay, persistent logo watermark, and smooth animated transitions at cut points. After this phase, exported shorts look professionally produced — high-budget broadcast quality without gaudy effects.

</domain>

<decisions>
## Implementation Decisions

### Creative Direction (Global)
- **D-01:** Premium restrained style — think Apple TV / Netflix title cards. Clean motion, generous negative space, no particle effects, no glitter, no "YouTube thumbnail" energy. Every animation must feel intentional and expensive.
- **D-02:** Easing: use `power2.out` and `power3.out` for entrances, `power2.inOut` for exits. Never use `bounce` or `elastic` — those read as cheap.
- **D-03:** Typography: system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`) in semibold/bold weights only. No thin weights, no decorative fonts.
- **D-04:** Color palette: brand primary + accent only. Never more than 2 colors on screen. White text on dark overlays. No gradients (except subtle opacity gradients for fade edges).

### Intro Bumper (OVRL-01)
- **D-05:** Duration: 2.5 seconds total. Logo scales up from 80% to 100% with fade-in (0.6s), channel name fades in below (0.4s), holds 1s, then everything fades out (0.5s).
- **D-06:** Layout: centered vertically and horizontally within safe zone. Logo above, channel name below with 12px gap. Nothing else on screen during intro.
- **D-07:** Background: subtle dark vignette (radial gradient from transparent center to rgba(0,0,0,0.3) at edges) — doesn't obscure video but lifts the branding off busy footage.
- **D-08:** Intro plays at video start (time 0). First real content frame appears after intro completes.

### Lower Third with Handle (OVRL-02)
- **D-09:** Enhance existing Phase 2 lower-third: add a secondary line below channel name showing handle (e.g., "@channelhandle") in lighter weight, slightly smaller font, 60% opacity.
- **D-10:** Add `channelHandle` field to BrandKit interface (optional, defaults to empty string — if empty, second line is hidden).
- **D-11:** Same timing as Phase 2: appears at intro end (~2.5s mark), holds for 3s, fades out. Does NOT overlap with intro bumper.

### Kinetic Text (OVRL-03)
- **D-12:** One style: large bold text that slides up from below the safe zone, holds, then slides back down. Used for emphasis words/callouts during the video.
- **D-13:** Style: white text with subtle drop shadow (2px offset, rgba(0,0,0,0.5)), centered horizontally, positioned at vertical center of frame. Font size: 8% of canvas height (large, impactful, readable).
- **D-14:** Animation: slide up 30px over 0.3s (`power2.out`), hold 2s, slide down + fade over 0.4s (`power2.inOut`). Total: 2.7s.
- **D-15:** For Phase 3: kinetic text is hardcoded to show one demo phrase ("PREMIUM CONTENT") at the 3s mark. User-configurable text timing is a future feature (Phase 5+/backlog).

### Logo Watermark (OVRL-04)
- **D-16:** Persistent on EVERY frame after intro completes (from 2.5s onward). Uses the same circular logo from brand kit at the chosen corner position.
- **D-17:** Opacity: 25% (barely visible, professional broadcast standard). Size: 5% of canvas width (smaller than the intro logo).
- **D-18:** No animation — static presence. Appears instantly after intro fade-out.

### Cut Transitions (OVRL-05)
- **D-19:** At skip-range boundaries (where cuts happen): 0.15s cross-fade. Frame N-1 fades to 50% opacity while Frame N fades in from 50%. Fast and clean — mimics professional editing software default.
- **D-20:** Implementation: modify the export loop to detect cut boundaries (when time jumps due to skipRange) and blend 4-5 frames across the transition using a secondary canvas buffer.
- **D-21:** No whip-pans, no glitches, no zooms. Just a clean dissolve. Premium editors don't draw attention to cuts.

### Cohesive Template Package (TMPL-03)
- **D-22:** All 5 overlays (intro, lower third, kinetic text, watermark, transitions) are bundled as ONE template called "Pro Pack" in the registry. Activating it enables all components with consistent brand values.
- **D-23:** Template `create()` returns a composite render function that internally manages timing for all components (intro at 0s, lower-third at 2.5s, watermark from 2.5s onward, kinetic text at 3s, transitions at cut boundaries).
- **D-24:** The Phase 2 `lowerThirdTemplate` remains available as a standalone lighter option. Pro Pack is the new default.

### the agent's Discretion
- Exact pixel values for drop shadows and spacing (follow research best practices)
- The vignette gradient stops and exact opacity curve
- Whether kinetic text uses canvas `measureText` for centering or pre-computed offsets
- Cross-fade buffer implementation details (double-buffer vs alpha blending)
- Whether to add `channelHandle` to the settings panel HTML in this phase or defer UI to a future tweak

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 Implementation (template engine already built)
- `src/templates.ts` — Template engine, TemplateDefinition/TemplateInstance interfaces, GSAP seek pattern, safe zone constants, getLogoPosition helper, decodeLogo helper
- `src/brand-kit.ts` — BrandKit interface, loadBrandKit/saveBrandKit, initBrandKitPanel
- `src/overlay.ts` — OverlayRenderFn type definition
- `src/export.ts` — ExportConfig interface, export loop where overlays are called

### Project Requirements
- `.planning/REQUIREMENTS.md` — OVRL-01 through OVRL-05, TMPL-03
- `.planning/ROADMAP.md` — Phase 3 success criteria and goal statement

### Prior Phase Context
- `.planning/phases/02-brand-kit-templates/02-CONTEXT.md` — Brand kit decisions, template architecture

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- GSAP timeline + `seek(t)` pattern from Phase 2 lower-third — reuse for all new overlays
- `decodeLogo()` helper — reuse for intro bumper and watermark logo rendering
- `getLogoPosition()` — reuse for watermark positioning
- `SAFE_ZONE` constants — apply to all new overlay positioning
- `drawDefaultLogo()` — circular monogram fallback for logo-less state

### Established Patterns
- Template creates a paused GSAP timeline, animates state objects, draws with Canvas2D
- Logo decoded to ImageBitmap at `create()` time (not per-frame)
- `dispose()` kills timeline + closes ImageBitmap
- Master alpha multiplier pattern for fade-out
- `time > duration` early-return to skip rendering after overlay period ends

### Integration Points
- `TEMPLATE_REGISTRY` in templates.ts — new Pro Pack template registers here
- `getActiveTemplate()` — returns the active template instance for export
- Export loop calls `overlay(ctx, t, encW, encH)` per frame — composite render function handles internal timing
- `skipRanges` array available in ExportConfig — needed for cut transition detection

</code_context>

<specifics>
## Specific Ideas

- Premium broadcast quality — no AI-slop, no generic effects
- Apple TV / Netflix title card aesthetic — restrained, intentional, expensive-feeling
- User explicitly rejected gold/flashy/hype styles
- Every motion must have purpose — if it doesn't communicate something, remove it

</specifics>

<deferred>
## Deferred Ideas

- User-configurable kinetic text timing and content (Phase 5+ / backlog)
- Multiple template style themes (PREM-01 from v2 requirements)
- Beat-sync overlay timing (PREM-02 from v2 requirements)
- Custom font upload (PREM-04 from v2 requirements)

</deferred>

---

*Phase: 03-animated-overlays*
*Context gathered: 2026-05-17*
