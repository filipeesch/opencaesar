import { describe, it, expect } from 'vitest';
import {
  Residence, isEligible, netMigration, allocateWorkers, wageBand,
  residentsForHouse, ageOnMonth, unemploymentBand, IMPERIAL_WAGE_REFERENCE,
} from '../../src/sim/population';
import { mulberry32 } from '../../src/sim/rng';
import { SimRunner } from '../../src/sim/runner';
import { residenceInspection } from '../../src/sim/advisors';
import { buildFoodCity, foodChainMap } from '../helpers';

describe('population model (task 2.1)', () => {
  it('tracks residents, capacity, class, and employment', () => {
    const r = new Residence(3, 'plebeian');
    expect(r.moveIn('plebeian', 30)).toBe(true);
    expect(r.moveIn('plebeian', 25)).toBe(true);
    expect(r.moveIn('plebeian', 10)).toBe(true);
    expect(r.moveIn('plebeian', 40)).toBe(false); // full
    expect(r.population).toBe(3);
  });
});

describe('age-band eligibility (task 2.2)', () => {
  it('only plebeians 16-60 are eligible to work', () => {
    expect(isEligible({ id: 1, class: 'plebeian', age: 30, employed: false })).toBe(true);
    expect(isEligible({ id: 2, class: 'plebeian', age: 12, employed: false })).toBe(false);
    expect(isEligible({ id: 3, class: 'plebeian', age: 70, employed: false })).toBe(false);
    expect(isEligible({ id: 4, class: 'patrician', age: 30, employed: false })).toBe(false);
  });
});

describe('migration (task 2.3)', () => {
  it('is bounded by available house capacity and rises with attractiveness', () => {
    expect(netMigration({ attractiveness: 0.9, unemployment: 0.1, capacityAvailable: 2 })).toBe(2);
    expect(netMigration({ attractiveness: 0.1, unemployment: 0.9, capacityAvailable: 10 })).toBe(0);
  });
});

describe('labor sectors (task 2.5)', () => {
  it('allocates scarce workers to higher priority first', () => {
    const sectors = [
      { id: 'a', priority: 3 as const, needed: 5, assigned: 0, pinned: false },
      { id: 'b', priority: 1 as const, needed: 5, assigned: 0, pinned: false },
    ];
    allocateWorkers(sectors, 6);
    expect(sectors[1].assigned).toBe(5); // b (priority 1)
    expect(sectors[0].assigned).toBe(1); // a (priority 3)
  });
});

describe('wage policy (task 2.6)', () => {
  it('reports band relative to imperial reference', () => {
    expect(wageBand({ wageRate: 0.5, imperialReference: 1 })).toMatchObject({ band: 'below' });
    expect(wageBand({ wageRate: 1, imperialReference: 1 })).toMatchObject({ band: 'at' });
    expect(wageBand({ wageRate: 1.2, imperialReference: 1 })).toMatchObject({ band: 'above' });
  });
});

// ============================================================================
// Phase 19.1 (POP-01/02/04) — target-API cases (Wave 0 scaffold; RED until the
// implementing waves land). The 5 original describes above stay green.
// ============================================================================

describe('residency consistency (POP-01, 19.1-01-01 target API)', () => {
  it('residentsForHouse returns exactly capacity residents, deterministically', () => {
    const seeded = (s: number) => mulberry32(s);
    const cohortA = residentsForHouse(2, 8, 1234, seeded);
    const cohortB = residentsForHouse(2, 8, 1234, seeded);
    expect(cohortA.length).toBe(8);
    expect(cohortB).toEqual(cohortA); // same seed + salt → same cohort
    for (const r of cohortA) expect(r.employed).toBe(false);
  });

  it('class share honors tierOfLevel — tier >= 3 introduces patricians; tier 0 has none', () => {
    const seeded = (s: number) => mulberry32(s);
    const low = residentsForHouse(1, 20, 99, seeded); // tier 0
    expect(low.every((r) => r.class === 'plebeian')).toBe(true);
    const high = residentsForHouse(20, 20, 99, seeded); // tier 4
    expect(high.some((r) => r.class === 'patrician')).toBe(true);
  });

  it('ages land in children(0-15)/workforce(16-60)/elderly(61+) bands', () => {
    const seeded = (s: number) => mulberry32(s);
    const cohort = residentsForHouse(3, 40, 7, seeded);
    expect(cohort.length).toBe(40);
    for (const r of cohort) {
      if (r.age <= 15) continue;
      if (r.age <= 60) continue;
      expect(r.age).toBeGreaterThan(60);
    }
    expect(cohort.some((r) => r.age <= 15)).toBe(true);
    expect(cohort.some((r) => r.age > 15 && r.age <= 60)).toBe(true);
  });

  it('ageOnMonth advances ages deterministically', () => {
    const seeded = (s: number) => mulberry32(s);
    const cohort = residentsForHouse(2, 10, 5, seeded);
    const before = cohort.map((r) => r.age);
    ageOnMonth(cohort);
    expect(cohort.map((r) => r.age)).toEqual(before.map((a) => a + 1));
  });

  it('residency is wired through getInspector internals and stays consistent with effectivePopulation', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 40; i++) r.tick(); // exactly one %40 boundary
    const house = r.getState().buildings.find((b) => b.house)!;
    const insp = r.getInspector(house.id, 'building')!;
    const residents = insp.internals?.house?.residents;
    expect(residents).toBeDefined();
    expect(residents!.length).toBeGreaterThan(0);
    expect(residents!.length).toBeLessThanOrEqual(house.house!.populationCapacity);
  });
});

