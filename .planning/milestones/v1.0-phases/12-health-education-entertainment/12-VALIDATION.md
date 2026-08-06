# Phase 12 Validation: Health, Education, Entertainment

## Success Criteria → Must-Haves

| # | Must-have | Verification |
|---|-----------|--------------|
| SC1 | Health services raise house health | clinic city: house health ≥ 40 at tick ~600; no-clinic control stays < 40 |
| SC1 | Health decays without service | control health decays toward 0; re-serviced house recovers |
| SC1 | Education raises literacy | school/library city: literacy ≥ 40; no-school control < 40 |
| SC1 | Cooldown map decays | house.services entries expire after serviceTTL ticks (no permanent flags) |
| SC2 | Entertainment venues placeable | hospital/amphitheatre/colosseum place in live sim (BUILDINGS catalog) |
| SC2 | Show-based coverage | theatre/amphitheatre walkers refresh entertainment flags; coverage > 0 |
| SC2 | Entertainment advances housing | tier gate: house cannot evolve past gate tier without the service; evolves with it |
| — | Advisor coverage real | derivedSnapshot.services reflects live access fractions (no hardcoded 0.8) |
| — | Determinism | civic-determinism: chunks 1/7/50 identical; same-seed rerun; no-RNG/clock audit |
| — | Goldens byte-identical | golden.test.ts + food-slice.test.ts green, no regeneration |
| — | No military tokens | `npm run check:military` clean |
