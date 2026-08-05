/**
 * Missions — campaign objectives that drive the sandbox game.
 *
 * Phase 17 (CAMPAIGN-01): each mission additionally defines a deterministic
 * starter map (layout string → terrain), emphasized products (goods-chain
 * fluency), trade routes to open on start, and difficulty modifiers (treasury
 * credit / policy / time-limit override). All four fields are OPTIONAL — an
 * all-undefined mission keeps prior (Phase 15 RATE-02) behavior, so every
 * existing entry stays valid.
 */

import type { TileType } from '../src/sim/types';
import type { TradeOrderMode } from '../src/sim/trade';

/** Deterministic starter map for a mission (validated at load — DATA-01). */
export interface MissionMapDef {
  /** Map width in tiles (≤ 40 for sim-sized layouts). */
  width: number;
  /** Map height in tiles. */
  height: number;
  /** Row-major terrain layout, newline-joined: exactly `height` rows of exactly
   *  `width` characters. '.' = earth; every other char must be a `legend` key. */
  layout: string;
  /** Layout char → terrain tile (every value must be a valid TileType). */
  legend: Record<string, TileType>;
  /** Starter buildings placed deterministically on mission start. Coordinates
   *  must be in-bounds; `god` only matters for temples/grand temples. */
  preplace?: { type: string; x: number; y: number; god?: string }[];
}

/** A trade route opened when the mission starts. */
export interface MissionRouteDef {
  /** Partner city id (must exist in TRADE_CITIES — validated at load). */
  cityId: string;
  /** Annual per-good quota cap, if any. */
  quota?: number;
  /** Per-good order mode to set. */
  order?: TradeOrderMode;
  /** The good the order applies to (omit to leave every good at no_trade). */
  good?: string;
}

/** Difficulty knobs applied at mission start (all optional, additive). */
export interface MissionModifiers {
  /** Denarii credited on top of the running treasury at mission start
   *  (startingDenarii semantics — additive, never a reset). */
  startingTreasuryCredit?: number;
  /** Policy override applied at start. */
  startingPolicy?: { taxRate?: number; wageRate?: number };
  /** Per-mission time-limit override in years (defaults to no limit). */
  timeLimitYears?: number;
}

export interface MissionDef {
  id: string;
  name: string;
  description: string;
  /** Target population to achieve. */
  targetPopulation: number;
  /** Target culture rating. */
  targetCulture: number;
  /** Target prosperity rating. */
  targetProsperity: number;
  /** Target stability rating. */
  targetStability: number;
  /** Optional RATE-02 targets — when present the mission must hold ADVANCED
   *  targets (favor/treasury/annual exports) too, each undefined = not
   *  required. */
  targetFavor?: number;
  targetTreasury?: number;
  targetAnnualExports?: number;
  /** Months the targets must be held consecutively (default 3). */
  sustainChecks?: number;
  /** Starting treasury (denarii). */
  startingDenarii: number;
  /** Time limit in years, if any. */
  timeLimitYears?: number;
  // --- Phase 17 additive (all optional; undefined = existing behavior) ---
  /** Deterministic starter map (terrain via missionMap() in sim). */
  map?: MissionMapDef;
  /** Commodity ids the mission emphasizes (goods-chain fluency). */
  products?: string[];
  /** Trade routes opened deterministically on start. */
  routes?: MissionRouteDef[];
  /** Difficulty knobs applied on start. */
  modifiers?: MissionModifiers;
}

