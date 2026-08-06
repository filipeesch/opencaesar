---
phase: 19
slug: persistence-options
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-06
validated: 2026-08-06
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 (unit/integration/determinism/golden/property) + Playwright 1.62.1 (e2e) |
| **Config file** | `vitest.config.ts` (node env, `include: ['tests/**/*.test.ts']`, `testTimeout: 30000`), `playwright.config.ts` (chromium, :5173, workers 1) |
| **Quick run command** | `npx vitest run tests/unit/saveCodec.test.ts tests/unit/options.test.ts tests/unit/save.test.ts --bail 1` (Vitest 3.x rejects `-x`; use `--bail 1` or no flag) |
| **Full suite command** | `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --pool=threads --maxWorkers=4` (forks pool RPC-timeouts under load on this Mac — `--pool=threads` is the documented working config) |
| **Estimated runtime** | ~85 seconds (119 files / 930 tests) |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-00-01 | 01 | 0 | PERS-01/02 | — | N/A | unit scaffolds | `test -f tests/unit/saveCodec.test.ts && test -f tests/unit/options.test.ts && test -f e2e/settings.spec.ts && grep -q loadSavedGame tests/unit/save.test.ts && grep -q migrateSave tests/determinism/determinism.test.ts && grep -q gameSpeedDefault tests/unit/time.test.ts && npm run typecheck` | ✅ | ✅ green |
| 19-01-01 | 01 | 1 | PERS-01 | T-19-01 | migrate+validate before replay | unit | `npx vitest run tests/unit/saveCodec.test.ts tests/unit/save.test.ts --bail 1` | ✅ | ✅ green (24 + 12) |
| 19-01-02 | 01 | 1 | PERS-01 | T-19-01/03 | defense-in-depth + rejection surface | unit + determinism + e2e | `npx vitest run tests/unit/save.test.ts tests/determinism/determinism.test.ts --bail 1 && npx playwright test e2e/sessions.spec.ts` | ✅ | ✅ green (12 + 9 + 7) |
| 19-02-01 | 02 | 2 | PERS-02 | T-19-04/06 | rcb.options store disjoint from saves | unit | `npx vitest run tests/unit/options.test.ts tests/unit/ui.test.ts --bail 1` | ✅ | ✅ green (8 + 4) |
| 19-02-02 | 02 | 2 | PERS-02 | T-19-05/06 | boot default speed once (Pitfall 6) | unit + e2e | `npx vitest run tests/unit/time.test.ts tests/unit/ui.test.ts --bail 1 && npx playwright test e2e/settings.spec.ts` | ✅ | ✅ green (16 + 4 + 4) |
| 19-03-01 | 03 | 3 | PERS-01/02 | T-19-04 | full suite + military + goldens clean | full suite + smoke | `npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --pool=threads --maxWorkers=4 && npm run check:military && git status --porcelain tests/golden` | ✅ | ✅ green (119 files / 930 tests) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/unit/saveCodec.test.ts` — migrateSave chain + validateSave rejection cases (PERS-01) — 24 tests green
- [x] `tests/unit/options.test.ts` — serialize/deserialize/merge/persistence round-trip + defaults (PERS-02) — 8 tests green
- [x] Extend `tests/unit/save.test.ts` — loadSavedGame read→parse→migrate→validate — 12 tests green (incl. too-new-version migrate rejection)
- [x] Extend a determinism suite — round-trip WITH migrate/validate in the loop — 9 tests green
- [x] Extend `tests/unit/time.test.ts` / new `e2e/settings.spec.ts` — settings panel + persistence (PERS-02) — 16 + 4 tests green
- [x] New adversarial coverage: `e2e/sessions.spec.ts` corrupt-save resume-load rejection (button disabled + typed reason) — 7 tests green

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings panel e2e | PERS-02 | Needs the browser + dev server (`npm run dev` on :5173) | `npx playwright test e2e/settings.spec.ts` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-06

---

## Validation Audit 2026-08-06

Gaps found in the draft map: all 6 per-task entries were ❌/⬜ pending with no evidence. Each was re-verified by executing its automated command. The Nyquist auditor additionally found two uncovered behavioral edges and hardened them with new tests.

| Metric | Count |
|--------|-------|
| Gaps found | 6 |
| Resolved | 6 |
| Escalated | 0 |

### Auditor hardening (adversarial pass)

| Edge | Why it was a gap | New coverage | Result |
|------|------------------|--------------|--------|
| HomeScene resume-load of a structurally-invalid v1 save — button looks resume-able (intact meta), click-through must reject it (disabled + 'Save rejected: reason' via textContent, no crash) | Only unit-tested at the `loadSavedGame()` function level; the DOM rejection surface had no integration/e2e test | `e2e/sessions.spec.ts` "resume-load of a structurally-invalid v1 save is rejected: button disabled + typed reason" (PERS-01, 19-01-02) | green (7/7 sessions) |
| `loadSavedGame` with a save newer than SAVE_VERSION → typed 'migrate' rejection | Codec-level `migrateSave` covers `save-version-too-new` but the actual load-path mapping had no case | `tests/unit/save.test.ts` "returns a typed migrate failure for a save newer than SAVE_VERSION" (PERS-01, 19-01-01) | green (12/12 save.test.ts) |

### Environment notes (documented, non-blocking)

- Vitest 3.x rejects the `-x` flag (`CACError: Unknown option`) — all map commands use `--bail 1` (or no flag). The plan's `<verify>` commands were non-blockingly corrected in the map above.
- Full suite uses `--pool=threads` on this loaded Mac — the forks pool reproduces `[vitest-worker] Timeout calling "onTaskUpdate"` teardown under load with all tests passing (SUMMARY deviation #3).
- Three pre-existing e2e specs (boots/campaign/placement) fail on this loaded host at the pre-Phase-19 baseline (SUMMARY deviation #4); the new corrupt-save e2e filters only the documented baseline "Failed to process file" spritesheet console noise while keeping `pageerror` strict.
- E2e/typecheck/golden notes: `npx playwright test e2e/settings.spec.ts` 4/4, `e2e/sessions.spec.ts` 7/7 (codec in real save→restart→load flow), `npm run typecheck` exit 0, `npm run check:military` clean, `git status --porcelain tests/golden` empty.
