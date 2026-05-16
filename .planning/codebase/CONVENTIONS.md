# Coding Conventions

**Analysis Date:** 2026-05-16

## Naming Patterns

**Files:**
- Lowercase with hyphens for config/entry: `serve.ts`, `index.ts`, `index.html`
- Lowercase for source: `main.ts`, `styles.css`
- Uppercase for metadata: `README.md`, `CLAUDE.md`

**Functions:**
- camelCase for all functions: `runPipeline`, `detectMotion`, `smoothPositions`, `setStep`, `encodeFallback`
- Verb-first naming: `detect*`, `smooth*`, `encode*`, `run*`, `set*`

**Variables:**
- camelCase: `videoEl`, `srcW`, `srcH`, `outW`, `encW`, `totalFrames`
- Short abbreviations for dimensions/math: `w`, `h`, `dw`, `dh`, `fps`, `dur`, `ctx`
- Descriptive for domain objects: `positions`, `smoothed`, `muxer`, `encoder`

**Types/Interfaces:**
- PascalCase with domain prefix: `MotionPosition`
- Defined at module top before usage

**CSS:**
- BEM-like flat naming with hyphens: `.upload-zone`, `.step-icon`, `.btn-primary`
- CSS custom properties (variables) use `--` prefix: `--bg`, `--surface`, `--accent`

## Code Style

**Formatting:**
- No dedicated formatter configured (no Prettier/Biome)
- 2-space indentation throughout
- Semicolons required
- Double quotes for imports, backtick templates for dynamic strings
- Single-line expressions for short statements

**Linting:**
- No linter configured (no ESLint/Biome)
- TypeScript strict mode enforces type safety via `tsconfig.json`

**TypeScript Strictness:**
- `strict: true` enabled
- `noUncheckedIndexedAccess: true` — forces `?.` or `?? default` on indexed access
- `noImplicitOverride: true`
- `noFallthroughCasesInSwitch: true`
- `verbatimModuleSyntax: true` — requires explicit `type` import annotations

## Import Organization

**Order:**
1. External packages (`mp4-muxer`)
2. Local CSS/assets (`./styles.css`)

**Path Style:**
- Relative paths with `./` prefix
- No path aliases configured
- Direct `.ts` extension not used in imports (bundler resolves)

## Error Handling

**Patterns:**
- Guard clauses with early return: `if (!file) return;`, `if (!videoEl) return;`
- Non-null assertion (`!`) on DOM queries via `$()` helper
- `console.error` passed directly to WebCodecs error callbacks
- Optional chaining with nullish coalescing for array access: `positions[pi]?.x ?? 0.5`
- No try/catch blocks — errors propagate naturally (browser-only app)

**DOM Access:**
- Central `$()` helper with non-null assertion: `const $ = (id: string) => document.getElementById(id)!;`
- Type casts for specific element types: `(e.target as HTMLInputElement)`

## Logging

**Framework:** Browser console only

**Patterns:**
- `console.log` for dev server startup messages (`serve.ts`)
- `console.error` as error handler callback for WebCodecs
- No structured logging — frontend-only app

## Comments

**When to Comment:**
- Step markers in pipelines: `// Step 1: Motion Detection`, `// Step 2: Decode + Reframe + Encode`
- Inline notes for unused files: `// This file is unused — see serve.ts`
- No JSDoc/TSDoc used

**Style:**
- `//` single-line comments only
- Comments mark logical sections, not explain obvious code

## Function Design

**Size:**
- `runPipeline` is the largest (~130 lines) — orchestrates the full workflow
- Helper functions kept focused: `detectMotion`, `smoothPositions`, `setStep`, `encodeFallback`

**Parameters:**
- Primitives passed individually: `(video, n)`, `(video, positions, w, h, fps, dur)`
- Default parameters via `=`: `smoothPositions(p, w = 5)`

**Return Values:**
- `Promise<Blob>` for async encode operations
- Arrays of typed objects: `MotionPosition[]`
- Void for side-effect functions: `setStep`, `runPipeline`

## Module Design

**Exports:**
- Single-file application — no inter-module exports in `src/main.ts`
- `serve.ts` uses HTML import pattern (Bun-specific)
- `index.ts` exports empty `{}` (placeholder file)

**Barrel Files:**
- Not used (single source file)

## DOM Interaction Patterns

**Event Binding:**
- `addEventListener` with async handlers
- `{ once: true }` option for one-shot events (seeked, loadeddata)
- Direct `onclick` assignment for simple handlers

**UI State Updates:**
- Direct DOM manipulation: `el.textContent`, `el.className`, `el.classList.remove`
- No reactive framework — imperative style
- Progress shown via style.width manipulation on progress bar element

## Async Patterns

**Promise Creation:**
- Inline `new Promise(r => ...)` wrapping event listeners for sequential flow
- `await` for all async steps in pipeline
- `setTimeout(r, 0)` yield pattern every N frames to keep UI responsive

**No Concurrency:**
- All frame processing is sequential (seek → draw → encode)
- Single processing pipeline, UI disabled during execution

---

*Convention analysis: 2026-05-16*
