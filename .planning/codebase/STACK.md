# Technology Stack

**Analysis Date:** 2026-05-16

## Languages

**Primary:**
- TypeScript 5.x - All application logic (`src/main.ts`, `serve.ts`)

**Secondary:**
- HTML - Single page app shell (`index.html`)
- CSS - Custom styles (`src/styles.css`)

## Runtime

**Environment:**
- Bun (latest) - Development server, bundler, and package manager

**Package Manager:**
- Bun
- Lockfile: `bun.lock` (present)

## Frameworks

**Core:**
- None (vanilla TypeScript, no UI framework)

**Testing:**
- Bun test (available via `bun test`, no tests exist yet)

**Build/Dev:**
- Bun bundler - HTML entry point bundling (`bun build ./index.html --outdir ./dist`)
- Bun dev server - HMR-enabled (`bun --hot serve.ts`)

## Key Dependencies

**Critical:**
- `mp4-muxer` ^5.2.2 - MP4 container muxing for WebCodecs VideoEncoder output

**Infrastructure:**
- `@types/bun` latest - Bun runtime type definitions (dev)
- `@types/dom-webcodecs` ^0.1.18 - WebCodecs API type definitions (dev)

## Browser APIs Used

**WebCodecs (primary path):**
- `VideoEncoder` - Hardware-accelerated H.264 encoding
- `VideoFrame` - Raw video frame creation from canvas

**Canvas (fallback path):**
- `CanvasRenderingContext2D` - Frame extraction and reframing
- `canvas.captureStream()` + `MediaRecorder` - WebM fallback encoding

**Other:**
- `URL.createObjectURL()` - Blob URL creation for video playback/download
- `ImageData` / `getImageData()` - Pixel-level motion detection

## Configuration

**TypeScript (`tsconfig.json`):**
- Target: ESNext
- Module: Preserve (bundler mode)
- Strict: true
- Lib: ESNext, DOM, DOM.Iterable
- JSX: react-jsx (configured but unused)
- `noUncheckedIndexedAccess`: true
- `noImplicitOverride`: true

**Build:**
- Entry: `./index.html` (Bun HTML imports)
- Output: `./dist/`

**PWA (`manifest.json`):**
- Display: standalone
- Start URL: `/video-reframe/`
- Theme: `#6366f1` (indigo)

## Platform Requirements

**Development:**
- Bun runtime
- No environment variables required
- `bun install && bun run dev` → http://localhost:3000

**Production:**
- Static hosting (GitHub Pages)
- Modern browser with WebCodecs support (Chrome 94+, Edge 94+, Safari 16.4+)
- Fallback to MediaRecorder/WebM for unsupported browsers

**Scripts:**
```bash
bun run dev       # HMR dev server on port 3000
bun run build     # Bundle to dist/
bun run preview   # Serve dist/ locally
```

---

*Stack analysis: 2026-05-16*
