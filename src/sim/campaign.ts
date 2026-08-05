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
import { HOUSING_LEVELS } from '../../data/housing';
import { requirementsMet, levelDesirability } from './housingLive';
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
  /** The requirement keys this house currently holds (well/fountain/market/
   *  service/goods) — drives the housing-evolution predicate. */
  satisfied?: string[];
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

/** Desirability headroom (on the 1-30 normalized scale) a house needs above its
 *  next level's base to actually evolve (mirrors decideEvolution's padding). */
const HOUSING_EVOLUTION_PADDING = 5;

/**
 * The cause-detection catalog: each step's eligibility is a pure TOTAL function
 * of (derived, houses, city) — deterministic from state, never wall-clock, never
 * throwing on empty cities. The ordered introduction (roads/housing) stays
 * trivially eligible; the cause steps observe real blockers:
 *   - water: houses that have never received clean water + no well/fountain
 *   - food: hungry houses + no food producer/stock anywhere
 *   - labor: staffable workplaces exist but houses are road-isolated
 *   - trade: surplus stock but no exports yet
 *   - rating: a mission is active and a target falls short (win explainer)
 *   - housing-evolution: a house's next level is fully requirements-satisfied
 *     and desirability is high — the player needs sustained satisfied ticks
 *   - immigration-blocked: occupied houses with no labor connectivity (the spec
 *     "houses built but no growth" → real cause: road/network isolation)
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
  food: {
    eligible: (_d, houses, city) =>
      houses.length > 0 &&
      houses.every((h) => h.foodCooldown <= 0) &&
      !city.hasFoodProducer &&
      !city.hasStorageStock,
    highlight: (houses) => houses.filter((h) => h.foodCooldown <= 0).map((h) => h.id),
  },
  labor: {
    // A workplace exists (food producer or stocked storage) but houses are
    // road-isolated — the labor pool cannot reach the staffable buildings.
    eligible: (_d, houses, city) =>
      houses.length > 0 &&
      (city.hasFoodProducer || city.hasStorageStock) &&
      houses.some((h) => !h.laborConnected),
    highlight: (houses) => houses.filter((h) => !h.laborConnected).map((h) => h.id),
  },
  trade: {
    // Surplus stock exists but nothing is exported yet — the trade route lesson.
    eligible: (_d, _houses, city) => city.hasStorageStock && city.annualExports === 0,
    highlight: () => [],
  },
  rating: {
    eligible: (d, _houses, city) => {
      if (!city.missionActive || !city.missionTargets) return false;
      const t = city.missionTargets;
      return (
        (t.population !== undefined && d.population < t.population) ||
        (t.culture !== undefined && d.culture < t.culture) ||
        (t.prosperity !== undefined && d.prosperity < t.prosperity) ||
        (t.stability !== undefined && d.stability < t.stability) ||
        (t.favor !== undefined && d.favor < t.favor) ||
        (t.treasury !== undefined && d.treasury < t.treasury) ||
        (t.annualExports !== undefined && d.annualExports < t.annualExports)
      );
    },
    highlight: () => [],
  },
  'housing-evolution': {
    eligible: (_d, houses, _city) => {
      if (houses.length === 0) return false;
      return houses.some((h) => {
        const next = h.level + 1;
        const nextDef = HOUSING_LEVELS.find((l) => l.level === next);
        if (!nextDef) return false;
        // The next level's cumulative requirements are met AND the normalized
        // desirability clears its padded threshold — the house just needs more
        // satisfied ticks/services, not a new mechanic.
        return (
          requirementsMet(next, h.satisfied ?? []) &&
          levelDesirability(h.desirability) >= nextDef.desirability + HOUSING_EVOLUTION_PADDING
        );
      });
    },
    highlight: (houses) =>
      houses
        .filter((h) => {
          const next = h.level + 1;
          const nextDef = HOUSING_LEVELS.find((l) => l.level === next);
          return nextDef && requirementsMet(next, h.satisfied ?? []) && levelDesirability(h.desirability) >= nextDef.desirability + HOUSING_EVOLUTION_PADDING;
        })
        .map((h) => h.id),
  },
  'immigration-blocked': {
    eligible: (_d, houses, _city) =>
      houses.some((h) => !h.laborConnected && h.workersRequired > 0),
    highlight: (houses) =>
      houses.filter((h) => !h.laborConnected && h.workersRequired > 0).map((h) => h.id),
  },
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
