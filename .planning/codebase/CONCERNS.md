# Codebase Concerns

**Analysis Date:** 2026-05-16

## Tech Debt

**Monolithic main.ts (277 lines, single file for all logic):**
- Issue: All application logic — motion detection, encoding, UI manipulation, fallback encoding — lives in one file with no module separation
- Files: `src/main.ts`
- Impact: Hard to test individual functions, hard to extend (e.g., add new reframe strategies), difficult to reason about state
- Fix approach: Extract into modules: `src/motion.ts`, `src/encoder.ts`, `src/ui.ts`, `src/fallback.ts`

**Committed dist/ directory:**
- Issue: Built output (`dist/`) is tracked in git despite being in `.gitignore`
- Files: `dist/index-f0cmfpw5.js`, `dist/index-t821n6kt.js`, `dist/index-xkmmxqtd.css`, `dist/index.html`
- Impact: Merge conflicts on build artifacts, bloated repo, stale output confuses contributors
- Fix approach: Remove `dist/` from git history (`git rm -r --cached dist/`); CI already builds fresh

**Dead export file:**
- Issue: `index.ts` exists with only `export {};` and a comment saying it's unused
- Files: `index.ts`
- Impact: Confuses contributors about the entry point
- Fix approach: Delete `index.ts`; the actual entry point is `serve.ts` (dev) and `index.html` (build)

**No linter or formatter configured:**
- Issue: No ESLint, Biome, or Prettier config present — code style depends entirely on developer discipline
- Files: (none — absence is the issue)
- Impact: Inconsistent formatting across contributions; no automated code quality checks
- Fix approach: Add `biome.json` with reasonable defaults; add a lint step to CI

## Known Bugs

**Missing PWA icons referenced in manifest:**
- Symptoms: `manifest.json` references `icon-192.png` and `icon-512.png` which do not exist in the repo or dist
- Files: `manifest.json`
- Trigger: Install as PWA → broken icons; browser console warnings on every page load
- Workaround: None; users see generic/broken app icon

**ObjectURL memory leaks:**
- Symptoms: Memory grows with each video processed; never freed
- Files: `src/main.ts` (lines 20, 148)
- Trigger: Process multiple videos in one session → `URL.createObjectURL` is called but `URL.revokeObjectURL` is never called for the input video URL or previous output URLs
- Workaround: Reload the page between processing runs

**No audio in output:**
- Symptoms: Exported MP4/WebM has no audio track
- Files: `src/main.ts` (lines 67-84, 164-207)
- Trigger: Process any video with audio → output is silent
- Workaround: Users must manually merge audio back using external tools

## Security Considerations

**No input validation on file selection:**
- Risk: Extremely large files could exhaust device memory (video is loaded entirely client-side with no size check)
- Files: `src/main.ts` (line 12-29)
- Current mitigation: None
- Recommendations: Add file size limit check (e.g., 2GB) and warn user; add duration check

**No CSP headers in dev server:**
- Risk: Low (static site), but inline event handler in HTML (`onclick="..."`) would break under strict CSP
- Files: `index.html` (line 20), `serve.ts`
- Current mitigation: None
- Recommendations: Move inline onclick to JS; add CSP meta tag or serve header

## Performance Bottlenecks

**Frame-by-frame seeking is extremely slow:**
- Problem: For a 60s video at 30fps, the pipeline seeks the `<video>` element 1800 times sequentially, waiting for `seeked` events
- Files: `src/main.ts` (lines 92-118, 190-202)
- Cause: `HTMLVideoElement.currentTime` seeking is not designed for frame-accurate sequential access; each seek may trigger a network-like decode pipeline internally
- Improvement path: Use `VideoDecoder` API (WebCodecs) to decode frames from a demuxed stream; or use `requestVideoFrameCallback` for sequential playback capture

**Motion detection re-seeks the video independently:**
- Problem: Motion detection (step 1) seeks through the video, then the reframe loop (step 2) seeks through it again from scratch — doubling decode work
- Files: `src/main.ts` (lines 209-260 for detection, 92-118 for reframe)
- Cause: Architecture doesn't pipeline decode → detect → reframe in a single pass
- Improvement path: Single-pass approach: decode each frame once, run motion detection on it, then immediately reframe and encode

