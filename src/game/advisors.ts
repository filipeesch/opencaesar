/**
 * 13-advisor composition seam (Phase 18, UI-02).
 *
 * Pure UI-layer composer: `advisorPanels(source)` returns exactly 13 advisor
 * panels (in the UI-SPEC locked tab order) by composing the `advisorsFrom(snapshot)`
 * base datasets with the dedicated SimRunner getters — mapped by the ACTUAL
 * getter names, never string-keyed, never fabricated.
 *
 * This module is imported by node-env vitest (tests/unit/advisor-composer.test.ts),
 * so it must stay Phaser-free. The full composition lands in 18-02-01; the
 * type surface below is stable from Wave 0 so the Wave-0 scaffolds typecheck
 * (plan typecheck-sequencing note).
 */
import type { SimRunner } from '../sim/runner';

export type OverlayId = 'water' | 'food' | 'risks' | 'coverage' | 'desirability';

export interface AdvisorRow {
  label: string;
  value: string;
  tone?: 'ok' | 'bad' | 'muted';
}

export type AdvisorAction =
  | { kind: 'open-inspector'; id: number }
  | { kind: 'locate'; id: number }
  | { kind: 'open-overlay'; overlay: OverlayId }
  | { kind: 'open-codex'; entryId: string };

export interface AdvisorPanel {
  id: string;
  title: string;
  rows: AdvisorRow[];
  alerts?: string[];
  action: AdvisorAction | null;
  noData?: boolean;
}

/**
 * The subset of SimRunner the composer reads, plus the water-overlay getter
 * that lands in Wave 3 (feature-detected here so the composer typechecks before
 * the getter exists — plan typecheck-sequencing note).
 */
export type AdvisorSource = Pick<
  SimRunner,
  | 'getState'
  | 'getDerived'
  | 'getFinanceAdvisor'
  | 'getTradeAdvisor'
  | 'getTradeRoutes'
  | 'getProductionAdvisor'
  | 'getLogisticsAdvisor'
  | 'getEmployment'
  | 'getGovernance'
  | 'getRequests'
  | 'getMission'
  | 'getMissionProgress'
  | 'getCampaignProgress'
  | 'getEvents'
  | 'getFestival'
  | 'getCivilizationOverlay'
  | 'getCivicStats'
  | 'getWalkerInternals'
> & {
  /** Optional until 18-03-01 lands the runner getter (feature-detect the read). */
  getWaterOverlay?: () => Record<string, number[][]>;
};

/** Locked UI-SPEC advisor tab order (the 13 ids). */
export const ADVISOR_TAB_ORDER: readonly string[] = [
  'ratings',
  'finance',
  'food',
  'production-logistics',
  'labor',
  'trade',
  'housing',
  'demography',
  'safety-risks',
  'religion',
  'governance',
  'diplomacy',
  'objectives',
];

/**
 * Compose the 13 advisor panels from a live SimRunner (pure — never fabricates).
 * Full composition lands in 18-02-01; this Wave-0 placeholder keeps the
 * scaffolds RED until then.
 */
export function advisorPanels(_source: AdvisorSource): AdvisorPanel[] {
  return [];
}
