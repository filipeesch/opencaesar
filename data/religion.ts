/**
 * Religion tuning data (Phase 13 — task 9.4 religion).
 *
 * Worship is derived from per-god walker coverage: a house visited by a
 * temple walker of god G gains fresh godAccess[G]; worshipOf(G) is the share
 * of houses with fresh access, scaled by the coverage factor of the serving
 * temple type (grand temples count double). Festivals add a temporary boost
 * on top. All values deterministic — no randomness, no clocks.
 */

/** Coverage factor applied to a god's served-house share for ordinary temples. */
export const TEMPLE_COVERAGE_FACTOR = 1;

/** Coverage factor for grand temples: served houses count twice toward worship. */
export const GRAND_TEMPLE_COVERAGE_FACTOR = 2;

/** Ticks a festival's worship/favor boost stays active after it completes. */
export const FESTIVAL_BOOST_WINDOW_TICKS = 480;

/** Month cadence in ticks (matches the event engine's `tickCount % 40` hook). */
export const MONTH_TICKS = 40;