**No Web Worker usage — UI thread blocked:**
- Problem: All pixel processing (motion detection, canvas drawing) runs on the main thread, freezing the UI
- Files: `src/main.ts` (entire pipeline)
- Cause: Canvas 2D and video element are main-thread-only APIs as currently used
- Improvement path: Use `OffscreenCanvas` in a Web Worker for the encode loop; or use WebCodecs `VideoDecoder`/`VideoEncoder` which are worker-compatible

## Fragile Areas

**DOM element access via unchecked `!` assertions:**
- Files: `src/main.ts` (line 9: `document.getElementById(id)!`)
- Why fragile: Any typo in element ID or HTML restructuring causes a silent runtime crash (uncaught TypeError)
- Safe modification: Always check that HTML `id` attributes match the strings in `main.ts`; consider a type-safe element registry
- Test coverage: Zero tests exist

**`seeked` event listener pattern:**
- Files: `src/main.ts` (lines 94-96, 192-194, 225-227)
- Why fragile: Adding `{ once: true }` listener for `seeked` can miss events if seek completes synchronously or if the video is already at the target time (no `seeked` fires) → pipeline hangs forever
- Safe modification: Add a timeout wrapper or check `video.readyState` before waiting
- Test coverage: None

**Fallback encoder produces WebM, not MP4:**
- Files: `src/main.ts` (lines 164-207)
- Why fragile: On browsers without WebCodecs (Firefox, older Safari), the output is WebM which may not play on iOS or import into some editors; the download filename still says `.mp4`
- Safe modification: Detect and surface the actual format to the user; rename download to `.webm` in fallback path
- Test coverage: None

## Scaling Limits

**Client-side memory for large videos:**
- Current capacity: Works for ~1080p videos up to ~2 minutes on mobile devices with 4GB RAM
- Limit: 4K source video or videos longer than 5 minutes will likely exceed device memory (multiple canvas buffers + muxer ArrayBuffer target)
- Scaling path: Stream encoding chunks to a Blob incrementally; use `ArrayBufferTarget` with periodic flushing; or process in segments

**Canvas captureStream fallback limited to ~15fps on mobile:**
- Current capacity: `MediaRecorder` + `captureStream(30)` may not deliver 30fps on mobile hardware
- Limit: Output video may have dropped frames or variable framerate
- Scaling path: WebCodecs path is the correct solution; remove captureStream fallback or clearly mark it as degraded

## Dependencies at Risk

**`mp4-muxer` (^5.2.2):**
- Risk: Sole dependency; if abandoned, no MP4 mux capability
- Impact: WebCodecs path produces no output
- Migration plan: Alternative is `mp4box.js` or manual fMP4 construction; low risk given active maintenance

**`@types/dom-webcodecs` (^0.1.18):**
- Risk: WebCodecs API is still evolving; type definitions may lag behind browser implementations
- Impact: Type errors on build; runtime API differences
- Migration plan: TypeScript 5.x may eventually include WebCodecs types natively; pin version if issues arise

## Missing Critical Features

**No service worker for offline/PWA:**
- Problem: `manifest.json` declares PWA intent but no service worker is registered — app cannot work offline
- Blocks: True PWA installation and offline use (the stated "100% on-device" promise)

**No progress cancellation:**
- Problem: Once processing starts, there is no way to cancel — button is disabled, no abort mechanism
- Blocks: User experience on long videos; only escape is page reload which loses all state

**No error handling in pipeline:**
- Problem: If `VideoEncoder` fails or a seek errors out, there is no try/catch or user-facing error message — the UI just freezes
- Files: `src/main.ts` (lines 33-161)
- Blocks: Reliable operation; users have no feedback when things go wrong

## Test Coverage Gaps

**No tests exist:**
- What's not tested: Everything — motion detection algorithm, smoothing function, encoding logic, DOM interactions
- Files: `src/main.ts` (all 277 lines)
- Risk: Any refactoring can silently break core algorithms (especially `smoothPositions` and `detectMotion` which are pure-ish functions)
- Priority: High — at minimum, unit test `smoothPositions` and `detectMotion` logic extracted to separate modules

---

*Concerns audit: 2026-05-16*
