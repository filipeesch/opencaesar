/**
 * Production & Manufacturing (Phase 6 — tasks 5.1, 5.2, 5.3).
 *
 * Extraction sites (clay pit, timber yard, iron mine, marble quarry) require a
 * deposit; workshops (pottery, carpentry, oil press, winery, metallurgy)
 * consume inputs, produce outputs to stock, and dispatch porters to a chosen
 * destination. Destination selection prefers the nearest needy workshop, else
 * a warehouse, else "blocked — nothing destroyed". Self-contained, additive.
 */

export type ExtractionKind = 'clay_pit' | 'timber_yard' | 'iron_mine' | 'marble_quarry';
export type WorkshopKind = 'pottery' | 'carpentry' | 'oil_press' | 'winery' | 'metallurgy';

export interface ExtractionSite {
  id: ExtractionKind;
  name: string;
  /** Deposit resource this site requires. */
  requires: string;
  /** Output commodity. */
  produces: string;
  /** Output per tick when active. */
  outputPerTick: number;
}

export interface Workshop {
  id: WorkshopKind;
  name: string;
  /** Input commodities consumed per tick. */
  inputs: string[];
  /** Output commodity produced. */
  produces: string;
  /** Output per tick. */
  outputPerTick: number;
  /** Max output stock held at the workshop. */
  stockCapacity: number;
}

export const EXTRACTION_SITES: Record<ExtractionKind, ExtractionSite> = {
  clay_pit: { id: 'clay_pit', name: 'Clay Pit', requires: 'clay_deposit', produces: 'clay', outputPerTick: 0.3 },
  timber_yard: { id: 'timber_yard', name: 'Timber Yard', requires: 'trees', produces: 'timber', outputPerTick: 0.3 },
  iron_mine: { id: 'iron_mine', name: 'Iron Mine', requires: 'iron_deposit', produces: 'iron', outputPerTick: 0.25 },
  marble_quarry: { id: 'marble_quarry', name: 'Marble Quarry', requires: 'marble_deposit', produces: 'marble', outputPerTick: 0.2 },
};

/** Terrain string an extraction site may require a deposit of (PROD-01). */
export type DepositTerrain = 'trees' | 'none';

/**
 * PROD-01 deposit gate: whether an extraction site's footprint actually sits on
 * the deposit it `requires`. The timber yard needs forest `terrain`; every other
 * site needs the matching `TileState.resourceType` (`clay_deposit`,
 * `iron_deposit`, `marble_deposit`). A null or mismatched resourceType yields
 * false — a site built off-deposit never extracts.
 */
export function satisfiesDeposit(site: ExtractionSite, terrain: string, resourceType: string | null): boolean {
  if (site.requires === 'trees') return terrain === 'trees';
  return resourceType === site.requires;
}

/**
 * PROD-01 extraction gate the runner calls: the site must both satisfy its
 * deposit requirement and have workers (labor gate). Pure and deterministic.
 */
export function canExtract(site: ExtractionSite, terrain: string, resourceType: string | null, hasWorkers: boolean): boolean {
  return satisfiesDeposit(site, terrain, resourceType) && hasWorkers;
}

/** Runtime building id → extraction site id (PROD-01, runner wiring). The
 *  olive/grape farms are raw farms handled via RAW_OLIVE_GRAPE, not deposit
 *  sites; the marble quarry's runtime type id is 'quarry'. */
export const EXTRACTION_BUILDING_TYPES: Record<string, ExtractionKind> = {
  clay_pit: 'clay_pit',
  timber_yard: 'timber_yard',
  iron_mine: 'iron_mine',
  quarry: 'marble_quarry',
};

/** Runtime building id → workshop kind (PROD-02, runner wiring). */
export const WORKSHOP_BUILDING_TYPES: Record<string, WorkshopKind> = {
  pottery_workshop: 'pottery',
  furniture_workshop: 'carpentry',
  oil_press: 'oil_press',
  winery: 'winery',
  tool_workshop: 'metallurgy',
};

/** Per-site output ceiling for extraction stock in the live sim (PROD-01). */
export const EXTRACTION_OUTPUT_CAPACITY = 8;

/** Raw olive/grape farms that feed the oil_press/winery workshops directly
 *  (no deposit gate — farms). */
export const RAW_OLIVE_GRAPE: Record<string, { produces: 'olives' | 'grapes'; perTick: number }> = {
  olive_farm: { produces: 'olives', perTick: 0.3 },
  grape_farm: { produces: 'grapes', perTick: 0.3 },
};

export const WORKSHOPS: Record<WorkshopKind, Workshop> = {
  pottery: { id: 'pottery', name: 'Pottery Workshop', inputs: ['clay'], produces: 'pottery', outputPerTick: 0.3, stockCapacity: 8 },
  carpentry: { id: 'carpentry', name: 'Carpentry Workshop', inputs: ['timber'], produces: 'furniture', outputPerTick: 0.3, stockCapacity: 8 },
  oil_press: { id: 'oil_press', name: 'Oil Press', inputs: ['olives'], produces: 'oil', outputPerTick: 0.3, stockCapacity: 8 },
  winery: { id: 'winery', name: 'Winery', inputs: ['grapes'], produces: 'wine', outputPerTick: 0.3, stockCapacity: 8 },
  metallurgy: { id: 'metallurgy', name: 'Metallurgy Workshop', inputs: ['iron'], produces: 'tools', outputPerTick: 0.25, stockCapacity: 8 },
};