export const MISSIONS: Record<string, MissionDef> = {
  // 1. riverside foundations — the tutorial: a farm, a well, and a few houses
  //    beside the river. Winnable by any functioning village (pop 100, 10/10/10).
  tutorial: {
    id: 'tutorial', name: 'Riverside Foundations', description: 'Lay the first roads by the river — build houses, a well, and a farm to feed your citizens.',
    targetPopulation: 100, targetCulture: 10, targetProsperity: 10, targetStability: 10, startingDenarii: 500,
    map: {
      width: 14, height: 14,
      legend: { W: 'water', F: 'fertile' },
      layout: [
        'WWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWW',
        '..............',
        '..............',
        '..FFFF........',
        '..FFFF........',
        '..FFFF........',
        '..FFFF........',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
      ].join('\n'),
      preplace: [
        { type: 'road', x: 8, y: 10 }, { type: 'road', x: 9, y: 10 }, { type: 'road', x: 10, y: 10 },
        { type: 'house', x: 8, y: 11 }, { type: 'well', x: 10, y: 11 },
      ],
    },
    products: ['wheat'],
    modifiers: { startingTreasuryCredit: 500 },
  },
  // 2. provincial granary — enough food surplus to sustain a small town.
  small_town: {
    id: 'small_town', name: 'Provincial Granary', description: 'Feed a growing town — a belt of farms feeding granaries, then a market to distribute the surplus.',
    targetPopulation: 500, targetCulture: 30, targetProsperity: 30, targetStability: 30, startingDenarii: 2000,
    map: {
      width: 16, height: 16,
      legend: { F: 'fertile', T: 'trees' },
      layout: [
        '................',
        '................',
        '................',
        '.FFFFFF.........',
        '.FFFFFF.........',
        '................',
        '................',
        '.FFFFFF.........',
        '.FFFFFF.........',
        '................',
        '..........TTT...',
        '..........TTT...',
        '..........TTT...',
        '................',
        '................',
        '................',
      ].join('\n'),
      preplace: [
        { type: 'road', x: 10, y: 13 }, { type: 'road', x: 11, y: 13 }, { type: 'road', x: 12, y: 13 },
        { type: 'house', x: 10, y: 14 }, { type: 'well', x: 12, y: 14 },
      ],
    },
    products: ['wheat', 'vegetables'],
    modifiers: { startingTreasuryCredit: 2000 },
  },
  // 3. clay and fire — the first workshops: clay to pottery, timber to
  //    furniture, olives to oil, grapes to wine.
  thriving_city: {
    id: 'thriving_city', name: 'Clay and Fire', description: 'Fire the kilns — feed clay and timber into workshops and grow a thriving city on manufactured goods.',
    targetPopulation: 2000, targetCulture: 60, targetProsperity: 60, targetStability: 60, startingDenarii: 5000, timeLimitYears: 10,
    map: {
      width: 24, height: 24,
      legend: { F: 'fertile', T: 'trees' },
      layout: [
        '........................',
        '........................',
        '........................',
        '........................',
        '..FFFFFF................',
        '..FFFFFF................',
        '..FFFFFF................',
        '........................',
        '..............TTTTTT....',
        '..............TTTTTT....',
        '..FFFFFF......TTTTTT....',
        '..FFFFFF......TTTTTT....',
        '..FFFFFF......TTTTTT....',
        '........................',
        '........................',
        '........................',
        '..........TTTT..........',
        '..........TTTT..........',
        '..........TTTT..........',
        '..........TTTT..........',
        '........................',
        '........................',
        '........................',
        '........................',
      ].join('\n'),
      preplace: [
        { type: 'road', x: 16, y: 20 }, { type: 'road', x: 17, y: 20 }, { type: 'road', x: 18, y: 20 },
        { type: 'house', x: 16, y: 21 }, { type: 'well', x: 18, y: 21 },
      ],
    },
    products: ['clay', 'pottery', 'timber', 'furniture', 'olives', 'oil', 'grapes', 'wine'],
    modifiers: { startingTreasuryCredit: 5000, timeLimitYears: 10 },
  },
  // 4. trade roads — a grand city whose surplus flows outward on the caravan
  //    routes; culture is fed by full civic coverage, exports by real loads.
  grand_city: {
    id: 'grand_city', name: 'Trade Roads', description: 'Bind the region with trade — open the roads to Massilia and Tarraco and let a grand city profit from its surplus.',
    targetPopulation: 5000, targetCulture: 80, targetProsperity: 80, targetStability: 80,
    targetAnnualExports: 40, startingDenarii: 10000, timeLimitYears: 20,
    map: {
      width: 30, height: 30,
      legend: { W: 'water', F: 'fertile', T: 'trees', R: 'rock' },
      layout: [
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
        '..............................',
        '..............................',
        '..............................',
        '...FFFFFFFF...................',
        '...FFFFFFFF.......TTTTT.......',
        '...FFFFFFFF.......TTTTT.......',
        '..................TTTTT.......',
        '..................TTTTT.......',
        '..............................',
        '..............................',
        '...FFFFFFFF...................',
        '...FFFFFFFF...................',
        '...FFFFFFFF...................',
        '..............................',
        '................FFFFFFF.......',
        '................FFFFFFF.......',
        '................FFFFFFF.......',
        '................FFFFFFF.......',
        '....RRRR......................',
        '....RRRR......................',
        '....RRRR......................',
        '....RRRR......................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
      ].join('\n'),
      preplace: [
        { type: 'road', x: 12, y: 22 }, { type: 'road', x: 13, y: 22 }, { type: 'road', x: 14, y: 22 },
        { type: 'house', x: 12, y: 23 }, { type: 'well', x: 14, y: 23 },
      ],
    },
    products: ['clay', 'pottery', 'furniture', 'wine', 'oil', 'tools'],
    routes: [
      { cityId: 'massilia', good: 'pottery', order: 'export_above_reserve', quota: 40 },
      { cityId: 'tarraco', good: 'tools', order: 'export_above_reserve', quota: 20 },
    ],
    modifiers: { startingTreasuryCredit: 10000, timeLimitYears: 20 },
  },
};

