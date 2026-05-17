<!-- GSD:project-start source:PROJECT.md -->
## Project

**Video Reframe**

A mobile-first web app that converts 16:9 landscape videos into 9:16 portrait shorts with intelligent motion-based cropping, keyframe editing, and professional branded overlays. Built for content creators who post daily to Reels/TikTok/Shorts and need high-budget production value from their phone — running entirely on-device (no uploads, no server costs).

**Core Value:** Landscape video → professional-looking branded vertical short in under 2 minutes, from a phone.

### Constraints

- **Performance**: Must render smoothly on Snapdragon 770 (limit GSAP complexity, minimize DOM nodes)
- **On-device**: Zero server dependencies — all rendering client-side
- **Bundle size**: Keep fast load on mobile networks — lazy-load Hyperframes compositions
- **Browser support**: Safari iOS 16+ and Chrome Android 90+ (WebCodecs required)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ^5 (5.9.3 resolved) - All application logic (`src/main.ts`, `serve.ts`)
- HTML - Single-page app entry (`index.html`)
- CSS - Custom styles with CSS variables (`src/styles.css`)
## Runtime
- Bun (latest) - Server, bundler, and package manager
- Browser - Client-side video processing via WebCodecs API
- Bun (lockfile: `bun.lock`, lockfileVersion 1)
## Frameworks
- None - Vanilla TypeScript, no UI framework (React/Vue/etc.)
- None detected - No test files or test framework configured
- Bun bundler - `bun build ./index.html --outdir ./dist`
- Bun dev server - `bun --hot serve.ts` with HMR
## Key Dependencies
- `mp4-muxer` ^5.2.2 - MP4 container muxing for encoded video output (`src/main.ts:1`)
- `@types/bun` latest - Bun runtime types
- `@types/dom-webcodecs` ^0.1.18 - WebCodecs API types (VideoEncoder, VideoFrame)
## Configuration
- Target: ESNext
- Module: Preserve (bundler mode)
- JSX: react-jsx (unused currently)
- Strict mode enabled
- `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`
- Entry point: `index.html` (Bun HTML imports)
- Output: `./dist/`
- Dev server: port 3000 with HMR (`serve.ts`)
## Platform Requirements
- Bun runtime (macOS/Linux/WSL)
- No `.nvmrc` or version pinning beyond `@types/bun: latest`
- Static hosting (GitHub Pages)
- Browser with WebCodecs API support (Chrome 94+, Edge 94+, Safari 16.4+)
- PWA-capable (`manifest.json` present)
## Scripts
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Lowercase with hyphens for config: `package.json`, `bun.lock`
- Lowercase for source: `main.ts`, `styles.css`, `serve.ts`
- Uppercase for documentation: `README.md`, `CLAUDE.md`
- camelCase: `goToFrame`, `drawCropEditor`, `setupCropDrag`, `renderFilmstrip`
- Verb-first naming: `get*`, `render*`, `setup*`, `apply*`, `detect*`
- camelCase: `currentIdx`, `skipRanges`, `markStartTime`, `videoEl`
- Short abbreviations accepted: `ctx`, `dw`, `dh`, `srcX`, `encW`
- Constants use `const` but not UPPER_SNAKE_CASE
- PascalCase: `FrameData`
- `interface` keyword preferred over `type` for object shapes
## Code Style
- No dedicated formatter configured (no Prettier, Biome, or ESLint)
- 2-space indentation in TypeScript and CSS
- Double quotes for strings in TypeScript
- Semicolons always used
- Trailing commas on multiline constructs
- No enforced limit; long lines observed (100+ chars for DOM operations)
- Opening brace on same line
- Single-line arrow functions without braces where concise
## Import Organization
- Named imports: `import { Muxer, ArrayBufferTarget } from "mp4-muxer"`
- Side-effect imports for CSS: `import "./styles.css"`
- Default imports for HTML: `import index from "./index.html"`
- Relative paths with `./` prefix
- No path aliases configured
## TypeScript Conventions
- `noFallthroughCasesInSwitch: true`
- `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`
- `verbatimModuleSyntax: true`
- `noUnusedLocals: false`
- `noUnusedParameters: false`
- Used freely on DOM queries: `document.getElementById(id)!`
- Used on array access: `frames[i]!.skipped`
- Return types omitted on most functions (inferred)
- Parameter types always explicit
- Inline type assertions: `(e.target as HTMLInputElement)`
- Used with `??` for defaults: `smoothed[i]?.x ?? 0.5`
## Error Handling
- Early returns for guard clauses: `if (!videoEl) return;`
- No try/catch blocks in the codebase
- `console.error` passed directly as error callback: `error: console.error`
- No error boundary or global error handler
- No explicit async error handling
- Promise rejections unhandled
## DOM Access Pattern
- All DOM access through this `$` shorthand with non-null assertion
- Type casting at usage site: `($("exportBtn") as HTMLButtonElement).disabled = true`
## Module Design
- All application logic in one file (`src/main.ts`, 532 lines)
- No module splitting or barrel files
- Top-level state variables with `let`
- Functions defined at module scope
- No exports from `src/main.ts` (side-effect module)
- `serve.ts` has no exports (entry point)
## Comments
- Brief explanations for non-obvious logic
- No JSDoc/TSDoc documentation
- No function documentation
## CSS Conventions
- Single CSS file: `src/styles.css`
- CSS custom properties (variables) in `:root`
- No CSS modules, no CSS-in-JS, no preprocessor
- BEM-like but simplified: `.crop-container`, `.frame-info-bar`
- Utility classes: `.hidden`, `.status.success`
- Component-based: `.card`, `.btn`, `.btn-primary`
- Mobile-first with `@media (min-width: 768px)` breakpoint
- CSS variables for theming: `--bg`, `--surface`, `--accent`
- `env()` for safe area insets (PWA/mobile)
## Linting & Formatting
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| Dev Server | Serves HTML with HMR during development | `serve.ts` |
| HTML Shell | UI layout, card-based progressive disclosure | `index.html` |
| Main Module | All application logic (upload, analyze, edit, export) | `src/main.ts` |
| Styles | Dark-themed mobile-first CSS | `src/styles.css` |
| PWA Manifest | Installable web app metadata | `manifest.json` |
| CI/CD | Build and deploy to GitHub Pages | `.github/workflows/deploy.yml` |
## Pattern Overview
- Zero server-side processing — all video work runs in the browser
- Sequential pipeline: Upload → Analyze → Edit → Export
- Imperative DOM manipulation (no framework)
- Module-level mutable state for application data
- Progressive disclosure UI (cards revealed as pipeline advances)
## Layers
- Purpose: Renders the UI with card-based progressive disclosure
- Location: `index.html`, `src/styles.css`
- Contains: Static HTML structure, all visual styling
- Depends on: Nothing
- Used by: `src/main.ts` via DOM manipulation
- Purpose: Entire application behavior — upload handling, motion detection, crop editing, video encoding
- Location: `src/main.ts`
- Contains: Event handlers, algorithms, canvas rendering, WebCodecs encoding
- Depends on: `mp4-muxer`, Browser APIs (Canvas, WebCodecs, VideoElement)
- Used by: Imported by `index.html` as a module script
- Purpose: Local development server with HMR
- Location: `serve.ts`
- Contains: Bun.serve() configuration
- Depends on: Bun runtime, `index.html`
- Used by: `bun --hot serve.ts` (dev script)
## Data Flow
### Primary Pipeline (Upload → Export)
### State Management
- **`frames: FrameData[]`** — Core state: array of per-frame crop positions and thumbnails
- **`currentIdx: number`** — Currently selected frame in the editor
- **`skipRanges: {start, end}[]`** — Time ranges to exclude from export
- **`videoEl: HTMLVideoElement`** — Source video element (used for seeking/reading frames)
- **`dragging: boolean`** — Transient UI state for crop drag interaction
## Key Abstractions
- Purpose: Represents one sampled frame with its crop position and thumbnail
- Definition: `src/main.ts:5-10`
- Pattern: Plain interface with `time`, `x` (normalized 0-1), `bitmap`, `skipped` flag
- Purpose: Smoothly interpolates crop position between sampled frames during export
- Implementation: `getPositionAtTime()` at `src/main.ts:405-414`
- Pattern: Linear interpolation between nearest frame samples
## Entry Points
- Location: `index.html` → `<script type="module" src="./src/main.ts">`
- Triggers: Page load
- Responsibilities: Initializes event listeners, sets up crop drag handler
- Location: `serve.ts`
- Triggers: `bun --hot serve.ts`
- Responsibilities: Serves HTML at port 3000 with HMR, serves manifest.json
- Location: `index.html` (as Bun bundler entry)
- Triggers: `bun build ./index.html --outdir ./dist`
- Responsibilities: Produces static bundle in `dist/`
## Architectural Constraints
- **Threading:** Single-threaded main thread. All video processing (seek, draw, encode) blocks the UI. Periodic `setTimeout(r, 0)` yields used to allow repaints during export.
- **Global state:** All application state lives as module-level variables in `src/main.ts`. No encapsulation beyond the ES module boundary.
- **Browser API dependency:** Requires WebCodecs API (`VideoEncoder`) for MP4 export. Falls back to empty blob if unavailable.
- **Memory:** All frame thumbnails (`ImageBitmap`) held in memory simultaneously. For long videos with many samples, this could be significant.
- **Seek-based processing:** Uses `video.currentTime` + `seeked` event for frame extraction. This is sequential and slow compared to WebCodecs decode.
## Anti-Patterns
### Monolithic Module
### Seek-Based Frame Extraction
## Error Handling
- `VideoEncoder` error callback logs to console: `error: console.error` (`src/main.ts:322`)
- No try/catch around seek operations or encoding
- No user-facing error messages for failures
- Buttons are disabled during operations to prevent re-entry
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
