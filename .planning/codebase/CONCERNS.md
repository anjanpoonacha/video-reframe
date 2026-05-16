# Codebase Concerns

**Analysis Date:** 2026-05-16

## Performance Bottlenecks

**Synchronous frame-by-frame seeking during export:**
- Problem: Export loop seeks video element one frame at a time using `videoEl.currentTime` + waiting for `seeked` event, creating massive I/O wait
- Files: `src/main.ts` (lines 340–371)
- Cause: Browser `<video>` element seeking is slow (~20-50ms per seek); for a 60s video at 30fps this means 1800 seeks ≈ 36-90 seconds of pure seek time
- Improvement path: Use `requestVideoFrameCallback` or decode frames via WebCodecs `VideoDecoder` to avoid per-frame seeking
- Severity: **HIGH**

**Synchronous frame-by-frame seeking during analysis:**
- Problem: Same per-frame seeking pattern for motion detection (up to 200 seeks)
- Files: `src/main.ts` (lines 430–465)
- Cause: No batch decode or OffscreenCanvas/worker offloading
- Improvement path: Decode frames in a Worker using WebCodecs `VideoDecoder` for parallel processing
- Severity: **MEDIUM**

**All frames held in memory as ImageBitmaps:**
- Problem: Up to 200 `ImageBitmap` objects (72×128 px each) retained in the `frames` array for the lifetime of the session
- Files: `src/main.ts` (line 13, lines 76–83)
- Cause: Bitmaps never released via `.close()`
- Improvement path: Call `bitmap.close()` on discard, or re-render from video on demand
- Severity: **LOW**

**Filmstrip re-renders all thumbnails on every state change:**
- Problem: `renderFilmstrip()` rebuilds all DOM elements and redraws all canvases every time skip ranges change
- Files: `src/main.ts` (lines 101–118)
- Cause: No virtual list or incremental DOM update
- Improvement path: Only toggle classes on existing elements rather than full rebuild; or use `requestAnimationFrame` debouncing
- Severity: **LOW**

## Missing Error Handling

**No fallback when WebCodecs is unavailable:**
- Problem: If `VideoEncoder` is not in `window`, the export produces an empty 0-byte Blob and offers it for download
- Files: `src/main.ts` (lines 310, 379–381)
- Cause: Fallback path creates `new Blob([], { type: "video/mp4" })` — functionally useless
- Improvement path: Disable export button and show user-facing message when WebCodecs is unsupported (Safari < 16.4, older Firefox)
- Severity: **HIGH**

**No error handling on VideoEncoder.configure:**
- Problem: `encoder.configure()` can throw `NotSupportedError` if the codec profile/level is unsupported on the device, but no try/catch exists
- Files: `src/main.ts` (lines 324–330)
- Cause: Missing error boundary
- Improvement path: Wrap in try/catch with user-visible error message and codec fallback
- Severity: **MEDIUM**

**No error handling on video file loading:**
- Problem: If the user selects a corrupt or unsupported video file, there is no error handler — `loadeddata` may never fire, leaving the UI stuck
- Files: `src/main.ts` (lines 27–34)
- Cause: No `error` event listener on the video element
- Improvement path: Add `videoEl.addEventListener("error", ...)` with user feedback
- Severity: **MEDIUM**

**Object URLs never revoked:**
- Problem: `URL.createObjectURL(file)` at line 31 and `URL.createObjectURL(blob)` at line 388 are never cleaned up via `URL.revokeObjectURL()`
- Files: `src/main.ts` (lines 31, 388)
- Cause: Missing cleanup
- Improvement path: Revoke previous URL when loading a new file; revoke export URL on re-export
- Severity: **LOW**

## Tech Debt

**Committed `dist/` directory:**
- Issue: Built artifacts (4 JS bundles, 2 CSS bundles, HTML, manifest) are committed to the repository despite `dist` being in `.gitignore`
- Files: `dist/index-*.js`, `dist/index-*.css`, `dist/index.html`, `dist/manifest-*.json`
- Impact: Stale build artifacts in history; merge conflicts on builds; repo bloat
- Fix approach: Remove `dist/` from tracked files with `git rm -r --cached dist/`
- Severity: **MEDIUM**

**Dead file `index.ts`:**
- Issue: `index.ts` contains only `export {};` and a comment saying it's unused
- Files: `index.ts`
- Impact: Confusing entry point; devs may think this is the app entrypoint
- Fix approach: Delete the file
- Severity: **LOW**

