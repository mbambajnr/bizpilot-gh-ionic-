import {
  IonBadge,
  IonButton,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { cartOutline, refreshOutline, swapHorizontalOutline, trendingDownOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';

import { useBusiness } from '../context/BusinessContext';
import { loadMagentoReorder, type MagentoReorderItem, type MagentoReorderResult } from '../lib/magentoClient';
import { formatCurrency } from '../utils/format';

const PERIODS = [7, 30, 90];

/** A "move N units from {branch}" hint when another branch can cover the deficit. */
type TransferHint = { fromBranch: string; quantity: number };

function urgencyForCover(days: number, target: number): { label: string; color: string } {
  if (days <= 3) return { label: 'Critical', color: 'danger' };
  if (days <= 7) return { label: 'Urgent', color: 'danger' };
  if (days <= target) return { label: 'Low cover', color: 'warning' };
  return { label: 'Healthy', color: 'success' };
}

function urgencyLevel(days: number): 'Low' | 'Medium' | 'High' {
  if (days <= 7) return 'High';
  if (days <= 14) return 'Medium';
  return 'Low';
}

export default function ReorderPage() {
  const { state, currentUser, hasPermission, addRestockRequest, createStockTransfer } = useBusiness();
  const [present] = useIonToast();

  const [days, setDays] = useState(30);
  const [needsOnly, setNeedsOnly] = useState(true);
  const [feed, setFeed] = useState<MagentoReorderResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [transferred, setTransferred] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const canRequest = hasPermission('restockRequests.create');
  const canTransfer = hasPermission('transfers.create');

  const load = async (windowDays: number) => {
    setLoading(true);
    setMessage('');
    try {
      const { reorder } = await loadMagentoReorder(windowDays);
      setFeed(reorder);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load reorder intelligence.');
      setFeed(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Transfer opportunities: for a needy item, can another branch spare stock?
  const transferHints = useMemo(() => {
    const hints: Record<string, TransferHint> = {};
    if (!feed) return hints;
    const target = feed.target_cover_days;
    const bySku: Record<string, MagentoReorderItem[]> = {};
    for (const item of feed.items) {
      (bySku[item.sku] ||= []).push(item);
    }
    for (const item of feed.items) {
      if (!item.needs_reorder) continue;
      const deficit = item.suggested_reorder;
      let best: TransferHint | null = null;
      for (const sibling of bySku[item.sku]) {
        if (sibling.source_code === item.source_code) continue;
        // Units this branch can spare while keeping its own target coverage.
        const keep = Math.ceil(sibling.daily_velocity * target);
        const sparable = Math.floor(sibling.on_hand - keep);
        const move = Math.min(deficit, sparable);
        if (move > 0 && (!best || move > best.quantity)) {
          best = { fromBranch: sibling.branch_name, quantity: move };
        }
      }
      if (best) hints[`${item.sku}|${item.source_code}`] = best;
    }
    return hints;
  }, [feed]);

  const visibleItems = useMemo(() => {
    const items = feed?.items ?? [];
    return needsOnly ? items.filter((i) => i.needs_reorder) : items;
  }, [feed, needsOnly]);

  const currency = 'GHS';

  const findProductId = (item: MagentoReorderItem): string | null => {
    const bySku = state.products.find((p) => p.inventoryId === item.sku);
    if (bySku) return bySku.id;
    const byName = state.products.find((p) => p.name === item.name);
    return byName ? byName.id : null;
  };

  /**
   * BizPilot transfers are warehouse→store only, so a needy store is
   * replenished by pulling from a warehouse that supplies it. Resolve the
   * destination store (by branch name) and a warehouse on an active supply
   * route to it. Returns null when that route isn't set up.
   */
  const resolveReplenishment = (item: MagentoReorderItem) => {
    const store = state.locations.find(
      (l) => l.type === 'store' && l.isActive && l.name === item.branch_name
    );
    if (!store) return null;
    const route = (state.locationSupplyRoutes ?? []).find(
      (r) => r.isActive && r.toLocationId === store.id
    );
    if (!route) return null;
    const warehouse = state.locations.find(
      (l) => l.id === route.fromLocationId && l.type === 'warehouse'
    );
    const productId = findProductId(item);
    if (!warehouse || !productId) return null;
    return { warehouse, store, productId };
  };

  const doTransfer = async (item: MagentoReorderItem) => {
    const key = `${item.sku}|${item.source_code}`;
    const plan = resolveReplenishment(item);
    if (!plan || !currentUser) {
      present({ message: 'No warehouse supply route to this branch — set one up in Inventory.', duration: 2800, color: 'medium' });
      return;
    }
    setBusyKey(key);
    try {
      const result = await createStockTransfer({
        fromWarehouseId: plan.warehouse.id,
        toStoreId: plan.store.id,
        items: [{ productId: plan.productId, quantity: item.suggested_reorder }],
        initiatedBy: currentUser.userId,
        note: `Reorder feed: replenish ${item.branch_name} (${item.days_of_cover}d cover, ${item.units_sold} sold/${feed?.period_days}d).`,
      });
      present({
        message: result.ok
          ? `Transfer created: ${item.suggested_reorder} × ${item.name} → ${plan.store.name} from ${plan.warehouse.name}.`
          : result.message || 'Could not create the transfer.',
        duration: 3000,
        color: result.ok ? 'success' : 'danger',
      });
      if (result.ok) {
        setTransferred((prev) => ({ ...prev, [key]: true }));
      }
    } finally {
      setBusyKey(null);
    }
  };

  const requestRestock = (item: MagentoReorderItem) => {
    const productId = findProductId(item);
    if (!productId || !currentUser) {
      present({ message: 'No matching product in BizPilot inventory to raise a request against.', duration: 2500, color: 'medium' });
      return;
    }
    const result = addRestockRequest({
      productId,
      requestedByUserId: currentUser.userId,
      requestedByName: currentUser.name,
      requestedQuantity: item.suggested_reorder,
      urgency: urgencyLevel(item.days_of_cover),
      note: `Magento demand: ${item.units_sold} sold in ${feed?.period_days}d at ${item.branch_name}, ${item.days_of_cover}d cover.`,
    });
    present({
      message: result.ok
        ? `Restock request raised for ${item.suggested_reorder} × ${item.name} (${item.branch_name}).`
        : result.message || 'Could not raise the request.',
      duration: 2600,
      color: result.ok ? 'success' : 'danger',
    });
    if (result.ok) {
      setRequested((prev) => ({ ...prev, [`${item.sku}|${item.source_code}`]: true }));
    }
  };

  const flaggedCount = (feed?.items ?? []).filter((i) => i.needs_reorder).length;

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Reorder Suggestions</IonTitle>
          <IonButton slot="end" fill="clear" onClick={() => load(days)} aria-label="Refresh">
            <IonIcon slot="icon-only" icon={refreshOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell" data-testid="reorder-page" style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
          <p className="eyebrow" style={{ opacity: 0.6, letterSpacing: 1, fontSize: 12 }}>DEMAND-DRIVEN PROCUREMENT</p>
          <h1 style={{ margin: '4px 0 4px' }}>What to reorder</h1>
          <p style={{ opacity: 0.7, marginTop: 0 }}>
            Live sales velocity per branch from Magento — {flaggedCount} item{flaggedCount === 1 ? '' : 's'} below{' '}
            {feed?.target_cover_days ?? 21}-day cover.
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '12px 0' }}>
            <IonSegment
              value={String(days)}
              style={{ maxWidth: 280 }}
              onIonChange={(e) => setDays(Number(e.detail.value))}
            >
              {PERIODS.map((p) => (
                <IonSegmentButton key={p} value={String(p)}>
                  {p}d
                </IonSegmentButton>
              ))}
            </IonSegment>
            <IonChip
              outline={!needsOnly}
              color={needsOnly ? 'warning' : 'medium'}
              onClick={() => setNeedsOnly((v) => !v)}
            >
              <IonIcon icon={trendingDownOutline} />
              <span>{needsOnly ? 'Needs reorder only' : 'Show all selling items'}</span>
            </IonChip>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <IonSpinner />
            </div>
          ) : message ? (
            <div style={{ padding: 24, textAlign: 'center', opacity: 0.75 }}>{message}</div>
          ) : visibleItems.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', opacity: 0.7 }}>
              {needsOnly ? 'Nothing below target cover — stock levels are healthy. 🎉' : 'No sales in this window.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {visibleItems.map((item) => {
                const key = `${item.sku}|${item.source_code}`;
                const cover = urgencyForCover(item.days_of_cover, feed?.target_cover_days ?? 21);
                const transfer = transferHints[key];
                const productId = findProductId(item);
                const already = requested[key];
                const replenish = item.needs_reorder ? resolveReplenishment(item) : null;
                const didTransfer = transferred[key];
                return (
                  <div
                    key={key}
                    data-testid={`reorder-${item.sku}-${item.source_code}`}
                    style={{
                      border: '1px solid var(--ion-color-step-150, #e0e0e0)',
                      borderRadius: 14,
                      padding: 14,
                      display: 'grid',
                      gap: 10,
                      background: 'var(--ion-card-background, #fff)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: 13, opacity: 0.6 }}>
                          {item.sku} · {item.branch_name}
                        </div>
                      </div>
                      <IonBadge color={cover.color}>{cover.label}</IonBadge>
                    </div>

                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
                      <span title="Units sold in the window">
                        <strong>{item.units_sold}</strong> sold / {feed?.period_days}d
                      </span>
                      <span title="Average units per day">
                        <strong>{item.daily_velocity}</strong>/day
                      </span>
                      <span title="Days the current stock covers">
                        <strong>{item.days_of_cover}</strong>d cover
                      </span>
                      <span title="Current stock at this branch">
                        on hand <strong>{item.on_hand}</strong>
                      </span>
                      <span title="Revenue in the window">{formatCurrency(item.revenue, currency)}</span>
                    </div>

                    {transfer && (
                      <IonChip color="tertiary" outline style={{ alignSelf: 'flex-start' }}>
                        <IonIcon icon={swapHorizontalOutline} />
                        <span>
                          {transfer.fromBranch} has ~{transfer.quantity} sparable — rebalance option
                        </span>
                      </IonChip>
                    )}

                    {item.needs_reorder && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 600 }}>
                          Suggested reorder: {item.suggested_reorder} {item.suggested_reorder === 1 ? 'unit' : 'units'}
                        </div>
                        {canRequest && (
                          <IonButton
                            size="small"
                            fill={already ? 'outline' : 'solid'}
                            disabled={already || !productId}
                            data-testid={`request-${item.sku}-${item.source_code}`}
                            onClick={() => requestRestock(item)}
                          >
                            <IonIcon slot="start" icon={cartOutline} />
                            {already ? 'Requested' : productId ? 'Request restock' : 'No matching product'}
                          </IonButton>
                        )}
                        {canTransfer && replenish && (
                          <IonButton
                            size="small"
                            color="tertiary"
                            fill={didTransfer ? 'outline' : 'solid'}
                            disabled={didTransfer || busyKey === key}
                            data-testid={`transfer-${item.sku}-${item.source_code}`}
                            onClick={() => doTransfer(item)}
                          >
                            <IonIcon slot="start" icon={swapHorizontalOutline} />
                            {didTransfer ? 'Transfer created' : `Transfer from ${replenish.warehouse.name}`}
                          </IonButton>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
