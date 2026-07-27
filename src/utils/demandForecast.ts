import type { BusinessState, Product } from '../data/seedBusiness';
import { selectActiveLocations, selectProductQuantityOnHand } from '../selectors/businessSelectors';

/**
 * Deterministic, explainable demand forecast for inventory replenishment.
 *
 * Capability #3 of BisaPilot's governed "propose -> approve" AI layer. Like the anomaly and collections
 * engines it is rule/statistics based, every entry carries plain-language `signals`, and it never mutates
 * state or raises a purchase order. It projects each product's stockout from its own recent sales velocity
 * so a buyer can act before stock crosses the static reorder level — the human still confirms the request.
 * Structured so a model behind the :8787 proxy can refine the velocity/qty later without changing the
 * contract or the UI.
 */

export type DemandRiskBand = 'healthy' | 'watch' | 'reorder_now' | 'stockout';

export type DemandForecast = {
  productId: string;
  productName: string;
  inventoryId: string;
  unit: string;
  locationId: string;
  locationLabel: string;
  quantityOnHand: number;
  reorderLevel: number;
  /** Average units sold per day over the trailing window. */
  dailyVelocity: number;
  unitsSoldInWindow: number;
  /** Whole days of stock left at the current velocity; null when there is no velocity to project from. */
  projectedStockoutInDays: number | null;
  /** Demand-driven quantity to bring stock back up to lead-time + coverage horizon. */
  suggestedReorderQty: number;
  riskBand: DemandRiskBand;
  signals: string[];
};

/** Trailing window used to measure sales velocity. */
export const VELOCITY_WINDOW_DAYS = 30;
/** Assumed replenishment lead time. Stock projected to run out inside this must be reordered now. */
export const LEAD_TIME_DAYS = 7;
/** Days of forward cover we aim to restore when suggesting a reorder quantity. */
export const TARGET_COVER_DAYS = 30;
const MS_PER_DAY = 86_400_000;

const BAND_RANK: Record<DemandRiskBand, number> = { stockout: 0, reorder_now: 1, watch: 2, healthy: 3 };

/** Units sold per (product, location) from stock 'sale' outflows inside the window. Key = `productId:locationId`. */
function unitsSoldByProductLocation(state: BusinessState, windowStart: number): Map<string, number> {
  const sold = new Map<string, number>();
  for (const movement of state.stockMovements) {
    if (movement.type !== 'sale' || !movement.locationId) continue;
    if (Date.parse(movement.createdAt) < windowStart) continue;
    const units = Math.max(0, -movement.quantityDelta); // sales reduce stock (negative delta)
    if (units <= 0) continue;
    const key = `${movement.productId}:${movement.locationId}`;
    sold.set(key, (sold.get(key) ?? 0) + units);
  }
  return sold;
}

function bandFor(quantityOnHand: number, reorderLevel: number, projectedStockoutInDays: number | null): DemandRiskBand {
  if (quantityOnHand <= 0) return 'stockout';
  if (projectedStockoutInDays != null && projectedStockoutInDays <= LEAD_TIME_DAYS) return 'reorder_now';
  if (quantityOnHand <= reorderLevel) return 'reorder_now';
  if (projectedStockoutInDays != null && projectedStockoutInDays <= TARGET_COVER_DAYS) return 'watch';
  return 'healthy';
}

/** Static fallback used when there is no velocity to forecast from — keeps parity with the legacy queue. */
function fallbackQty(reorderLevel: number, quantityOnHand: number): number {
  return Math.max(reorderLevel * 2 - quantityOnHand, 1);
}

/**
 * Forecast replenishment demand for every at-risk (product, location), most-urgent first.
 * `now` is epoch ms so callers stay pure/testable. Pass `locationId` to scope to one location.
 * Healthy, comfortably-stocked lines are omitted.
 */
export function forecastDemand(state: BusinessState, now: number, locationId?: string): DemandForecast[] {
  const windowStart = now - VELOCITY_WINDOW_DAYS * MS_PER_DAY;
  const sold = unitsSoldByProductLocation(state, windowStart);
  const locations = selectActiveLocations(state).filter((location) => !locationId || location.id === locationId);
  const productsById = new Map<string, Product>(state.products.map((product) => [product.id, product]));

  const forecasts: DemandForecast[] = [];
  for (const location of locations) {
    for (const product of productsById.values()) {
      const quantityOnHand = selectProductQuantityOnHand(state, product.id, location.id);
      const unitsSoldInWindow = sold.get(`${product.id}:${location.id}`) ?? 0;
      // Skip lines with no stock exposure and no sales history at this location — nothing to forecast.
      if (quantityOnHand <= 0 && unitsSoldInWindow <= 0) continue;

      const dailyVelocity = unitsSoldInWindow / VELOCITY_WINDOW_DAYS;
      const projectedStockoutInDays = dailyVelocity > 0 ? Math.floor(quantityOnHand / dailyVelocity) : null;
      const riskBand = bandFor(quantityOnHand, product.reorderLevel, projectedStockoutInDays);
      if (riskBand === 'healthy') continue;

      let suggestedReorderQty: number;
      if (dailyVelocity > 0) {
        const reorderUpTo = Math.ceil(dailyVelocity * (LEAD_TIME_DAYS + TARGET_COVER_DAYS));
        suggestedReorderQty = Math.max(0, reorderUpTo - quantityOnHand);
        if (suggestedReorderQty <= 0 && riskBand !== 'watch') suggestedReorderQty = fallbackQty(product.reorderLevel, quantityOnHand);
      } else {
        suggestedReorderQty = fallbackQty(product.reorderLevel, quantityOnHand);
      }

      const signals: string[] = [];
      if (unitsSoldInWindow > 0) {
        signals.push(`Selling ~${dailyVelocity.toFixed(dailyVelocity < 1 ? 2 : 1)} ${product.unit}/day (${unitsSoldInWindow} in ${VELOCITY_WINDOW_DAYS} days).`);
      } else {
        signals.push('No recent sales at this location — demand is flat.');
      }
      if (quantityOnHand <= 0) {
        signals.push(`Out of stock at ${location.name}.`);
      } else if (projectedStockoutInDays != null) {
        signals.push(`About ${projectedStockoutInDays} day${projectedStockoutInDays === 1 ? '' : 's'} of cover left${projectedStockoutInDays <= LEAD_TIME_DAYS ? ` — inside the ${LEAD_TIME_DAYS}-day lead time` : ''}.`);
      }
      if (quantityOnHand > 0 && quantityOnHand <= product.reorderLevel) {
        signals.push(`On hand (${quantityOnHand}) is at or below the reorder level of ${product.reorderLevel}.`);
      }

      forecasts.push({
        productId: product.id,
        productName: product.name,
        inventoryId: product.inventoryId,
        unit: product.unit,
        locationId: location.id,
        locationLabel: location.name,
        quantityOnHand,
        reorderLevel: product.reorderLevel,
        dailyVelocity,
        unitsSoldInWindow,
        projectedStockoutInDays,
        suggestedReorderQty,
        riskBand,
        signals,
      });
    }
  }

  return forecasts.sort((left, right) =>
    BAND_RANK[left.riskBand] - BAND_RANK[right.riskBand] ||
    (left.projectedStockoutInDays ?? Infinity) - (right.projectedStockoutInDays ?? Infinity) ||
    left.productName.localeCompare(right.productName),
  );
}
