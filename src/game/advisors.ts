/**
 * 13-advisor composition seam (Phase 18, UI-02).
 *
 * Pure UI-layer composer: `advisorPanels(source)` returns exactly 13 advisor
 * panels in the UI-SPEC locked tab order by composing the `advisorsFrom(snapshot)`
 * base datasets with the dedicated SimRunner getters — mapped by the ACTUAL
 * getter names, never string-keyed, never fabricated (RESEARCH Pitfall 1:
 * `advisorsFrom` takes a SimSnapshot, not a name string).
 *
 * Phaser-free (imported by node-env vitest). Every value traces to a real
 * runner getter / pure projection; empty-city calls stay total with noData flags.
 */
import type { SimRunner } from '../sim/runner';
import { advisorsFrom, foodAdvisorFromState, foodHudFromState } from '../sim/advisors';
import type { SimSnapshot } from '../sim/advisors';

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
 * that lands in 18-03-01 (feature-detected here so the composer typechecks
 * before the getter exists — plan typecheck-sequencing note).
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

const n = (v: number): string => String(Math.round(v));
const dnr = (v: number): string => String(Math.round(v * 100)) + '%';

/** Locate the first live building of one of the given types, or null. */
function firstBuildingOf(state: { buildings: { id: number; type: string }[] }, types: string[]): number | null {
  for (const b of state.buildings) {
    if (types.includes(b.type)) return b.id;
  }
  return null;
}

/**
 * Compose the 13 advisor panels from a live SimRunner. Pure — never fabricates
 * a number; every value is a runner getter or a pure projection.
 */
