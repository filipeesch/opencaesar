/**
 * Phase 7, WARE-01 (decision 1): per-commodity warehouse order matrix.
 *
 * The six §17.3 order modes (accept/refuse/request/maintain/empty/reserve) are
 * asserted against warehouseAccepts at used-slot boundaries, plus the default
 * absent-order behaviour, per-commodity independence, and slot-gating. Written
 * as an executable trap for the modes that were previously untested
 * (maintain/reserve) and for the default-to-accept contract.
 */
import { describe, it, expect } from 'vitest';
import {
  defaultWarehousePolicy, warehouseAccepts,
  warehouseOrder, warehouseReserves, warehouseNeedsStock, warehousePriority,
} from '../../src/sim/logistics';
import type { WarehouseReorder } from '../../src/sim/logistics';

describe('per-mode order matrix (WARE-01 §17.3)', () => {
  it('the default absent order acts as accept', () => {
    const policy = defaultWarehousePolicy(16);
    expect(policy.perCommodity).toEqual({});
    expect(policy.slotCapacity).toBe(16);
    expect(warehouseAccepts(policy, 'pottery', 0)).toBe(true);
  });

  it('each of the six modes maps to its documented acceptance at usedSlots 0', () => {
    const cases: Array<{ mode: WarehouseReorder; expected: boolean }> = [
      { mode: 'accept', expected: true },
      { mode: 'refuse', expected: false },
      { mode: 'request', expected: true },
      { mode: 'maintain', expected: true },
      { mode: 'empty', expected: false },
      { mode: 'reserve', expected: true },
    ];
    for (const c of cases) {
      const policy = defaultWarehousePolicy(16);
      policy.perCommodity.pottery = c.mode;
      expect(warehouseAccepts(policy, 'pottery', 0), `mode ${c.mode} at usedSlots 0`).toBe(c.expected);
    }
  });

  it('every non-refusing mode still fails strictly at the slot cap (15 accepts, 16 refuses)', () => {
    const modes: WarehouseReorder[] = ['accept', 'request', 'maintain', 'reserve'];
    for (const mode of modes) {
      const policy = defaultWarehousePolicy(16);
      policy.perCommodity.pottery = mode;
      expect(warehouseAccepts(policy, 'pottery', 15), `mode ${mode} at usedSlots 15`).toBe(true);
      expect(warehouseAccepts(policy, 'pottery', 16), `mode ${mode} at usedSlots 16`).toBe(false);
    }
  });

  it('refuse and empty fail even with 0 used slots', () => {
    const policy = defaultWarehousePolicy(16);
    policy.perCommodity.pottery = 'refuse';
    expect(warehouseAccepts(policy, 'pottery', 0)).toBe(false);
    policy.perCommodity.pottery = 'empty';
    expect(warehouseAccepts(policy, 'pottery', 0)).toBe(false);
  });

  it('per-commodity orders are independent', () => {
    const policy = defaultWarehousePolicy(16);
    policy.perCommodity.clay = 'refuse';
    expect(warehouseAccepts(policy, 'clay', 0)).toBe(false);
    expect(warehouseAccepts(policy, 'pottery', 0)).toBe(true);
  });
});

describe('order semantics: request/maintain/reserve (WARE-01 §17.3)', () => {
  it('warehouseOrder returns accept for the default and the configured mode otherwise', () => {
    const policy = defaultWarehousePolicy(16);
    expect(warehouseOrder(policy, 'pottery')).toBe('accept');
    policy.perCommodity.pottery = 'maintain';
    expect(warehouseOrder(policy, 'pottery')).toBe('maintain');
    policy.perCommodity.pottery = 'reserve';
    expect(warehouseOrder(policy, 'pottery')).toBe('reserve');
  });

  it('warehouseReserves is true only for reserve', () => {
    const modes: WarehouseReorder[] = ['accept', 'refuse', 'request', 'maintain', 'empty', 'reserve'];
    for (const mode of modes) {
      const policy = defaultWarehousePolicy(16);
      policy.perCommodity.pottery = mode;
      expect(warehouseReserves(policy, 'pottery'), `mode ${mode}`).toBe(mode === 'reserve');
    }
  });

  it('warehouseNeedsStock is true for request and maintain-below-target only', () => {
    const policy = defaultWarehousePolicy(16);
    policy.maintainTargets = { pottery: 8 };

    policy.perCommodity.pottery = 'request';
    expect(warehouseNeedsStock(policy, 'pottery', 0)).toBe(true);
    expect(warehouseNeedsStock(policy, 'pottery', 100)).toBe(true);

    policy.perCommodity.pottery = 'maintain';
    expect(warehouseNeedsStock(policy, 'pottery', 7)).toBe(true);
    expect(warehouseNeedsStock(policy, 'pottery', 8)).toBe(false);
    expect(warehouseNeedsStock(policy, 'pottery', 12)).toBe(false);

    policy.perCommodity.pottery = 'accept';
    expect(warehouseNeedsStock(policy, 'pottery', 0)).toBe(false);
    policy.perCommodity.pottery = 'empty';
    expect(warehouseNeedsStock(policy, 'pottery', 0)).toBe(false);
    policy.perCommodity.pottery = 'reserve';
    expect(warehouseNeedsStock(policy, 'pottery', 0)).toBe(false);
  });

  it('warehousePriority is 1 exactly when warehouseNeedsStock is true, else 0', () => {
    const policy = defaultWarehousePolicy(16);
    policy.maintainTargets = { pottery: 8 };
    policy.perCommodity.pottery = 'maintain';
    expect(warehousePriority(policy, 'pottery', 7)).toBe(1);
    expect(warehousePriority(policy, 'pottery', 8)).toBe(0);
    policy.perCommodity.pottery = 'request';
    expect(warehousePriority(policy, 'pottery', 99)).toBe(1);
    policy.perCommodity.pottery = 'accept';
    expect(warehousePriority(policy, 'pottery', 0)).toBe(0);
  });

  it('a maintain-below-target warehouse is a priority destination while a full one is not', () => {
    const thirsty = defaultWarehousePolicy(16);
    thirsty.maintainTargets = { pottery: 8 };
    thirsty.perCommodity.pottery = 'maintain';
    expect(warehousePriority(thirsty, 'pottery', 3)).toBeGreaterThan(0);

    const full = defaultWarehousePolicy(16);
    full.maintainTargets = { pottery: 8 };
    full.perCommodity.pottery = 'maintain';
    expect(warehousePriority(full, 'pottery', 8)).toBe(0);
    // at the slot capacity (16 used slots) it still rejects new loads
    expect(warehouseAccepts(full, 'pottery', 16)).toBe(false);
  });
});
