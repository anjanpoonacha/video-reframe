# Features Research

**Domain:** Browser-based short-form video branding/overlay tool
**Researched:** 2026-05-17
**Focus:** Visual branding overlays (no captions in v1)

---

## Table Stakes (must have or looks amateur)

Features users expect. Missing any of these = video looks like raw phone footage.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Logo/watermark placement** | Every professional creator watermarks. Without it, content looks unclaimed | Low | Must support corner placement + opacity control |
| **Consistent color palette** | Mismatched colors = amateur hour. Viewers subconsciously register brand coherence | Low | 3-5 color brand kit stored per user |
| **Intro bumper** (1-3s animated) | Signals "this is a series." Without it, every video feels disconnected | Medium | Animated logo reveal or branded motion graphic |
| **Outro/end card** | Drives follows/subscriptions. Missing = wasted final seconds | Low | Static or simple animated card |
| **Lower third** (name/handle overlay) | Identifies the creator. Expected in first 2s of any talking-head content | Medium | Animated in/out with brand colors + text |
| **Aspect ratio framing** | Content must fill 9:16 cleanly. Black bars = instant skip | Low | Auto-crop/reframe for vertical |
| **Text overlays with brand fonts** | Used for hooks, key points, CTAs. Generic system fonts = cheap feel | Medium | 2-3 font slots in brand kit |
| **Smooth transitions** | Jump cuts without any transition feel unintentional | Low | 3-5 simple transitions (fade, slide, zoom) |

### Why these are non-negotiable

Successful creators on Reels/TikTok/Shorts maintain visual identity through repetition. Audiences recognize creators by their color scheme, text style, and intro pattern *before* they register the face. A tool that doesn't support these basics can't compete with CapCut's free tier.

---

## Differentiators (competitive advantage)

Features that set the tool apart. Not expected from a "basic editor" but make users feel like they have a motion graphics team.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Animated brand kit** (not just static assets) | Logos animate in, colors pulse, text has entrance effects — all pre-configured once, applied everywhere | High | This is the killer feature. Set it up once, every video gets the same energy |
| **Kinetic emphasis overlays** | Animated arrows, circles, underlines that follow the beat or key moments | Medium | Subtle motion that makes footage feel "edited by a pro" |
| **Frame/border overlays** | Consistent visual frame around content (gradient edges, textured borders, vignette) | Low | Adds structure to raw phone footage instantly |
| **Stinger transitions** (branded animated wipes) | Custom branded transition between clips — not generic fades | High | Like what gaming streamers use. Feels expensive |
| **Beat-synced motion** | Overlays pulse/move on audio beats automatically | High | The single biggest "wow" factor in high-budget shorts |
| **Animated icon library** | Small contextual icons (arrows, checkmarks, sparkles, emoji-style) with smooth entrance/exit | Medium | Used as visual punctuation. CapCut has stickers; we'd have *motion-designed* icons |
| **One-tap "energy level" control** | Slider from "calm/minimal" to "hype/maximal" that adjusts overlay intensity, animation speed, particle density | Medium | Solves the "I want it branded but not overwhelming" problem |
| **Gradient/glow accents** | Soft colored glows behind text, gradient light leaks between cuts | Low | Cheap to render, massive perceived quality boost |
| **Progress/hook bars** | Animated progress bar or "watch till the end" visual cue | Low | Retention hack that also looks intentional/branded |

### Key insight from research

