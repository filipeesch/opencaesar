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
import { MISSIONS, EXTRA_MISSIONS } from './missions';
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
    // HOUS-02 merge ladder: every level's footprint must be a finite positive
    // integer, and the ladder must be non-decreasing (1x1 → 2x2 → 3x3 → 4x4).
    if (!Number.isFinite(lvl.footprint) || lvl.footprint < 1) {
      issues.push({ catalog: 'housing', message: `level ${lvl.level}: footprint must be a finite positive integer` });
    }
    if (i > 0 && HOUSING_LEVELS[i - 1].footprint > lvl.footprint) {
      issues.push({ catalog: 'housing', message: `level ${lvl.level}: footprint not monotonic (previous ${HOUSING_LEVELS[i - 1].footprint} > ${lvl.footprint})` });
    }
    // Catalog-consistency gate: every requiresGoods key must be either a food
    // type or a house good (has a per-house delivery path). This is what forced
    // the 'tools' (houseGood:false) resolution on levels 15-20.
    for (const g of lvl.requiresGoods) {
      if (!FOOD_TYPES.includes(g as never) && !(COMMODITIES[g]?.houseGood)) {
        issues.push({ catalog: 'housing', message: `level ${lvl.level}: requiresGoods '${g}' is not a food type nor a house good` });
      }
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

  const TILE_TYPES: readonly string[] = ['earth', 'water', 'fertile', 'trees', 'rock', 'road'];
  const allMissions = [...Object.values(MISSIONS), ...Object.values(EXTRA_MISSIONS)];
  for (const m of allMissions) {
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
    // Phase 17 additive field validation (CAMPAIGN-01): map / products / routes /
    // modifiers are validated over BOTH MISSIONS and EXTRA_MISSIONS (T-17-01).
    if (m.map) {
      const map = m.map;
      if (!Number.isInteger(map.width) || map.width <= 0 || !Number.isInteger(map.height) || map.height <= 0) {
        issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: map width/height must be positive integers` });
      }
      const rows = map.layout.split('\n');
      if (rows.length !== map.height) {
        issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: map layout has ${rows.length} rows, expected ${map.height}` });
      }
      rows.forEach((row, y) => {
        if (row.length !== map.width) {
          issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: map layout row ${y} has ${row.length} columns, expected ${map.width}` });
        }
        for (const ch of row) {
          if (ch !== '.' && map.legend[ch] === undefined) {
            issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: map layout char '${ch}' missing from legend` });
          }
        }
      });
      for (const [ch, tile] of Object.entries(map.legend)) {
        if (!TILE_TYPES.includes(tile as string)) {
          issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: map legend '${ch}' maps to invalid tile '${tile}'` });
        }
      }
      if (map.preplace) {
        for (const p of map.preplace) {
          if (!BUILDINGS[p.type]) {
            issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: preplace references unknown building '${p.type}'` });
          }
          if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= map.width || p.y >= map.height) {
            issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: preplace '${p.type}' out of bounds` });
          }
        }
      }
    }
    if (m.products) {
      for (const good of m.products) {
        if (!COMMODITIES[good]) {
          issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: product '${good}' missing from COMMODITIES` });
        }
      }
    }
    if (m.routes) {
      for (const route of m.routes) {
        if (!TRADE_CITIES[route.cityId]) {
          issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: route city '${route.cityId}' missing from TRADE_CITIES` });
        }
        if (route.quota !== undefined && (typeof route.quota !== 'number' || !Number.isFinite(route.quota) || route.quota < 0)) {
          issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: route '${route.cityId}' quota must be a finite non-negative number` });
        }
        if (route.good !== undefined && !COMMODITIES[route.good]) {
          issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: route '${route.cityId}' good '${route.good}' missing from COMMODITIES` });
        }
      }
    }
    if (m.modifiers) {
      const mod = m.modifiers;
      if (mod.startingTreasuryCredit !== undefined && (typeof mod.startingTreasuryCredit !== 'number' || !Number.isFinite(mod.startingTreasuryCredit) || mod.startingTreasuryCredit < 0)) {
        issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: startingTreasuryCredit must be a finite non-negative number` });
      }
      if (mod.timeLimitYears !== undefined && (typeof mod.timeLimitYears !== 'number' || !Number.isFinite(mod.timeLimitYears) || mod.timeLimitYears <= 0)) {
        issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: timeLimitYears must be a positive finite number` });
      }
      if (mod.startingPolicy) {
        for (const key of ['taxRate', 'wageRate'] as const) {
          const v = mod.startingPolicy[key];
          if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)) {
            issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: startingPolicy.${key} must be a number in 0..1` });
          }
        }
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
