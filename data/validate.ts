/**
 * Load-time catalog validation (DATA-01). Every catalog is checked on load so
 * the game refuses to run with corrupt data. Returns an array of errors; an
 * empty array means all catalogs are valid. Tests assert validation is engaged.
 */
import { COMMODITIES, FOOD_TYPES } from './commodities';
import { BUILDINGS } from './buildings';
import { HOUSING_LEVELS } from './housing';
import { WALKERS } from './walkers';
import { TRADE_CITIES, type TradeCityDef } from './trade';
import { EVENTS } from './events';
import { MISSIONS } from './missions';
import { STRINGS } from './localization';
import { BALANCE } from './balance';
import { REQUEST_CATALOG } from './requests';

export interface CatalogIssue {
  catalog: string;
  message: string;
}

/**
 * Validate the BALANCE catalog (DATA-01). Every value must be a finite
 * non-negative number; undefined, NaN, Infinity, and negative values are
 * reported as issues under the 'balance' catalog.
 */
export function validateBalance(balance: Record<string, unknown>): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  for (const [key, value] of Object.entries(balance)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      issues.push({ catalog: 'balance', message: `${key}: must be a finite non-negative number` });
    }
  }
  return issues;
}

/**
 * Throw a single hard-fail error listing every reported catalog issue (DATA-01).
 * Used at sim load time so the sim refuses to run on corrupt catalog data.
 */
export function throwCatalogIssues(issues: CatalogIssue[]): void {
  if (issues.length > 0) {
    throw new Error(
      'Data catalog validation failed: ' +
        issues.map((i) => `[${i.catalog}] ${i.message}`).join('; '),
    );
  }
}

