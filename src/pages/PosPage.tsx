import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  addOutline,
  cartOutline,
  checkmarkCircle,
  closeOutline,
  cubeOutline,
  locationOutline,
  removeOutline,
  refreshOutline,
} from 'ionicons/icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import OfflineSyncStatus from '../components/OfflineSyncStatus';
import {
  type MagentoCatalog,
  type MagentoCatalogProduct,
  type MagentoPosOrder,
  type MagentoPosOrderInput,
} from '../lib/magentoClient';
import { loadPosCatalogWithOfflineSupport, placePosOrderWithOfflineSupport } from '../offline/offlinePos';
import { formatCurrency } from '../utils/format';

type CartLine = {
  product: MagentoCatalogProduct;
  quantity: number;
};

const paymentMethods: MagentoPosOrderInput['paymentMethod'][] = ['Cash', 'Mobile Money', 'Bank Account'];

const PosPage = () => {
  const [catalog, setCatalog] = useState<MagentoCatalog | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('Walk-in customer');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<MagentoPosOrderInput['paymentMethod']>('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<MagentoPosOrder | null>(null);

  const loadCatalog = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await loadPosCatalogWithOfflineSupport();
      setCatalog(result.catalog);
      setBranchId((current) =>
        result.catalog.branches.some((branch) => branch.id === current)
          ? current
          : result.catalog.branches[0]?.id ?? null
      );
      if (result.cachedAt) {
        setMessage(
          `Offline — using the catalog saved ${new Date(result.cachedAt).toLocaleString()}. Sales made now will sync automatically.`
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the Magento catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (catalog?.products ?? [])
      .filter((product) => product.is_salable && product.quantity > 0)
      .filter((product) =>
        !query || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)
      );
  }, [catalog?.products, search]);

  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedBranch = catalog?.branches.find((branch) => branch.id === branchId);

  const changeQuantity = (product: MagentoCatalogProduct, delta: number) => {
    setCart((current) => {
      const existing = current.find((line) => line.product.sku === product.sku);
      const nextQuantity = Math.min(product.quantity, Math.max(0, (existing?.quantity ?? 0) + delta));
      if (nextQuantity === 0) {
        return current.filter((line) => line.product.sku !== product.sku);
      }
      if (existing) {
        return current.map((line) =>
          line.product.sku === product.sku ? { ...line, quantity: nextQuantity } : line
        );
      }
      return [...current, { product, quantity: nextQuantity }];
    });
  };

  // Idempotency key for the sale being checked out. Created on the first
  // submit attempt and kept across retries, so a network failure + retry can
  // never record the sale twice; cleared once Magento confirms the order.
  const saleClientRef = useRef<string | null>(null);

  const handleCheckout = async () => {
    if (!branchId || cart.length === 0 || !customerName.trim()) {
      setMessage('Choose a branch, add products, and enter the customer name.');
      return;
    }

    if (!saleClientRef.current) {
      saleClientRef.current = `BISA-${crypto.randomUUID()}`;
    }

    setSubmitting(true);
    setMessage('');
    try {
      const result = await placePosOrderWithOfflineSupport({
        branchId,
        clientRef: saleClientRef.current,
        customer: {
          name: customerName.trim(),
          email: customerEmail.trim(),
          phone: customerPhone.trim(),
        },
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        items: cart.map((line) => ({
          sku: line.product.sku,
          quantity: line.quantity,
        })),
      });

      // Both outcomes mean the sale is recorded (immediately, or durably
      // queued for idempotent replay) — the cart is done either way.
      saleClientRef.current = null;
      setCart([]);
      setPaymentReference('');

      if (result.status === 'placed') {
        setCompletedOrder(result.order);
        await loadCatalog();
      } else {
        setCompletedOrder(null);
        setMessage('No connection — sale saved on this device and will sync to Magento automatically.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Magento POS checkout failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Point of Sale</IonTitle>
          <div slot="end" style={{ paddingRight: 12 }}>
            <OfflineSyncStatus />
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell pos-shell" data-testid="pos-page">
          <div className="pos-command-bar">
            <div>
              <p className="eyebrow">Magento live register</p>
              <h1>Counter sale</h1>
            </div>
            <div className="pos-branch-control">
              <IonIcon icon={locationOutline} />
              <IonSelect
                aria-label="Store branch"
                value={branchId}
                interface="popover"
                onIonChange={(event) => setBranchId(Number(event.detail.value))}
              >
                {(catalog?.branches ?? []).map((branch) => (
                  <IonSelectOption key={branch.id} value={branch.id}>
                    {branch.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </div>
          </div>

          {completedOrder ? (
            <section className="pos-success" aria-live="polite">
              <IonIcon icon={checkmarkCircle} />
              <div>
                <p className="eyebrow">Order placed in Magento</p>
                <h2>{completedOrder.orderNumber}</h2>
                <p>
                  {completedOrder.itemCount} items from {completedOrder.branch.name} ·{' '}
                  {formatCurrency(completedOrder.total, completedOrder.currency)}
                </p>
              </div>
              <IonButton fill="clear" aria-label="Dismiss completed order" onClick={() => setCompletedOrder(null)}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </section>
          ) : null}

          {loading && !catalog ? (
            <div className="pos-loading">
              <IonSpinner name="crescent" />
              <p>Loading live Magento stock...</p>
            </div>
          ) : message && !catalog ? (
            <div className="pos-loading">
              <p>{message}</p>
              <IonButton onClick={() => void loadCatalog()}>
                <IonIcon slot="start" icon={refreshOutline} />
                Retry
              </IonButton>
            </div>
          ) : (
            <div className="pos-workspace">
              <section className="pos-catalog-panel">
                <div className="pos-panel-head">
                  <div>
                    <h2>Products</h2>
                    <p>{visibleProducts.length} live items available</p>
                  </div>
                  <IonBadge color="success">Synced</IonBadge>
                </div>
                <IonSearchbar
                  value={search}
                  placeholder="Search product or SKU"
                  debounce={100}
                  onIonInput={(event) => setSearch(event.detail.value ?? '')}
                />
                <div className="pos-product-grid">
                  {visibleProducts.map((product) => {
                    const cartLine = cart.find((line) => line.product.sku === product.sku);
                    return (
                      <article className="pos-product" key={product.sku}>
                        <div className="pos-product-image">
                          {product.image_url ? <img src={product.image_url} alt="" /> : <IonIcon icon={cubeOutline} />}
                          <span>{product.quantity} in stock</span>
                        </div>
                        <div className="pos-product-copy">
                          <p>{product.sku}</p>
                          <h3>{product.name}</h3>
                          <strong>{formatCurrency(product.price, catalog?.currency ?? 'GHS')}</strong>
                        </div>
                        <IonButton
                          data-testid={`pos-add-${product.sku}`}
                          fill={cartLine ? 'outline' : 'solid'}
                          size="small"
                          onClick={() => changeQuantity(product, 1)}
                          disabled={(cartLine?.quantity ?? 0) >= product.quantity}
                        >
                          <IonIcon slot="start" icon={addOutline} />
                          {cartLine ? `${cartLine.quantity} in cart` : 'Add'}
                        </IonButton>
                      </article>
                    );
                  })}
                </div>
              </section>

              <aside className="pos-cart-panel">
                <div className="pos-panel-head">
                  <div>
                    <h2>Current sale</h2>
                    <p>{selectedBranch?.name ?? 'Select a branch'}</p>
                  </div>
                  <IonBadge color="primary">{itemCount}</IonBadge>
                </div>

                <div className="pos-cart-lines">
                  {cart.length === 0 ? (
                    <div className="pos-empty-cart">
                      <IonIcon icon={cartOutline} />
                      <strong>Cart is empty</strong>
                      <p>Add a live Magento product to begin.</p>
                    </div>
                  ) : (
                    cart.map((line) => (
                      <div className="pos-cart-line" key={line.product.sku}>
                        <div>
                          <strong>{line.product.name}</strong>
                          <p>{formatCurrency(line.product.price, catalog?.currency ?? 'GHS')} each</p>
                        </div>
                        <div className="pos-stepper">
                          <IonButton
                            fill="clear"
                            aria-label={`Remove one ${line.product.name}`}
                            onClick={() => changeQuantity(line.product, -1)}
                          >
                            <IonIcon slot="icon-only" icon={removeOutline} />
                          </IonButton>
                          <span>{line.quantity}</span>
                          <IonButton
                            fill="clear"
                            aria-label={`Add one ${line.product.name}`}
                            disabled={line.quantity >= line.product.quantity}
                            onClick={() => changeQuantity(line.product, 1)}
                          >
                            <IonIcon slot="icon-only" icon={addOutline} />
                          </IonButton>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pos-customer-fields">
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Customer name</IonLabel>
                    <IonInput value={customerName} onIonInput={(event) => setCustomerName(event.detail.value ?? '')} />
                  </IonItem>
                  <div className="pos-field-pair">
                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Phone</IonLabel>
                      <IonInput type="tel" value={customerPhone} onIonInput={(event) => setCustomerPhone(event.detail.value ?? '')} />
                    </IonItem>
                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Email</IonLabel>
                      <IonInput type="email" value={customerEmail} onIonInput={(event) => setCustomerEmail(event.detail.value ?? '')} />
                    </IonItem>
                  </div>
                </div>

                <div className="pos-payment">
                  <p className="muted-label">Payment method</p>
                  <IonSegment
                    value={paymentMethod}
                    onIonChange={(event) => setPaymentMethod(event.detail.value as MagentoPosOrderInput['paymentMethod'])}
                  >
                    {paymentMethods.map((method) => (
                      <IonSegmentButton key={method} value={method}>
                        <IonLabel>{method}</IonLabel>
                      </IonSegmentButton>
                    ))}
                  </IonSegment>
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Payment reference</IonLabel>
                    <IonInput
                      placeholder="Optional"
                      value={paymentReference}
                      onIonInput={(event) => setPaymentReference(event.detail.value ?? '')}
                    />
                  </IonItem>
                </div>

                <div className="pos-total">
                  <span>Magento subtotal</span>
                  <strong>{formatCurrency(subtotal, catalog?.currency ?? 'GHS')}</strong>
                  <p>Magento calculates final Ghana taxes when the order is placed.</p>
                </div>
                {message && catalog ? <p className="form-message">{message}</p> : null}
                <IonButton
                  data-testid="pos-complete-sale"
                  expand="block"
                  size="large"
                  disabled={submitting || cart.length === 0 || !branchId}
                  onClick={() => void handleCheckout()}
                >
                  {submitting ? <IonSpinner name="crescent" /> : 'Complete sale'}
                </IonButton>
              </aside>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default PosPage;