The gap in the market is between:
- **CapCut** (powerful but generic — everyone's videos look the same)
- **After Effects** (unlimited but requires expertise + desktop)

A tool that gives After Effects-level *branded motion* with CapCut-level *speed* wins.

---

## Anti-Features (don't build these)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Caption/subtitle generation** | Explicitly out of scope for v1. Also: saturated market (CapCut, Opus, Captions.ai all do this) | Focus exclusively on visual branding overlays |
| **Full timeline NLE editor** | Competing with CapCut/Premiere on editing is suicide. Also: complex, slow on mobile browsers | Provide a simple clip-arrangement view, not a full editor |
| **Stock footage library** | Hosting costs, licensing complexity, not our differentiator | Let users import their own clips |
| **AI avatar/face generation** | Gimmicky, trust issues, regulatory risk | Focus on enhancing real footage |
| **Music/SFX library** | Licensing nightmare, not our core value prop | Allow audio import, maybe link to royalty-free sources |
| **Social posting/scheduling** | Completely different product. Splits focus | Export to camera roll; let Buffer/Later handle distribution |
| **Collaboration/team features** | Overkill for v1 target (solo creators) | Single-user brand kit first |
| **Over-the-top particle effects** | Makes content look like 2015 dubstep intros. Hurts authenticity | Keep particles subtle: light dust, soft bokeh, minimal |
| **Platform-specific trend templates** | Trends die in days. Maintenance nightmare. Feels dated fast | Offer timeless brand templates, not "trending audio" templates |

### The authenticity rule

Research consistently shows: **platform-native feel > polish**. Overly cinematic or effect-heavy content signals "ad" and gets skipped. The tool should make content look *intentionally branded* without making it look *produced by an agency*.

---

## Template Organization Patterns

### How competitors organize templates

| Tool | Organization Model | Strengths | Weaknesses |
|------|-------------------|-----------|------------|
| **Canva** | By format → theme → industry (Reel > Promo > Fitness) | Broad discovery, good for beginners | Overwhelming. 10,000+ templates = paralysis |
| **CapCut** | By editing style → trend → mood (Aesthetic > Dreamy > Soft) | Matches how creators think about vibe | Templates age fast, trend-dependent |
| **Mojo** | By content type (Story, Promo, Announcement, Quote) | Clear intent mapping | Limited flexibility |
| **Unfold** | By aesthetic collection (Minimal, Film, Retro, Bold) | Strong visual identity per collection | Small library feels limiting |

### Recommended template system for this tool

**Layer-based brand templates, not full-video templates.**

Instead of "here's a complete video template," offer:

```
Brand Kit (user configures once)
├── Logo (+ animation style: fade/bounce/slide)
├── Colors (primary, secondary, accent)
├── Fonts (heading, body)
├── Intro style (from 4-5 options)
└── Outro style (from 4-5 options)

Overlay Packs (mix and match per video)
├── Lower Thirds (3-4 styles per pack)
├── Text Styles (hook text, callout, label)
├── Transitions (2-3 branded wipes)
├── Emphasis Graphics (arrows, circles, underlines)
└── Ambient Effects (light leak, grain, glow)
```

**Why this works better:**
1. **Not disposable** — users invest in their brand kit, increasing retention
2. **Combinatorial** — 5 packs × brand kit = hundreds of unique looks
3. **Fast** — apply brand kit = instant consistency without choosing from 10,000 templates
4. **Scalable** — add new overlay packs without restructuring

### Organization hierarchy

```
Level 1: Energy/Mood
  → Minimal | Clean | Bold | Hype

Level 2: Content Type  
  → Talking Head | B-Roll Montage | Tutorial/Demo | Announcement

Level 3: Individual overlays within that context
  → Each adapts to the user's brand kit colors/fonts automatically
```

### Key UX principle

**Templates should feel like "styles" not "layouts."** The user's footage is the layout. Templates define the *visual treatment* applied on top. Think Instagram filters but for motion graphics branding.

---

## Feature Dependencies

```
Brand Kit Setup → All overlay features (everything inherits colors/fonts/logo)
Logo Import → Intro Bumper, Watermark, Stinger Transitions
Color Palette → Lower Thirds, Text Overlays, Frame Overlays, Gradient Accents
Font Selection → Text Overlays, Lower Thirds, Hook Text
Audio Import → Beat-Synced Motion (requires audio analysis)
Clip Import → Aspect Ratio Framing → Everything else (overlays need a canvas)
```

## MVP Recommendation

### Phase 1: Brand Kit + Core Overlays
1. Brand kit setup (logo, 3 colors, 2 fonts)
2. Logo watermark with position/opacity
3. 3 intro bumper styles (adapting to brand kit)
4. Lower third with animated entrance
5. 2-3 text overlay styles for hooks/CTAs
6. Basic transitions (fade, slide, cut)

### Phase 2: Motion & Polish
7. Frame/border overlays
8. Gradient glow accents
9. Animated icon library (10-15 icons)
10. Outro/end card templates
11. "Energy level" slider

### Phase 3: Premium Differentiation
12. Beat-synced motion
13. Stinger transitions
14. Kinetic emphasis system
15. Overlay packs marketplace/library

### Defer indefinitely
- Captions/subtitles
- Full NLE timeline
- Stock media
- Social scheduling
- Team collaboration

---

## Sources

- CapCut vs Canva feature comparison (capcut.com/resource)
- Canva brand kit documentation (canva.com)
- Short-form video marketing best practices (spintadigital.com, freshcontentsociety.com)
- Platform comparison: TikTok vs Reels vs Shorts (socialinsider.io, goatagency.com)
- Brand kit tools: Camtasia, Clipchamp, WeVideo, PowerDirector documentation
- Motion graphics best practices for short-form (todaymade.com, creativebloq.com)