describe('migration wiring (POP-02, 19.1-02-01 target API)', () => {
  it('netMigration is bounded by capacityAvailable: 3 with vacancy, 0 when full', () => {
    expect(netMigration({ attractiveness: 0.9, unemployment: 0.1, capacityAvailable: 3 })).toBe(3);
    expect(netMigration({ attractiveness: 0.9, unemployment: 0.1, capacityAvailable: 0 })).toBe(0);
  });

  it('a full city yields zero migration delta after a migration month', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 400; i++) r.tick();
    const before = r.getStateJson();
    for (let i = 0; i < 40; i++) r.tick(); // one migration month
    expect(r.getStateJson()).toBe(before);
    const d = r.getDerived();
    expect(d.immigration ?? 0).toBe(0);
  });

  it('famine (negative pull) drives residents out, creating vacancy', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 500; i++) r.tick();
    const internals = r.getWalkerInternals();
    const houses = internals.buildings.filter((b) => b.house);
    const sum = () => houses.reduce((s, b) => s + ((b.house!.residents?.length ?? 0) as number), 0);
    const full = sum();
    expect(full).toBeGreaterThan(0);
    // Starve the city: demolish the food chain → famine emigration drains occupancy.
    for (const [x, y] of [[0, 1], [2, 1], [4, 1]] as Array<[number, number]>) r.demolish(x, y);
    for (let i = 0; i < 400; i++) r.tick();
    expect(sum()).toBeLessThan(full);
  });
});

describe('residence inspection projection (POP-01, 19.1-01-01)', () => {
  it('residenceInspection appends class/age/employment rows when internals provide residents', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 40; i++) r.tick();
    const sim = r.getWalkerInternals();
    const house = sim.buildings.find((b) => b.type === 'house' && b.house)!;
    const h = house.house!;
    expect(h.residents).toBeDefined();

    const insp = residenceInspection(
      10, 20, 'plebeian', ['well'], { wheat: 2 },
      { house: h },
    );
    const residents = insp.residents as { count: number; classBreakdown: Record<string, number>; ageBands: Record<string, number>; employed: number };
    expect(residents).toBeDefined();
    expect(residents.count).toBeGreaterThan(0);
    expect(residents.classBreakdown.plebeian + residents.classBreakdown.patrician).toBe(residents.count);
    expect(residents.ageBands.children + residents.ageBands.workforce + residents.ageBands.elderly).toBe(residents.count);
    expect(typeof residents.employed).toBe('number');
    // The ORIGINAL minimal call keeps returning the old shape (no residents key).
    const minimal = residenceInspection(10, 20, 'plebeian', ['well'], { wheat: 2 });
    expect('residents' in minimal).toBe(false);
  });
});

describe('wage band + unemployment band (POP-04, 19.1-04-01 target API)', () => {
  it('wageBand reports relative vs the imperial reference', () => {
    const w = wageBand({ wageRate: 0.2, imperialReference: 0.3 });
    expect(w.band).toBe('below');
    expect(w.relative).toBeCloseTo(0.6666667, 5);
    expect(IMPERIAL_WAGE_REFERENCE).toBeGreaterThan(0);
    expect(IMPERIAL_WAGE_REFERENCE).toBeLessThan(1);
  });

  it('unemploymentBand maps rates to labelled tiers as a total function', () => {
    expect(unemploymentBand(0.05).label).toBe('healthy');
    expect(unemploymentBand(0.4).label).toBe('high');
    expect(unemploymentBand(NaN).label).toBe('healthy'); // NaN guarded
    expect(unemploymentBand(2)).toEqual(unemploymentBand(1)); // clamped above
    expect(unemploymentBand(-1)).toEqual(unemploymentBand(0)); // clamped below
  });

  it('the live DerivedSnapshot carries wageBand + unemploymentBand', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 80; i++) r.tick();
    const d = r.getDerived();
    expect(typeof d.wageBand.band).toBe('string');
    expect(typeof d.wageBand.relative).toBe('number');
    expect(typeof d.unemploymentBand.label).toBe('string');
    expect(typeof d.unemploymentBand.rate).toBe('number');
  });
});
