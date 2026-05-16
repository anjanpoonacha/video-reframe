# Codebase Structure

**Analysis Date:** 2026-05-16

## Directory Layout

```
video-reframe/
├── .github/workflows/   # CI/CD pipeline
│   └── deploy.yml       # GitHub Pages deployment
├── dist/                # Build output (gitignored, checked in currently)
├── src/                 # Application source
│   ├── main.ts          # All application logic
│   └── styles.css       # All application styles
├── index.html           # App shell & Bun build entry point
├── index.ts             # Unused placeholder (see serve.ts)
├── serve.ts             # Bun dev server with HMR
├── manifest.json        # PWA web app manifest
├── package.json         # Dependencies & scripts
├── tsconfig.json        # TypeScript configuration
├── bun.lock             # Bun lockfile
├── CLAUDE.md            # AI assistant instructions
└── README.md            # Project documentation
```

## Directory Purposes

**`src/`:**
- Purpose: Frontend application source code
- Contains: TypeScript logic and CSS styles
- Key files: `main.ts` (all app logic), `styles.css` (all styles)

**`dist/`:**
- Purpose: Production build output
- Contains: Bundled JS, CSS, HTML, and manifest
- Generated: Yes (by `bun build ./index.html --outdir ./dist`)
- Committed: Yes (for GitHub Pages deployment)

**`.github/workflows/`:**
- Purpose: GitHub Actions CI/CD
- Contains: Deployment workflow
- Key files: `deploy.yml` (build + deploy to GitHub Pages)

## Key File Locations

**Entry Points:**
- `index.html`: Browser entry and Bun bundler entry point
- `serve.ts`: Dev server entry (`bun --hot serve.ts`)

**Configuration:**
- `package.json`: Dependencies, scripts
- `tsconfig.json`: TypeScript strict mode, ESNext target, bundler resolution
- `manifest.json`: PWA metadata (name, icons, display mode)

**Core Logic:**
- `src/main.ts`: Motion detection, crop editing, video encoding, all UI interaction

**Styles:**
- `src/styles.css`: Complete application styling (dark theme, mobile-first, responsive)

**Testing:**
- None — no test files or test configuration exist

## Naming Conventions

**Files:**
- kebab-case for config files: `package.json`, `manifest.json`
- camelCase for TypeScript source: `main.ts`, `serve.ts`
- Standard dotfiles: `.gitignore`, `tsconfig.json`

**Directories:**
- Lowercase: `src/`, `dist/`

**Functions (in `src/main.ts`):**
- camelCase: `detectMotion`, `smoothPositions`, `renderFilmstrip`, `goToFrame`, `drawCropEditor`
- Verb-first naming: `render*`, `apply*`, `setup*`, `get*`

**Interfaces:**
- PascalCase: `FrameData`

**DOM IDs:**
- camelCase: `fileInput`, `analyzeBtn`, `cropContainer`, `exportProgress`

## Where to Add New Code

**New Feature (e.g., audio handling, different aspect ratios):**
- Create new module: `src/{feature}.ts`
- Import from `src/main.ts` or create new entry module
- Add styles to `src/styles.css` or create `src/{feature}.css` and import it

**New UI Section:**
- Add HTML card in `index.html` (follow existing card pattern with `class="card hidden"`)
- Add event listeners in `src/main.ts`
- Add styles in `src/styles.css`

**New Utility/Algorithm:**
- Create `src/{name}.ts` and export functions
- Import into `src/main.ts`

**New Dev Server Route:**
- Add to `routes` object in `serve.ts`

**New Dependency:**
- Add via `bun add {package}`
- Import in relevant `src/*.ts` file

## Special Directories

**`dist/`:**
- Purpose: Production build artifacts for GitHub Pages
- Generated: Yes (by `bun run build`)
- Committed: Yes (deployed directly from this directory)
- Note: Also gitignored — the checked-in copy may be stale

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (by `bun install`)
- Committed: No

## Module Organization Strategy

The project uses a **flat single-module** organization:

- One TypeScript file (`src/main.ts`) contains all logic
- One CSS file (`src/styles.css`) contains all styles
- HTML directly references the TypeScript module
- No barrel files, no re-exports, no shared types module

**Import Graph:**
```
index.html
  └── src/main.ts
        ├── mp4-muxer (external: Muxer, ArrayBufferTarget)
        └── ./styles.css (side-effect import for bundler)
```

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Start dev server with HMR on port 3000 |
| `bun run build` | Bundle `index.html` → `dist/` |
| `bun run preview` | Serve built `dist/` locally |

---

*Structure analysis: 2026-05-16*