export interface ProductionState {
  /** Input commodity -> stock held. */
  inputs: Record<string, number>;
  /** Output commodity -> stock held. */
  output: Record<string, number>;
  active: boolean;
  blocked: boolean;
}

export function emptyProduction(w: Workshop): ProductionState {
  return { inputs: {}, output: { [w.produces]: 0 }, active: true, blocked: false };
}

export type WorkshopStatus = 'working' | 'missing_input' | 'output_full' | 'blocked';

/** Status of a workshop given current stocks and inputs. */
export function workshopStatus(w: Workshop, s: ProductionState): WorkshopStatus {
  if (!s.active) return 'blocked';
  const out = s.output[w.produces] ?? 0;
  if (out >= w.stockCapacity) return 'output_full';
  const lacking = w.inputs.some((i) => (s.inputs[i] ?? 0) <= 0);
  if (lacking) return 'missing_input';
  return 'working';
}

/** Advance one tick: consume inputs, produce output. Requires a porter to move output. */
export function tickWorkshop(w: Workshop, s: ProductionState): { produced: number } {
  s.blocked = false;
  const status = workshopStatus(w, s);
  if (status !== 'working') {
    s.blocked = status === 'blocked' || status === 'missing_input' || status === 'output_full';
    return { produced: 0 };
  }
  for (const i of w.inputs) s.inputs[i] = (s.inputs[i] ?? 0) - 1;
  const produced = Math.min(w.outputPerTick, w.stockCapacity - (s.output[w.produces] ?? 0));
  s.output[w.produces] = (s.output[w.produces] ?? 0) + produced;
  return { produced };
}

/** Deliver one load of output to a destination (e.g. warehouse) and update stocks. */
export function porterDelivers(w: Workshop, s: ProductionState): number {
  const out = s.output[w.produces] ?? 0;
  if (out < 1) return 0;
  s.output[w.produces] = out - 1;
  return 1;
}

/**
 * Destination selection (task 5.3): among candidate destinations, pick the one
 * that needs this output most. Returns null when everything is full/blocked
 * ("blocked, nothing destroyed").
 */
export function selectDestination<T>(
  destinations: T[],
  needScore: (d: T) => number,
): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const d of destinations) {
    const score = needScore(d);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best && bestScore > 0 ? best : null;
}

/**
 * A candidate destination for a porter's finished load (PROD-02 §16.4).
 * Validity is `accepts(commodity) === true && capacity > 0`.
 */
export interface LoadDestination {
  id: string;
  kind: 'workshop' | 'warehouse';
  accepts: (commodity: string) => boolean;
  capacity: number;
  distance: number;
  /** Neediness (workshops only): higher means the workshop wants the good more. */
  need: number;
}

function validFor(d: LoadDestination, commodity: string): boolean {
  return d.accepts(commodity) && d.capacity > 0;
}

/**
 * PROD-02 §16.4 destination policy: prefer the nearest-and-neediest workshop
 * that accepts the good and has capacity; else the nearest warehouse that
 * accepts and has capacity; else null meaning "blocked — keep the load,
 * nothing destroyed".
 */
export function porterDestination(
  commodity: string,
  workshops: LoadDestination[],
  warehouses: LoadDestination[],
): LoadDestination | null {
  let bestWorkshop: LoadDestination | null = null;
  for (const w of workshops) {
    if (!validFor(w, commodity)) continue;
    if (
      bestWorkshop === null ||
      w.need > bestWorkshop.need ||
      (w.need === bestWorkshop.need && w.distance < bestWorkshop.distance)
    ) {
      bestWorkshop = w;
    }
  }
  if (bestWorkshop) return bestWorkshop;

  let bestWarehouse: LoadDestination | null = null;
  for (const wh of warehouses) {
    if (!validFor(wh, commodity)) continue;
    if (bestWarehouse === null || wh.distance < bestWarehouse.distance) {
      bestWarehouse = wh;
    }
  }
  return bestWarehouse;
}

/**
 * Move up to one load of the workshop's output into a destination's stock,
 * never below zero and never creating or destroying units: the workshop output
 * falls by exactly the moved amount and `dest.stock` rises by the same. `dest`
 * models a total-capacity store, so a full destination (stock at capacity)
 * receives 0 and the output stays. Returns the moved amount.
 */
export function porterDeliversTo(
  w: Workshop,
  s: ProductionState,
  dest: { stock: Record<string, number>; capacity: number },
): number {
  const out = s.output[w.produces] ?? 0;
  let used = 0;
  for (const v of Object.values(dest.stock)) used += v;
  const room = Math.max(0, dest.capacity - used);
  const move = Math.min(1, out, room);
  if (move > 0) {
    s.output[w.produces] = out - move;
    dest.stock[w.produces] = (dest.stock[w.produces] ?? 0) + move;
  }
  return move;
}

/**
 * Human bottleneck label for a workshop (PROD-02): the `workshopStatus` label
 * except that a genuinely working workshop with no valid destination reads
 * 'no_destination' (load kept, nothing destroyed).
 */
export function workshopBottleneck(w: Workshop, s: ProductionState, hasDestination: boolean): string {
  const status = workshopStatus(w, s);
  if (status !== 'working') return status;
  return hasDestination ? 'working' : 'no_destination';
}
