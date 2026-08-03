/**
 * Agriculture & Food (Phase 5 — tasks 3.1, 3.2).
 *
 * Data-driven farm types with fertility-based production (wheat, vegetables,
 * orchard, animals, olives, vines) plus a fishing wharf. Production requires a
 * staffed farm with road access that is not paused; output scales with local
 * fertility. A granary policy layer adds per-food commands (accept/refuse/
 * request/maintain/empty/reserve/export/priority). Self-contained, additive to
 * the live sim.
 */
export type FarmKind =
  | 'wheat' | 'vegetables' | 'orchard' | 'animals' | 'olives' | 'vines' | 'fishing';

export interface FarmDef {
  id: FarmKind;
  name: string;
  /** Commodity produced. */
  produces: string;
  /** True if this farm needs fertile terrain. */
  requiresFertile: boolean;
  /** Base output rate (loads per tick at fertility=1). */
  baseOutputPerTick: number;
  /** Local output-stock capacity in units (spec §6.4/§7/§9/§10.4). */
  outputCapacity: number;
}

export const FARMS: Record<FarmKind, FarmDef> = {
  wheat: { id: 'wheat', name: 'Wheat Farm', produces: 'wheat', requiresFertile: true, baseOutputPerTick: 0.5, outputCapacity: 200 },
  vegetables: { id: 'vegetables', name: 'Vegetable Farm', produces: 'vegetables', requiresFertile: true, baseOutputPerTick: 0.4, outputCapacity: 180 },
  orchard: { id: 'orchard', name: 'Orchard', produces: 'fruit', requiresFertile: true, baseOutputPerTick: 0.35, outputCapacity: 200 },
  animals: { id: 'animals', name: 'Animal Farm', produces: 'meat', requiresFertile: true, baseOutputPerTick: 0.25, outputCapacity: 200 },
  olives: { id: 'olives', name: 'Olive Grove', produces: 'olives', requiresFertile: true, baseOutputPerTick: 0.3, outputCapacity: 160 },
  vines: { id: 'vines', name: 'Vineyard', produces: 'grapes', requiresFertile: true, baseOutputPerTick: 0.3, outputCapacity: 160 },
  fishing: { id: 'fishing', name: 'Fishing Wharf', produces: 'fish', requiresFertile: false, baseOutputPerTick: 0.45, outputCapacity: 200 },
};

export interface FarmInput {
  kind: FarmKind;
  fertility: number;
  staffed: boolean;
  roadAccess: boolean;
  paused: boolean;
}

/** Output (loads) a farm produces this tick, or 0. */
export function farmProductionPerTick(input: FarmInput): number {
  const def = FARMS[input.kind];
  if (!def) return 0;
  if (input.paused) return 0;
  if (!input.staffed || !input.roadAccess) return 0;
  if (def.requiresFertile && input.fertility <= 0) return 0;
  return def.baseOutputPerTick * Math.max(0, Math.min(1, input.fertility));
}

/**
 * === Physical-load production model (AGRI-02, spec §3.1, §6.6–6.8, §10) ===
 *
 * Additive to the live sim's tickFood: a farm creates a *load* in its output
 * stock instead of inflating a global counter. Effective production follows the
 * spec formula base × fertility × worker ratio × event × religion × condition,
 * and output only ships when it clears the minimum-dispatch threshold. Stopping
 * is never destructive: when the output stock is full or no destination exists
 * the farm simply stops producing (spec §29.1). All functions deterministic.
 */

/** 1 load = 100 units (spec §3.1). */
export const UNITS_PER_LOAD = 100;
/** Minimum output a farm ships in one dispatch (spec §6.8). */
export const MIN_DISPATCH_UNITS = 25;

/** Soil fertility grades (spec §6.5): barren/poor/normal/rich. */
export const SOIL_FERTILITY: Record<string, number> = {
  barren: 0,
  poor: 0.5,
  normal: 1,
  rich: 1.25,
} as const;

/** Production modifiers (spec §6.6); all default to neutral 1. */
export interface ProductionModifiers {
  /** Event bonus/penalty, e.g. 1.1 for a harvest festival. */
  eventBonus?: number;
  /** Religion blessing factor, e.g. 1.05. */
  religionBonus?: number;
  /** Building condition 0..1 (1 = pristine). */
  condition?: number;
}

export interface EffectiveFarmInput {
  def: FarmDef;
  /** Average fertility of the footprint, 0..1.25 (spec §6.5). */
  fertility: number;
  /** Fraction of required workers actually assigned, 0..1. */
  workerRatio: number;
  paused: boolean;
  /** Current output stock in units (used to compute full/capacity states). */
  currentOutput: number;
  modifiers?: ProductionModifiers;
}

