/**
 * Top status bar (Phase 20 Wave 1).
 *
 * Pure builder: takes the live SimState + DerivedSnapshot and returns a
 * UiNode tree plus seam metadata for the unit tests. HUDScene mounts the
 * root, keeps the value nodes fresh every tick, and never re-renders the
 * tree (labels/date rule are static; only the values change).
 *
 * Date derivation locked from SimState.tick (SPEC §2):
 *   year  = floor(tick / 360)
 *   month = floor((tick % 360) / 40) + 1   (9 months/yr; month cadence tick%40)
 */
import type { SimState } from '../../sim/types';
import type { DerivedSnapshot } from '../../sim/runner';
import { el, type UiNode } from './dom';

export interface TopBarDom {
  root: UiNode; // [data-testid="topbar"]
  population: { value: number; seam: string };
  date: { year: number; month: number; seam: string };
  treasury: { value: number; seam: string };
  ratings: {
    prosperity: { seam: string };
    happiness: { seam: string };
    culture: { seam: string };
    stability: { seam: string };
    favor: { seam: string };
  };
  /** Live value nodes HUDScene refreshes each tick (stat-* legacy testids). */
  valueNodes: {
    population: UiNode; // [data-testid="stat-population"]
    treasury: UiNode; // [data-testid="stat-treasury"]
    date: UiNode; // [data-testid="stat-date"]
    prosperity: UiNode;
    happiness: UiNode;
    culture: UiNode;
    stability: UiNode;
    favor: UiNode;
  };
  labels(): Record<string, string>;
  seams(): Record<string, string>;
}

export function buildTopBarDom(state: SimState, derived: DerivedSnapshot): TopBarDom {
  const population = state.ratings.population;
  const treasury = state.treasury;
  const year = Math.floor(state.tick / 360);
  const month = Math.floor((state.tick % 360) / 40) + 1;

  const seams = () => ({
    population: 'getState().ratings.population',
    treasury: 'getState().treasury',
    date: 'getState().tick',
    prosperity: 'getState().ratings.prosperity',
    happiness: 'getState().ratings.happiness',
    culture: 'getDerived().culture',
    stability: 'getDerived().stability',
    favor: 'getDerived().favor',
  });

  const stat = (label: string, wrapperTestid: string, valueTestid: string, value: string, cls: string): { node: UiNode; value: UiNode } => {
    const valueEl = el('b', { className: 'topbar-value', testid: valueTestid, text: value });
    return {
      node: el('div', { className: cls, testid: wrapperTestid },
        el('span', { className: 'topbar-label uppercase', text: label }),
        valueEl),
      value: valueEl,
    };
  };

  // The valueNodes are the inner <b> elements (which carry the legacy stat-*
  // testids): HUDScene refreshes them per tick via textContent without ever
  // touching the wrapper, so the UPPERCASE label span survives.
  const pop = stat('POPULATION', 'topbar-population', 'stat-population', String(population), 'topbar-stat');
  const date = stat('DATE', 'topbar-date', 'stat-date', `YEAR ${year} · MONTH ${month}`, 'topbar-stat');
  const treas = stat('TREASURY', 'topbar-treasury', 'stat-treasury', String(Math.floor(state.treasury)), 'topbar-stat');
  const popNode = pop.node;
  const dateNode = date.node;
  const treasuryNode = treas.node;
  const prosperityNode = el('b', { className: 'topbar-value', testid: 'stat-prosperity', text: String(state.ratings.prosperity) });
  const happinessNode = el('b', { className: 'topbar-value', testid: 'stat-happiness', text: String(state.ratings.happiness) });
  const cultureNode = el('b', { className: 'topbar-value', testid: 'stat-culture', text: String(derived.culture) });
  const stabilityNode = el('b', { className: 'topbar-value', testid: 'stat-stability', text: String(derived.stability) });
  const favorNode = el('b', { className: 'topbar-value', testid: 'stat-favor', text: String(derived.favor) });

  const root = el('div', { className: 'hud-topbar', testid: 'topbar' },
    popNode,
    dateNode,
    treasuryNode,
    el('div', { className: 'topbar-ratings', testid: 'topbar-ratings' },
      el('span', { className: 'topbar-rating', testid: 'topbar-prosperity' }, el('span', { className: 'topbar-label uppercase', text: 'PROSPERITY' }), prosperityNode),
      el('span', { className: 'topbar-rating', testid: 'topbar-happiness' }, el('span', { className: 'topbar-label uppercase', text: 'HAPPINESS' }), happinessNode),
      el('span', { className: 'topbar-rating', testid: 'topbar-culture' }, el('span', { className: 'topbar-label uppercase', text: 'CULTURE' }), cultureNode),
      el('span', { className: 'topbar-rating', testid: 'topbar-stability' }, el('span', { className: 'topbar-label uppercase', text: 'STABILITY' }), stabilityNode),
      el('span', { className: 'topbar-rating', testid: 'topbar-favor' }, el('span', { className: 'topbar-label uppercase', text: 'FAVOR' }), favorNode),
    ),
  );

  return {
    root,
    population: { value: population, seam: seams().population },
    date: { year, month, seam: seams().date },
    treasury: { value: treasury, seam: seams().treasury },
    ratings: {
      prosperity: { seam: seams().prosperity },
      happiness: { seam: seams().happiness },
      culture: { seam: seams().culture },
      stability: { seam: seams().stability },
      favor: { seam: seams().favor },
    },
    valueNodes: {
      population: pop.value,
      treasury: treas.value,
      date: date.value,
      prosperity: prosperityNode,
      happiness: happinessNode,
      culture: cultureNode,
      stability: stabilityNode,
      favor: favorNode,
    },
    labels: () => ({ POPULATION: 'POPULATION', DATE: 'DATE', TREASURY: 'TREASURY' }),
    seams,
  };
}
