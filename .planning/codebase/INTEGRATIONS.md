# External Integrations

**Analysis Date:** 2026-05-16

## APIs & External Services

**None.**

This is a fully client-side application. All video processing (motion detection, reframing, encoding) happens on-device in the browser. Zero network calls are made during operation.

## Data Storage

**Databases:**
- None

**File Storage:**
- Local filesystem only (browser File API for input, Blob download for output)

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None (no user accounts, no server-side state)

## Monitoring & Observability

**Error Tracking:**
- None (console.error only for VideoEncoder failures)

**Logs:**
- Browser console only

## CI/CD & Deployment

**Hosting:**
- GitHub Pages (static site)
- URL pattern: `https://{user}.github.io/video-reframe/`

**CI Pipeline:**
- GitHub Actions (`.github/workflows/deploy.yml`)
- Trigger: push to `main` branch
- Steps: checkout → setup-bun → install → build → deploy to Pages
- Uses: `oven-sh/setup-bun@v2`, `actions/deploy-pages@v4`

## Environment Configuration

**Required env vars:**
- None (zero-config application)

**Secrets location:**
- No secrets required (fully client-side, no API keys)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## PWA Integration

**Service Worker:**
- Not implemented (manifest.json present but no SW registration)

**Manifest:**
- `manifest.json` - PWA metadata for Add to Home Screen
- Icons referenced: `icon-192.png`, `icon-512.png` (not yet present in repo)

---

*Integration audit: 2026-05-16*
