import { describe, it, expect } from 'vitest';
import {
  advisorsFrom, overlaysFrom, residenceInspection, productionInspection, storageInspection, marketInspection, walkerInspection,
} from '../../src/sim/advisors';

const snap = {
  population: 500, treasury: 3000, taxRate: 0.1, wageRate: 0.1,
  hasReligion: true, hasEntertainment: true, hasEducation: true, hasHealth: true, hasWater: true, hasFood: true,
  jobs: 40, employed: 30, welfare: {}, godWorship: { jupiter: 1, neptune: 1, ceres: 1, bacchus: 1, mercury: 1 },
  doctorCoverage: 0.8, educationCoverage: 0.6, entertainmentCoverage: 0.9,
};

describe('advisors (tasks 9.6, 11.3)', () => {
  it('produces market/health/education/religion/finance advisor datasets', () => {
    const data = advisorsFrom(snap);
    expect(data.map((d) => d.name)).toEqual(expect.arrayContaining(['finance', 'religion', 'health', 'education', 'labor', 'ratings']));
    const health = data.find((d) => d.name === 'health');
    expect(health!.data.wellness).toBe(80);
    const ratings = data.find((d) => d.name === 'ratings');
    expect(ratings!.data.culture).toBeGreaterThan(0);
  });
});

describe('overlays (task 11.4)', () => {
  it('assembles per-tile overlay grids by name', () => {
    const o = overlaysFrom(2, 2, (x, y) => ({ water: y * 2 + x, risk: x }));
    expect(o.water[1][1]).toBe(3);
    expect(o.risk[1][1]).toBe(1);
  });
});

describe('inspectors (task 11.2)', () => {
  it('builds residence/production/storage/market/walker datasets', () => {
    expect(residenceInspection(10, 20, 'plebeian', ['well'], { wheat: 2 })).toMatchObject({ population: 10, residentClass: 'plebeian' });
    expect(productionInspection({ clay: 3 }, { pottery: 1 }, 'working')).toMatchObject({ status: 'working' });
    expect(storageInspection({ wheat: 5 }, 3, 16)).toMatchObject({ usedSlots: 3 });
    expect(marketInspection({ wheat: 4 }, 2)).toMatchObject({ buyerRadius: 2 });
    expect(walkerInspection(1, 2, 3, 'travelling', 4, 8)).toMatchObject({ id: 1, status: 'travelling' });
  });
});
