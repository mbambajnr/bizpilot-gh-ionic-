import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessLocation, BusinessState, Product, StockMovement } from '../data/seedBusiness';
import { forecastDemand, LEAD_TIME_DAYS, TARGET_COVER_DAYS } from './demandForecast';

const NOW = Date.parse('2026-07-25T12:00:00.000Z');
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

let counter = 0;
function loc(id: string, name: string): BusinessLocation {
  return { ...seedState.locations[0], id, name, type: 'store', isDefault: false, isActive: true };
}
function product(id: string, name: string, reorderLevel: number): Product {
  return { ...seedState.products[0], id, inventoryId: id.toUpperCase(), name, unit: 'pcs', reorderLevel, categoryId: undefined };
}
function move(productId: string, locationId: string, type: StockMovement['type'], quantityDelta: number, createdAt: string): StockMovement {
  counter += 1;
  return { id: `m-${counter}`, movementNumber: `MOV-${counter}`, productId, locationId, type, quantityDelta, quantityAfter: 0, createdAt, note: '' };
}

/** Opening stock (dated outside the velocity window) plus an optional recent sale outflow. */
function stocked(productId: string, locationId: string, opening: number, soldRecently = 0): StockMovement[] {
  const moves = [move(productId, locationId, 'opening', opening, daysAgo(60))];
  if (soldRecently > 0) moves.push(move(productId, locationId, 'sale', -soldRecently, daysAgo(5)));
  return moves;
}

function stateWith(locations: BusinessLocation[], products: Product[], movements: StockMovement[]): BusinessState {
  return { ...seedState, locations, products, stockMovements: movements, sales: [] };
}

describe('demand forecast', () => {
  const products = [
    product('pa', 'Fast Mover', 3),
    product('pb', 'Runs Out Soon', 2),
    product('pc', 'Below Reorder', 10),
    product('pd', 'Well Stocked', 3),
    product('pe', 'Out of Stock', 5),
  ];
  const movements = [
    ...stocked('pa', 'loc1', 40, 30), // qty 10, ~1/day -> 10 days cover -> watch (still above reorder 3)
    ...stocked('pb', 'loc1', 35, 30), // qty 5, ~1/day -> 5 days cover -> reorder_now by projection
    ...stocked('pc', 'loc1', 8, 0), // qty 8, no velocity, below reorder 10 -> reorder_now
    ...stocked('pd', 'loc1', 100, 3), // qty 97, 0.1/day -> ~970 days -> healthy (excluded)
    ...stocked('pe', 'loc1', 30, 30), // qty 0 -> stockout
  ];
  const state = stateWith([loc('loc1', 'Main Store')], products, movements);

  it('includes every at-risk line and excludes the comfortably-stocked one', () => {
    const ids = forecastDemand(state, NOW).map((entry) => entry.productId);
    expect(ids.sort()).toEqual(['pa', 'pb', 'pc', 'pe']);
    expect(ids).not.toContain('pd');
  });

  it('flags a fast mover as watch before it crosses the reorder level', () => {
    const pa = forecastDemand(state, NOW).find((entry) => entry.productId === 'pa')!;
    expect(pa.quantityOnHand).toBe(10);
    expect(pa.quantityOnHand).toBeGreaterThan(pa.reorderLevel); // not yet low by the static rule
    expect(pa.riskBand).toBe('watch');
    expect(pa.projectedStockoutInDays).toBe(10);
  });

  it('escalates to reorder_now when projected stockout is inside the lead time', () => {
    const pb = forecastDemand(state, NOW).find((entry) => entry.productId === 'pb')!;
    expect(pb.projectedStockoutInDays).toBe(5);
    expect(pb.projectedStockoutInDays).toBeLessThanOrEqual(LEAD_TIME_DAYS);
    expect(pb.riskBand).toBe('reorder_now');
    expect(pb.suggestedReorderQty).toBe(Math.ceil(1 * (LEAD_TIME_DAYS + TARGET_COVER_DAYS)) - 5); // 37 - 5 = 32
  });

  it('treats a below-reorder line with no sales as reorder_now with a static fallback quantity', () => {
    const pc = forecastDemand(state, NOW).find((entry) => entry.productId === 'pc')!;
    expect(pc.riskBand).toBe('reorder_now');
    expect(pc.projectedStockoutInDays).toBeNull();
    expect(pc.suggestedReorderQty).toBe(Math.max(10 * 2 - 8, 1)); // 12
    expect(pc.signals.join(' ')).toContain('No recent sales');
  });

  it('marks a depleted fast mover as stockout and sizes the reorder to the coverage horizon', () => {
    const pe = forecastDemand(state, NOW).find((entry) => entry.productId === 'pe')!;
    expect(pe.riskBand).toBe('stockout');
    expect(pe.quantityOnHand).toBe(0);
    expect(pe.suggestedReorderQty).toBe(Math.ceil(1 * (LEAD_TIME_DAYS + TARGET_COVER_DAYS))); // 37
  });

  it('orders the queue by severity, stockout first', () => {
    const bands = forecastDemand(state, NOW).map((entry) => entry.riskBand);
    expect(bands[0]).toBe('stockout');
    expect(bands[bands.length - 1]).toBe('watch');
  });

  it('scopes the forecast to a single location when asked', () => {
    const twoLoc = stateWith(
      [loc('loc1', 'Main Store'), loc('loc2', 'Branch')],
      [product('pa', 'Fast Mover', 3)],
      [...stocked('pa', 'loc1', 35, 30), ...stocked('pa', 'loc2', 35, 30)],
    );
    const scoped = forecastDemand(twoLoc, NOW, 'loc1');
    expect(scoped).toHaveLength(1);
    expect(scoped[0].locationId).toBe('loc1');
  });
});
