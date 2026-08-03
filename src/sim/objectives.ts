/**
 * Objectives & Win Conditions (Phase 15 — task 10.4 / RATE-02).
 *
 * A win objective is met when every target metric stays at or above its
 * threshold for a required consecutive-check period. A tracker records the
 * sustained period and reports progress.
 */
export interface ObjectiveTarget {
  population?: number;
  culture?: number;
  prosperity?: number;
  stability?: number;
  /** How many consecutive checks the targets must be sustained. */
  sustainChecks: number;
}

export interface MetricSnapshot {
  population: number;
  culture: number;
  prosperity: number;
  stability: number;
}

export class ObjectiveTracker {
  private sustained = 0;

  constructor(readonly target: ObjectiveTarget) {}

  /** Feed one periodic check; returns true when the objective is won. */
  update(s: MetricSnapshot): { won: boolean; sustained: number } {
    const ok =
      (this.target.population === undefined || s.population >= this.target.population) &&
      (this.target.culture === undefined || s.culture >= this.target.culture) &&
      (this.target.prosperity === undefined || s.prosperity >= this.target.prosperity) &&
      (this.target.stability === undefined || s.stability >= this.target.stability);
    if (ok) this.sustained += 1;
    else this.sustained = 0;
    return { won: this.sustained >= this.target.sustainChecks, sustained: this.sustained };
  }

  progress(): number {
    return Math.min(1, this.sustained / this.target.sustainChecks);
  }
}
