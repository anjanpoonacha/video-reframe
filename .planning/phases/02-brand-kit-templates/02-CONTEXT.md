# Phase 2: Brand Kit & Templates - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

User configures their channel brand (logo, colors) once via a persistent settings panel, and the template engine renders overlays frame-by-frame using GSAP seek() + canvas rasterization. Brand values automatically flow into overlay rendering at export time.

</domain>

<decisions>
## Implementation Decisions

### Brand Kit UI & Storage
- **D-01:** Brand kit lives in a persistent settings panel (gear icon), NOT inline in the pipeline. Set once, applied to all future exports automatically.
- **D-02:** Brand kit data stored in localStorage as JSON. Schema: `{ logo: string (data URL), primaryColor: string (hex), accentColor: string (hex), logoPosition: string }`.
- **D-03:** Logo uploaded as PNG or SVG, stored as base64 data URL in localStorage. Max file size enforced client-side (e.g., 500KB) to keep localStorage under quota.
- **D-04:** Brand colors: primary and accent color pickers with hex input. Used by templates for text, bars, accents.

### Logo Positioning (Platform-Safe)
- **D-05:** Logo positions respect shorts platform safe zones — inset 8% from each edge to avoid Reels/TikTok/Shorts UI overlays (bottom buttons, right engagement stack, top nav).
- **D-06:** Position options: Top-Left, Top-Right, Bottom-Left, Bottom-Right — all rendered within the safe zone (not at the literal edge). Agent to research exact safe-zone dimensions per platform and pick insets.
- **D-07:** Default position: Top-Left (safest across all platforms — avoids engagement buttons on right and bottom).

### Template Rendering Engine
- **D-08:** Templates are GSAP timelines defined in code (not loaded from external files). Each template is a function that creates a GSAP timeline, draws to a hidden DOM element or virtual canvas, and exposes a `seek(t)` method.
- **D-09:** Frame-by-frame rendering: at each frame time `t`, call `timeline.seek(t)` to position all animated elements, then rasterize to the export canvas using `ctx.drawImage()` from a hidden rendering canvas or via manual canvas draw calls.
- **D-10:** Templates receive brand kit values (logo image, colors) as parameters when constructed. Brand values are injected at timeline creation, not at render time.
- **D-11:** Template rendering implements the `OverlayRenderFn` interface from Phase 1: `(ctx, time, width, height) => void`. The template engine wraps GSAP seek + rasterize behind this callback.

### Template Architecture
- **D-12:** New module `src/templates.ts` — defines template registry, template interface, and the first template implementation.
- **D-13:** Template interface: `{ name: string, duration: number, create(brandKit: BrandKit): { render: OverlayRenderFn, dispose(): void } }`. Create returns a render function (compatible with export pipeline) and a dispose cleanup.
- **D-14:** Brand kit module: `src/brand-kit.ts` — handles settings panel UI, localStorage read/write, logo file handling, color pickers.
- **D-15:** Phase 2 delivers ONE working template that uses brand colors + logo (a simple lower-third with channel name and logo). Animated overlays (intro bumper, kinetic text, etc.) are Phase 3.

### the agent's Discretion
- Exact GSAP timeline implementation details (tweens, easing)
- Settings panel visual design and layout
- Color picker component choice (native `<input type="color">` vs custom)
- Logo resize/crop behavior during upload
- Template preview mechanism (if any — could be deferred)
- Whether to use a hidden DOM element or pure canvas for GSAP rendering target

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Implementation (built foundation)
- `src/overlay.ts` — OverlayRenderFn type definition (template must implement this)
- `src/export.ts` — ExportConfig interface with `overlay` field (how templates plug in)

### Project Requirements
- `.planning/REQUIREMENTS.md` — BRAND-01 through BRAND-04, TMPL-01, TMPL-02
- `.planning/ROADMAP.md` — Phase 2 success criteria and goal statement

### Architecture Context
- `.planning/codebase/ARCHITECTURE.md` — System overview, progressive disclosure UI pattern
- `.planning/codebase/STRUCTURE.md` — Where to add new modules, naming conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OverlayRenderFn` type from `src/overlay.ts` — templates MUST implement this interface
- `ExportConfig.overlay` field in `src/export.ts` — how template render functions plug into export
- `$()` DOM helper in `src/main.ts` — reuse for settings panel DOM access
- CSS variables in `src/styles.css` — dark theme, card pattern, mobile-first responsive

### Established Patterns
- Card-based progressive disclosure UI (HTML cards with `.hidden` class)
- Module-level state with `let` declarations
- localStorage used for session persistence (existing pattern in main.ts for crop sessions)
- `async/await` patterns throughout

### Integration Points
- Export button handler in `src/main.ts` currently passes `renderTestOverlay` — will pass template's render function instead
- `index.html` needs new settings panel HTML structure
- `src/styles.css` needs settings panel styles
- New brand-kit module loaded at app startup to hydrate from localStorage

</code_context>

<specifics>
## Specific Ideas

- Logo position MUST account for shorts platform safe zones (Reels/TikTok/Shorts have UI overlays that cover edges)
- User wants production-quality code with best practices
- Settings should feel like a "set once and forget" experience — not something configured every export

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-brand-kit-templates*
*Context gathered: 2026-05-17*
