# Testing Patterns

**Analysis Date:** 2026-05-16

## Test Framework

**Runner:** None configured

No test framework is installed or configured. There are:
- No test files (`*.test.*`, `*.spec.*`)
- No test directories (`__tests__/`, `tests/`)
- No test configuration files (`jest.config.*`, `vitest.config.*`)
- No test scripts in `package.json`
- No test dependencies in `package.json`

## Test Commands

```bash
bun test    # Would use Bun's built-in test runner (not configured)
```

No `"test"` script exists in `package.json`. The available scripts are:
- `bun run dev` — Development server
- `bun run build` — Production build
- `bun run preview` — Preview production build

## Coverage

**Requirements:** None enforced
**Coverage tool:** Not configured

The `.gitignore` includes `coverage` and `*.lcov` entries (from Bun's default template), but no coverage tooling is set up.

## CI/CD Pipeline

**Location:** `.github/workflows/deploy.yml`

**Pipeline steps:**
1. Checkout
2. Setup Bun
3. `bun install`
4. `bun run build`
5. Copy manifest
6. Deploy to GitHub Pages

**No test step in CI.** The pipeline goes directly from install to build with no validation gate.

## Test Types

**Unit Tests:** Not present
**Integration Tests:** Not present
**E2E Tests:** Not present

## Recommended Test Approach

Given the Bun runtime and `CLAUDE.md` directives, tests should use:

```typescript
// filename: src/main.test.ts (co-located)
import { test, expect } from "bun:test";

test("example", () => {
  expect(1).toBe(1);
});
```

**Testable units in current code:**
- `smoothPositions()` — Pure function, easily unit-tested
- `getPositionAtTime()` — Pure function with interpolation logic
- `formatTime()` — Pure function for time formatting
- `applySkipRanges()` — Depends on module state but logic is extractable

**Challenges:**
- Most logic is tightly coupled to DOM and Canvas APIs
- State is module-level `let` variables (not injectable)
- No dependency injection or abstraction layer for browser APIs

## What's Missing

| Gap | Impact | Priority |
|-----|--------|----------|
| No tests at all | Regressions undetectable | High |
| No CI test gate | Broken code can deploy | High |
| No type-check in CI | Type errors can ship | Medium |
| Pure functions not extracted | Hard to test in isolation | Medium |

---

*Testing analysis: 2026-05-16*