export function advisorPanels(source: AdvisorSource): AdvisorPanel[] {
  const state = source.getState();
  const derived = source.getDerived();
  const foodData = foodAdvisorFromState(state);
  const foodHud = foodHudFromState(state);

  // Build the 8 base datasets ONCE via a real SimSnapshot (never string-keyed).
  const snapshot: SimSnapshot = {
    population: derived.population,
    treasury: state.treasury,
    taxRate: state.policy.taxRate,
    wageRate: state.policy.wageRate,
    hasReligion: derived.services.religion > 0,
    hasEntertainment: derived.services.entertainment > 0,
    hasEducation: derived.services.literacy > 0,
    hasHealth: derived.services.health > 0,
    hasWater: derived.water.coveredTiles > 0,
    hasFood: foodData.totalMonths > 0,
    jobs: derived.employment.jobs,
    employed: derived.employment.employed,
    welfare: {},
    godWorship: derived.godWorship,
    doctorCoverage: derived.services.health,
    educationCoverage: derived.services.literacy,
    entertainmentCoverage: derived.services.entertainment,
    decomposition: derived.decomposition,
    constructionSpend: derived.constructionSpend,
  };
  const base = advisorsFrom(snapshot);
  const baseData = (name: string): Record<string, number> =>
    base.find((d) => d.name === name)?.data ?? {};

  // --- Finance (getFinanceAdvisor) ---
  const fin = source.getFinanceAdvisor();
  const finance: AdvisorPanel = {
    id: 'finance',
    title: 'Finance',
    rows: [
      { label: 'Balance', value: n(fin.balance) },
      { label: 'Monthly Result', value: `${fin.deficit >= 0 ? '+' : '−'}${n(Math.abs(fin.deficit))}`, tone: fin.deficit < 0 ? 'bad' : 'ok' },
      { label: 'Debt', value: n(fin.debt), tone: fin.debt > 0 ? 'bad' : undefined },
      { label: 'Interest', value: n(fin.interest) },
      { label: 'Subsidy Used', value: n(fin.subsidyUsedThisYear) },
      { label: 'Tax Rate', value: dnr(fin.taxRate) },
      { label: 'Wage Rate', value: dnr(fin.wageRate) },
    ],
    alerts: fin.arrears ? ['Wages are in arrears'] : [],
    action: { kind: 'open-codex', entryId: 'finance' },
  };

  // --- Food (foodAdvisorFromState + foodHudFromState) ---
  const food: AdvisorPanel = {
    id: 'food',
    title: 'Food',
    rows: [
      { label: 'Months of Food', value: foodHud.text, tone: foodHud.band === 'red' || foodHud.band === 'orange' ? 'bad' : foodHud.band === 'green' ? 'ok' : undefined },
      { label: 'Available', value: n(foodData.totalAvailable) },
      { label: 'Production', value: n(foodData.productionMonthly) },
      { label: 'Consumption', value: n(foodData.consumptionMonthly) },
      { label: 'Balance', value: n(foodData.balanceMonthly), tone: foodData.balanceMonthly < 0 ? 'bad' : 'ok' },
    ],
    alerts: foodData.bottlenecks,
    action: { kind: 'open-overlay', overlay: 'food' },
    noData: foodData.totalAvailable === 0 && foodData.productionMonthly === 0 && foodData.consumptionMonthly === 0,
  };

  // --- Production & Logistics (getProductionAdvisor + getLogisticsAdvisor) ---
  const prod = source.getProductionAdvisor();
  const logi = source.getLogisticsAdvisor();
  const blockedRows = prod.rows.filter((r) => r.status === 'blocked' || r.status === 'missing_input' || r.status === 'output_full');
  const productionLogistics: AdvisorPanel = {
    id: 'production-logistics',
    title: 'Production & Logistics',
    rows: [
      { label: 'Workshops', value: n(prod.summary.workshops) },
      { label: 'Active', value: n(prod.summary.activeWorkshops), tone: prod.summary.activeWorkshops > 0 ? 'ok' : undefined },
      { label: 'Blocked', value: n(prod.summary.blocked), tone: prod.summary.blocked > 0 ? 'bad' : undefined },
      { label: 'In Transit', value: n(logi.inTransit) },
      { label: 'Bottlenecks', value: n(logi.bottlenecks), tone: logi.bottlenecks > 0 ? 'bad' : 'ok' },
      { label: 'Stopped', value: n(logi.stopped), tone: logi.stopped > 0 ? 'bad' : undefined },
    ],
    alerts: blockedRows.slice(0, 3).map((r) => `${r.buildingType} ${r.bottleneck ? `: ${r.bottleneck}` : ''}`),
    action: blockedRows[0] ? { kind: 'open-inspector', id: blockedRows[0].id } : null,
    noData: prod.rows.length === 0 && logi.stopped === 0,
  };

  // --- Labor (getEmployment) ---
  const emp = source.getEmployment();
  const fillPct = emp.totalJobs > 0 ? Math.round((emp.employed / emp.totalJobs) * 100) : 0;
  const unstaffed = state.buildings.find((b) => b.workersRequired > 0 && b.workersAssigned === 0);
  // POP-04: urban wage/unemployment-band rows — pure projections of
  // source.getDerived() (composer rule: never fabricate a value). Guarded with
  // optional chaining so empty cities (no buildings, population 0) compose
  // without throwing (Pitfall 5), and the wageBand total function still yields
  // below/at/above vs IMPERIAL_WAGE_REFERENCE.
  const wageBand = derived.wageBand;
  const unemploymentBand = derived.unemploymentBand;
  const labor: AdvisorPanel = {
    id: 'labor',
    title: 'Labor',
    rows: [
      { label: 'Employed', value: n(emp.employed) },
      { label: 'Unemployed', value: n(emp.unemployed) },
      { label: 'Total Jobs', value: n(emp.totalJobs) },
      { label: 'Fill', value: dnr(fillPct / 100), tone: fillPct >= 100 ? 'ok' : fillPct < 50 ? 'bad' : undefined },
      ...(wageBand
        ? [{
            label: 'Wage vs Imperial',
            value: `${wageBand.band} (${Math.round(wageBand.relative * 100)}%)`,
            tone: wageBand.band === 'below' ? 'bad' : 'ok',
          }]
        : []),
      ...(unemploymentBand ? [{ label: 'Unemployment Band', value: unemploymentBand.label }] : []),
    ],
    action: unstaffed ? { kind: 'locate', id: unstaffed.id } : null,
  };

  // --- Trade / Commerce (getTradeAdvisor + getTradeRoutes) ---
  const tradeView = source.getTradeAdvisor();
  const totals = tradeView.totals;
  const trade: AdvisorPanel = {
    id: 'trade',
    title: 'Trade',
    rows: [
      { label: 'Export Proceeds', value: n(totals.exportProceeds) },
      { label: 'Import Spend', value: n(totals.importSpend) },
      { label: 'Active Routes', value: n(totals.activeRoutes), tone: totals.activeRoutes > 0 ? 'ok' : 'muted' },
      { label: 'Cities', value: n(tradeView.cities.length) },
    ],
    alerts: tradeView.cities.filter((c) => c.opened).map((c) => `${c.name}: ${Object.keys(c.orders).length} orders`),
    action: null,
    noData: tradeView.cities.length === 0 && totals.activeRoutes === 0,
  };

  // --- Housing (state.buildings houses + food overlays + water overlay) ---
  const houses = state.buildings.filter((b) => b.house);
  const occupancyCapacity = houses.reduce((s, b) => s + (b.house?.populationCapacity ?? 0), 0);
  const waterOverlay = source.getWaterOverlay?.();
  // WR-03: count tiles with any well/fountain coverage (a real, physical
  // metric). NEVER the raw sum across every returned grid — that double-counts
  // tiles across sources+coverage+classes and drags in the negative water-source
  // desirability, producing a fabricated number with no meaning.
  const waters = (() => {
    const o = waterOverlay ?? {};
    const well = o.wellCoverage;
    const fount = o.fountainCoverage;
    if (!Array.isArray(well) || !Array.isArray(fount)) return 0;
    let covered = 0;
    const h = Math.min(well.length, fount.length);
    for (let y = 0; y < h; y++) {
      const wRow = well[y];
      const fRow = fount[y];
      if (!Array.isArray(wRow) || !Array.isArray(fRow)) continue;
      const wlen = Math.min(wRow.length, fRow.length);
      for (let x = 0; x < wlen; x++) {
        if (wRow[x] > 0 || fRow[x] > 0) covered++;
      }
    }
    return covered;
  })();
  const housing: AdvisorPanel = {
    id: 'housing',
    title: 'Housing',
    rows: [
      { label: 'Houses', value: n(houses.length) },
      { label: 'Population', value: n(derived.population) },
      { label: 'Capacity', value: n(occupancyCapacity) },
      { label: 'Water Coverage %', value: dnr(derived.water.totalTiles > 0 ? derived.water.coveredTiles / derived.water.totalTiles : 0) },
      { label: 'Water Grid Cells', value: n(waters) },
    ],
    alerts: houses.filter((b) => b.house && b.house.foodCooldown <= 0).length > 0 ? ['Some houses are out of food'] : [],
    action: houses[0] ? { kind: 'open-inspector', id: houses[0].id } : null,
    noData: houses.length === 0,
  };

  // --- Ratings (derived + decomposition) ---
  const ratingData = baseData('ratings');
  const topFactor = (rating: 'culture' | 'prosperity' | 'stability' | 'favor'): string | null => {
    const factors = derived.decomposition[rating];
    if (!factors) return null;
    const best = Object.entries(factors).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    return best ? `${best[0]} ${best[1] >= 0 ? '+' : '−'}${n(Math.abs(best[1]))}` : null;
  };
  const ratings: AdvisorPanel = {
    id: 'ratings',
    title: 'Ratings',
    rows: [
      { label: 'Culture', value: n(derived.culture) },
      { label: 'Prosperity', value: n(derived.prosperity) },
      { label: 'Stability', value: n(derived.stability) },
      { label: 'Favor', value: n(derived.favor) },
      ...[
        ['Culture', topFactor('culture')],
        ['Prosperity', topFactor('prosperity')],
        ['Stability', topFactor('stability')],
        ['Favor', topFactor('favor')],
      ]
        .filter((e): e is [string, string] => e[1] !== null)
        .map(([label, value]) => ({ label: `${label} Top Factor`, value })),
    ],
    alerts: ratingData.constructionSpend ? [`Construction spent: ${n(ratingData.constructionSpend)} denarii`] : [],
    action: { kind: 'open-codex', entryId: 'objectives' },
  };

  // --- Religion (godWorship + festival) ---
  const worship = derived.godWorship;
  const festival = source.getFestival();
  const templeId = firstBuildingOf(state, ['temple', 'grand_temple']);
  const religion: AdvisorPanel = {
    id: 'religion',
    title: 'Religion',
    rows: [
      ...Object.entries(worship).map(([god, v]) => ({ label: god, value: dnr(v) })),
      { label: 'Festival Prep', value: festival.prepTier ?? '—' },
      { label: 'Festival Boost', value: festival.boostTier ?? '—' },
      { label: 'Boost Remaining', value: n(festival.boostRemaining) },
    ],
    action: templeId ? { kind: 'locate', id: templeId } : null,
    noData: Object.keys(worship).length === 0,
  };

  // --- Safety & Risks (derived + civilization overlay) ---
  const civ = source.getCivilizationOverlay();
  const countCells = (grid: number[][], pred: (v: number) => boolean): number =>
    grid.reduce((s, row) => s + row.reduce((a, v) => a + (pred(v) ? 1 : 0), 0), 0);
  const inDanger = countCells(civ.danger, (v) => v > 0);
  const burning = countCells(civ.fire, (v) => v >= 0.9);
  const safetyRisks: AdvisorPanel = {
    id: 'safety-risks',
    title: 'Safety & Risks',
    rows: [
      { label: 'Fire Risk', value: dnr(derived.fireRisk), tone: derived.fireRisk > 0.5 ? 'bad' : undefined },
      { label: 'Collapse Risk', value: dnr(derived.collapseRisk), tone: derived.collapseRisk > 0.5 ? 'bad' : undefined },
      { label: 'Crime', value: dnr(derived.crime), tone: derived.crime > 0.5 ? 'bad' : undefined },
      { label: 'Tiles in Danger', value: n(inDanger), tone: inDanger > 0 ? 'bad' : 'ok' },
      { label: 'Burning', value: n(burning), tone: burning > 0 ? 'bad' : 'ok' },
    ],
    action: { kind: 'open-overlay', overlay: 'risks' },
    noData: derived.fireRisk === 0 && derived.collapseRisk === 0 && derived.crime === 0 && inDanger === 0,
  };

  // --- Governance (getGovernance) ---
  const gov = source.getGovernance();
  const govId = firstBuildingOf(state, [...gov.placed]);
  const governance: AdvisorPanel = {
    id: 'governance',
    title: 'Governance',
    rows: [
      { label: 'Unlocked', value: gov.unlocked.join(', ') || 'none' },
      { label: 'Placed', value: gov.placed.join(', ') || 'none' },
      { label: 'Salary Level', value: n(gov.governor.salaryLevel) },
      { label: 'Donations This Year', value: n(gov.governor.donationsThisYear) },
    ],
    action: govId ? { kind: 'locate', id: govId } : null,
    noData: gov.placed.length === 0 && gov.unlocked.length === 0,
  };

  // --- Diplomacy / Requests (getRequests + getEvents) ---
  const req = source.getRequests();
  const events = source.getEvents();
  const diplomacy: AdvisorPanel = {
    id: 'diplomacy',
    title: 'Diplomacy',
    rows: [
      { label: 'Active Requests', value: n(req.active.length), tone: req.active.length > 0 ? 'bad' : 'ok' },
      { label: 'Requests Reward', value: n(req.history.filter((h) => h.outcome === 'reward').length) },
      { label: 'Requests Penalty', value: n(req.history.filter((h) => h.outcome === 'penalty').length) },
      { label: 'Event Log', value: n(events.length) },
    ],
    alerts: req.active.map((a) => `${a.title}: ${a.monthsLeft} months left`),
    action: null,
    noData: req.active.length === 0 && req.history.length === 0 && events.length === 0,
  };

  // --- Objectives / Missions (getMission + progress + campaign) ---
  const mission = source.getMission();
  const missionProg = source.getMissionProgress();
  const campaign = source.getCampaignProgress();
  const objectives: AdvisorPanel = {
    id: 'objectives',
    title: 'Objectives',
    rows: [
      { label: 'Mission', value: mission?.id ?? 'none' },
      { label: 'Progress', value: missionProg ? dnr(missionProg.progress) : '—' },
      { label: 'Sustained', value: missionProg ? `${missionProg.sustained}/${missionProg.sustainChecks}` : '—' },
      { label: 'Next Unlocked', value: campaign.nextUnlocked ?? '—' },
    ],
    action: mission ? { kind: 'open-codex', entryId: 'missions' } : null,
    noData: !mission,
  };

  // --- Demography (derived.population + house census) ---
  const populationData = baseData('population');
  const demography: AdvisorPanel = {
    id: 'demography',
    title: 'Demography',
    rows: [
      { label: 'Population', value: n(populationData.population ?? derived.population) },
      { label: 'Houses', value: n(houses.length) },
      { label: 'Total Capacity', value: n(occupancyCapacity) },
    ],
    action: houses[0] ? { kind: 'open-inspector', id: houses[0].id } : null,
    noData: derived.population === 0 && houses.length === 0,
  };

  const byId: Record<string, AdvisorPanel> = {
    ratings,
    finance,
    food,
    'production-logistics': productionLogistics,
    labor,
    trade,
    housing,
    demography,
    'safety-risks': safetyRisks,
    religion,
    governance,
    diplomacy,
    objectives,
  };
  return ADVISOR_TAB_ORDER.map((id) => byId[id]);
}