**README is a generic bun init placeholder:**
- Issue: README references `bun run index.ts` which is not the actual dev command (`bun run dev` or `bun --hot serve.ts`)
- Files: `README.md`
- Impact: Misleading for contributors
- Fix approach: Rewrite with actual usage instructions
- Severity: **LOW**

**`@types/bun` pinned to `latest`:**
- Issue: `devDependencies` uses `"@types/bun": "latest"` which is non-deterministic across installs
- Files: `package.json` (line 11)
- Impact: Different developers may get different type definitions; CI builds may break unexpectedly
- Fix approach: Pin to a specific version (e.g., `^1.2.0`)
- Severity: **LOW**

## Scalability Limitations

**Single-threaded encoding blocks the main thread:**
- Problem: The export loop runs entirely on the main thread — drawing to canvas, encoding frames, and awaiting seeks. UI becomes unresponsive for long videos.
- Files: `src/main.ts` (lines 340–371)
- Cause: No use of Web Workers or OffscreenCanvas
- Limit: Videos >2 minutes produce multi-minute freezes with only `setTimeout(r, 0)` yielding every 5 frames
- Scaling path: Move canvas rendering + encoding to a Worker with OffscreenCanvas; post progress back to main thread
- Severity: **HIGH**

**Fixed max 200 sample frames regardless of video length:**
- Problem: `numSamples = Math.min(200, ...)` caps analysis at 200 frames. For a 10-minute video this is 1 sample per 3 seconds — insufficient for fast scene changes
- Files: `src/main.ts` (line 48)
- Cause: Hardcoded limit to keep analysis time reasonable given the slow seeking approach
- Limit: Motion detection accuracy degrades significantly for videos >60s
- Scaling path: Adaptive sampling rate or use WebCodecs decoder for faster frame access
- Severity: **MEDIUM**

## Security Considerations

**No file size or duration validation:**
- Risk: User can load arbitrarily large video files which may exhaust device memory during analysis/export (hundreds of seeks + canvas operations on multi-GB files)
- Files: `src/main.ts` (lines 23–38)
- Current mitigation: None
- Recommendations: Warn users for files >500MB; reject or confirm for files >2GB
- Severity: **LOW** (client-side only app, user harms only themselves)

## Fragile Areas

**Event-listener-based seeking pattern:**
- Files: `src/main.ts` (lines 32–33, 67–69, 148–149, 351–353, 431–433)
- Why fragile: If `seeked` event doesn't fire (e.g., seeking to an out-of-range time, or video element errors), the `await` hangs indefinitely with no timeout
- Safe modification: Replace with a Promise that races against a timeout; add `AbortSignal` support
- Test coverage: No tests exist
- Severity: **MEDIUM**

**Global mutable state with no reset mechanism:**
- Files: `src/main.ts` (lines 13–17)
- Why fragile: `frames`, `currentIdx`, `skipRanges`, `markStartTime`, `dragging` are module-level globals. Loading a new video does not reset these, causing stale state
- Safe modification: Create a `resetState()` function called on new file selection
- Test coverage: No tests exist
- Severity: **MEDIUM**

## Test Coverage Gaps

**No tests exist:**
- What's not tested: Entire application — motion detection algorithm, position interpolation, skip range logic, export encoding, UI interactions
- Files: No test files found in the repository
- Risk: Any refactoring of `smoothPositions`, `getPositionAtTime`, `detectMotion`, or skip range logic could silently break behavior
- Priority: **HIGH** — particularly for the pure functions (`smoothPositions`, `getPositionAtTime`, `formatTime`) which are easily unit-testable

## Missing Critical Features

**No audio track in exported video:**
- Problem: Export encodes video only; the output MP4 has no audio track
- Files: `src/main.ts` (lines 311–319) — muxer configured with `video` only
- Blocks: Output videos are silent, limiting usefulness for social media reposting
- Severity: **MEDIUM**

**No service worker for PWA offline support:**
- Problem: `manifest.json` declares a PWA but no service worker is registered; icons referenced (`icon-192.png`, `icon-512.png`) don't exist in the repo
- Files: `manifest.json` (lines 9–19), `index.html` (line 8)
- Blocks: App won't install as PWA properly; broken icons in app manifest
- Severity: **LOW**

---

*Concerns audit: 2026-05-16*
