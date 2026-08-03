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
