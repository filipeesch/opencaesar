/**
 * Load-time catalog validation (DATA-01). Every catalog is checked on load so
 * the game refuses to run with corrupt data. Returns an array of errors; an
 * empty array means all catalogs are valid. Tests assert validation is engaged.
 */
import { COMMODITIES, FOOD_TYPES } from './commodities';
import { BUILDINGS } from './buildings';
import { HOUSING_LEVELS } from './housing';
import { WALKERS } from './walkers';
import { TRADE_CITIES } from './trade';
import { EVENTS } from './events';
import { MISSIONS } from './missions';
import { STRINGS } from './localization';

export interface CatalogIssue {
  catalog: string;
  message: string;
}

export function validateCatalogs(): CatalogIssue[] {
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

  for (const city of Object.values(TRADE_CITIES)) {
    if (city.distance <= 0 || city.buys.length === 0) {
      issues.push({ catalog: 'trade', message: `${city.id}: invalid distance or empty buys` });
    }
  }

  for (const ev of Object.values(EVENTS)) {
    if (!ev.message) issues.push({ catalog: 'events', message: `${(ev as { id: string }).id}: missing message` });
  }

  for (const m of Object.values(MISSIONS)) {
    if (m.targetPopulation <= 0) {
      issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: missing positive population target` });
    }
  }

  if (Object.keys(STRINGS.pt).length === 0) {
    issues.push({ catalog: 'localization', message: 'empty pt string table' });
  }

  return issues;
}
