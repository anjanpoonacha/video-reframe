# External Integrations

**Analysis Date:** 2026-05-16

## APIs & External Services

**None** - This application is 100% client-side. No HTTP requests, no external APIs, no SDKs.

## Browser APIs Used

**WebCodecs API:**
- `VideoEncoder` - Hardware-accelerated H.264 encoding (`src/main.ts:320-330`)
- `VideoFrame` - Frame creation from canvas for encoding (`src/main.ts:358-360`)
- Codec: `avc1.640028` (H.264 High Profile Level 4.0)
- Bitrate: 4 Mbps, 30fps

**Canvas API:**
- `CanvasRenderingContext2D` - Frame extraction, motion detection, crop preview
- `createImageBitmap` - Thumbnail generation for filmstrip

**File API:**
- `URL.createObjectURL` - In-memory video loading and output blob display
- `<input type="file" accept="video/*">` - Video file selection
- `<a>.download` - Save processed video to device

## Data Storage

**Databases:**
- None

**File Storage:**
- Browser memory only (no IndexedDB, no localStorage)
- All processing is ephemeral — data lost on page reload

**Caching:**
- None

## Authentication & Identity

**None** - No auth required. Fully static, offline-capable app.

## Monitoring & Observability

**Error Tracking:**
- None (errors go to `console.error`)

**Logs:**
- `console.log` for dev server startup (`serve.ts:15`)
- `console.error` as VideoEncoder error callback (`src/main.ts:322`)

## CI/CD & Deployment

**Hosting:**
- GitHub Pages (static files)

**CI Pipeline:**
- GitHub Actions (`.github/workflows/deploy.yml`)
- Trigger: push to `main` branch
- Steps: checkout → setup-bun → install → build → deploy to Pages
- Uses: `oven-sh/setup-bun@v2`, `actions/deploy-pages@v4`

**Build Output:**
- `dist/` directory with bundled HTML/JS/CSS
- `manifest.json` copied separately into dist

## Environment Configuration

**Required env vars:**
- None

**Secrets location:**
- None needed (no API keys, no auth tokens)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## PWA Configuration

**Web App Manifest (`manifest.json`):**
- Display: standalone
- Start URL: `/video-reframe/`
- Theme: `#6366f1` (indigo)
- Icons: 192x192, 512x512 (referenced but not present in repo)

---

*Integration audit: 2026-05-16*
