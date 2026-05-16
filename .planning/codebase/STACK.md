# Technology Stack

**Analysis Date:** 2026-05-16

## Languages

**Primary:**
- TypeScript ^5 (5.9.3 resolved) - All application logic (`src/main.ts`, `serve.ts`)

**Secondary:**
- HTML - Single-page app entry (`index.html`)
- CSS - Custom styles with CSS variables (`src/styles.css`)

## Runtime

**Environment:**
- Bun (latest) - Server, bundler, and package manager
- Browser - Client-side video processing via WebCodecs API

**Package Manager:**
- Bun (lockfile: `bun.lock`, lockfileVersion 1)

## Frameworks

**Core:**
- None - Vanilla TypeScript, no UI framework (React/Vue/etc.)

**Testing:**
- None detected - No test files or test framework configured

**Build/Dev:**
- Bun bundler - `bun build ./index.html --outdir ./dist`
- Bun dev server - `bun --hot serve.ts` with HMR

## Key Dependencies

**Critical:**
- `mp4-muxer` ^5.2.2 - MP4 container muxing for encoded video output (`src/main.ts:1`)

**Type Definitions:**
- `@types/bun` latest - Bun runtime types
- `@types/dom-webcodecs` ^0.1.18 - WebCodecs API types (VideoEncoder, VideoFrame)

## Configuration

**TypeScript (`tsconfig.json`):**
- Target: ESNext
- Module: Preserve (bundler mode)
- JSX: react-jsx (unused currently)
- Strict mode enabled
- `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`

**Build:**
- Entry point: `index.html` (Bun HTML imports)
- Output: `./dist/`
- Dev server: port 3000 with HMR (`serve.ts`)

## Platform Requirements

**Development:**
- Bun runtime (macOS/Linux/WSL)
- No `.nvmrc` or version pinning beyond `@types/bun: latest`

**Production:**
- Static hosting (GitHub Pages)
- Browser with WebCodecs API support (Chrome 94+, Edge 94+, Safari 16.4+)
- PWA-capable (`manifest.json` present)

## Scripts

```bash
bun run dev       # Hot-reload dev server on port 3000
bun run build     # Bundle to ./dist/
bun run preview   # Serve dist/ locally (bunx serve)
```

---

*Stack analysis: 2026-05-16*
