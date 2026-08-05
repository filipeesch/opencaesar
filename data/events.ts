/**
 * Event catalog — random events that can strike a city (deterministic by seed).
 * RATE-03: expanded to the full non-armed spec set (~25+ types, original 8
 * byte-identical), each optionally carrying player `responses[]` whose valid
 * choice changes the outcome (treasury cost / altered severity / early
 * conclusion). Event names intentionally avoid the forbidden scanner tokens.
 */

export type EventSeverity = 'mild' | 'serious' | 'disaster';

/** A player response option for an event (RATE-03). */
export interface EventResponse {
  id: string;
  label: string;
  effect: {
    culture?: number;
    prosperity?: number;
    stability?: number;
    favor?: number;
    /** One-time denarii cost charged through the treasury when chosen. */
    treasuryCost?: number;
    /** End the event at the next tick. */
    conclude?: boolean;
    /** Altered severity after the choice (scales the event's own rating deltas). */
    severity?: EventSeverity;
  };
}

export interface EventDef {
  id: string;
  name: string;
  severity: EventSeverity;
  /** Probability weight for selection each month. */
  weight: number;
  /** Effect on city metrics. */
  effect: { culture?: number; prosperity?: number; stability?: number; favor?: number };
  /** Damage to buildings of these categories. */
  damages?: string[];
  /** price_* events: modifier delta applied to existing trade price states
   *  (a no-op when no price state exists, so golden runs with no routes stay
   *  untouched). */
  priceModify?: { good?: string; delta: number };
  /** Player response choices (RATE-03); valid choices change the outcome. */
  responses?: EventResponse[];
  /** Initial message shown when the event fires. */
  message: string;
  /** How long the event persists (in ticks), default 40. */
  durationTicks?: number;
  /** Message shown partway through the event. */
  sustainMsg?: string;
  /** Message shown when the event concludes. */
  finalMsg?: string;
}

// --- Original 8 events (Phase 7) — kept byte-identical (tests depend on their
// schedule/message behavior). ---
const ORIGINAL: Record<string, EventDef> = {
  fire: {
    id: 'fire', name: 'Fire', severity: 'serious', weight: 3,
    effect: { prosperity: -2, stability: -1 }, damages: ['housing', 'storage'],
    message: 'A fire has broken out in the city!',
    durationTicks: 60, sustainMsg: "The fire continues to burn.", finalMsg: "The fire has been brought under control."
  },
  collapse: {
    id: 'collapse', name: 'Building Collapse', severity: 'serious', weight: 2,
    effect: { prosperity: -2, stability: -1 }, damages: ['housing'],
    message: 'A building has collapsed!',
    durationTicks: 40, sustainMsg: "Cleanup continues at the collapse site.", finalMsg: "The debris has been cleared."
  },
  earthquake: {
    id: 'earthquake', name: 'Earthquake', severity: 'disaster', weight: 1,
    effect: { culture: -3, prosperity: -4, stability: -2 },
    message: 'An earthquake has struck the city!',
    durationTicks: 30, sustainMsg: "Aftershocks are felt across the city.", finalMsg: "The earthquake has subsided and repairs begin."
  },
  flood: {
    id: 'flood', name: 'Flood', severity: 'disaster', weight: 1,
    effect: { prosperity: -3, stability: -2 }, damages: ['water', 'storage'],
    message: 'Flooding has damaged the city!',
    durationTicks: 80, sustainMsg: "The floodwaters persist.", finalMsg: "The floodwaters have receded."
  },
  pestilence: {
    id: 'pestilence', name: 'Pestilence', severity: 'serious', weight: 2,
    effect: { prosperity: -3, stability: -1 }, damages: ['housing'],
    message: 'A plague has struck the city!',
    durationTicks: 70, sustainMsg: "The plague continues to spread.", finalMsg: "The plague has passed."
  },
  riot: {
    id: 'riot', name: 'Riot', severity: 'serious', weight: 2,
    effect: { stability: -3 },
    message: 'The citizens are rioting!',
    durationTicks: 40, sustainMsg: "Unrest continues in the streets.", finalMsg: "Order has been restored."
  },
  good_harvest: {
    id: 'good_harvest', name: 'Good Harvest', severity: 'mild', weight: 3,
    effect: { prosperity: 2 },
    message: 'A bountiful harvest has enriched the city.',
    durationTicks: 50, sustainMsg: "The abundant harvest continues.", finalMsg: "The harvest season has come to an end."
  },
  festival: {
    id: 'festival', name: 'Festival', severity: 'mild', weight: 2,
    effect: { culture: 2, stability: 1 },
    message: 'The citizens celebrate a great festival!',
    durationTicks: 50, sustainMsg: "The festivities continue.", finalMsg: "The festival has concluded."
  },
};