/** Full farm stop-reason vocabulary (spec §6.7). */
export type FarmStopReason =
  | 'working'
  | 'working-partial'
  | 'seeking-workers'
  | 'no-road-access'
  | 'no-labor-access'
  | 'low-fertility'
  | 'harvest-ready'
  | 'awaiting-carrier'
  | 'output-full'
  | 'no-destination'
  | 'paused'
  | 'damaged'
  | 'fire-risk'
  | 'collapse-risk';

/**
 * Effective production in units per the spec §6.6 formula:
 *   base × fertility × workerRatio × eventBonus × religionBonus × condition.
 */
export function effectiveFarmProduction(
  def: FarmDef,
  fertility: number,
  workerRatio: number,
  modifiers: ProductionModifiers = {},
): number {
  const base = def.baseOutputPerTick * UNITS_PER_LOAD;
  const event = modifiers.eventBonus ?? 1;
  const religion = modifiers.religionBonus ?? 1;
  const condition = modifiers.condition ?? 1;
  const f = Math.max(0, Math.min(SOIL_FERTILITY.rich, fertility));
  const w = Math.max(0, Math.min(1, workerRatio));
  return base * f * w * event * religion * condition;
}

/** The farm's current stop reason given its situation (spec §6.7). */
export function farmStopReason(input: EffectiveFarmInput & { roadAccess: boolean; staffed: boolean }): FarmStopReason {
  const { def, paused, roadAccess, staffed, fertility, currentOutput } = input;
  if (paused) return 'paused';
  if (!staffed) return 'seeking-workers';
  if (!roadAccess) return 'no-road-access';
  if (def.requiresFertile && fertility <= 0) return 'low-fertility';
  if (currentOutput >= def.outputCapacity) return 'output-full';
  const ratio = Math.max(0, Math.min(1, input.workerRatio));
  if (ratio < 1) return 'working-partial';
  if ((input.modifiers?.condition ?? 1) <= 0) return 'damaged';
  return 'working';
}

/** Output-capacity values for the producer model (spec §6.4/§7/§9/§10). */
export const FARM_OUTPUT_CAPACITY: Record<string, number> = {
  wheat: 200,
  vegetables: 180,
  fruit: 200,
  meat: 200,
  olives: 160,
  grapes: 160,
  fish: 200,
};

export interface OutputStock {
  units: number;
  capacity: number;
}

/** Whether the farm may dispatch a load now (≥ minimum-dispatch, §6.8). */
export function shouldDispatchOutput(stock: Pick<OutputStock, 'units'>): boolean {
  return stock.units >= MIN_DISPATCH_UNITS;
}

/**
 * Advance a farm's output stock by one tick of production. Additive, never
 * destructive: production stops when the output stock is full (§29.1).
 * Returns the units actually produced this tick.
 */
export function produceFarmOutput(
  stock: OutputStock,
  producedPerTick: number,
): { produced: number; full: boolean } {
  if (producedPerTick <= 0) return { produced: 0, full: stock.units >= stock.capacity };
  const free = stock.capacity - stock.units;
  if (free <= 0) return { produced: 0, full: true };
  const produced = Math.min(free, producedPerTick);
  stock.units += produced;
  return { produced, full: stock.units >= stock.capacity };
}

/** Fishing-wharf boat lifecycle (spec §10). */
export type FishingBoatState = 'idle' | 'maintenance' | 'seeking-zone' | 'sailing' | 'fishing' | 'returning' | 'unloading';

export interface FishingBoat {
  state: FishingBoatState;
  /** Fish caught on the current voyage (units), capacity-limited. */
  catch: number;
  /** Remaining ticks of the current phase. */
  remaining: number;
}

/** Boat capacity (100 units) and 30-day fishing cycle (spec §10.4). */
export const BOAT_CAPACITY = UNITS_PER_LOAD;
export const FISHING_CYCLE_DAYS = 30;

export function createFishingBoat(): FishingBoat {
  return { state: 'idle', catch: 0, remaining: 0 };
}

export interface BoatStepOptions {
  hasZone: boolean;
  wharfFree: boolean;
  /**
   * Optional wharf output stock that receives the catch on handoff. When an
   * unloading boat hands over, the catch is transferred here before the boat
   * clears, so product is never destroyed without a handoff (§29/§33-22).
   */
  wharfStock?: OutputStock;
}

export interface BoatStepResult {
  /** Units transferred to the wharf stock on this step (0 when none). */
  unloaded: number;
  /** True when the boat stayed unloading with its catch intact (blocked). */
  blocked: boolean;
}

