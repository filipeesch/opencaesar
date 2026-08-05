/**
 * Campaign support — codex & contextual tutorial (task 10.6).
 *
 * The codex explains every building, good, service, and god from the data
 * catalogs. The tutorial emits contextual prompts when the player first
 * encounters each system. Self-contained, additive.
 */
import { BUILDINGS } from '../../data/buildings';
import { COMMODITIES } from '../../data/commodities';
import { WALKERS } from '../../data/walkers';
import { GODS } from './services';

export interface CodexEntry {
  kind: 'building' | 'commodity' | 'service' | 'god';
  id: string;
  name: string;
  blurb: string;
}

/** Build the full codex from the real data catalogs. */
export function buildCodex(): CodexEntry[] {
  const entries: CodexEntry[] = [];
  for (const b of Object.values(BUILDINGS)) {
    entries.push({ kind: 'building', id: b.id, name: b.name, blurb: b.name });
  }
  for (const c of Object.values(COMMODITIES)) {
    entries.push({ kind: 'commodity', id: c.id, name: c.name, blurb: c.name });
  }
  for (const w of Object.values(WALKERS)) {
    entries.push({ kind: 'service', id: w.id, name: w.name, blurb: w.service });
  }
  for (const g of GODS) {
    entries.push({ kind: 'god', id: g, name: g, blurb: `Cult of ${g}` });
  }
  return entries;
}

export type TutorialStepId =
  | 'roads' | 'housing' | 'water' | 'food' | 'labor' | 'trade' | 'rating'
  | 'housing-evolution' | 'immigration-blocked' | 'dismissed';

const TUTORIAL_TEXT: Record<TutorialStepId, string> = {
  roads: 'Lay roads to connect buildings — walkers deliver services along them.',
  housing: 'Build houses near roads and services; they will evolve over time.',
  water: 'Provide wells and fountains so houses get clean water.',
  food: 'Farms and granaries feed your citizens; markets distribute the food.',
  labor: 'Staffed buildings need a connected labor pool to operate.',
  trade: 'Open trade routes to import goods and export surplus for denarii.',
  rating: 'Your city has ratings for Culture, Prosperity, Stability, and Favor.',
  // Phase 17 (CAMPAIGN-02): the two cause steps the state predicates drive —
  // text appended to the ORDERED seed above (the seed's own entries are intact).
  'housing-evolution': 'Homes evolve when their needs are met — improve desirability and services.',
  'immigration-blocked': 'A house without a road can grow no further — its walkers can never arrive.',
  dismissed: '',
};

/** Return the next tutorial prompt not yet seen. */
export function nextTutorialPrompt(seen: Set<TutorialStepId>): TutorialStepId | null {
  const order: TutorialStepId[] = [
    'roads', 'housing', 'water', 'food', 'labor', 'trade', 'rating',
  ];
  return order.find((s) => !seen.has(s)) ?? null;
}

export function tutorialText(step: TutorialStepId): string {
  return TUTORIAL_TEXT[step];
}

// ---------------------------------------------------------------------------
// Phase 17 (CAMPAIGN-02): state-observed tutorial.
//
// The ordered-introduction seed above stays EXACTLY as it was; on top of it each
// step gains a PURE TOTAL eligibility predicate over live state (DerivedSnapshot
// + per-house live state + a small city view). The runner evaluates the catalog
// every read — deterministic from state, never wall-clock — and getTutorial()
// exposes current/eligible/dismissed for Phase 18's UI.
// ---------------------------------------------------------------------------

/** Pure predicate input per house (the runner maps live BuildingInstance →
 *  HouseView; the house's `workersRequired` is its live workforce contribution,
 *  so road-isolation reads `!laborConnected && workersRequired > 0`). */
export interface HouseView {
  id: number;
  level: number;
  laborConnected: boolean;
  workersRequired: number;
  desirability: number;
  foodCooldown: number;
  waterCooldown: number;
  laborCooldown: number;
  services?: Record<string, number>;
  godAccess?: Record<string, number>;
  foodInventory?: Record<string, number>;
}

/** City-wide inputs the predicates read (built by the runner from live state). */
export interface CityView {
  hasStorageStock: boolean;
  annualExports: number;
  missionActive: boolean;
  missionTargets?: {
    population?: number;
    culture?: number;
    prosperity?: number;
    stability?: number;
    favor?: number;
    treasury?: number;
    annualExports?: number;
  };
  hasFoodProducer: boolean;
}

/** Per-step eligibility: a pure TOTAL function (never throws on empty cities)
 *  over the live snapshot, per-house views, and city view. No RNG/clock. */
