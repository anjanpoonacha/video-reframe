# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these unless the question requires otherwise.

## Stack

- **Runtime:** Bun (serve + HMR)
- **Language:** TypeScript (serve.ts), vanilla JS in HTML for spikes (no build step per spike)
- **Frontend:** Single HTML file with inline `<script type="module">`, no framework
- **Styling:** CSS custom properties matching the main app's dark theme

## Structure

- Each spike: `.planning/spikes/NNN-descriptive-name/`
- Files: `index.html` (self-contained), `serve.ts` (Bun server), `README.md` (frontmatter + docs)
- Ports: 3001+ (sequential per spike), main app on 3000
- Comparison spikes: `NNN-a-name` / `NNN-b-name`

## Patterns

- **Bun.serve with HTML import:** `import index from "./index.html"` for zero-config serving
- **Dark theme:** Reuse `--bg`, `--surface`, `--border`, `--accent` from main app
- **Video loading:** `createElement('video')` → `loadeddata` event → extract frames
- **Frame access:** `video.currentTime` + `seeked` event for on-demand; `createImageBitmap` for cached thumbnails
- **Mobile-first:** touch events, max-width constraint, `-webkit-tap-highlight-color`

## Tools & Libraries

- `createImageBitmap()` — GPU-backed bitmap caching for thumbnails
- CSS `scroll-snap-type: x mandatory` — discrete frame navigation feel
- Smoothstep interpolation `t²(3-2t)` — for keyframe position easing
- No external dependencies — all spikes use native browser APIs