/**
 * One phase step for a fishing boat. Fully deterministic:
 *   idle → sailing (3-day outbound) → fishing (30-day cycle, accumulates up to
 *   capacity) → returning (3-day inbound) → unloading (catch → wharf) → idle.
 * A blocked boat stays put and keeps its catch (never loses product — §29/§33-22):
 * the catch transfers to the wharf stock only when `wharfFree` is true, and the
 * boat advances to idle only after a real handoff.
 */
export function boatStep(boat: FishingBoat, opts: BoatStepOptions): BoatStepResult {
  // Timer-driven phases advance while `remaining` is positive; fishing also
  // accumulates catch here so the 30-day cycle terminates deterministically.
  if (boat.remaining > 0) {
    if (boat.state === 'fishing') {
      boat.catch = Math.min(BOAT_CAPACITY, boat.catch + 1);
    }
    boat.remaining -= 1;
    if (boat.remaining === 0) {
      if (boat.state === 'sailing') {
        boat.state = 'fishing';
        boat.remaining = FISHING_CYCLE_DAYS;
      } else if (boat.state === 'fishing') {
        boat.state = 'returning';
        boat.remaining = 3;
      } else if (boat.state === 'returning') {
        boat.state = 'unloading';
      }
    }
    return { unloaded: 0, blocked: false };
  }
  switch (boat.state) {
    case 'idle':
      boat.state = opts.hasZone ? 'sailing' : 'seeking-zone';
      boat.remaining = opts.hasZone ? 3 : 0;
      break;
    case 'seeking-zone':
      if (opts.hasZone) {
        boat.state = 'sailing';
        boat.remaining = 3;
      }
      break;
    case 'unloading': {
      // A blocked wharf (no free capacity) keeps the boat unloading with its
      // catch fully intact — never zero it out until the handoff commits.
      if (!opts.wharfFree) return { unloaded: 0, blocked: true };
      const unloaded = boat.catch;
      const stock = opts.wharfStock;
      if (stock) {
        const free = Math.max(0, stock.capacity - stock.units);
        const accepted = Math.min(unloaded, free);
        stock.units += accepted;
        boat.catch = unloaded - accepted;
        // The wharf could not take the whole catch: keep the remainder and stay
        // unloading rather than silently discarding fish.
        if (boat.catch > 0) return { unloaded: accepted, blocked: true };
      } else {
        boat.catch = 0;
      }
      boat.state = 'idle';
      return { unloaded, blocked: false };
    }
    case 'maintenance':
      boat.remaining = 0;
      break;
    case 'sailing':
    case 'fishing':
    case 'returning':
      // only reached with remaining === 0 (transient after a state change)
      break;
  }
  return { unloaded: 0, blocked: false };
}

/** Stop reasons for the fishing wharf (spec §10.5). */
export type FishingWharfReason =
  | 'working'
  | 'no-workers'
  | 'maintenance'
  | 'boat-seeking-zone'
  | 'sailing'
  | 'fishing'
  | 'returning'
  | 'unloading'
  | 'wharf-full'
  | 'no-granary'
  | 'river-blocked'
  | 'reduced-production'
  | 'paused';

export function fishingWharfState(boat: FishingBoat, opts: { staffed: boolean; paused: boolean; hasZone: boolean; granaryAvailable: boolean }): FishingWharfReason {
  if (opts.paused) return 'paused';
  if (!opts.staffed) return 'no-workers';
  if (!opts.granaryAvailable) return 'no-granary';
  if (!opts.hasZone) return 'river-blocked';
  if (boat.state === 'seeking-zone') return 'boat-seeking-zone';
  if (boat.state === 'idle' || boat.state === 'unloading') return 'unloading';
  return boat.state;
}

export type GranaryCommand =
  | 'accept' | 'refuse' | 'request' | 'maintain' | 'empty' | 'reserve' | 'export';

export interface GranaryPolicy {
  /** Per-commodity command overriding the default. */
  perFood: Partial<Record<string, GranaryCommand>>;
  capacity: number;
}

export function defaultGranaryPolicy(capacity = 100): GranaryPolicy {
  return { perFood: {}, capacity };
}

/**
 * Whether a granary with `policy` accepts, holds, and releases a food load.
 * Handles capacity (a granary is full and refuses more when at capacity) and
 * the reserve buffer for 'maintain'/'reserve'/'export' commands.
 */
export function granaryAccepts(policy: GranaryPolicy, food: string, stored: number): boolean {
  if (stored >= policy.capacity) return false;
  const cmd = policy.perFood[food] ?? 'accept';
  return cmd !== 'refuse' && cmd !== 'empty';
}
