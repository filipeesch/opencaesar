# Phase 13 Validation — Religion (RELI-01)

## Success criteria → testable scenarios

| # | Criterion (from REQUIREMENTS.md) | Live-sim scenario |
|---|---|---|
| SC1 | Temples for 5 gods with coverage-driven favor | City with a Ceres temple: `house.godAccess.ceres` > 0 on served houses; `getDerived().services.godWorship.ceres` > 0; aggregate religion coverage > 0; favor exceeds the no-temple baseline |
| SC1 | Grand temples | `grand_temple` places (4×4/900/10), spawns god-carrying walkers; grand-temple city worship > temple-only city worship (coverage factor 2) |
| SC1 | Festivals | `holdFestival('small')` spends 100 from treasury (ledger category `festival`), preps 1 month, then raises every god's worship (+0.05) and favor (+5) for the boost window; rejected without funds; one festival at a time |
| SC1 | Per-god isolation | Temple of Ceres raises only `ceres` worship; `neptune` stays 0 without its temple |
| SC2 | Backwards compatibility | No temples → `godWorship` empty, religion coverage 0, favor == pre-Phase-13 value; golden fixtures byte-identical (no regeneration) |

## Must-have (non-negotiable)
1. Determinism: `getStateJson()` byte-identical across chunk sizes 1/7/50 with temples + festivals active (seeds 1/7/1337); same-seed rerun identical.
2. No `Math.random`/`Date.now`/`new Date` in the religion chain.
3. Full suite green every wave; lint 0 warnings; `check:military` clean.
4. Commands replayable (save/load reproduces festivals and temple placement exactly).

## Should-have (nice to have)
- Festival expense visible in the ledger (`finance` category `festival`).
- `getDerived()` exposes `godWorship` per god for the religion advisor.

## Won't have (out of scope for this phase)
- Religion-gated housing tiers (the 5-tier live model has no religion gate; the 21-level model's religion effects arrive in Phase 16).
- Per-god temple art variants; per-god festival targeting.