export function validateCatalogs(tradeCatalog: Record<string, TradeCityDef> = TRADE_CITIES): CatalogIssue[] {
  const issues: CatalogIssue[] = [];

  for (const [id, def] of Object.entries(BUILDINGS)) {
    if (def.footprint[0] <= 0 || def.footprint[1] <= 0) {
      issues.push({ catalog: 'buildings', message: `${id}: invalid footprint` });
    }
    if (def.cost < 0) {
      issues.push({ catalog: 'buildings', message: `${id}: negative cost` });
    }
    if (def.workers < 0) {
      issues.push({ catalog: 'buildings', message: `${id}: negative workers` });
    }
  }

  for (const c of Object.values(COMMODITIES)) {
    if (!c.name) issues.push({ catalog: 'commodities', message: `${c.id}: missing name` });
    if (c.baseImportPrice < 0 || c.baseExportPrice < 0) {
      issues.push({ catalog: 'commodities', message: `${c.id}: negative price` });
    }
  }
  if (FOOD_TYPES.length < 4) {
    issues.push({ catalog: 'commodities', message: `expected at least 4 food types` });
  }

  for (let i = 0; i < HOUSING_LEVELS.length; i++) {
    const lvl = HOUSING_LEVELS[i];
    if (lvl.capacity < 0) {
      issues.push({ catalog: 'housing', message: `level ${lvl.level}: negative capacity` });
    }
    if (i > 0 && HOUSING_LEVELS[i - 1].level >= lvl.level) {
      issues.push({ catalog: 'housing', message: `levels not strictly ascending at ${lvl.level}` });
    }
  }

  for (const w of Object.values(WALKERS)) {
    if (!(w as { id: string }).id || !w.name || !w.service) {
      issues.push({ catalog: 'walkers', message: `${(w as { id: string }).id ?? '?'}: missing id/name/service` });
    }
  }

  for (const city of Object.values(tradeCatalog)) {
    if (city.distance <= 0 || city.buys.length === 0 || city.sells.length === 0) {
      issues.push({ catalog: 'trade', message: `${city.id}: invalid distance or empty buys/sells` });
    }
    if (city.routeOpeningCost <= 0) {
      issues.push({ catalog: 'trade', message: `${city.id}: route opening cost must be positive` });
    }
    if (city.merchantFrequency <= 0) {
      issues.push({ catalog: 'trade', message: `${city.id}: merchant frequency must be positive` });
    }
    if (city.annualQuotaPerGood !== undefined && city.annualQuotaPerGood <= 0) {
      issues.push({ catalog: 'trade', message: `${city.id}: annual quota per good must be positive` });
    }
    if (city.landOrSea !== 'land' && city.landOrSea !== 'sea') {
      issues.push({ catalog: 'trade', message: `${city.id}: landOrSea must be 'land' or 'sea'` });
    }
    if (city.relationship !== 'neutral' && city.relationship !== 'friendly' && city.relationship !== 'hostile') {
      issues.push({ catalog: 'trade', message: `${city.id}: relationship must be neutral/friendly/hostile` });
    }
    for (const good of [...city.buys, ...city.sells]) {
      if (!COMMODITIES[good]) {
        issues.push({ catalog: 'trade', message: `${city.id}: good '${good}' missing from COMMODITIES` });
      }
    }
    if (city.priceModifiers !== undefined) {
      for (const good of [...city.buys, ...city.sells]) {
        const m = city.priceModifiers[good];
        if (typeof m !== 'number' || !Number.isFinite(m) || m <= 0) {
          issues.push({ catalog: 'trade', message: `${city.id}: priceModifiers missing/invalid for '${good}'` });
        }
      }
    }
  }

  for (const ev of Object.values(EVENTS)) {
    if (!ev.message) issues.push({ catalog: 'events', message: `${(ev as { id: string }).id}: missing message` });
    // RATE-03: responses must have unique ids per event, non-empty labels, and
    // finite numeric effects; treasuryCost must be non-negative.
    if (ev.responses) {
      const seen = new Set<string>();
      for (const resp of ev.responses) {
        if (!resp.id || seen.has(resp.id)) {
          issues.push({ catalog: 'events', message: `${(ev as { id: string }).id}: duplicate/missing response id '${resp.id ?? ''}'` });
        }
        seen.add(resp.id);
        if (!resp.label || resp.label.trim().length === 0) {
          issues.push({ catalog: 'events', message: `${(ev as { id: string }).id}: response '${resp.id}' has an empty label` });
        }
        for (const key of ['culture', 'prosperity', 'stability', 'favor'] as const) {
          const v = resp.effect[key];
          if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v))) {
            issues.push({ catalog: 'events', message: `${(ev as { id: string }).id}: response '${resp.id}' effect.${key} must be a finite number` });
          }
        }
        if (resp.effect.treasuryCost !== undefined && (typeof resp.effect.treasuryCost !== 'number' || !Number.isFinite(resp.effect.treasuryCost) || resp.effect.treasuryCost < 0)) {
          issues.push({ catalog: 'events', message: `${(ev as { id: string }).id}: response '${resp.id}' effect.treasuryCost must be a finite non-negative number` });
        }
      }
    }
    if (ev.priceModify !== undefined && (typeof ev.priceModify.delta !== 'number' || !Number.isFinite(ev.priceModify.delta))) {
      issues.push({ catalog: 'events', message: `${(ev as { id: string }).id}: priceModify.delta must be a finite number` });
    }
  }

  for (const m of Object.values(MISSIONS)) {
    if (m.targetPopulation <= 0) {
      issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: missing positive population target` });
    }
    // RATE-02 extension: sustainChecks must be a positive integer when present;
    // the new target fields must be finite non-negative numbers.
    if (m.sustainChecks !== undefined && (!Number.isInteger(m.sustainChecks) || m.sustainChecks <= 0)) {
      issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: sustainChecks must be a positive integer` });
    }
    for (const key of ['targetFavor', 'targetTreasury', 'targetAnnualExports'] as const) {
      const v = m[key];
      if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
        issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: ${key} must be a finite non-negative number` });
      }
    }
  }

  for (const r of REQUEST_CATALOG) {
    if (r.amount <= 0 || r.deadlineMonths <= 0 || r.weight <= 0) {
      issues.push({ catalog: 'requests', message: `${r.id}: non-positive amount/deadline/weight` });
    }
    if (r.type === 'goods' && !COMMODITIES[r.good ?? '']) {
      issues.push({ catalog: 'requests', message: `${r.id}: good '${r.good ?? ''}' missing from COMMODITIES` });
    }
  }

  if (Object.keys(STRINGS.pt).length === 0) {
    issues.push({ catalog: 'localization', message: 'empty pt string table' });
  }

  issues.push(...validateBalance(BALANCE));

  return issues;
}
