/**
 * Labor sectors (POP-03, Phase 19.1) — the pure sector-grouping layer that
 * replaces the greedy placement-order tickLabor with priority-1..5 allocation.
 *
 * Role-analog of housingLive.ts: pure functions over building state, no RNG,
 * no wall-clock, deterministic. Tuning stays module-local (balance-parity —
 * never a BALANCE/CONFIG key).
 *
 *  - LABOR_SECTOR_PRIORITY: the default sector→priority map [ASSUMED A3].
 *  - SECTOR_IDS: the known sector set the setLaborSectorState SaveCommand
 *    validates against (unknown ids never reach this layer).
 *  - buildLaborSectors: one LaborSector per known id; needed = Σ workersRequired
 *    over the sector's labor-connected buildings; paused sectors report
 *    needed=0 (their workers spill to other sectors).
 *  - applySectorAssignments: distribute each sector's `assigned` to its
 *    buildings greedily within each building's workersRequired cap (activation
 *    is handled by the runner loop, exactly as the legacy tickLabor did).
 */
import { BUILDINGS } from './buildings';
import type { SectorPriority, LaborSector } from './population';
import type { BuildingInstance } from './walkers';

/** Default sector priority map [ASSUMED A3] — module-local, never BALANCE/CONFIG. */
export const LABOR_SECTOR_PRIORITY: Record<string, SectorPriority> = {
  food: 1,
  water: 2,
  utility: 3,
  commerce: 4,
  culture: 5,
};

/** The known sector set the setLaborSectorState command validates against. */
export const SECTOR_IDS: readonly string[] = Object.keys(LABOR_SECTOR_PRIORITY);

/**
 * Building type → sector mapping. Every type with workers (>0) maps to exactly
 * one sector; job-free types (roads/housing/ornament) have no sector and are
 * skipped by the `workersRequired > 0` guard in buildLaborSectors.
 *
 * The grain of the map is the BUILDING TYPE, not the category, because two
 * storages split: granary (food-distribution infrastructure) feeds UTILITY while
 * warehouse (trade depot) feeds COMMERCE — and the market, though classed
 * 'commerce', is city-service infrastructure feeding UTILITY. These splits are
 * pinned by tests/unit/labor-sectors.test.ts (pure-helper cases).
 */
const TYPE_SECTOR: Record<string, string> = {
  // food
  farm: 'food',
  // vegetable_farm / cattle_ranch / fishing_wharf are not in the BUILDINGS
  // catalog yet — mappings reserved for those future types.
  orchard: 'food',
  // water
  well: 'water',
  // reservoir is not in the BUILDINGS catalog yet — mapping reserved for the
  // future type.
  fountain: 'water',
  // utility (infrastructure / raw extraction / workshops / civic services)
  granary: 'utility',
  market: 'utility',
  clay_pit: 'utility',
  timber_yard: 'utility',
  iron_mine: 'utility',
  olive_farm: 'utility',
  grape_farm: 'utility',
  quarry: 'utility',
  pottery_workshop: 'utility',
  furniture_workshop: 'utility',
  oil_press: 'utility',
  winery: 'utility',
  tool_workshop: 'utility',
  engineer_post: 'utility',
  fire_station: 'utility',
  prefecture: 'utility',
  clinic: 'utility',
  hospital: 'utility',
  // commerce
  warehouse: 'commerce',
  forum: 'commerce',
  senate: 'commerce',
  palatine: 'commerce', // Governor Palace (workers 40) — CR-01: government civic
  // culture
  school: 'culture',
  library: 'culture',
  theatre: 'culture',
  amphitheatre: 'culture',
  temple: 'culture',
  grand_temple: 'culture',
  colosseum: 'culture',
};

/** The sector a building belongs to, or null when it has no job sector. */
function sectorOf(b: BuildingInstance): string | null {
  if (!BUILDINGS[b.type]) return null;
  return TYPE_SECTOR[b.type] ?? null;
}

/** Per-sector config the runner owns (pinned/paused); absent sectors default to
 *  unpinned/unpaused. */
export interface LaborSectorConfig {
  pinned?: boolean;
  paused?: boolean;
}

/**
 * Group labor-connected buildings into one LaborSector per known sector id.
 * needed = Σ workersRequired over the sector's labor-connected buildings;
 * paused sectors report needed=0 (their workers spill to other sectors).
 * assigned starts 0; pinned/paused read from the per-sector config argument
 * (the runner's private store — a Map or plain object — default false/unset).
 * Deterministic — iterates buildings in placement order.
 */
export function buildLaborSectors(
  buildings: readonly BuildingInstance[],
  cfg: ReadonlyMap<string, LaborSectorConfig> | Record<string, LaborSectorConfig> = new Map(),
): LaborSector[] {
  const cfgOf = (id: string): LaborSectorConfig | undefined => {
    if (cfg instanceof Map) return cfg.get(id);
    return (cfg as Record<string, LaborSectorConfig | undefined>)[id];
  };
  const sectors = new Map<string, LaborSector>();
  for (const id of SECTOR_IDS) {
    sectors.set(id, {
      id,
      priority: LABOR_SECTOR_PRIORITY[id],
      needed: 0,
      assigned: 0,
      pinned: cfgOf(id)?.pinned === true,
    });
  }
  for (const b of buildings) {
    if (b.workersRequired <= 0) continue;
    if (!b.laborConnected) continue;
    const sectorId = sectorOf(b);
    if (!sectorId) continue;
    const s = sectors.get(sectorId);
    if (!s) continue;
    if (cfgOf(sectorId)?.paused === true) continue; // paused ⇒ needed=0
    s.needed += b.workersRequired;
  }
  return [...sectors.values()];
}

/**
 * Distribute each sector's `assigned` to its labor-connected buildings greedily
 * within each building's workersRequired cap (placement order). Total never
 * exceeds the pool by construction (Σ sector assigned ≤ Σ sector needed ≤ pool
 * after allocation). Activation is NOT touched here — the runner loop calls
 * setActive(b, give >= want) exactly as the legacy tickLabor did.
 */
export function applySectorAssignments(
  buildings: readonly BuildingInstance[],
  sectors: readonly LaborSector[],
): void {
  // Reset every labor-connected job building, then distribute per sector.
  for (const b of buildings) {
    if (b.workersRequired <= 0) continue;
    if (!b.laborConnected) continue;
    b.workersAssigned = 0;
  }
  for (const s of sectors) {
    let remaining = s.assigned;
    if (remaining <= 0) continue;
    for (const b of buildings) {
      if (remaining <= 0) break;
      if (b.workersRequired <= 0) continue;
      if (!b.laborConnected) continue;
      if (sectorOf(b) !== s.id) continue;
      const give = Math.min(b.workersRequired, remaining);
      b.workersAssigned = give;
      remaining -= give;
    }
  }
}
