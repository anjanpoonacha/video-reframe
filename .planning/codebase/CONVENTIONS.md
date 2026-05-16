# Coding Conventions

**Analysis Date:** 2026-05-16

## Naming Patterns

**Files:**
- Lowercase with hyphens for config: `package.json`, `bun.lock`
- Lowercase for source: `main.ts`, `styles.css`, `serve.ts`
- Uppercase for documentation: `README.md`, `CLAUDE.md`

**Functions:**
- camelCase: `goToFrame`, `drawCropEditor`, `setupCropDrag`, `renderFilmstrip`
- Verb-first naming: `get*`, `render*`, `setup*`, `apply*`, `detect*`

**Variables:**
- camelCase: `currentIdx`, `skipRanges`, `markStartTime`, `videoEl`
- Short abbreviations accepted: `ctx`, `dw`, `dh`, `srcX`, `encW`
- Constants use `const` but not UPPER_SNAKE_CASE

**Types/Interfaces:**
- PascalCase: `FrameData`
- `interface` keyword preferred over `type` for object shapes

## Code Style

**Formatting:**
- No dedicated formatter configured (no Prettier, Biome, or ESLint)
- 2-space indentation in TypeScript and CSS
- Double quotes for strings in TypeScript
- Semicolons always used
- Trailing commas on multiline constructs

**Line Length:**
- No enforced limit; long lines observed (100+ chars for DOM operations)

**Braces:**
- Opening brace on same line
- Single-line arrow functions without braces where concise

## Import Organization

**Order:**
1. Third-party packages (`mp4-muxer`)
2. Local files (`./styles.css`)

**Style:**
- Named imports: `import { Muxer, ArrayBufferTarget } from "mp4-muxer"`
- Side-effect imports for CSS: `import "./styles.css"`
- Default imports for HTML: `import index from "./index.html"`

**Path Style:**
- Relative paths with `./` prefix
- No path aliases configured

## TypeScript Conventions

**Strict Mode:** Enabled with additional checks:
- `noFallthroughCasesInSwitch: true`
- `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`
- `verbatimModuleSyntax: true`

**Relaxed:**
- `noUnusedLocals: false`
- `noUnusedParameters: false`

**Non-null assertions:**
- Used freely on DOM queries: `document.getElementById(id)!`
- Used on array access: `frames[i]!.skipped`

**Type annotations:**
- Return types omitted on most functions (inferred)
- Parameter types always explicit
- Inline type assertions: `(e.target as HTMLInputElement)`

**Nullish coalescing:**
- Used with `??` for defaults: `smoothed[i]?.x ?? 0.5`

## Error Handling

**Patterns:**
- Early returns for guard clauses: `if (!videoEl) return;`
- No try/catch blocks in the codebase
- `console.error` passed directly as error callback: `error: console.error`
- No error boundary or global error handler

**Async errors:**
- No explicit async error handling
- Promise rejections unhandled

## DOM Access Pattern

**Helper function:**
```typescript
const $ = (id: string) => document.getElementById(id)!;
```
- All DOM access through this `$` shorthand with non-null assertion
- Type casting at usage site: `($("exportBtn") as HTMLButtonElement).disabled = true`

## Module Design

**Single-file architecture:**
- All application logic in one file (`src/main.ts`, 532 lines)
- No module splitting or barrel files
- Top-level state variables with `let`
- Functions defined at module scope

**Exports:**
- No exports from `src/main.ts` (side-effect module)
- `serve.ts` has no exports (entry point)

## Comments

**Section dividers:**
```typescript
// --- Section Name ---
```

**Inline comments:**
- Brief explanations for non-obvious logic
- No JSDoc/TSDoc documentation
- No function documentation

## CSS Conventions

**Architecture:**
- Single CSS file: `src/styles.css`
- CSS custom properties (variables) in `:root`
- No CSS modules, no CSS-in-JS, no preprocessor

**Naming:**
- BEM-like but simplified: `.crop-container`, `.frame-info-bar`
- Utility classes: `.hidden`, `.status.success`
- Component-based: `.card`, `.btn`, `.btn-primary`

**Patterns:**
- Mobile-first with `@media (min-width: 768px)` breakpoint
- CSS variables for theming: `--bg`, `--surface`, `--accent`
- `env()` for safe area insets (PWA/mobile)

## Linting & Formatting

**Tools configured:** None

**No linter or formatter is configured.** The `.gitignore` includes `.eslintcache` but no ESLint config exists. Code style is maintained manually.

**TypeScript compiler** serves as the only static analysis via `strict: true` in `tsconfig.json`.

---

*Convention analysis: 2026-05-16*
