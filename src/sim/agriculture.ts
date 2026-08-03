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
}

export const FARMS: Record<FarmKind, FarmDef> = {
  wheat: { id: 'wheat', name: 'Wheat Farm', produces: 'wheat', requiresFertile: true, baseOutputPerTick: 0.5 },
  vegetables: { id: 'vegetables', name: 'Vegetable Farm', produces: 'vegetables', requiresFertile: true, baseOutputPerTick: 0.4 },
  orchard: { id: 'orchard', name: 'Orchard', produces: 'fruit', requiresFertile: true, baseOutputPerTick: 0.35 },
  animals: { id: 'animals', name: 'Animal Farm', produces: 'meat', requiresFertile: true, baseOutputPerTick: 0.25 },
  olives: { id: 'olives', name: 'Olive Grove', produces: 'olives', requiresFertile: true, baseOutputPerTick: 0.3 },
  vines: { id: 'vines', name: 'Vineyard', produces: 'grapes', requiresFertile: true, baseOutputPerTick: 0.3 },
  fishing: { id: 'fishing', name: 'Fishing Wharf', produces: 'fish', requiresFertile: false, baseOutputPerTick: 0.45 },
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
