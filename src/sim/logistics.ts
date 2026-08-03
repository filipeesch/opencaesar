/**
 * Logistics — warehouses, markets & distribution (Phases 7 & 8; tasks 5.4, 5.5,
 * 3.4, 3.5, 3.6).
 *
 * - Warehouses store one load per slot with per-commodity orders
 *   (accept/refuse/request/maintain/empty/reserve).
 * - A single Commercial Center may be designated; a second designation falls
 *   back with a warning, and a full center is reported.
 * - Markets track inventory with a reservation pool so a load in transit is not
 *   double-picked, and distribute by priority (essential food first).
 * Self-contained, additive.
 */
export type WarehouseReorder = 'accept' | 'refuse' | 'request' | 'maintain' | 'empty' | 'reserve';

export interface WarehousePolicy {
  perCommodity: Partial<Record<string, WarehouseReorder>>;
  slotCapacity: number;
}

export function defaultWarehousePolicy(slotCapacity = 16): WarehousePolicy {
  return { perCommodity: {}, slotCapacity };
}

/** Whether a warehouse with `policy` may hold one more slot of `commodity`. */
export function warehouseAccepts(policy: WarehousePolicy, commodity: string, usedSlots: number): boolean {
  if (usedSlots >= policy.slotCapacity) return false;
  const cmd = policy.perCommodity[commodity] ?? 'accept';
  return cmd !== 'refuse' && cmd !== 'empty';
}

/** Commercial Center handles: exactly one may be designated. */
export class CommercialCenter {
  private designation: string | null = null;
  private warning: string | null = null;

  designate(id: string): { ok: boolean; warning?: string; fallback?: boolean } {
    if (this.designation !== null && this.designation !== id) {
      this.warning = `Commercial Center already designated (${this.designation}). Fallback: ${id}.`;
      return { ok: true, fallback: true, warning: this.warning };
    }
    this.designation = id;
    this.warning = null;
    return { ok: true };
  }

  isDesignated(id: string): boolean {
    return this.designation === id;
  }

  allowedToExport(): string | null {
    return this.designation;
  }
}

/** A load in transit is reserved so it cannot be double-picked. */
export class ReservationPool {
  readonly taxable = new Map<string, number>(); // commodity -> reserved loads
  private reservations = new Map<string, number>();

  reserve(commodity: string, amount = 1): boolean {
    const have = this.available(commodity);
    if (have < 1) return false;
    this.reservations.set(commodity, (this.reservations.get(commodity) ?? 0) + amount);
    return true;
  }

  available(commodity: string): number {
    const total = this.taxable.get(commodity) ?? 0;
    const reserved = this.reservations.get(commodity) ?? 0;
    return Math.max(0, total - reserved);
  }

  release(commodity: string, amount = 1): void {
    const cur = this.reservations.get(commodity) ?? 0;
    this.reservations.set(commodity, Math.max(0, cur - amount));
  }

  reserved(commodity: string): number {
    return this.reservations.get(commodity) ?? 0;
  }
}

/**
 * Distribution priority (task 3.5): pick which commodity a market buyer should
 * fetch next — essential food first, then the evolution-blocking good, else
 * the most depleted stock.
 */
export function nextPickPriority(
  foods: string[],
  evolutionBlocking: string | null,
  current: Record<string, number>,
): string | null {
  for (const f of foods) {
    if ((current[f] ?? 0) <= 0) return f;
  }
  if (evolutionBlocking && (current[evolutionBlocking] ?? 0) <= 0) return evolutionBlocking;
  return null;
}

/** Per-market configuration (task 3.6). */
export interface MarketConfig {
  productRules: Partial<Record<string, 'accept' | 'refuse'>>;
  targetStock: number;
  buyerRadius: number;
  /** Block wine for plebeian households. */
  blockWineForPlebeians: boolean;
  preferredSupplier: string | null;
}

export function defaultMarketConfig(): MarketConfig {
  return { productRules: {}, targetStock: 20, buyerRadius: 2, blockWineForPlebeians: true, preferredSupplier: null };
}

/** Whether a market accepts a product for a given resident class. */
export function marketAccepts(cfg: MarketConfig, product: string, residentClass: string): boolean {
  if (cfg.productRules[product] === 'refuse') return false;
  if (cfg.blockWineForPlebeians && product === 'wine' && residentClass === 'plebeian') return false;
  return true;
}

/** Market buyer model (task 3.4): wander to the nearest supplier within range. */
export interface MarketSupplier {
  id: string;
  x: number;
  y: number;
  hasProduct: (product: string) => boolean;
}

export function findSupplier(suppliers: MarketSupplier[], marketX: number, marketY: number, product: string, radius: number): MarketSupplier | null {
  let best: MarketSupplier | null = null;
  let bestDist = Infinity;
  for (const s of suppliers) {
    if (!s.hasProduct(product)) continue;
    const d = Math.abs(s.x - marketX) + Math.abs(s.y - marketY);
    if (d <= radius && d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

/** Production/logistics advisor data (task 5.6). */
export interface LogisticsAdvisorView {
  stock: Record<string, number>;
  production: Record<string, number>;
  consumption: Record<string, number>;
  inTransit: number;
  bottlenecks: number;
  stopped: number;
}

export function logisticsAdvisor(
  stock: Record<string, number>,
  production: Record<string, number>,
  consumption: Record<string, number>,
  portsActive: number,
  totalPorters: number,
  bottlenecks: number,
  stopped: number,
): LogisticsAdvisorView {
  return { stock, production, consumption, inTransit: totalPorters - portsActive, bottlenecks, stopped };
}
