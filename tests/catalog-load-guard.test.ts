import { describe, it, expect } from 'vitest';
import { validateBalance, validateCatalogs, throwCatalogIssues } from '../data/validate';
import { SimRunner } from '../src/sim/runner';

describe('balance catalog validation (DATA-01)', () => {
  it('accepts an empty balance catalog unmodified', () => {
    expect(validateBalance({})).toEqual([]);
  });

  it('accepts finite non-negative numbers', () => {
    expect(validateBalance({ goodKey: 5 })).toEqual([]);
  });

  it('flags negative, NaN, and Infinity values as balance catalog issues', () => {
    const issues = validateBalance({
      startingTreasury: -1,
      walkerSpeedPerTick: NaN,
      farmProductionPerTick: Infinity,
    });
    expect(issues).toHaveLength(3);
    for (const issue of issues) {
      expect(issue.catalog).toBe('balance');
    }
    const negative = issues.find((i) => i.message.includes('startingTreasury'));
    expect(negative).toBeDefined();
  });

  it('validateCatalogs stays clean on the real catalogs', () => {
    expect(validateCatalogs()).toEqual([]);
  });
});

describe('load-time guard (DATA-01)', () => {
  it('throwCatalogIssues does not throw on an empty issue list', () => {
    expect(() => throwCatalogIssues([])).not.toThrow();
  });

  it('throwCatalogIssues throws a Data catalog validation failed error with the catalog tag', () => {
    expect(() =>
      throwCatalogIssues([{ catalog: 'balance', message: 'startingTreasury: invalid' }]),
    ).toThrowError(/Data catalog validation failed/);
    expect(() =>
      throwCatalogIssues([{ catalog: 'balance', message: 'startingTreasury: invalid' }]),
    ).toThrowError(/\[balance\]/);
  });

  it('SimRunner constructs while the catalogs are valid', () => {
    expect(() => new SimRunner(1)).not.toThrow();
    expect(() => new SimRunner(2, undefined, 10)).not.toThrow();
  });
});

