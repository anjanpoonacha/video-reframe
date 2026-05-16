# Testing Patterns

**Analysis Date:** 2026-05-16

## Test Framework

**Runner:**
- No test framework configured
- No test files exist in the codebase
- Bun's built-in test runner (`bun test`) is available via `@types/bun` devDependency

**Assertion Library:**
- None configured (Bun's `expect` available if tests are added)

**Run Commands:**
```bash
bun test               # Would run all tests (none exist)
bun test --watch       # Watch mode
bun test --coverage    # Coverage
```

## Test File Organization

**Location:**
- No test files exist
- Recommended pattern: co-located `*.test.ts` files alongside source

**Recommended Naming:**
- `src/main.test.ts` for unit tests of processing functions
- `src/motion.test.ts` if motion detection is extracted

**Recommended Structure:**
```
src/
├── main.ts
├── main.test.ts         # Tests for smoothPositions, detectMotion logic
├── styles.css
```

## Test Structure

**Recommended Suite Organization:**
```typescript
import { test, expect, describe } from "bun:test";

describe("smoothPositions", () => {
  test("averages window of positions", () => {
    const input = [
      { time: 0, x: 0.2 },
      { time: 1, x: 0.4 },
      { time: 2, x: 0.6 },
    ];
    const result = smoothPositions(input, 3);
    expect(result[1].x).toBeCloseTo(0.4);
  });
});
```

**Patterns:**
- Use `describe` blocks to group related tests
- Use `test` (not `it`) per Bun conventions
- Async tests with `async/await`

## Mocking

**Framework:** Bun's built-in `mock` (available but unused)

**Recommended Patterns:**
```typescript
import { mock } from "bun:test";

// Mock browser APIs not available in Bun runtime
const mockCanvas = {
  getContext: mock(() => ({
    drawImage: mock(),
    getImageData: mock(() => ({ data: new Uint8ClampedArray(100) })),
  })),
};
```

**What to Mock:**
- `HTMLVideoElement` (not available in Bun runtime)
- `HTMLCanvasElement` / `CanvasRenderingContext2D`
- `VideoEncoder` / `VideoFrame` (WebCodecs API)
- `MediaRecorder` (fallback encoder)
- DOM elements (`document.getElementById`)

**What NOT to Mock:**
- Pure computation functions: `smoothPositions`
- Array/math operations
- Type definitions

## Fixtures and Factories

**Test Data:**
```typescript
// MotionPosition arrays for testing smoothing
const samplePositions: MotionPosition[] = [
  { time: 0, x: 0.5 },
  { time: 0.5, x: 0.3 },
  { time: 1.0, x: 0.7 },
  { time: 1.5, x: 0.4 },
];
```

**Location:**
- No fixtures directory exists
- Recommended: inline test data for small arrays, `src/__fixtures__/` for larger datasets

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
bun test --coverage
```

## Test Types

**Unit Tests:**
- Testable without browser: `smoothPositions` (pure function)
- Would require mocking: `detectMotion`, `runPipeline`, `encodeFallback`

**Integration Tests:**
- Not applicable in current architecture (single-file browser app)
- Would require browser environment (Playwright/Puppeteer) for full pipeline

**E2E Tests:**
- Not configured
- Could use Playwright for full browser testing of the upload → process → download flow

## Testability Assessment

**Easily Testable (extract and test):**
- `smoothPositions` — pure function, no DOM dependency
- Math calculations: aspect ratio, frame timing, position interpolation

**Requires Browser Environment:**
- `detectMotion` — uses Canvas, video seeking
- `runPipeline` — orchestrates DOM, WebCodecs, Canvas
- `encodeFallback` — uses MediaRecorder, Canvas

**Testability Improvement Path:**
1. Extract pure computation into separate module (`src/math.ts`)
2. Extract motion detection algorithm (pixel diff logic) from DOM access
3. Use dependency injection for canvas/video access
4. Add Playwright for E2E testing of full pipeline

## Common Patterns

**Async Testing:**
```typescript
import { test, expect } from "bun:test";

test("async processing", async () => {
  const result = await someAsyncFn();
  expect(result).toBeDefined();
});
```

**Error Testing:**
```typescript
import { test, expect } from "bun:test";

test("throws on invalid input", () => {
  expect(() => smoothPositions([])).not.toThrow();
});
```

## CI Integration

**Current CI:**
- GitHub Actions (`.github/workflows/deploy.yml`)
- Pipeline: `bun install` → `bun run build` → deploy to GitHub Pages
- **No test step** in CI pipeline

**Recommended Addition:**
```yaml
- run: bun test
```

---

*Testing analysis: 2026-05-16*
