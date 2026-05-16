# Codebase Structure

**Analysis Date:** 2026-05-16

## Directory Layout

```
video-reframe/
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Pages CI/CD
├── .planning/            # GSD planning artifacts
│   └── codebase/         # Auto-generated codebase analysis
├── dist/                 # Build output (gitignored but present)
│   ├── index.html
│   ├── index-*.js        # Bundled JS (hashed)
│   ├── index-*.css       # Bundled CSS (hashed)
│   └── manifest-*.json   # Copied manifest (hashed)
├── src/
│   ├── main.ts           # All application logic
│   └── styles.css        # Application styles
├── index.html            # App shell / entry HTML
├── index.ts              # Unused placeholder
├── manifest.json         # PWA web app manifest
├── serve.ts              # Bun dev server
├── package.json          # Project config & scripts
├── tsconfig.json         # TypeScript configuration
├── bun.lock              # Dependency lockfile
├── CLAUDE.md             # AI assistant instructions
└── README.md             # Project documentation
```

## Directory Purposes

**`src/`:**
- Purpose: Application source code
- Contains: TypeScript logic and CSS styles
- Key files: `main.ts` (entire app logic), `styles.css` (all styles)

**`.github/workflows/`:**
- Purpose: CI/CD automation
- Contains: GitHub Actions workflow definitions
- Key files: `deploy.yml` (build + deploy to GitHub Pages)

**`dist/`:**
- Purpose: Production build output
- Contains: Bundled, hashed static assets ready for deployment
- Generated: Yes (by `bun run build`)
- Committed: No (in `.gitignore`, but currently tracked)

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Contains: Auto-generated markdown analysis files
- Generated: Yes (by GSD tooling)

## Key File Locations

**Entry Points:**
- `index.html`: Browser entry — loads `src/main.ts` as ES module
- `serve.ts`: Dev server entry — `bun --hot serve.ts`
- `src/main.ts`: Application logic entry — registers DOM event listeners on load

**Configuration:**
- `package.json`: Scripts, dependencies, project metadata
- `tsconfig.json`: TypeScript compiler options (strict, ESNext, bundler mode)
- `manifest.json`: PWA installability metadata

**Core Logic:**
- `src/main.ts`: Motion detection, frame reframing, video encoding (entire pipeline)

**Styling:**
- `src/styles.css`: Complete application stylesheet (CSS custom properties, mobile-first)

**Testing:**
- No test files exist currently

## Naming Conventions

**Files:**
- `kebab-case.ts`: Source files (e.g., `main.ts`, `styles.css`)
- `UPPERCASE.md`: Documentation/planning files (e.g., `CLAUDE.md`, `README.md`)
- `camelCase.json`: Config files (e.g., `manifest.json`, `tsconfig.json`)

**Directories:**
- `lowercase`: All directories use lowercase (e.g., `src/`, `dist/`)

**Functions (in `src/main.ts`):**
- `camelCase`: All functions (`runPipeline`, `detectMotion`, `smoothPositions`, `setStep`, `encodeFallback`)

**Interfaces:**
- `PascalCase`: TypeScript interfaces (`MotionPosition`)

**Constants:**
- `camelCase`: Local constants within functions (`totalFrames`, `encW`, `encH`)

## Where to Add New Code

**New Feature (processing logic):**
- Primary code: `src/` — create a new `.ts` file (e.g., `src/audio-extractor.ts`)
- Import from: `src/main.ts` or new orchestrator module
- Tests: Create `src/*.test.ts` (no test infrastructure exists yet — use `bun test`)

**New UI Section:**
- HTML markup: `index.html` — add new card `<div>` following existing pattern
- Styles: `src/styles.css` — append new rules using existing CSS custom properties
- Logic: `src/main.ts` — add event handlers using `$("elementId")` pattern

**New Processing Stage:**
- Implementation: Create `src/<stage-name>.ts` with a function that accepts video/canvas data and returns processed result
- Integration: Import and call from `runPipeline()` in `src/main.ts`

**Utilities / Shared Helpers:**
- Place in `src/` as separate modules (e.g., `src/utils.ts`)
- Keep functions pure where possible for testability

**New Web Worker (performance improvement):**
- Create `src/workers/<name>.worker.ts`
- Import from main thread using standard Worker API

## Special Directories

**`dist/`:**
- Purpose: Static production build output
- Generated: Yes (`bun run build`)
- Committed: Listed in `.gitignore` but currently has tracked files — should be fully untracked
- Deployed: Yes, uploaded to GitHub Pages via CI

**`.planning/`:**
- Purpose: Project planning and analysis documents
- Generated: Yes (by GSD commands)
- Committed: Yes

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (`bun install`)
- Committed: No

---

*Structure analysis: 2026-05-16*
