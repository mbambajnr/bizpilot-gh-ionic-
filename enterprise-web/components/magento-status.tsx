'use client';

import { Activity, CircleCheck, CircleX, Clock3, Package, RefreshCw, Store, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { MagentoHealthResponse } from '@/lib/bizpilot-api';
import {
  loadMagentoActivity,
  loadMagentoCatalog,
  loadMagentoReorder,
  loadMagentoStock,
  type MagentoCatalog,
  type MagentoOrderActivity,
  type MagentoReorderResult,
  type MagentoStockSnapshot,
} from '../../src/lib/magentoClient';
import { formatCurrency, formatRelativeDate } from '../../src/utils/format';

type Status = 'loading' | 'connected' | 'unconfigured' | 'unavailable';

type MagentoFeed = {
  catalog: MagentoCatalog | null;
  stock: MagentoStockSnapshot | null;
  reorder: MagentoReorderResult | null;
  activity: MagentoOrderActivity | null;
  activityUnavailable: boolean;
  connectivityError: string;
};

const EMPTY_FEED: MagentoFeed = {
  catalog: null,
  stock: null,
  reorder: null,
  activity: null,
  activityUnavailable: false,
  connectivityError: '',
};

async function fetchMagentoStatus(): Promise<{ status: Status; storeCode: string }> {
  try {
    const response = await fetch('/api/bizpilot/magento/health', { cache: 'no-store' });
    const payload = (await response.json()) as MagentoHealthResponse;
    if (!response.ok || !payload.ok) throw new Error('Unavailable');
    return {
      status: payload.integration.configured ? 'connected' : 'unconfigured',
      storeCode: payload.integration.storeCode,
    };
  } catch {
    return { status: 'unavailable', storeCode: 'default' };
  }
}

async function fetchMagentoFeed(): Promise<MagentoFeed> {
  const [catalog, stock, reorder, activity] = await Promise.allSettled([
    loadMagentoCatalog(),
    loadMagentoStock(),
    loadMagentoReorder(30),
    loadMagentoActivity(6),
  ]);
  const primaryError =
    catalog.status === 'rejected'
      ? catalog.reason
      : stock.status === 'rejected'
        ? stock.reason
        : null;

  return {
    catalog: catalog.status === 'fulfilled' ? catalog.value.catalog : null,
    stock: stock.status === 'fulfilled' ? stock.value.stock : null,
    reorder: reorder.status === 'fulfilled' ? reorder.value.reorder : null,
    activity: activity.status === 'fulfilled' ? activity.value.activity : null,
    activityUnavailable: activity.status === 'rejected',
    connectivityError:
      primaryError instanceof Error
        ? primaryError.message
        : primaryError
          ? 'Magento catalog or stock could not be reached.'
          : '',
  };
}

async function fetchMagentoSnapshot() {
  const connection = await fetchMagentoStatus();
  if (connection.status !== 'connected') {
    return { connection, feed: EMPTY_FEED, checkedAt: new Date(), statusMessage: '' };
  }
  const feed = await fetchMagentoFeed();
  const hasPrimaryFeed = Boolean(feed.catalog || feed.stock);
  return {
    connection: hasPrimaryFeed ? connection : { ...connection, status: 'unavailable' as const },
    feed,
    checkedAt: new Date(),
    statusMessage: hasPrimaryFeed ? '' : feed.connectivityError,
  };
}

export function MagentoStatus() {
  const [status, setStatus] = useState<Status>('loading');
  const [storeCode, setStoreCode] = useState('default');
  const [feed, setFeed] = useState<MagentoFeed>(EMPTY_FEED);
  const [refreshing, setRefreshing] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const snapshot = await fetchMagentoSnapshot();
    setStoreCode(snapshot.connection.storeCode);
    setStatus(snapshot.connection.status);
    setFeed(snapshot.feed);
    setLastCheckedAt(snapshot.checkedAt);
    setStatusMessage(snapshot.statusMessage);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let active = true;
    const poll = () => {
      void fetchMagentoSnapshot().then((snapshot) => {
        if (!active) return;
        setStoreCode(snapshot.connection.storeCode);
        setStatus(snapshot.connection.status);
        setFeed(snapshot.feed);
        setLastCheckedAt(snapshot.checkedAt);
        setStatusMessage(snapshot.statusMessage);
        setRefreshing(false);
      });
    };
    poll();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') poll();
    }, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const details = {
    loading: ['Checking connection', 'Contacting the BisaPilot service'],
    connected: ['Live connection', `Magento store: ${storeCode}`],
    unconfigured: ['Configuration required', 'Magento credentials are not set on the server'],
    unavailable: ['Service unavailable', statusMessage || 'The Magento service could not be reached'],
  }[status];
  const StatusIcon = status === 'connected' ? CircleCheck : status === 'loading' ? RefreshCw : CircleX;
  const products = feed.catalog?.products.length ?? 0;
  const branches = feed.catalog?.branches.filter((branch) => branch.is_active).length ?? 0;
  const stockUnits = feed.stock?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  const demandUnits = feed.reorder?.items.reduce((total, item) => total + item.units_sold, 0) ?? 0;
  const demandRevenue = feed.reorder?.items.reduce((total, item) => total + item.revenue, 0) ?? 0;
  const demandActivity = feed.reorder?.items.filter((item) => item.units_sold > 0).slice(0, 4) ?? [];
  const currency = feed.catalog?.currency ?? 'GHS';

  return (
    <section className="integration-panel magento-live-panel" aria-labelledby="magento-title">
      <div className="panel-heading">
        <div className="integration-mark"><Store size={18} /></div>
        <div>
          <p className="eyebrow">Commerce infrastructure</p>
          <h2 id="magento-title">Magento connection</h2>
        </div>
        <button className="icon-button" type="button" onClick={() => void refresh()} disabled={refreshing} title="Refresh Magento activity">
          <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
          <span className="sr-only">Refresh Magento activity</span>
        </button>
      </div>

      <div className={`connection-state connection-state--${status}`}>
        <StatusIcon size={19} className={status === 'loading' ? 'spin' : ''} />
        <div><strong>{details[0]}</strong><span>{details[1]}</span></div>
        {status === 'connected' ? <span className="live-label"><i />Live</span> : null}
      </div>

      {status === 'connected' ? (
        <>
          <dl className="integration-facts integration-facts--live">
            <div><dt>Products</dt><dd>{products}</dd></div>
            <div><dt>Branches</dt><dd>{branches}</dd></div>
            <div><dt>Stock units</dt><dd>{stockUnits.toLocaleString('en-GH')}</dd></div>
          </dl>

          <div className="magento-signal-grid">
            <div><TrendingUp size={15} /><span>30-day demand</span><strong>{demandUnits} units</strong></div>
            <div><Activity size={15} /><span>Tracked revenue</span><strong>{formatCurrency(demandRevenue, currency)}</strong></div>
          </div>

          <div className="magento-activity-heading"><span>Magento activity</span><small>{feed.activity ? `${feed.activity.total_count} orders` : 'Live demand'}</small></div>
          {feed.activity?.orders.length ? (
            <div className="magento-order-list">
              {feed.activity.orders.slice(0, 4).map((order) => (
                <article className="magento-order" key={order.id || order.order_number}>
                  <div className="magento-order-icon"><Package size={14} /></div>
                  <div><strong>#{order.order_number}</strong><span>{order.customer_name} · {formatRelativeDate(order.created_at)}</span></div>
                  <div className="magento-order-value"><strong>{formatCurrency(order.total, order.currency)}</strong><span>{humanizeStatus(order.status)}</span></div>
                </article>
              ))}
            </div>
          ) : demandActivity.length ? (
            <div className="magento-order-list">
              {demandActivity.map((item) => (
                <article className="magento-order" key={`${item.sku}-${item.source_code}`}>
                  <div className="magento-order-icon"><TrendingUp size={14} /></div>
                  <div><strong>{item.name}</strong><span>{item.units_sold} sold · {item.branch_name}</span></div>
                  <div className="magento-order-value"><strong>{formatCurrency(item.revenue, currency)}</strong><span>{item.days_of_cover}d cover</span></div>
                </article>
              ))}
            </div>
          ) : (
            <p className="magento-empty">{refreshing ? 'Loading Magento activity...' : 'No recent Magento activity.'}</p>
          )}

          {feed.activityUnavailable ? <p className="magento-permission-note">Order-level events require Sales read permission on the Magento integration token.</p> : null}

          <div className="magento-last-sync"><Clock3 size={13} /><span>{lastCheckedAt ? `Updated ${lastCheckedAt.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Waiting for first refresh'} · refreshes every 30 seconds</span></div>
        </>
      ) : (
        <dl className="integration-facts">
          <div><dt>Catalog</dt><dd>Server managed</dd></div>
          <div><dt>Stock</dt><dd>Branch aware</dd></div>
          <div><dt>Orders</dt><dd>Idempotent</dd></div>
        </dl>
      )}
    </section>
  );
}

function humanizeStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