export function missionName(id: string): string {
  return MISSIONS[id]?.name ?? id;
}

// Extended campaign to reach 10 missions (task 10.6).
export const EXTRA_MISSIONS: Record<string, MissionDef> = {
  // 5. water for all — the wharf town: fish from the coast and clean water.
  fishing_village: {
    id: 'fishing_village', name: 'Water for All', description: 'Bring water to every home — wells and fountains on the fishing coast.',
    targetPopulation: 300, targetCulture: 20, targetProsperity: 20, targetStability: 20, startingDenarii: 1500,
    map: {
      width: 18, height: 18,
      legend: { W: 'water', F: 'fertile' },
      layout: [
        'WWWWWW............',
        'WWWWWW............',
        'WWWWWW............',
        'WWWWWW............',
        'WWWW..............',
        'WWWW..............',
        'WWWW....FFFFF.....',
        'WWWW....FFFFF.....',
        'WWWW....FFFFF.....',
        'WWWW..............',
        'WWWW..............',
        'WWWW..............',
        'WWWW..............',
        'WWWW..............',
        'WWWW..............',
        'WWWW..............',
        'WWWW..............',
        'WWWW..............',
      ].join('\n'),
      preplace: [
        { type: 'road', x: 10, y: 12 }, { type: 'road', x: 11, y: 12 }, { type: 'road', x: 12, y: 12 },
        { type: 'house', x: 10, y: 13 }, { type: 'well', x: 12, y: 13 },
      ],
    },
    products: ['fish', 'wheat', 'vegetables'],
    modifiers: { startingTreasuryCredit: 1500 },
  },
  // 6. city of scholars — libraries and schools raise a modest town to culture.
  market_town: {
    id: 'market_town', name: 'City of Scholars', description: 'Raise the town\'s mind — pack schools, a library, and a theatre into a bustling market town.',
    targetPopulation: 900, targetCulture: 40, targetProsperity: 40, targetStability: 40, startingDenarii: 3000, timeLimitYears: 8,
    map: {
      width: 20, height: 20,
      legend: { F: 'fertile', T: 'trees' },
      layout: [
        '....................',
        '....................',
        '....................',
        '....................',
        '..FFFFFF............',
        '..FFFFFF............',
        '....................',
        '....................',
        '....................',
        '..FFFFFF............',
        '..FFFFFF............',
        '....................',
        '.............TTTT...',
        '.............TTTT...',
        '..FFFFFF.....TTTT...',
        '..FFFFFF.....TTTT...',
        '....................',
        '....................',
        '....................',
        '....................',
      ].join('\n'),
      preplace: [
        { type: 'road', x: 10, y: 17 }, { type: 'road', x: 11, y: 17 }, { type: 'road', x: 12, y: 17 },
        { type: 'house', x: 10, y: 18 }, { type: 'well', x: 12, y: 18 },
      ],
    },
    products: ['wheat', 'pottery', 'timber', 'furniture'],
    modifiers: { startingTreasuryCredit: 3000, timeLimitYears: 8 },
  },
  // 7. favors of the gods — win the gods through temples, festivals, and
  //    worship; the port city stacks favor on top of its targets.
  port_city: {
    id: 'port_city', name: 'Favors of the Gods', description: 'Win the favor of the gods — raise temples and hold festivals in a flourishing port.',
    targetPopulation: 3000, targetCulture: 60, targetProsperity: 60, targetStability: 60,
    targetFavor: 60, startingDenarii: 6000, timeLimitYears: 12,
    map: {
      width: 26, height: 26,
      legend: { W: 'water', F: 'fertile', T: 'trees' },
      layout: [
        'WWWWWWW...................',
        'WWWWWWW...................',
        'WWWWWWW...................',
        'WWWWWWW...................',
        'WWWWW.....................',
        'WWWWW.....................',
        'WWWWW.....................',
        'WWWWW.....................',
        'WWWWW....FFFFFF...........',
        'WWWWW....FFFFFF...........',
        'WWWWW....FFFFFF...........',
        'WWWWW....FFFFFF...........',
        'WWWWW.....................',
        'WWWWW.....................',
        'WWWWW.............TTTT....',
        'WWWWW.............TTTT....',
        'WWWWW.............TTTT....',
        'WWWWW.............TTTT....',
        'WWWWW.............TTTT....',
        'WWWWW.....................',
        'WWWWW.....................',
        'WWWWW.....................',
        'WWWWW.....................',
        'WWWWW.....................',
        'WWWWW.....................',
        'WWWWW.....................',
      ].join('\n'),
      preplace: [
        { type: 'road', x: 16, y: 21 }, { type: 'road', x: 17, y: 21 }, { type: 'road', x: 18, y: 21 },
        { type: 'house', x: 16, y: 22 }, { type: 'well', x: 18, y: 22 },
      ],
    },
    products: ['wheat', 'fish', 'wine', 'oil'],
    modifiers: { startingTreasuryCredit: 6000, timeLimitYears: 12 },
  },
  // 8. southern port — the cultural center: education and entertainment are the
  //    goal, with enough sea trade to justify the name.
  cultural_center: {
    id: 'cultural_center', name: 'Southern Port', description: 'Foster learning and spectacle — a cultural center on the southern sea with workshops feeding the ships.',
    targetPopulation: 4000, targetCulture: 80, targetProsperity: 50, targetStability: 60,
    targetAnnualExports: 30, startingDenarii: 8000, timeLimitYears: 15,
    map: {
      width: 32, height: 32,
      legend: { F: 'fertile', T: 'trees', R: 'rock' },
      layout: [
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '...FFFFFFFF.....................',
        '...FFFFFFFF.....................',
        '...FFFFFFFF.....................',
        '................................',
        '................................',
        '................................',
        '....................TTTTT.......',
        '....................TTTTT.......',
        '...FFFFFFFF.........TTTTT.......',
        '...FFFFFFFF.........TTTTT.......',
        '...FFFFFFFF.........TTTTT.......',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '...FFFFFFFF.....................',
        '...FFFFFFFF.....................',
        '...FFFFFFFF.....................',
        '................................',
        '....RRRR........................',
        '....RRRR........................',
        '....RRRR........................',
        '....RRRR........................',
        '................................',
        '................................',
      ].join('\n'),
      preplace: [
        { type: 'road', x: 16, y: 18 }, { type: 'road', x: 17, y: 18 }, { type: 'road', x: 18, y: 18 },
        { type: 'house', x: 16, y: 19 }, { type: 'well', x: 18, y: 19 },
      ],
    },
    products: ['wheat', 'pottery', 'furniture', 'marble', 'wine'],
    routes: [
      { cityId: 'caralis', good: 'pottery', order: 'export_above_reserve', quota: 20 },
      { cityId: 'londinium', good: 'wine', order: 'export_above_reserve', quota: 20 },
    ],
    modifiers: { startingTreasuryCredit: 8000, timeLimitYears: 15 },
  },
  // 9. city of patricians — the religious hub: villas and temples for the
  //    patricians, sustained by godly favor.
  religious_hub: {
    id: 'religious_hub', name: 'City of Patricians', description: 'Raise villas for the patricians — great temples and festivals keep the city graceful and stable.',
    targetPopulation: 4500, targetCulture: 70, targetProsperity: 60, targetStability: 70,
    targetFavor: 70, startingDenarii: 9000, timeLimitYears: 18,
    map: {
      width: 30, height: 30,
      legend: { F: 'fertile', T: 'trees' },
      layout: [
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..FFFFFF..........FFFFFF......',
        '..FFFFFF..........FFFFFF......',
        '..FFFFFF..........FFFFFF......',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..FFFFFF..........FFFFFF......',
        '..FFFFFF..........FFFFFF......',
        '..FFFFFF..TTTTT...FFFFFF......',
        '..........TTTTT...............',
        '..........TTTTT...............',
        '..........TTTTT...............',
        '..........TTTTT...............',
        '..............................',
        '..............................',
        '..............................',
      ].join('\n'),
      preplace: [
        { type: 'road', x: 16, y: 12 }, { type: 'road', x: 17, y: 12 }, { type: 'road', x: 18, y: 12 },
        { type: 'house', x: 16, y: 13 }, { type: 'well', x: 18, y: 13 },
      ],
    },
    products: ['wheat', 'meat', 'furniture', 'wine', 'oil', 'marble'],
    modifiers: { startingTreasuryCredit: 9000, timeLimitYears: 18 },
  },
  // 10. provincial capital — the metropolis: a great city across the river,
  //     eased targets (80/80/80) keep the final mission winnable inside its
  //     long limit (RESEARCH per-mission winnability: 85/85/85 is fragile).
  metropolis: {
    id: 'metropolis', name: 'Provincial Capital', description: 'Crown the campaign — a glorious metropolis spanning the river, the seat of the province.',
    targetPopulation: 6000, targetCulture: 80, targetProsperity: 80, targetStability: 80,
    targetTreasury: 12000, targetFavor: 70, startingDenarii: 12000, timeLimitYears: 25,
    map: {
      width: 36, height: 36,
      legend: { W: 'water', F: 'fertile', T: 'trees', R: 'rock' },
      layout: [
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '..FFFFFFFF............TTTTT.........',
        '..FFFFFFFF............TTTTT.........',
        '..FFFFFFFF............TTTTT.........',
        '......................TTTTT.........',
        '......................TTTTT.........',
        '....................................',
        '....................................',
        '....................................',
        '..FFFFFFFF..........................',
        '..FFFFFFFF..........................',
        '..FFFFFFFF............FFFFFFFF......',
        '......................FFFFFFFF......',
        '......................FFFFFFFF......',
        '......................FFFFFFFF......',
        '....................................',
        '....................................',
        '..FFFFFFFF..........................',
        '..FFFFFFFF..........................',
        '..FFFFFFFF..............RRRRR.......',
        '........................RRRRR.......',
        '........................RRRRR.......',
        '........................RRRRR.......',
        '........................RRRRR.......',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
      ].join('\n'),
      preplace: [
        { type: 'road', x: 12, y: 28 }, { type: 'road', x: 13, y: 28 }, { type: 'road', x: 14, y: 28 },
        { type: 'house', x: 12, y: 29 }, { type: 'well', x: 14, y: 29 },
      ],
    },
    products: ['wheat', 'pottery', 'furniture', 'wine', 'oil', 'tools', 'marble'],
    routes: [
      { cityId: 'massilia', good: 'pottery', order: 'export_above_reserve', quota: 40 },
      { cityId: 'londinium', good: 'wine', order: 'export_above_reserve', quota: 40 },
    ],
    modifiers: { startingTreasuryCredit: 12000, timeLimitYears: 25 },
  },
};
