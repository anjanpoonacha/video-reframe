---
status: resolved
trigger: "Can you remove the lead room and some unwanted logics? which are not working?"
created: 2026-05-17
updated: 2026-05-17
---

# Debug: Lead Room Not Working

## Symptoms

- **Expected behavior:** Lead room logic should show the space where the character is going (directional space ahead of movement)
- **Actual behavior:** Nothing works about the lead room logic — no visible effect on output
- **Error messages:** No errors, just wrong behavior
- **Timeline:** Never worked — was added but never functioned correctly
- **Reproduction:** Any video input triggers it

## Current Focus

- hypothesis: Lead room was never implemented — motion detection only finds motion centroid position, never calculates direction/velocity for directional bias
- test: Searched entire codebase for lead room, direction, velocity, bias, look-ahead patterns
- expecting: No lead room logic exists
- next_action: Remove dead code artifacts (index.ts, main.v1.ts, debug data files)

## Evidence

- timestamp: 2026-05-17
  checked: grep for "lead room", "leadRoom", "direction", "velocity", "bias", "look ahead" in all source files
  found: Zero matches in source code. Motion detection (detectMotion) only computes centroid x-position of changed pixels — no direction vector, no velocity calculation, no positional offset/bias
  implication: Lead room was never implemented. The feature concept existed but no code was written for it.

- timestamp: 2026-05-17
  checked: src/main.v1.ts vs src/main.ts
  found: main.v1.ts is an older version (651 lines) superseded by main.ts (810 lines with segments, split, undo, action bar). Untracked file, never imported anywhere.
  implication: Dead code backup file

- timestamp: 2026-05-17
  checked: index.ts
  found: Contains only `export {}; // This file is unused — see serve.ts for the dev server`. Tracked in git but never imported.
  implication: Dead placeholder file

- timestamp: 2026-05-17
  checked: frames.json, segments.json at project root
  found: Debug data artifacts (1402 and 47 lines respectively). Untracked, never imported.
  implication: Leftover debug data from development

## Eliminated

- hypothesis: Lead room code exists but is broken/disconnected
  evidence: Full codebase search found zero lead room implementation. No direction tracking, no velocity calculation, no positional bias code exists anywhere.
  timestamp: 2026-05-17

## Resolution

root_cause: Lead room was never implemented — the motion detection only finds WHERE motion occurs (centroid x-position) but never computes motion DIRECTION or applies directional space bias. The feature was conceptual only.
fix: Removed dead code artifacts: deleted tracked `index.ts` (empty placeholder), added gitignore for untracked debug data (frames.json, segments.json), identified `src/main.v1.ts` as untracked dead backup.
verification: grep confirms no lead room logic to remove; dead files identified and handled
files_changed: [index.ts (deleted), .gitignore (updated)]
