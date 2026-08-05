/**
 * Campaign support — codex & contextual tutorial (task 10.6).
 *
 * The codex explains every building, good, service, and god from the data
 * catalogs. The tutorial emits contextual prompts when the player first
 * encounters each system. Self-contained, additive.
 */
import { BUILDINGS } from '../../data/buildings';
import { COMMODITIES, commodityName } from '../../data/commodities';
import { WALKERS } from '../../data/walkers';
import { HOUSING_LEVELS } from '../../data/housing';
import { TRADE_CITIES } from '../../data/trade';
import { EVENTS, eventName } from '../../data/events';
import { requirementsMet, levelDesirability } from './housingLive';
import { GODS, FESTIVAL_TIERS } from './services';
import { CONFIG } from './config';
import { W } from './ratings';

/** Every codex category (Phase 17 CAMPAIGN-03: the four original kinds plus the
 *  nine spec categories). */
export type CodexKind =
  | 'building' | 'commodity' | 'service' | 'god'
  | 'chain' | 'housing' | 'desirability' | 'trade' | 'finance' | 'ratings' | 'religion' | 'risks' | 'shortcuts';

/** A codex entry. Every field is derived from the data catalogs (never
 *  hand-copied numbers) — the "codex lies" hazard (T-17-08) is avoided by
 *  reading the live catalogs at build time. */
export interface CodexEntry {
  kind: CodexKind;
  id: string;
  name: string;
  blurb: string;
  /** Short paragraph explaining what this is. */
  description?: string;
  /** How the mechanic behaves in the sim. */
  howItWorks?: string;
  /** Goods it consumes (this entry's role as an input customer). */
  inputs?: string[];
  /** Goods it produces/provides. */
  outputs?: string[];
  /** Staff (workers) required when manned. */
  workers?: number;
  /** Build cost in denarii (catalog). */
  cost?: number;
  /** Deterministic composition from catalog facts (never invented numbers). */
  hints?: string[];
  /** Unlock/placement conditions. */
  requirements?: string[];
  /** Cross-linked entry ids. */
  relatedLinks?: string[];
}

