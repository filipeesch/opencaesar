/**
 * Event catalog — random events that can strike a city (deterministic by seed).
 */

export type EventSeverity = 'mild' | 'serious' | 'disaster';

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
  /** Initial message shown when the event fires. */
  message: string;
  /** How long the event persists (in ticks), default 40. */
  durationTicks?: number;
  /** Message shown partway through the event. */
  sustainMsg?: string;
  /** Message shown when the event concludes. */
  finalMsg?: string;
}

export const EVENTS: Record<string, EventDef> = {
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

export function eventName(id: string): string {
  return EVENTS[id]?.name ?? id;
}
