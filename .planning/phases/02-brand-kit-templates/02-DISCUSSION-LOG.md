# Phase 2: Brand Kit & Templates - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 02-brand-kit-templates
**Areas discussed:** Brand kit storage & UI, Logo positioning

---

## Brand Kit UI Location

| Option | Description | Selected |
|--------|-------------|----------|
| Inline card in pipeline | New card between Analyze and Export | |
| Persistent settings panel | Gear icon, set once, applied to all exports | ✓ |
| You decide | Agent picks best approach | |

**User's choice:** Persistent settings panel
**Notes:** User wants "set once and forget" — not a per-export configuration step.

---

## Logo Corner Positioning

| Option | Description | Selected |
|--------|-------------|----------|
| 4-corner grid buttons | TL/TR/BL/BR visual buttons | |
| Drag-to-position | Free positioning anywhere on frame | |
| You decide | Agent picks for mobile-first | ✓ |

**User's choice:** You decide
**Notes:** User clarified that positions MUST respect shorts platform safe zones — Reels/TikTok/Shorts have UI overlays on bottom and right side. Agent locked in 4-corner grid with 8% safe-zone insets.

---

## Remaining Areas (Template Engine, Logo Handling, Template Architecture)

**User's choice:** "Lock in defaults for everything"
**Notes:** User deferred all remaining technical decisions to best-practice defaults. Non-developer visionary who wants production-quality output without making implementation calls.

---

## the agent's Discretion

- GSAP timeline implementation details
- Settings panel visual design
- Color picker component choice
- Logo resize/crop behavior
- Template preview mechanism
- GSAP rendering target (DOM vs pure canvas)

## Deferred Ideas

None — discussion stayed within phase scope
