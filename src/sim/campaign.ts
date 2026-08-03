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
  | 'roads' | 'housing' | 'water' | 'food' | 'labor' | 'trade' | 'rating' | 'dismissed';

const TUTORIAL_TEXT: Record<TutorialStepId, string> = {
  roads: 'Lay roads to connect buildings — walkers deliver services along them.',
  housing: 'Build houses near roads and services; they will evolve over time.',
  water: 'Provide wells and fountains so houses get clean water.',
  food: 'Farms and granaries feed your citizens; markets distribute the food.',
  labor: 'Staffed buildings need a connected labor pool to operate.',
  trade: 'Open trade routes to import goods and export surplus for denarii.',
  rating: 'Your city has ratings for Culture, Prosperity, Stability, and Favor.',
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
