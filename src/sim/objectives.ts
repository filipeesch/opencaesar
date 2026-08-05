/**
 * Objectives & Win Conditions (Phase 15 — task 10.4 / RATE-02).
 *
 * A win objective is met when every target metric stays at or above its
 * threshold for a required consecutive-check period. A tracker records the
 * sustained period and reports progress. Targets may include population, the
 * four ratings, favor, treasury, and annual exports — each `undefined` means
 * that metric is not required. Sustain checks are counted on the month
 * cadence by the caller (`tickCount % 40 === 0`), so `sustainChecks` is
 * expressed in months (default 3). `sustained` is the tracker's only mutable
 * member, so `progress()` and the last result are pure projections.
 */
export interface ObjectiveTarget {
  population?: number;
  culture?: number;
  prosperity?: number;
  stability?: number;
  favor?: number;
  treasury?: number;
  annualExports?: number;
  /** How many consecutive monthly checks the targets must be sustained
   *  (months; defaults to 3). */
  sustainChecks?: number;
}

export interface MetricSnapshot {
  population: number;
  culture: number;
  prosperity: number;
  stability: number;
  treasury?: number;
  favor?: number;
  annualExports?: number;
}

export class ObjectiveTracker {
  private sustained = 0;
  /** Normalized sustain period in monthly checks (default 3 per the spec). */
  readonly sustainChecks: number;
  private last: { won: boolean; sustained: number };

  constructor(readonly target: ObjectiveTarget) {
    this.sustainChecks = target.sustainChecks ?? 3;
    this.last = { won: false, sustained: 0 };
  }

  /** Feed one periodic check; returns true when the objective is won. */
  update(s: MetricSnapshot): { won: boolean; sustained: number } {
    const t = this.target;
    const ok =
      (t.population === undefined || s.population >= t.population) &&
      (t.culture === undefined || s.culture >= t.culture) &&
      (t.prosperity === undefined || s.prosperity >= t.prosperity) &&
      (t.stability === undefined || s.stability >= t.stability) &&
      (t.favor === undefined || (s.favor !== undefined && s.favor >= t.favor)) &&
      (t.treasury === undefined || (s.treasury !== undefined && s.treasury >= t.treasury)) &&
      (t.annualExports === undefined || (s.annualExports !== undefined && s.annualExports >= t.annualExports));
    if (ok) this.sustained += 1;
    else this.sustained = 0;
    this.last = { won: this.sustained >= this.sustainChecks, sustained: this.sustained };
    return this.last;
  }

  /** Latest update result as a pure read — calling this never advances the
   *  counter (the runner reads it between month boundaries). */
  lastResult(): { won: boolean; sustained: number } {
    return { won: this.last.won, sustained: this.last.sustained };
  }

  progress(): number {
    return Math.min(1, this.sustained / this.sustainChecks);
  }
}