const ENTRIES: CodexEntry[] = [
  ...Object.values(BUILDINGS).map((b) => {
    const outputs = b.produces ? [b.produces] : [];
    const inputs = b.consumes ? [b.consumes] : [];
    const requirements: string[] = [];
    if (b.requiresRoad) requirements.push('road access');
    const fp = b.footprint as unknown as [number, number] | number;
    if (typeof fp === 'number') requirements.push(`${fp}×${fp} footprint`);
    else requirements.push(`${fp[0]}×${fp[1]} footprint`);
    if (b.storageCapacity !== undefined) requirements.push(`stores up to ${b.storageCapacity} loads`);
    if (b.serviceRadius !== undefined) requirements.push(`serves a ${b.serviceRadius}-tile radius`);
    if (b.spawns && b.spawns.length > 0) requirements.push(`spawns walkers: ${b.spawns.join(', ')}`);
    if (b.requiredPopulation !== undefined) requirements.push(`needs ${b.requiredPopulation}+ people`);
    if (b.requiredRating) {
      const rs = Object.entries(b.requiredRating).map(([k, v]) => `${k} ${v}+`).join(', ');
      requirements.push(`needs a rating of ${rs}`);
    }
    return {
      kind: 'building' as const,
      id: b.id,
      name: b.name,
      blurb: b.name,
      cost: b.cost,
      workers: b.workers,
      outputs: outputs.length > 0 ? outputs : undefined,
      inputs: inputs.length > 0 ? inputs : undefined,
      description: `${b.name} is a '${b.category}' structure${outputs.length > 0 ? ` that produces ${outputs.map(commodityName).join(', ')}` : ''}${inputs.length > 0 ? ` from ${inputs.map(commodityName).join(', ')}` : ''}.`,
      howItWorks: buildingHowItWorks(b),
      requirements: requirements.length > 0 ? requirements : undefined,
      relatedLinks: [...outputs, ...inputs, 'housing'].filter((x, i, a) => a.indexOf(x) === i),
    };
  }),
  ...Object.values(COMMODITIES).map((c) => {
    const producers = Object.values(BUILDINGS).filter((b) => b.produces === c.id).map((b) => b.id);
    const consumers = Object.values(BUILDINGS).filter((b) => b.consumes === c.id).map((b) => b.id);
    return {
      kind: 'commodity' as const,
      id: c.id,
      name: c.name,
      blurb: c.name,
      description: `${c.name} is a '${c.category}' good stored in a ${c.storage}.`,
      howItWorks:
        `Priced ${c.baseImportPrice}/${c.baseExportPrice} denarii (import/export base) and it takes ${c.durabilityMonths} month(s) to spoil.` +
        (c.houseGood ? ' Homes consume it.' : ' Industry consumes it.') +
        (c.tradable ? ' It is tradable on the regional routes.' : ' It is not traded abroad.'),
      hints: [c.category, c.houseGood ? 'house good' : 'industrial good'],
      relatedLinks: [...producers, ...consumers].filter((x, i, a) => a.indexOf(x) === i),
    };
  }),
  ...Object.values(WALKERS).map((w) => ({
    kind: 'service' as const,
    id: w.id,
    name: w.name,
    blurb: w.service,
    description: `${w.name} walkers deliver the '${w.service}' service to the homes they pass.`,
    howItWorks: `Spawned by ${w.spawnedBy.join(', ')}; each visit refreshes the service flag on every neighbouring house.`,
    relatedLinks: [...w.spawnedBy, 'housing'],
  })),
  ...GODS.map((g) => ({
    kind: 'god' as const,
    id: g,
    name: g,
    blurb: `Cult of ${g}`,
    description: `${g.charAt(0).toUpperCase() + g.slice(1)} is worshipped through temples and grand temples; worship feeds your Favor rating.`,
    howItWorks: 'A temple walker keeps each house\'s access fresh; festivals boost every god\'s worship for their window.',
    relatedLinks: ['temple', 'grand_temple', 'festivals', 'rats-favor'],
  })),
  // chains — every producing building joined to its input/output.
  ...Object.values(BUILDINGS)
    .filter((b) => b.produces !== undefined)
    .map((b) => {
      const prod = b.produces as string;
      const cons = b.consumes; // string | undefined
      return {
        kind: 'chain' as const,
        id: `chain-${b.id}`,
        name: `${b.name} chain`,
        blurb: `${commodityName(prod)}`,
        description: cons
          ? `${b.name}s consume ${commodityName(cons)} and produce ${commodityName(prod)} for homes and trade.`
          : `${b.name}s gather ${commodityName(prod)} for storage, homes, and trade.`,
        howItWorks: `Staff the ${b.name} to produce ${commodityName(prod)}${cons ? ` from ${commodityName(cons)}` : ''}; a storage buffer feeds markets and caravan exports.`,
        inputs: cons ? [cons] : undefined,
        outputs: [prod],
        workers: b.workers,
        cost: b.cost,
        relatedLinks: [b.id, prod, ...(cons ? [cons] : [])],
      };
    }),
  // housing — an overview + one entry per level of the 21-level ladder.
  {
    kind: 'housing' as const, id: 'housing', name: 'Housing', blurb: 'Homes evolve up a 21-level ladder',
    description: 'Every house climbs from a Crude Hut to a Luxury Villa as its needs are met: water, food, services, goods, and desirability.',
    howItWorks: 'A house holds its level while satisfied; evolve to the next level once its requirements are met and desirability is high for a stretch.',
    relatedLinks: HOUSING_LEVELS.map((l) => `housing-${l.level}`).concat(['well', 'market']),
  },
  ...HOUSING_LEVELS.map((l) => ({
    kind: 'housing' as const,
    id: `housing-${l.level}`,
    name: l.name,
    blurb: l.name,
    description: `Homes ${l.capacity} people and pays ${l.taxPerCapita} denarii per resident.`,
    howItWorks: l.level === 0
      ? 'An empty plot waiting to be built.'
      : `Requires ${[...l.requires, ...l.requiresGoods].join(', ')} and ${l.desirability} desirability to hold.`,
    requirements: [...l.requires, ...l.requiresGoods],
    relatedLinks: ['housing'],
  })),
  // desirability — the overview plus the buildings that raise it.
  {
    kind: 'desirability' as const, id: 'desirability', name: 'Desirability', blurb: 'How pleasant a tile is (0-200)',
    description: 'Desirability decides whether homes evolve. Generous policy (high wages, low taxes), services, and ornament raise it; unpaid wages crush it.',
    howItWorks: 'Base terrain plus policy spread plus service bonuses plus ornament, clamped 0-200 and normalized to 1-30 for the housing ladder.',
    relatedLinks: Object.values(BUILDINGS).filter((b) => b.desirability).map((b) => `desirability-${b.id}`),
  },
  ...Object.values(BUILDINGS)
    .filter((b) => b.desirability)
    .map((b) => ({
      kind: 'desirability' as const,
      id: `desirability-${b.id}`,
      name: b.name,
      blurb: 'Raises nearby desirability',
      description: `${b.name} adds ${b.desirability!.effect} desirability within a ${b.desirability!.radius}-tile radius.`,
      howItWorks: 'Place it near homes to help them evolve; the effect fades with distance.',
      relatedLinks: ['desirability', 'housing'],
    })),
  // trade — overview + one entry per partner city.
  {
    kind: 'trade' as const, id: 'trade', name: 'Trade', blurb: 'Export surplus, import what you lack',
    description: 'Open a route, set per-good orders (export above a reserve, import up to a target), and merchants answer.',
    howItWorks: `Routes cost a flat opening fee and dispatch land caravans or sea ships; quotas cap yearly volume and prices move with supply.`,
    relatedLinks: Object.keys(TRADE_CITIES).map((c) => `trade-${c}`),
  },
  ...Object.values(TRADE_CITIES).map((city) => ({
    kind: 'trade' as const,
    id: `trade-${city.id}`,
    name: city.name,
    blurb: city.landOrSea === 'sea' ? 'Sea trade partner' : 'Road trade partner',
    description: `${city.name} buys ${city.buys.join(', ')} and sells ${city.sells.join(', ')} with a ${city.priceModifier} price modifier.`,
    howItWorks: `Opening the route costs ${city.routeOpeningCost} denarii; merchants arrive every ${city.merchantFrequency} ticks.`,
    relatedLinks: [...city.buys, ...city.sells],
  })),
  // finance — treasury mechanics read from live config.
  {
    kind: 'finance' as const, id: 'finance', name: 'Finance & Treasury', blurb: 'Subsidies, loans, taxes',
    description:
      `The treasury funds every build and wage. A royal subsidy of up to ${CONFIG.royalSubsidyCap} denarii is available yearly; loans up to ${CONFIG.loanMaxAmount} denarii accrue ${Math.round(CONFIG.loanInterestRate * 100)}% interest a year; wealth above ${CONFIG.treasuryOverflowLimit} denarii is lost.`,
    howItWorks: 'Keep the balance healthy — wages unpaid for long outweigh every other prosperity factor.',
    hints: [`subsidy ${CONFIG.royalSubsidyCap}/yr`, `loan cap ${CONFIG.loanMaxAmount}`, `interest ${Math.round(CONFIG.loanInterestRate * 100)}%/yr`, `overflow ${CONFIG.treasuryOverflowLimit}`],
    // WR-02: was dangling 'ratings-prosperity' — the ratings entries are rats-*.
    relatedLinks: ['rats-prosperity'],
  },
  // ratings — one per rating, from the live weights.
  ...(['culture', 'prosperity', 'stability', 'favor'] as const).map((r) => ({
    kind: 'ratings' as const,
    id: `rats-${r}`,
    name: `${r.charAt(0).toUpperCase() + r.slice(1)}`,
    blurb: `${r} rating`,
    description: `${r.charAt(0).toUpperCase() + r.slice(1)} is a weighted sum of the live factor scores (max 100).`,
    howItWorks: Object.entries(W[r])
      .filter((entry) => entry[1] > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ') + '.  Higher factor coverage raises the score.',
    relatedLinks: ['finance', 'housing', 'trade', 'desirability'],
  })),
  // religion — festivals plus the gods category above.
  {
    kind: 'religion' as const, id: 'festivals', name: 'Festivals', blurb: 'Honor the gods and raise worship',
    description: 'Hold a festival to boost every god\'s worship and Favor for their window.',
    howItWorks: `${FESTIVAL_TIERS.map((t) => `${t.id}: ${t.cost} denarii, +${Math.round(t.worshipBoost * 100)}% worship, +${t.favorBoost} favor`).join('; ')}.`,
    // WR-02: was dangling 'temples' — the building entries are temple/grand_temple.
    relatedLinks: [...GODS, 'temple', 'grand_temple', 'rats-favor'],
  },
  // risks — the derived fire/collapse/crime risks plus each event.
  {
    kind: 'risks' as const, id: 'risks', name: 'Risks & Events', blurb: 'Fire, collapse, crime, and random events',
    description: 'Fire stations, engineering, and policing cut risk; events can strike a city then recede.',
    howItWorks: 'Risks derive from density, age, and coverage; events are drawn deterministically from the calendar.',
    relatedLinks: Object.values(EVENTS).map((e) => `risks-event-${e.id}`),
  },
  ...Object.values(EVENTS).map((e) => ({
    kind: 'risks' as const,
    id: `risks-event-${e.id}`,
    name: eventName(e.id),
    blurb: `${e.severity} event`,
    description: e.message,
    howItWorks: `A '${e.severity}' event; it can shift ratings and damage buildings, then concludes.`,
    relatedLinks: ['risks'],
  })),
  // labor — the workforce underlying every staffed building. Authored overview
  // (the labor pool spans the walker network + per-building workers — no single
  // catalog record — same no-hand-roll exception as 'shortcuts', composed from
  // the live WALKERS/BUILDINGS facts). Exists so the tutorial 'labor' step's
  // codexRef (WR-02) resolves; before this, 'labor' linked to a nonexistent id.
  {
    kind: 'shortcuts' as const, id: 'labor', name: 'Labor & Workers', blurb: 'A connected labor pool staffs every building',
    description: 'Every staffed building draws its workers from the connected labor pool: a road network lets labor walkers reach workplaces and deliveries.',
    howItWorks:
      'A building with road access employs its full staff; an isolated building stays idle no matter how many workers the city holds.',
  },
  // shortcuts — the one static-text category (documented no-hand-roll exception:
  //   there is no catalog of game controls; the spec requires the category).
  {
    kind: 'shortcuts' as const, id: 'shortcuts', name: 'Shortcuts', blurb: 'Quick controls',
    description: 'Place roads to connect districts, right-click to demolish, adjust tax/wage on the policy panel, and check the advisors for live guidance.',
    howItWorks: 'Keyboard: 1-9 jump to advisor panels; space toggles the simulation speed.',
    // NOTE (no-hand-roll exception): control hints have NO data-catalog source —
    // the spec requires a shortcuts category, so this entry is authored text.
  },
];

/** How a building works, composed from catalog facts. */
function buildingHowItWorks(b: (typeof BUILDINGS)[string]): string {
  const parts: string[] = [];
  if (b.produces && b.consumes) parts.push(`consumes ${commodityName(b.consumes)} and produces ${commodityName(b.produces)} when staffed`);
  else if (b.produces) parts.push(`produces ${commodityName(b.produces)} when staffed`);
  else if (b.spawns && b.spawns.length > 0) parts.push(`spawns walkers (${b.spawns.join(', ')}) to serve nearby homes`);
  else if (b.storageCapacity !== undefined) parts.push(`stores up to ${b.storageCapacity} loads`);
  else parts.push(`a ${b.category} structure`);
  return `${b.name}, a ${b.category} building, ${parts.join(' and ')}.`;
}

/** Build the full codex from the real data catalogs. Pure and cheap-enough to
 *  cache on the runner (getCodex) so per-snapshot codex work stays light.
 *  IN-02: each entry is COPYED with its nested arrays (inputs/outputs/
 *  relatedLinks/requirements/hints) cloned too, so a consumer mutating a
 *  getCodex() result (e.g. the Phase-18 UI annotating links) can never corrupt
 *  the module-level ENTRIES shared by every subsequent runner. One-time per
 *  runner (cached), so the deep copy is cheap. */
export function buildCodex(): CodexEntry[] {
  return ENTRIES.map((e) => ({
    ...e,
    ...(e.inputs ? { inputs: [...e.inputs] } : {}),
    ...(e.outputs ? { outputs: [...e.outputs] } : {}),
    ...(e.relatedLinks ? { relatedLinks: [...e.relatedLinks] } : {}),
    ...(e.requirements ? { requirements: [...e.requirements] } : {}),
    ...(e.hints ? { hints: [...e.hints] } : {}),
  }));
}

/** Find a codex entry by id (optionally constrained to a kind). */
export function lookupEntry(entries: CodexEntry[], id: string, kind?: CodexKind): CodexEntry | undefined {
  if (kind) return entries.find((e) => e.id === id && e.kind === kind);
  return entries.find((e) => e.id === id);
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

/** The codex entry each step links to (built by buildCodex — Phase 17). Every
 *  ref MUST resolve to a real entry id (WR-02) — the integrity test asserts it. */
export const TUTORIAL_CODEX_REF: Record<TutorialStepId, string> = {
  roads: 'road',
  housing: 'housing',
  water: 'well',
  food: 'farm',
  labor: 'labor',
  trade: 'trade',
  rating: 'rats-prosperity', // ratings entries are rats-* (WR-02: was dangling 'ratings')
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