export interface TutorialEligibility {
  eligible: (
    derived: import('./runner').DerivedSnapshot,
    houses: readonly HouseView[],
    city: CityView,
  ) => boolean;
  /** House ids that triggered the step ('show-where' for the UI); intro steps
   *  leave these empty. */
  highlight?: (houses: readonly HouseView[]) => number[];
}

/** A rendered tutorial prompt (short text + expanded explanation + a codex
 *  reference + the building ids that caused it). */
export interface TutorialPrompt {
  step: TutorialStepId;
  shortText: string;
  expandedText: string;
  codexRef: string;
  highlight: number[];
}

/** The whole tutorial state the UI reads. */
export interface TutorialView {
  current: TutorialPrompt | null;
  eligible: TutorialPrompt[];
  dismissed: string[];
}

/** Catalog order — the fixed introduction roads→housing→water first, then the
 *  state-triggered cause steps (constructor-first). */
export const TUTORIAL_STEP_ORDER: TutorialStepId[] = [
  'roads', 'housing', 'water', 'food', 'labor', 'trade', 'rating',
  'housing-evolution', 'immigration-blocked',
];

/** Expanded per-step explanation. */
export const TUTORIAL_EXPANDED: Record<TutorialStepId, string> = {
  roads: 'Walkers move along the road network. A building only counts as connected when a labor or service walker can reach it, so roads must form an unbroken network to every district.',
  housing: 'Houses evolve up a 21-level ladder as their needs (water, food, services, goods, desirability) are met. Start small: a well and a market make the first levels reachable.',
  water: 'Wells and fountains deliver clean water to adjacent houses. A house that never receives water cannot evolve past the first levels.',
  food: 'Farms grow grain into granaries; a market distributes food to nearby houses. Hunger — a house whose food flag keeps lapsing — stalls every other need.',
  labor: 'Every staffed building needs workers from the connected labor pool. A building with road access employs its workers; one that is cut off cannot operate.',
  trade: 'Open a route to a partner city and set per-good orders (export above a reserve, import up to a target). Exports earn denarii; the annual-export window rewards steady surplus.',
  rating: 'Culture, Prosperity, Stability, and Favor rate your city. Missions are won by holding every listed target for several months, so watch the advisor panels.',
  'housing-evolution': 'A house evolves when its desirability is high enough and its requirements are satisfied for a stretch. Raise desirability with services, ornament, and generous policy; cover every required service and good.',
  'immigration-blocked': 'A house with no road access never receives labor walkers, so it stays vacant no matter how many services exist. Connect it with a road and the neighborhood can grow.',
  dismissed: '',
};

/** The codex entry each step links to (built by buildCodex — Phase 17). */
export const TUTORIAL_CODEX_REF: Record<TutorialStepId, string> = {
  roads: 'road',
  housing: 'housing',
  water: 'well',
  food: 'farm',
  labor: 'labor',
  trade: 'trade',
  rating: 'ratings',
  'housing-evolution': 'housing',
  'immigration-blocked': 'road',
  dismissed: '',
};

/**
 * The cause-detection catalog. Roads/housing are the trivially-eligible
 * introduction (preserving the ordered seed); water observes a real live signal.
 * The remaining cause steps are conservatively inert (`() => false`
 * placeholder) in the Wave-2 tracer and completed with real predicates in
 * 17-02-02 — the predicate chain is the final shape, only the functions are
 * still conservative.
 */
export const TUTORIAL_ELIGIBILITY: Record<TutorialStepId, TutorialEligibility> = {
  roads: { eligible: () => true },
  housing: { eligible: () => true },
  water: {
    eligible: (d, houses) =>
      houses.length > 0 &&
      houses.every((h) => h.waterCooldown <= 0) &&
      d.water.coveredTiles === 0,
    highlight: (houses) => houses.map((h) => h.id),
  },
  food: { eligible: () => false },
  labor: { eligible: () => false },
  trade: { eligible: () => false },
  rating: { eligible: () => false },
  'housing-evolution': { eligible: () => false },
  'immigration-blocked': { eligible: () => false },
  dismissed: { eligible: () => false },
};

/**
 * The first catalog-order step that is both eligible and not dismissed (and not
 * 'seen' — for this phase seen == dismissed, the only persistent marker; transient
 * session 'seen' is Phase-18 UI state). Pure.
 */
export function nextTutorialCurrent(
  seen: Set<string>,
  dismissed: Set<string> | undefined,
  eligibleSteps: TutorialStepId[],
): TutorialStepId | null {
  const dismissedSet = dismissed ?? new Set<string>();
  return (
    TUTORIAL_STEP_ORDER.find((s) => eligibleSteps.includes(s) && !seen.has(s) && !dismissedSet.has(s)) ??
    null
  );
}
