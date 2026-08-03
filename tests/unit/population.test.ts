import { describe, it, expect } from 'vitest';
import { Residence, isEligible, netMigration, allocateWorkers, wageBand } from '../../src/sim/population';

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