// --- RATE-03 expanded non-armed event set (spec §39). ---
const EXPANDED: Record<string, EventDef> = {
  drought: {
    id: 'drought', name: 'Drought', severity: 'serious', weight: 3,
    effect: { prosperity: -2, stability: -1 },
    message: 'A long drought threatens the harvest!',
    durationTicks: 60, sustainMsg: "The drought persists under a scorching sun.", finalMsg: "Rain has returned to end the drought.",
    responses: [
      { id: 'spend_now', label: 'Spend denarii on irrigation', effect: { treasuryCost: 200, prosperity: 1, conclude: true } },
      { id: 'wait_out', label: 'Wait out the season', effect: { severity: 'disaster' } },
    ],
  },
  exceptional_harvest: {
    id: 'exceptional_harvest', name: 'Exceptional Harvest', severity: 'mild', weight: 2,
    effect: { prosperity: 3 },
    message: 'An exceptional harvest fills every granary.',
    durationTicks: 50, sustainMsg: "The granaries overflow with grain.", finalMsg: "The exceptional harvest has been gathered."
  },
  agricultural_plague: {
    id: 'agricultural_plague', name: 'Agricultural Plague', severity: 'serious', weight: 2,
    effect: { prosperity: -3, stability: -1 },
    message: 'A blight is spreading across the fields!',
    durationTicks: 70, sustainMsg: "The blight continues to damage crops.", finalMsg: "The crops have recovered from the blight."
  },
  epidemic: {
    id: 'epidemic', name: 'Epidemic', severity: 'disaster', weight: 2,
    effect: { prosperity: -3, stability: -2 },
    message: 'An epidemic stalks the streets!',
    durationTicks: 90, sustainMsg: "The epidemic claims more victims.", finalMsg: "The epidemic has run its course.",
    responses: [
      { id: 'quarantine', label: 'Enforce a quarantine', effect: { treasuryCost: 300, favor: 2, conclude: true } },
      { id: 'ignore', label: 'Do nothing', effect: { severity: 'disaster' } },
    ],
  },
  regional_growth: {
    id: 'regional_growth', name: 'Regional Growth', severity: 'mild', weight: 3,
    effect: { prosperity: 1, stability: 1 },
    message: 'Traders and settlers from the region boost the city.',
    durationTicks: 60, sustainMsg: "The influx of newcomers continues.", finalMsg: "Regional growth has settled down."
  },
  price_fall: {
    id: 'price_fall', name: 'Price Fall', severity: 'mild', weight: 2,
    effect: { prosperity: 1 },
    priceModify: { delta: -0.15 },
    message: 'Goods prices fall across the region.',
    durationTicks: 80, sustainMsg: "Prices remain low.", finalMsg: "Prices have returned to normal."
  },
  price_rise: {
    id: 'price_rise', name: 'Price Rise', severity: 'serious', weight: 2,
    effect: { prosperity: -1, stability: -1 },
    priceModify: { delta: 0.2 },
    message: 'Regional demand drives prices upward!',
    durationTicks: 80, sustainMsg: "Prices keep climbing.", finalMsg: "Prices have eased back to normal.",
    responses: [
      { id: 'stockpile', label: 'Stockpile goods against the rise', effect: { treasuryCost: 150, conclude: true } },
      { id: 'absorb', label: 'Absorb the cost', effect: { severity: 'serious' } },
    ],
  },
  congested_route: {
    id: 'congested_route', name: 'Congested Route', severity: 'mild', weight: 2,
    effect: { prosperity: -1 },
    message: 'Heavy traffic clogs the trade routes.',
    durationTicks: 60, sustainMsg: "The congestion persists.", finalMsg: "The trade routes have cleared."
  },
  naval_delay: {
    id: 'naval_delay', name: 'Naval Delay', severity: 'mild', weight: 1,
    effect: { prosperity: -1 },
    message: 'Unfavorable tides delay the merchant ships.',
    durationTicks: 50, sustainMsg: "The ships remain delayed.", finalMsg: "The merchant fleet has arrived."
  },
  strike: {
    id: 'strike', name: 'Workers Strike', severity: 'serious', weight: 2,
    effect: { prosperity: -2, stability: -2 },
    message: 'The workers have downed tools!',
    durationTicks: 60, sustainMsg: "The strike continues.", finalMsg: "The workers have returned to the workshops.",
    responses: [
      { id: 'pay_raise', label: 'Grant a pay raise', effect: { treasuryCost: 250, favor: 2, conclude: true } },
      { id: 'refuse', label: 'Refuse their demands', effect: { severity: 'disaster' } },
    ],
  },
  spontaneous_festival: {
    id: 'spontaneous_festival', name: 'Spontaneous Festival', severity: 'mild', weight: 2,
    effect: { culture: 2, stability: 2 },
    message: 'The people celebrate with an impromptu festival.',
    durationTicks: 50, sustainMsg: "The celebrations continue.", finalMsg: "The spontaneous festival has ended."
  },
  marble_discovery: {
    id: 'marble_discovery', name: 'Marble Discovery', severity: 'mild', weight: 1,
    effect: { prosperity: 2, culture: 1 },
    message: 'A rich marble deposit is discovered nearby.',
    durationTicks: 70, sustainMsg: "The quarry produces fine marble.", finalMsg: "The marble discovery has been fully worked."
  },
  fertility_reduction: {
    id: 'fertility_reduction', name: 'Fertility Reduction', severity: 'serious', weight: 1,
    effect: { prosperity: -2, stability: -1 },
    message: 'The fields grow less fertile!',
    durationTicks: 100, sustainMsg: "Crop yields remain poor.", finalMsg: "The soil has recovered its fertility."
  },
  special_merchant: {
    id: 'special_merchant', name: 'Special Merchant', severity: 'mild', weight: 1,
    effect: { prosperity: 2 },
    message: 'A travelling merchant offers rare wares.',
    durationTicks: 50, sustainMsg: "The merchant still trades in the forum.", finalMsg: "The special merchant has departed."
  },
  urgent_request: {
    id: 'urgent_request', name: 'Urgent Request', severity: 'serious', weight: 2,
    effect: { favor: -1 },
    message: 'The governor makes an urgent request for aid!',
    durationTicks: 60, sustainMsg: "The request remains unanswered.", finalMsg: "The urgent request has been resolved.",
    responses: [
      { id: 'comply', label: 'Send aid immediately', effect: { treasuryCost: 220, favor: 3, conclude: true } },
      { id: 'decline', label: 'Politely decline', effect: { favor: -4, severity: 'serious' } },
    ],
  },
  donation: {
    id: 'donation', name: 'Generous Donation', severity: 'mild', weight: 1,
    effect: { favor: 2 },
    message: 'A wealthy citizen offers a generous donation.',
    durationTicks: 50, sustainMsg: "The donation is being considered.", finalMsg: "The donation matter has been settled.",
    responses: [
      { id: 'accept', label: 'Gratefully accept', effect: { favor: 4, conclude: true } },
      { id: 'refuse', label: 'Refuse politely', effect: { favor: -2, conclude: true } },
    ],
  },
  administrative_visit: {
    id: 'administrative_visit', name: 'Administrative Visit', severity: 'mild', weight: 1,
    effect: { favor: -1 },
    message: 'A provincial administrator visits the city.',
    durationTicks: 60, sustainMsg: "The administrator tours the public works.", finalMsg: "The administrative visit has concluded.",
    responses: [
      { id: 'impress', label: 'Host a lavish reception', effect: { treasuryCost: 180, favor: 3, conclude: true } },
      { id: 'modest', label: 'Keep it simple', effect: { favor: 1, conclude: true } },
    ],
  },
  regional_shortage: {
    id: 'regional_shortage', name: 'Regional Shortage', severity: 'serious', weight: 2,
    effect: { stability: -2 },
    message: 'A shortage sweeps the region!',
    durationTicks: 80, sustainMsg: "The shortage continues to bite.", finalMsg: "The regional shortage has eased."
  },
  exceptional_demand: {
    id: 'exceptional_demand', name: 'Exceptional Demand', severity: 'mild', weight: 2,
    effect: { prosperity: 2 },
    priceModify: { delta: 0.15 },
    message: 'Foreign demand for your wares surges.',
    durationTicks: 70, sustainMsg: "The demand shows no sign of slowing.", finalMsg: "The exceptional demand has subsided."
  },
  industrial_accident: {
    id: 'industrial_accident', name: 'Industrial Accident', severity: 'serious', weight: 2,
    effect: { prosperity: -2, stability: -2 }, damages: ['workshop', 'raw'],
    message: 'An accident strikes the workshops!',
    durationTicks: 60, sustainMsg: "Workshops remain damaged.", finalMsg: "The workshops are repaired.",
    responses: [
      { id: 'compensate', label: 'Compensate the injured', effect: { treasuryCost: 200, favor: 3, conclude: true } },
      { id: 'downplay', label: 'Downplay the incident', effect: { favor: -3, severity: 'serious' } },
    ],
  },
  well_contamination: {
    id: 'well_contamination', name: 'Well Contamination', severity: 'serious', weight: 2,
    effect: { stability: -2 }, damages: ['water'],
    message: 'A well has been contaminated!',
    durationTicks: 70, sustainMsg: "The water remains unsafe.", finalMsg: "The contaminated well has been sealed.",
    responses: [
      { id: 'dig_new', label: 'Dig a replacement well', effect: { treasuryCost: 150, stability: 2, conclude: true } },
      { id: 'post_warning', label: 'Post a warning', effect: { severity: 'serious' } },
    ],
  },
  heat_wave: {
    id: 'heat_wave', name: 'Heat Wave', severity: 'serious', weight: 2,
    effect: { stability: -2, prosperity: -1 },
    message: 'A scorching heat wave grips the city!',
    durationTicks: 60, sustainMsg: "The heat shows no mercy.", finalMsg: "The heat wave has broken."
  },
  severe_winter: {
    id: 'severe_winter', name: 'Severe Winter', severity: 'serious', weight: 2,
    effect: { stability: -2, prosperity: -1 },
    message: 'A severe winter blankets the city!',
    durationTicks: 80, sustainMsg: "The cold persists relentlessly.", finalMsg: "Spring has ended the severe winter."
  },
};

/** The full deterministic event catalog (original 8 + RATE-03 expansion). */
export const EVENTS: Record<string, EventDef> = { ...ORIGINAL, ...EXPANDED };

export function eventName(id: string): string {
  return EVENTS[id]?.name ?? id;
}
