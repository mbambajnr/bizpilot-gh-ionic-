import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { resizeImage } from '../utils/imageUtils';
import type { InventoryImportPreview } from '../utils/inventoryImport';
import { buildInventoryTemplateCsv, validateInventoryImportCsv } from '../utils/inventoryImport';
import type { PurchaseItem } from '../data/seedBusiness';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import SearchablePicker, { PickerItem } from '../components/SearchablePicker';
import { useBusiness } from '../context/BusinessContext';
import {
  type InventoryCategoryFilterValue,
  selectActiveProductCategories,
  selectInventorySummariesByCategory,
  selectInventorySummaries,
  selectInventoryCategoryReport,
  selectInventoryLocationReport,
  selectActiveLocations,
  selectDefaultLocation,
  selectFastMovingProductsByLocation,
  selectInventorySummariesByLocation,
  selectLowStockByLocation,
  selectProductCategoryDisplayLabel,
  selectProductById,
  selectProductMovements,
  selectProductQuantityOnHand,
  selectStockTransfers,
  selectStoreStockBalances,
  selectSupplyRoutesForStore,
  selectStockMovementDisplay,
  selectTransferHistory,
  selectWarehouseStockBalances,
} from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate, formatRelativeDate } from '../utils/format';

const InventoryPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const {
    state,
    addProduct,
    addRestockRequest,
    reviewRestockRequest,
    createStockTransfer,
    approveStockTransfer,
    dispatchStockTransfer,
    receiveStockTransfer,
    cancelStockTransfer,
    createPurchaseDraft,
    createVendor,
    submitPurchase,
    approvePurchase,
    cancelPurchase,
    receivePurchaseInWarehouse,
    currentUser,
    hasPermission,
  } = useBusiness();
  const [name, setName] = useState('');
  const [inventoryId, setInventoryId] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [cost, setCost] = useState<number | ''>('');
  const [reorderLevel, setReorderLevel] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [image, setImage] = useState<string>('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [savedItemName, setSavedItemName] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<InventoryImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importSummaryMessage, setImportSummaryMessage] = useState('');
  const [showImportToast, setShowImportToast] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategoryFilterValue>('all');
  const [activeSegment, setActiveSegment] = useState<'status' | 'activity' | 'supply'>('status');

  // Review state
  const [reviewNote, setReviewNote] = useState('');
  const [showReviewToast, setShowReviewToast] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  // Restock Request State
  const [restockQty, setRestockQty] = useState<number | ''>('');
  const [restockNote, setRestockNote] = useState('');
  const [urgency, setUrgency] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [restockMessage, setRestockMessage] = useState('');
  const [showRestockSuccess, setShowRestockSuccess] = useState(false);
  const [transferProductId, setTransferProductId] = useState('');
  const [transferFromLocationId, setTransferFromLocationId] = useState('');
  const [transferToLocationId, setTransferToLocationId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState<number | ''>('');
  const [transferNote, setTransferNote] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [showTransferSuccess, setShowTransferSuccess] = useState(false);
  const [purchaseVendorId, setPurchaseVendorId] = useState('');
  const [purchaseProductId, setPurchaseProductId] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState<number | ''>('');
  const [purchaseUnitCost, setPurchaseUnitCost] = useState<number | ''>('');
  const [purchaseDraftItems, setPurchaseDraftItems] = useState<PurchaseItem[]>([]);
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [showPurchaseSuccess, setShowPurchaseSuccess] = useState(false);
  const [showPurchaseVendorPicker, setShowPurchaseVendorPicker] = useState(false);
  const [showPurchaseProductPicker, setShowPurchaseProductPicker] = useState(false);
  const [showQuickVendorForm, setShowQuickVendorForm] = useState(false);
  const [quickVendorName, setQuickVendorName] = useState('');
  const [quickVendorEmail, setQuickVendorEmail] = useState('');
  const [quickVendorLocation, setQuickVendorLocation] = useState('');
  const [pendingPurchaseVendorName, setPendingPurchaseVendorName] = useState('');
  const [showQuickProductForm, setShowQuickProductForm] = useState(false);
  const [quickProductName, setQuickProductName] = useState('');
  const [quickProductInventoryId, setQuickProductInventoryId] = useState('');
  const [quickProductUnit, setQuickProductUnit] = useState('');
  const [quickProductPrice, setQuickProductPrice] = useState<number | ''>('');
  const [quickProductReorderLevel, setQuickProductReorderLevel] = useState<number | ''>(0);
  const [pendingPurchaseProductKey, setPendingPurchaseProductKey] = useState('');
  const [selectedReceiptPurchaseId, setSelectedReceiptPurchaseId] = useState('');
  const [selectedReceiptWarehouseId, setSelectedReceiptWarehouseId] = useState('');
  const [purchaseReceiptQuantities, setPurchaseReceiptQuantities] = useState<Record<string, number | ''>>({});
  const [purchaseReceiptMessage, setPurchaseReceiptMessage] = useState('');
  const [showPurchaseReceiptSuccess, setShowPurchaseReceiptSuccess] = useState(false);
  const procurementSectionRef = useRef<HTMLElement | null>(null);
  const receiptsSectionRef = useRef<HTMLElement | null>(null);
  const transfersSectionRef = useRef<HTMLElement | null>(null);
  const arrivalSection = new URLSearchParams(location.search).get('section');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setFormMessage('Photo is very large (over 10MB). Please choose a smaller file.');
        return;
      }
      
      try {
        setFormMessage('Processing photo...');
        const resized = await resizeImage(file, 600, 600);
        setImage(resized);
        setFormMessage('');
      } catch (err) {
        setFormMessage('Failed to process the photo. Please try again.');
        console.error(err);
      }
    }
  };
  const [selectedProductId, setSelectedProductId] = useState(state.products[0]?.id ?? '');

  useEffect(() => {
    if (!selectedProductId && state.products.length > 0) {
      setSelectedProductId(state.products[0].id);
    }
  }, [state.products, selectedProductId]);

  useEffect(() => {
    if (!transferProductId && state.products.length > 0) {
      setTransferProductId(selectedProductId || state.products[0].id);
    }
  }, [selectedProductId, state.products, transferProductId]);
  const inventoryCategoriesEnabled = state.businessProfile.inventoryCategoriesEnabled;
  const activeLocations = useMemo(() => selectActiveLocations(state), [state]);
  const defaultLocation = useMemo(() => selectDefaultLocation(state), [state]);
  const canViewStoreInventory = hasPermission('transfers.receive') || hasPermission('sales.view') || hasPermission('sales.create');
  const canViewWarehouseInventory =
    hasPermission('purchases.receive') ||
    hasPermission('transfers.view') ||
    hasPermission('transfers.dispatch') ||
    hasPermission('transfers.approve') ||
    hasPermission('inventory.adjust') ||
    hasPermission('inventory.create') ||
    hasPermission('inventory.edit');
  const activeWarehouses = useMemo(() => activeLocations.filter((location) => location.type === 'warehouse'), [activeLocations]);
  const activeStores = useMemo(() => activeLocations.filter((location) => location.type === 'store'), [activeLocations]);
  const visibleInventoryLocations = useMemo(
    () => activeLocations.filter((location) =>
      location.type === 'store' ? canViewStoreInventory : canViewWarehouseInventory
    ),
    [activeLocations, canViewStoreInventory, canViewWarehouseInventory]
  );
  const activeVendors = useMemo(() => state.vendors.filter((vendor) => vendor.status === 'active'), [state.vendors]);
  const approvedPurchases = useMemo(
    () => state.purchases.filter((purchase) => purchase.status === 'approved'),
    [state.purchases]
  );
  const selectedLocationId =
    visibleInventoryLocations.some((location) => location.id === locationId)
      ? locationId
      : visibleInventoryLocations[0]?.id ?? defaultLocation.id;
  const activeProductCategories = useMemo(() => selectActiveProductCategories(state), [state]);
  const categoryMap = useMemo(
    () => new Map(state.productCategories.map((category) => [category.id, category])),
    [state.productCategories]
  );

  useEffect(() => {
    if (!inventoryCategoriesEnabled && categoryFilter !== 'all') {
      setCategoryFilter('all');
      return;
    }

    if (
      categoryFilter.startsWith('category:') &&
      !activeProductCategories.some((category) => category.id === categoryFilter.slice('category:'.length))
    ) {
      setCategoryFilter('all');
    }
  }, [inventoryCategoriesEnabled, categoryFilter, activeProductCategories]);

  const inventorySummaries = useMemo(() => {
    const locationScoped = selectInventorySummariesByLocation(state, selectedLocationId);
    const all = inventoryCategoriesEnabled
      ? selectInventorySummariesByCategory(state, categoryFilter)
      : locationScoped;
    const locationAdjusted = all.map((summary) =>
      locationScoped.find((item) => item.product.id === summary.product.id) ?? summary
    );
    if (!searchTerm.trim()) return locationAdjusted;
    const lower = searchTerm.toLowerCase();
    return locationAdjusted.filter(({ product }) =>
      product.name.toLowerCase().includes(lower) || 
      product.inventoryId.toLowerCase().includes(lower)
    );
  }, [state, searchTerm, inventoryCategoriesEnabled, categoryFilter, selectedLocationId]);
  const selectedSummary = useMemo(() => {
    return inventorySummaries.find((item) => item.product.id === selectedProductId) ?? 
           inventorySummaries[0] ?? 
           selectInventorySummaries(state).find(item => item.product.id === selectedProductId) ??
           null;
  }, [inventorySummaries, selectedProductId, state]);
  const selectedMovements = useMemo(
    () => (selectedSummary ? selectProductMovements(state, selectedSummary.product.id) : []),
    [selectedSummary, state]
  );
  const transferSourceOptions = useMemo(() => {
    if (!transferToLocationId) {
      return activeWarehouses;
    }

    const sourceIds = new Set(selectSupplyRoutesForStore(state, transferToLocationId).map((route) => route.fromLocationId));
    return activeWarehouses.filter((location) => sourceIds.has(location.id));
  }, [activeWarehouses, state, transferToLocationId]);
  const transferHistory = useMemo(() => selectTransferHistory(state), [state]);
  const stockTransfers = useMemo(() => selectStockTransfers(state), [state]);
  const warehouseStockBalances = useMemo(() => selectWarehouseStockBalances(state), [state]);
  const storeStockBalances = useMemo(() => selectStoreStockBalances(state), [state]);
  const purchaseViews = useMemo(
    () => state.purchases.map((purchase) => ({
      purchase,
      vendorName: state.vendors.find((vendor) => vendor.id === purchase.vendorId)?.name ?? purchase.vendorCode,
    })),
    [state.purchases, state.vendors]
  );
  const currency = state.businessProfile.currency;
  const selectedPurchaseVendor = useMemo(
    () => activeVendors.find((vendor) => vendor.id === purchaseVendorId) ?? null,
    [activeVendors, purchaseVendorId]
  );
  const selectedPurchaseProduct = useMemo(
    () => state.products.find((product) => product.id === purchaseProductId) ?? null,
    [purchaseProductId, state.products]
  );
  const purchaseVendorPickerItems = useMemo<PickerItem[]>(
    () => activeVendors.map((vendor) => ({
      id: vendor.id,
      title: vendor.name,
      subtitle: vendor.vendorCode,
      meta: vendor.location,
    })),
    [activeVendors]
  );
  const purchaseProductPickerItems = useMemo<PickerItem[]>(
    () => state.products.map((product) => ({
      id: product.id,
      title: product.name,
      subtitle: product.inventoryId,
      meta: `${product.unit} · cost ${formatCurrency(product.cost, currency)}`,
    })),
    [currency, state.products]
  );
  const purchaseDraftTotal = purchaseDraftItems.reduce((sum, item) => sum + item.totalCost, 0);
  const inventoryCategoryReport = useMemo(() => selectInventoryCategoryReport(state), [state]);
  const inventoryLocationReport = useMemo(() => {
    const visibleLocationIds = new Set(visibleInventoryLocations.map((location) => location.id));
    return selectInventoryLocationReport(state).filter((entry) => visibleLocationIds.has(entry.locationId));
  }, [state, visibleInventoryLocations]);
  const lowStockByLocation = useMemo(() => selectLowStockByLocation(state, selectedLocationId), [state, selectedLocationId]);
  const fastMovingByLocation = useMemo(
    () => selectFastMovingProductsByLocation(state).filter((entry) => entry.locationId === selectedLocationId),
    [state, selectedLocationId]
  );

  useEffect(() => {
    if (!transferToLocationId && activeStores.length > 0) {
      setTransferToLocationId(activeStores[0].id);
    }
  }, [activeStores, transferToLocationId]);

  useEffect(() => {
    if (!transferFromLocationId && transferSourceOptions.length > 0) {
      setTransferFromLocationId(transferSourceOptions[0].id);
      return;
    }

    if (transferFromLocationId && transferSourceOptions.length > 0 && !transferSourceOptions.some((location) => location.id === transferFromLocationId)) {
      setTransferFromLocationId(transferSourceOptions[0].id);
    }
  }, [transferFromLocationId, transferSourceOptions]);

  useEffect(() => {
    if (!purchaseVendorId && activeVendors.length > 0) {
      setPurchaseVendorId(activeVendors[0].id);
    }
  }, [activeVendors, purchaseVendorId]);

  useEffect(() => {
    if (!pendingPurchaseVendorName) {
      return;
    }

    const createdVendor = activeVendors.find(
      (vendor) => vendor.name.toLowerCase() === pendingPurchaseVendorName.toLowerCase()
    );
    if (createdVendor) {
      setPurchaseVendorId(createdVendor.id);
      setPendingPurchaseVendorName('');
    }
  }, [activeVendors, pendingPurchaseVendorName]);

  useEffect(() => {
    if (!purchaseProductId && state.products.length > 0) {
      setPurchaseProductId(state.products[0].id);
    }
  }, [purchaseProductId, state.products]);

  useEffect(() => {
    if (!pendingPurchaseProductKey) {
      return;
    }

    const createdProduct = state.products.find((product) =>
      product.inventoryId.toLowerCase() === pendingPurchaseProductKey.toLowerCase() ||
      product.name.toLowerCase() === pendingPurchaseProductKey.toLowerCase()
    );
    if (createdProduct) {
      setPurchaseProductId(createdProduct.id);
      setPendingPurchaseProductKey('');
    }
  }, [pendingPurchaseProductKey, state.products]);

  useEffect(() => {
    if (!selectedReceiptPurchaseId && approvedPurchases.length > 0) {
      setSelectedReceiptPurchaseId(approvedPurchases[0].id);
    }

    if (selectedReceiptPurchaseId && !approvedPurchases.some((purchase) => purchase.id === selectedReceiptPurchaseId)) {
      setSelectedReceiptPurchaseId(approvedPurchases[0]?.id ?? '');
    }
  }, [approvedPurchases, selectedReceiptPurchaseId]);

  useEffect(() => {
    if (!selectedReceiptWarehouseId && activeWarehouses.length > 0) {
      setSelectedReceiptWarehouseId(activeWarehouses[0].id);
    }

    if (selectedReceiptWarehouseId && !activeWarehouses.some((location) => location.id === selectedReceiptWarehouseId)) {
      setSelectedReceiptWarehouseId(activeWarehouses[0]?.id ?? '');
    }
  }, [activeWarehouses, selectedReceiptWarehouseId]);

  useEffect(() => {
    const selectedPurchase = approvedPurchases.find((purchase) => purchase.id === selectedReceiptPurchaseId);
    if (!selectedPurchase) {
      setPurchaseReceiptQuantities({});
      return;
    }

    setPurchaseReceiptQuantities((current) => {
      const next: Record<string, number | ''> = {};
      selectedPurchase.items.forEach((item) => {
        next[item.productId] = current[item.productId] === undefined ? item.quantity : current[item.productId];
      });
      return next;
    });
  }, [approvedPurchases, selectedReceiptPurchaseId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (!section) {
      return;
    }

    if (['procurement', 'receipts', 'transfers'].includes(section)) {
      setActiveSegment('supply');
    }

    const target =
      section === 'procurement' ? procurementSectionRef.current :
      section === 'receipts' ? receiptsSectionRef.current :
      section === 'transfers' ? transfersSectionRef.current :
      null;

    if (target) {
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }
  }, [location.search]);

  const handleAddProduct = () => {
    if (!name || price === '' || cost === '' || reorderLevel === '' || quantity === '') {
      setFormMessage('Complete all required inventory fields before saving.');
      return;
    }

    const itemName = name;

    const result = addProduct({
      name: itemName,
      inventoryId,
      unit: unit.trim() || 'units',
      price: Number(price),
      cost: Number(cost),
      reorderLevel: Number(reorderLevel),
      quantity: Number(quantity),
      image: image || undefined,
      categoryId: inventoryCategoriesEnabled ? categoryId || undefined : undefined,
      locationId: selectedLocationId,
    });

    if (!result.ok) {
      setFormMessage(result.message);
      return;
    }

    setName('');
    setInventoryId('');
    setUnit('');
    setPrice('');
    setCost('');
    setReorderLevel('');
    setQuantity('');
    setImage('');
    setCategoryId('');
    setSavedItemName(itemName);
    setFormMessage('');
    setShowSuccessToast(true);
  };

  const handleCreatePurchaseVendor = async () => {
    const vendorName = quickVendorName.trim();
    const result = await createVendor({
      name: vendorName,
      contactEmail: quickVendorEmail,
      location: quickVendorLocation,
    });

    if (!result.ok) {
      setPurchaseMessage(result.message);
      return;
    }

    setPendingPurchaseVendorName(vendorName);
    setQuickVendorName('');
    setQuickVendorEmail('');
    setQuickVendorLocation('');
    setShowQuickVendorForm(false);
    setPurchaseMessage('');
    setShowPurchaseSuccess(true);
  };

  const handleCreatePurchaseProduct = () => {
    const itemName = quickProductName.trim();
    const itemCost = purchaseUnitCost === '' ? 0 : Number(purchaseUnitCost);
    const itemPrice = quickProductPrice === '' ? itemCost : Number(quickProductPrice);
    const itemUnit = quickProductUnit.trim() || 'units';
    const itemReorderLevel = quickProductReorderLevel === '' ? 0 : Number(quickProductReorderLevel);
    const itemInventoryId = quickProductInventoryId.trim();

    const result = addProduct({
      name: itemName,
      inventoryId: itemInventoryId,
      unit: itemUnit,
      price: itemPrice,
      cost: itemCost,
      reorderLevel: itemReorderLevel,
      quantity: 0,
      categoryId: inventoryCategoriesEnabled ? categoryId || undefined : undefined,
      locationId: selectedLocationId,
    });

    if (!result.ok) {
      setPurchaseMessage(result.message);
      return;
    }

    setPendingPurchaseProductKey(itemInventoryId || itemName);
    setPurchaseUnitCost(itemCost);
    setQuickProductName('');
    setQuickProductInventoryId('');
    setQuickProductUnit('');
    setQuickProductPrice('');
    setQuickProductReorderLevel(0);
    setShowQuickProductForm(false);
    setPurchaseMessage('');
    setShowPurchaseSuccess(true);
  };

  const handleDownloadTemplate = () => {
    const csv = buildInventoryTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bisapilot-inventory-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportPreview(null);
    setImportMessage('');
    setImportFileName('');
    setIsImporting(false);
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportMessage('Upload the BisaPilot inventory template as a CSV file.');
      setShowImportModal(true);
      return;
    }

    const text = await file.text();
    const preview = validateInventoryImportCsv(text, state.products, {
      inventoryCategoriesEnabled: state.businessProfile.inventoryCategoriesEnabled,
      productCategories: state.productCategories,
    });
    setImportPreview(preview);
    setImportFileName(file.name);
    setImportMessage(
      preview.headerErrors.length > 0
        ? preview.headerErrors.join(' ')
        : preview.invalidRows.length > 0
          ? `Found ${preview.invalidRows.length} invalid row${preview.invalidRows.length === 1 ? '' : 's'}. Fix them in the file and upload again.`
          : `Preview ready. ${preview.validRows.length} item${preview.validRows.length === 1 ? '' : 's'} can be imported safely.`
    );
    setShowImportModal(true);
  };

  const handleConfirmImport = () => {
    if (!importPreview || importPreview.headerErrors.length > 0 || importPreview.validRows.length === 0 || isImporting) {
      return;
    }

    setIsImporting(true);
    let importedCount = 0;
    const failedRows: string[] = [];

    importPreview.validRows.forEach((row) => {
      if (!row.normalizedInput) {
        return;
      }

      const result = addProduct(row.normalizedInput);
      if (result.ok) {
        importedCount += 1;
        return;
      }

      failedRows.push(`Row ${row.rowNumber}: ${result.message}`);
    });

    setIsImporting(false);

    if (failedRows.length > 0) {
      setImportMessage(`Imported ${importedCount} item${importedCount === 1 ? '' : 's'}, but some rows failed. ${failedRows.join(' ')}`);
      return;
    }

    setImportSummaryMessage(`Imported ${importedCount} inventory item${importedCount === 1 ? '' : 's'} successfully.`);
    setShowImportToast(true);
    closeImportModal();
  };

  const handleRequestRestock = () => {
    if (!selectedProductId || restockQty === '') {
      setRestockMessage('Enter a valid quantity.');
      return;
    }

    const result = addRestockRequest({
      productId: selectedProductId,
      requestedByUserId: currentUser.userId,
      requestedByName: currentUser.name,
      requestedQuantity: Number(restockQty),
      urgency,
      note: restockNote,
    });

    if (!result.ok) {
      setRestockMessage(result.message);
      return;
    }

    setRestockQty('');
    setRestockNote('');
    setUrgency('Medium');
    setRestockMessage('');
    setShowRestockSuccess(true);
  };

  const handleTransferStock = async () => {
    if (!transferProductId || !transferFromLocationId || !transferToLocationId || transferQuantity === '') {
      setTransferMessage('Choose a product, route, and quantity before transferring stock.');
      return;
    }

    const result = await createStockTransfer({
      fromWarehouseId: transferFromLocationId,
      toStoreId: transferToLocationId,
      initiatedBy: currentUser.userId,
      note: transferNote,
      items: [
        {
          productId: transferProductId,
          quantity: Number(transferQuantity),
        },
      ],
    });

    if (!result.ok) {
      setTransferMessage(result.message);
      return;
    }

    setTransferQuantity('');
    setTransferNote('');
    setTransferMessage('');
    setShowTransferSuccess(true);
  };

  const handleTransferAction = async (
    transferId: string,
    action: 'approve' | 'dispatch' | 'receive' | 'cancel'
  ) => {
    const input = { transferId, performedBy: currentUser.userId };
    const result =
      action === 'approve'
        ? await approveStockTransfer(input)
        : action === 'dispatch'
          ? await dispatchStockTransfer(input)
          : action === 'receive'
            ? await receiveStockTransfer(input)
            : await cancelStockTransfer(input);

    if (!result.ok) {
      setTransferMessage(result.message);
      return;
    }

    const actionLabel =
      action === 'approve' ? 'approved' :
      action === 'dispatch' ? 'dispatched' :
      action === 'receive' ? 'received' : 'cancelled';
    setTransferMessage('');
    setReviewMessage(`Transfer ${actionLabel} successfully.`);
    setShowReviewToast(true);
  };

  const handleAddPurchaseItem = () => {
    const product = state.products.find((item) => item.id === purchaseProductId);
    if (!product || purchaseQuantity === '' || purchaseUnitCost === '') {
      setPurchaseMessage('Choose a product, quantity, and unit cost before adding a line.');
      return;
    }

    const vendor = activeVendors.find((item) => item.id === purchaseVendorId);
    if (!vendor) {
      setPurchaseMessage('Choose an active vendor before adding purchase lines.');
      return;
    }

    const quantity = Number(purchaseQuantity);
    const unitCost = Number(purchaseUnitCost);
    if (quantity <= 0 || unitCost < 0) {
      setPurchaseMessage('Purchase quantity must be positive and unit cost cannot be negative.');
      return;
    }

    setPurchaseDraftItems((current) => [
      ...current,
      {
        productId: product.id,
        productName: product.name,
        quantity,
        unitCost,
        totalCost: Number((quantity * unitCost).toFixed(2)),
        vendorCode: vendor.vendorCode,
      },
    ]);
    setPurchaseQuantity('');
    setPurchaseUnitCost('');
    setPurchaseMessage('');
  };

  const handleRemovePurchaseItem = (index: number) => {
    setPurchaseDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleCreatePurchaseDraft = async () => {
    const result = await createPurchaseDraft({
      vendorId: purchaseVendorId,
      createdBy: currentUser.userId,
      items: purchaseDraftItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
      })),
    });

    if (!result.ok) {
      setPurchaseMessage(result.message);
      return;
    }

    setPurchaseDraftItems([]);
    setPurchaseMessage('');
    setShowPurchaseSuccess(true);
  };

  const handlePurchaseAction = async (purchaseId: string, action: 'submit' | 'approve' | 'cancel') => {
    const input = { purchaseId, performedBy: currentUser.userId };
    const result =
      action === 'submit'
        ? await submitPurchase(input)
        : action === 'approve'
          ? await approvePurchase(input)
          : await cancelPurchase(input);

    if (!result.ok) {
      setPurchaseMessage(result.message);
      return;
    }

    setPurchaseMessage('');
    setReviewMessage(
      action === 'submit'
        ? 'Purchase submitted for approval.'
        : action === 'approve'
          ? 'Purchase approved and payable created.'
          : 'Purchase cancelled.'
    );
    setShowReviewToast(true);
  };

  const handleReceivePurchase = async () => {
    const selectedPurchase = approvedPurchases.find((purchase) => purchase.id === selectedReceiptPurchaseId);
    if (!selectedPurchase || !selectedReceiptWarehouseId) {
      setPurchaseReceiptMessage('Choose an approved purchase and warehouse before receiving stock.');
      return;
    }

    const result = await receivePurchaseInWarehouse({
      purchaseId: selectedPurchase.id,
      warehouseId: selectedReceiptWarehouseId,
      performedBy: currentUser.userId,
      receivedItems: selectedPurchase.items.map((item) => ({
        productId: item.productId,
        quantity: Number(purchaseReceiptQuantities[item.productId] ?? item.quantity),
      })),
    });

    if (!result.ok) {
      setPurchaseReceiptMessage(result.message);
      return;
    }

    setPurchaseReceiptMessage('');
    setShowPurchaseReceiptSuccess(true);
  };

  const handleReviewRequest = (reqId: string, status: 'Approved' | 'Rejected' | 'Fulfilled') => {
    const result = reviewRestockRequest({
      requestId: reqId,
      status,
      reviewNote,
      reviewedByUserId: currentUser.userId,
      reviewedByName: currentUser.name,
    });

    if (result.ok) {
      setReviewNote('');
      setReviewMessage(`Request marked as ${status.toLowerCase()}.`);
      setShowReviewToast(true);
    } else {
      setRestockMessage(result.message);
    }
  };

  const openImageViewer = (src: string, alt: string) => {
    setExpandedImage({ src, alt });
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Inventory</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment
            value={activeSegment}
            onIonChange={(event) => {
              const nextSegment = event.detail.value;
              if (nextSegment === 'status' || nextSegment === 'activity' || nextSegment === 'supply') {
                setActiveSegment(nextSegment);
              }
            }}
          >
            <IonSegmentButton value="status">
              <IonLabel>Status</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="activity">
              <IonLabel>Activity</IonLabel>
            </IonSegmentButton>
            {(hasPermission('restockRequests.view') || hasPermission('transfers.view') || hasPermission('purchases.view') || hasPermission('purchases.create')) && (
              <IonSegmentButton value="supply">
                <IonLabel>Supply</IonLabel>
              </IonSegmentButton>
            )}
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          {activeSegment === 'status' && (
            <>
              {hasPermission('inventory.create') && (
                <SectionCard title="Add stock item" subtitle="Create a sellable item with its details. Adding a photo is optional but helps with quick identification.">
                  <div className="form-grid">
                    <div className="button-group">
                      <IonButton fill="outline" onClick={handleDownloadTemplate}>
                        Download Import Template
                      </IonButton>
                      <input
                        id="inventory-import-input"
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        onChange={handleImportFileChange}
                      />
                      <IonButton fill="outline" onClick={() => document.getElementById('inventory-import-input')?.click()}>
                        Import from CSV
                      </IonButton>
                    </div>
                    <p className="muted-label">
                      Bulk import uses a CSV template with the exact BisaPilot inventory columns. Upload, preview, and confirm before anything is created.
                    </p>
                    <p className="muted-label">
                      Required: Item Name, Cost Price, Selling Price, Quantity In Stock, Reorder Level. Optional: Inventory ID, Unit, Image URL, Category.
                    </p>
                    <div className="inventory-photo-section">
                      <div className="inventory-photo-preview">
                        {image ? (
                          <button
                            type="button"
                            className="image-thumb-button image-thumb-button-large"
                            onClick={() => openImageViewer(image, name.trim() || 'Product preview')}
                            aria-label="Expand product photo"
                          >
                            <img src={image} alt="Preview" />
                          </button>
                        ) : (
                          <div className="photo-placeholder">
                            <span>No photo</span>
                          </div>
                        )}
                      </div>
                      <div className="photo-actions">
                        <input
                          type="file"
                          accept="image/*"
                          id="inventory-photo-input"
                          hidden
                          onChange={handleFileChange}
                        />
                        <IonButton
                          fill="outline"
                          size="small"
                          onClick={() => document.getElementById('inventory-photo-input')?.click()}
                        >
                          {image ? 'Change Photo' : 'Add Photo (Optional)'}
                        </IonButton>
                        {image && (
                          <IonButton fill="clear" color="danger" size="small" onClick={() => setImage('')}>
                            Remove
                          </IonButton>
                        )}
                      </div>
                    </div>

                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Item name</IonLabel>
                      <IonInput
                        value={name}
                        placeholder="e.g. Morning Fresh Soap"
                        onIonInput={(event) => setName(event.detail.value ?? '')}
                      />
                    </IonItem>

                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Inventory ID (optional)</IonLabel>
                      <IonInput
                        value={inventoryId}
                        helperText="Leave blank to auto-generate one."
                        onIonInput={(event) => setInventoryId(event.detail.value ?? '')}
                      />
                    </IonItem>

                    {inventoryCategoriesEnabled && (
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Category (optional)</IonLabel>
                        <IonSelect
                          value={categoryId}
                          placeholder={activeProductCategories.length > 0 ? 'Choose a category' : 'No active categories yet'}
                          interface="popover"
                          onIonChange={(event) => setCategoryId(event.detail.value ?? '')}
                        >
                          <IonSelectOption value="">Uncategorized</IonSelectOption>
                          {activeProductCategories.map((category) => (
                            <IonSelectOption key={category.id} value={category.id}>
                              {category.name}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                    )}

                    {visibleInventoryLocations.length > 1 ? (
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Opening stock location</IonLabel>
                        <IonSelect
                          value={selectedLocationId}
                          interface="popover"
                          onIonChange={(event) => setLocationId(event.detail.value ?? '')}
                        >
                          {visibleInventoryLocations.map((location) => (
                            <IonSelectOption key={location.id} value={location.id}>
                              {location.name} {location.isDefault ? '(default)' : ''}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                    ) : null}

                    <div className="triple-grid">
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Unit</IonLabel>
                        <IonInput
                          value={unit}
                          placeholder="e.g. packs, boxes, units"
                          onIonInput={(event) => setUnit(event.detail.value ?? '')}
                        />
                      </IonItem>
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Price</IonLabel>
                        <IonInput
                          type="number"
                          inputmode="decimal"
                          placeholder="0.00"
                          value={price}
                          onIonInput={(event) => setPrice(event.detail.value === '' ? '' : Number(event.detail.value))}
                        />
                      </IonItem>
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Cost</IonLabel>
                        <IonInput
                          type="number"
                          inputmode="decimal"
                          placeholder="0.00"
                          value={cost}
                          onIonInput={(event) => setCost(event.detail.value === '' ? '' : Number(event.detail.value))}
                        />
                      </IonItem>
                    </div>

                    <div className="dual-stat">
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Opening stock</IonLabel>
                        <IonInput
                          type="number"
                          inputmode="numeric"
                          placeholder="0"
                          value={quantity}
                          onIonInput={(event) => setQuantity(event.detail.value === '' ? '' : Number(event.detail.value))}
                        />
                      </IonItem>
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Reorder level</IonLabel>
                        <IonInput
                          type="number"
                          inputmode="numeric"
                          placeholder="0"
                          value={reorderLevel}
                          onIonInput={(event) => setReorderLevel(event.detail.value === '' ? '' : Number(event.detail.value))}
                        />
                      </IonItem>
                    </div>

                    <IonButton expand="block" onClick={handleAddProduct}>
                      Save Item
                    </IonButton>
                    {formMessage ? <p className="form-message">{formMessage}</p> : null}
                  </div>
                </SectionCard>
              )}

              {(hasPermission('purchases.view') || hasPermission('purchases.create') || hasPermission('purchases.receive') || hasPermission('transfers.view')) && (
                <SectionCard
                  title="ERP operations"
                  subtitle="See procurement, warehouse receiving, and stock transfers at a glance before drilling into inventory detail."
                >
                  <div className="stats-grid">
                    {(hasPermission('purchases.view') || hasPermission('purchases.create')) ? (
                      <div className="mini-stat">
                        <p className="muted-label">Procurement</p>
                        <h3>{state.purchases.filter((purchase) => purchase.status === 'draft' || purchase.status === 'submitted' || purchase.status === 'adminReviewed').length}</h3>
                        <p>{state.purchases.length > 0 ? 'Purchase Queue is active' : 'No procurement activity yet'}</p>
                      </div>
                    ) : null}
                    {hasPermission('purchases.view') ? (
                      <div className="mini-stat">
                        <p className="muted-label">Purchase Queue</p>
                        <h3>{state.purchases.filter((purchase) => purchase.status === 'submitted' || purchase.status === 'adminReviewed').length}</h3>
                        <p>{state.purchases.some((purchase) => purchase.status === 'submitted' || purchase.status === 'adminReviewed') ? 'Pending approval purchases' : 'No purchases pending approval'}</p>
                      </div>
                    ) : null}
                    {hasPermission('purchases.receive') ? (
                      <div className="mini-stat">
                        <p className="muted-label">Warehouse Receipts</p>
                        <h3>{approvedPurchases.length}</h3>
                        <p>{approvedPurchases.length > 0 ? 'Approved purchases awaiting receipt' : 'No purchases awaiting receipt'}</p>
                      </div>
                    ) : null}
                    {hasPermission('transfers.view') ? (
                      <div className="mini-stat">
                        <p className="muted-label">Stock Transfers</p>
                        <h3>{stockTransfers.filter((entry) => entry.transfer.status !== 'received' && entry.transfer.status !== 'cancelled').length}</h3>
                        <p>{stockTransfers.length > 0 ? 'Warehouse-to-store transfer queue' : 'No pending stock transfers'}</p>
                      </div>
                    ) : null}
                  </div>
                </SectionCard>
              )}

              <SectionCard
                title="Management snapshot"
                subtitle="Compact operational reporting for the current inventory view, without leaving the stock-control screen."
              >
                <div className="stats-grid">
                  <div className="mini-stat">
                    <p className="muted-label">Selected location</p>
                    <h3>{visibleInventoryLocations.find((location) => location.id === selectedLocationId)?.name ?? defaultLocation.name}</h3>
                    <p>{inventoryLocationReport.find((entry) => entry.locationId === selectedLocationId)?.quantityOnHand ?? 0} units on hand</p>
                  </div>
                  <div className="mini-stat">
                    <p className="muted-label">Low-stock lines here</p>
                    <h3>{lowStockByLocation.length}</h3>
                    <p>{lowStockByLocation.length > 0 ? 'Needs replenishment planning' : 'No urgent stock risk'}</p>
                  </div>
                  <div className="mini-stat">
                    <p className="muted-label">Fast movers here</p>
                    <h3>{fastMovingByLocation.length}</h3>
                    <p>30-day sales-movement heuristic</p>
                  </div>
                </div>
                <p className="muted-label" style={{ margin: '0 8px 12px 8px' }}>
                  Stock value below is an operational estimate based on current product cost multiplied by quantity on hand.
                </p>
                <div className="list-block">
                  {inventoryLocationReport.map((entry) => (
                    <div className="list-row" key={entry.locationId}>
                      <div>
                        <strong>{entry.label}</strong>
                        <p>{entry.type === 'warehouse' ? 'Warehouse' : 'Store'} • {entry.productCount} stocked products</p>
                      </div>
                      <div className="right-meta">
                        <strong>{entry.quantityOnHand} units</strong>
                        <p>Estimate {formatCurrency(entry.stockValue, currency)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {inventoryCategoriesEnabled ? (
                  <div className="list-block">
                    <div className="list-row">
                      <div>
                        <strong>Category distribution</strong>
                        <p>Uncategorized products stay fully supported.</p>
                      </div>
                    </div>
                    {inventoryCategoryReport.slice(0, 4).map((entry) => (
                      <div className="list-row" key={entry.categoryId ?? 'uncategorized'}>
                        <div>
                          <strong>{entry.label}</strong>
                          <p>{entry.productCount} products</p>
                        </div>
                        <div className="right-meta">
                          <strong>{entry.quantityOnHand} units</strong>
                          <p>{formatCurrency(entry.stockValue, currency)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {(lowStockByLocation.length > 0 || fastMovingByLocation.length > 0) ? (
                  <div className="list-block">
                    {lowStockByLocation.slice(0, 3).map((entry) => (
                      <div className="list-row" key={`risk-${entry.locationId}-${entry.product.id}`}>
                        <div>
                          <strong>{entry.product.name}</strong>
                          <p>Low stock at {entry.locationLabel}</p>
                        </div>
                        <div className="right-meta">
                          <strong className="warning-text">{entry.quantityOnHand} left</strong>
                          <p>Reorder at {entry.reorderLevel}</p>
                        </div>
                      </div>
                    ))}
                    {fastMovingByLocation.slice(0, 3).map((entry) => (
                      <div className="list-row" key={`fast-${entry.locationId}-${entry.productId}`}>
                        <div>
                          <strong>{selectProductById(state, entry.productId)?.name ?? 'Unknown product'}</strong>
                          <p>Fast-moving in {visibleInventoryLocations.find((location) => location.id === entry.locationId)?.name ?? defaultLocation.name}</p>
                        </div>
                        <div className="right-meta">
                          <strong>{entry.quantityMoved} units</strong>
                          <p>{entry.movementCount} sale movements</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard
                title="Warehouse balances"
                subtitle="Available warehouse stock is built from purchases, transfer dispatches, and adjustments."
              >
                {activeWarehouses.length === 0 ? (
                  <EmptyState
                    eyebrow="No warehouses"
                    title="Add a warehouse in Settings to hold procurement stock."
                    message="Warehouse balances will appear here once a warehouse location exists and receives stock."
                  />
                ) : (
                  <div className="list-block">
                    <div className="list-row">
                      <div>
                        <strong>{activeWarehouses.length} warehouse{activeWarehouses.length === 1 ? '' : 's'}</strong>
                        <p>Operational stock ready for dispatch to stores</p>
                      </div>
                    </div>
                    {warehouseStockBalances.map((entry) => (
                      <div className="list-row" key={`${entry.warehouseId}-${entry.productId}`}>
                        <div>
                          <strong>{entry.productName}</strong>
                          <p>{entry.warehouseName} • {activeWarehouses.find((location) => location.id === entry.warehouseId)?.locationCode ?? 'WH'}</p>
                          <p className="muted-label">{entry.lastMovementAt ? `Last movement ${formatRelativeDate(entry.lastMovementAt)}` : 'No movement yet'}</p>
                        </div>
                        <div className="right-meta">
                          <strong>{entry.quantityAvailable}</strong>
                          <p>{entry.vendorCode ? `Vendor ${entry.vendorCode}` : 'Warehouse stock'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {canViewStoreInventory ? (
                <SectionCard
                  title="Store balances"
                  subtitle="Store stock reflects transfer receipts, sales, and adjustments at each selling location."
                >
                  {activeStores.length === 0 ? (
                    <EmptyState
                      eyebrow="No stores"
                      title="Add a store location to track sellable stock."
                      message="Store balances will appear here once a store location exists."
                    />
                  ) : (
                    <div className="list-block">
                      <div className="list-row">
                        <div>
                          <strong>{activeStores.length} store{activeStores.length === 1 ? '' : 's'}</strong>
                          <p>Sales should draw down store stock, not warehouse stock</p>
                        </div>
                      </div>
                      {storeStockBalances.map((entry) => (
                        <div className="list-row" key={`${entry.storeId}-${entry.productId}`}>
                          <div>
                            <strong>{entry.productName}</strong>
                            <p>{entry.storeName} • {activeStores.find((location) => location.id === entry.storeId)?.locationCode ?? 'ST'}</p>
                            <p className="muted-label">{entry.lastMovementAt ? `Last movement ${formatRelativeDate(entry.lastMovementAt)}` : 'No movement yet'}</p>
                          </div>
                          <div className="right-meta">
                            <strong>{entry.quantityAvailable}</strong>
                            <p>Store-ready stock</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              ) : null}

              <SectionCard title="Stock control" subtitle="Quantities now come from explicit stock movements instead of a loose on-hand counter.">
                <IonSearchbar 
                  placeholder="Search by name or ID..." 
                  value={searchTerm}
                  onIonInput={(e) => setSearchTerm(e.detail.value ?? '')}
                  style={{ padding: '0 8px 16px 8px' }}
                />
                {visibleInventoryLocations.length > 1 ? (
                  <IonItem lines="none" className="app-item" style={{ margin: '0 8px 16px 8px' }}>
                    <IonLabel position="stacked">Location</IonLabel>
                    <IonSelect
                      value={selectedLocationId}
                      interface="popover"
                      onIonChange={(event) => setLocationId(event.detail.value ?? '')}
                    >
                      {visibleInventoryLocations.map((location) => (
                        <IonSelectOption key={location.id} value={location.id}>
                          {location.name} {location.isDefault ? '(default)' : ''}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                ) : null}
                {inventoryCategoriesEnabled && (
                  <IonItem lines="none" className="app-item" style={{ margin: '0 8px 16px 8px' }}>
                    <IonLabel position="stacked">Category filter</IonLabel>
                    <IonSelect
                      value={categoryFilter}
                      interface="popover"
                      onIonChange={(event) => setCategoryFilter(event.detail.value as InventoryCategoryFilterValue)}
                    >
                      <IonSelectOption value="all">All</IonSelectOption>
                      <IonSelectOption value="uncategorized">Uncategorized</IonSelectOption>
                      {activeProductCategories.map((category) => (
                        <IonSelectOption key={category.id} value={`category:${category.id}`}>
                          {category.name}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                )}
                {inventorySummaries.length === 0 ? (
                  <EmptyState
                    eyebrow="No stock yet"
                    title={inventoryCategoriesEnabled && categoryFilter !== 'all' ? 'No items match this category filter' : 'Inventory visibility starts with the first item'}
                    message={
                      inventoryCategoriesEnabled && categoryFilter !== 'all'
                        ? 'Try another category filter or add an item in this category to see it here.'
                        : 'Add a sellable product above and BisaPilot will track quantity on hand, reorder risk, and the latest stock movement from that moment forward.'
                    }
                  />
                ) : (
                  <div className="list-block">
                    {inventorySummaries.map(({ product, quantityOnHand, lowStock, latestMovement, stockStatusDisplay }) => {
                      const margin = product.price > 0 ? `${Math.round(((product.price - product.cost) / product.price) * 100)}%` : '0%';
                      const categoryLabel = selectProductCategoryDisplayLabel(state, product.categoryId);
                      const category = product.categoryId ? categoryMap.get(product.categoryId) ?? null : null;

                      return (
                        <div
                          className="list-row"
                          key={product.id}
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setActiveSegment('activity');
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedProductId(product.id);
                              setActiveSegment('activity');
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="item-main">
                            <button
                              type="button"
                              className="image-thumb-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openImageViewer(product.image, product.name);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                              aria-label={`Expand ${product.name} image`}
                            >
                              <img className="product-thumb" src={product.image} alt={product.name} />
                            </button>
                            <div>
                              <strong>{product.name}</strong>
                              <p className="code-label">{product.inventoryId}</p>
                              {inventoryCategoriesEnabled ? (
                                <p className="muted-label">
                                  Category: {categoryLabel}
                                  {category && !category.isActive ? ' • Archived' : ''}
                                </p>
                              ) : null}
                              <p>
                                Reorder at {product.reorderLevel} • Margin {margin} • {formatCurrency(product.price, currency)}
                              </p>
                              <p>
                                Latest movement:{' '}
                                {latestMovement ? `${latestMovement.type} • ${formatRelativeDate(latestMovement.createdAt)}` : 'No movements yet'}
                              </p>
                            </div>
                          </div>
                          <div className="right-meta">
                            <strong className={lowStock ? 'warning-text' : 'success-text'}>{stockStatusDisplay.label}</strong>
                            <p>{quantityOnHand} left</p>
                            <p>{stockStatusDisplay.helper}</p>
                            <p>{product.unit}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {activeSegment === 'activity' && (
            <SectionCard
              title="Stock movement history"
              subtitle="See exactly why this product's quantity changed, from opening stock to sales and reversals."
            >
              {selectedSummary ? (
                <div className="list-block">
                  <div className="list-row header-row" style={{ background: 'rgba(0,0,0,0.05)', borderRadius: '12px', padding: '12px' }}>
                    <div className="item-main">
                      <button
                        type="button"
                        className="image-thumb-button"
                        onClick={() => openImageViewer(selectedSummary.product.image, selectedSummary.product.name)}
                        aria-label={`Expand ${selectedSummary.product.name} image`}
                      >
                        <img className="product-thumb" src={selectedSummary.product.image} alt={selectedSummary.product.name} />
                      </button>
                      <div>
                        <strong>{selectedSummary.product.name}</strong>
                        <p className="code-label">{selectedSummary.product.inventoryId}</p>
                        {inventoryCategoriesEnabled ? (
                          <p className="muted-label">
                            Category: {selectProductCategoryDisplayLabel(state, selectedSummary.product.categoryId)}
                          </p>
                        ) : null}
                        <p>{selectedSummary.stockStatusDisplay.helper}</p>
                      </div>
                    </div>
                    <div className="right-meta">
                      <strong className={selectedSummary.lowStock ? 'warning-text' : 'success-text'}>
                        {selectedSummary.quantityOnHand} left
                      </strong>
                      <p>{selectedSummary.product.unit}</p>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    {selectedMovements.length === 0 ? (
                      <EmptyState
                        eyebrow="No movement history"
                        title="No stock movement has been recorded yet."
                        message="Opening stock, sales, and reversals will appear here as this product is used."
                      />
                    ) : (
                      selectedMovements.map((movement) => {
                        const movementDisplay = selectStockMovementDisplay(movement);
                        const relatedSale = movement.relatedSaleId
                          ? state.sales.find((sale) => sale.id === movement.relatedSaleId)
                          : null;
                        const relatedCustomer = relatedSale
                          ? state.customers.find((customer) => customer.id === relatedSale.customerId)
                          : null;

                        return (
                          <div className="list-row" key={movement.id} style={{ borderBottom: '1px solid var(--border-color)', paddingTop: '16px', paddingBottom: '16px' }}>
                            <div>
                              <strong>{movementDisplay.label}</strong>
                              <p className="code-label">
                                {movement.movementNumber}
                                {movement.referenceNumber ? ` • ${movement.referenceNumber}` : ''}
                              </p>
                              <p>{movement.note || movementDisplay.helper}</p>
                              {relatedCustomer ? <p>Customer: {relatedCustomer.name}</p> : null}
                              <p className="muted-label">{formatReceiptDate(movement.createdAt)}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <strong className={movement.quantityDelta < 0 ? 'danger-text' : 'success-text'} style={{ fontSize: '1.1rem' }}>
                                {movement.quantityDelta > 0 ? '+' : ''}
                                {movement.quantityDelta}
                              </strong>
                              <p>After: {movement.quantityAfter}</p>
                              <p className={movementDisplay.tone === 'warning' ? 'warning-text' : 'success-text'}>
                                {movementDisplay.helper}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState
                  eyebrow="No product selected"
                  title="Choose a product to see activity history."
                  message="Switch to the Status tab and tap on a product to view its detailed movement log here."
                />
              )}
            </SectionCard>
          )}

          {activeSegment === 'supply' && (hasPermission('transfers.view') || hasPermission('restockRequests.view') || hasPermission('purchases.view') || hasPermission('purchases.create')) && (
            <>
              <SectionCard
                title="Supply workflow"
                subtitle="Move stock through the business with a clear operational chain."
              >
                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>
                        {hasPermission('transfers.view')
                          ? 'Vendor → Purchase → Approval → Payable → Warehouse Receipt → Store Transfer → Sale'
                          : 'Vendor → Purchase → Approval → Payable → Warehouse Receipt'}
                      </strong>
                      <p>
                        {hasPermission('transfers.view')
                          ? 'Use procurement for supplier orders, warehouse receipts for stock-in, and transfer stock to move goods into selling locations.'
                          : 'Use procurement for supplier orders and warehouse receipts without exposing store transfer operations.'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="stats-grid" style={{ marginTop: '12px' }}>
                  {(hasPermission('purchases.view') || hasPermission('purchases.create')) ? (
                    <div className="mini-stat">
                      <p className="muted-label">Purchase Queue</p>
                      <h3>{state.purchases.filter((purchase) => purchase.status === 'draft' || purchase.status === 'submitted' || purchase.status === 'adminReviewed').length}</h3>
                      <p>{state.purchases.filter((purchase) => purchase.status === 'approved').length} approved awaiting receipt</p>
                    </div>
                  ) : null}
                  {hasPermission('purchases.receive') ? (
                    <div className="mini-stat">
                      <p className="muted-label">Warehouse Receipts</p>
                      <h3>{approvedPurchases.length}</h3>
                      <p>{approvedPurchases.length > 0 ? 'Approved purchases awaiting receipt' : 'No purchases awaiting receipt'}</p>
                    </div>
                  ) : null}
                  {hasPermission('transfers.view') ? (
                    <div className="mini-stat">
                      <p className="muted-label">Pending Stock Transfers</p>
                      <h3>{stockTransfers.filter((entry) => entry.transfer.status !== 'received' && entry.transfer.status !== 'cancelled').length}</h3>
                      <p>Warehouse-to-store movements still in flight</p>
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              {(hasPermission('purchases.create') || hasPermission('purchases.view')) && (
                <section ref={procurementSectionRef}>
                  <SectionCard
                    title="Procurement"
                    subtitle="Raise purchase drafts from active vendors, submit them, and track approval through warehouse receipt."
                    highlighted={arrivalSection === 'procurement'}
                    highlightLabel={arrivalSection === 'procurement' ? "You're viewing Procurement" : undefined}
                    dataTestId="arrival-procurement"
                  >
                  <div className="form-grid">
                    {hasPermission('purchases.create') ? (
                      <>
                            <div className="dual-stat">
                              <div className="picker-container">
                                <p className="muted-label">Supplier</p>
                                <IonButton
                                  expand="block"
                                  fill="outline"
                                  onClick={() => setShowPurchaseVendorPicker(true)}
                                  disabled={activeVendors.length === 0}
                                >
                                  {selectedPurchaseVendor ? selectedPurchaseVendor.name : activeVendors.length === 0 ? 'No Vendors Yet' : 'Select Vendor'}
                                </IonButton>
                                {selectedPurchaseVendor ? (
                                  <p className="muted-label">
                                    {selectedPurchaseVendor.vendorCode} · {selectedPurchaseVendor.location}
                                  </p>
                                ) : null}
                                <IonButton
                                  expand="block"
                                  fill="clear"
                                  onClick={() => setShowQuickVendorForm((visible) => !visible)}
                                >
                                  {showQuickVendorForm ? 'Hide New Supplier' : 'Add New Supplier'}
                                </IonButton>
                              </div>
                              <div className="picker-container">
                                <p className="muted-label">Stock item</p>
                                <IonButton
                                  expand="block"
                                  fill="outline"
                                  onClick={() => setShowPurchaseProductPicker(true)}
                                >
                                  {selectedPurchaseProduct ? selectedPurchaseProduct.name : 'Select Item'}
                                </IonButton>
                                {selectedPurchaseProduct ? (
                                  <p className="muted-label">
                                    {selectedPurchaseProduct.inventoryId} · {selectProductCategoryDisplayLabel(state, selectedPurchaseProduct.categoryId)}
                                  </p>
                                ) : null}
                                {hasPermission('inventory.create') ? (
                                  <IonButton
                                    expand="block"
                                    fill="clear"
                                    onClick={() => setShowQuickProductForm((visible) => !visible)}
                                  >
                                    {showQuickProductForm ? 'Hide New Stock Item' : 'Add New Stock Item'}
                                  </IonButton>
                                ) : null}
                              </div>
                            </div>
                            {showQuickVendorForm ? (
                              <div className="list-block">
                                <div className="list-row">
                                  <div>
                                    <strong>New supplier</strong>
                                    <p>Create the vendor here, then continue the purchase order.</p>
                                  </div>
                                </div>
                                <div className="dual-stat">
                                  <IonItem lines="none" className="app-item">
                                    <IonLabel position="stacked">Vendor name</IonLabel>
                                    <IonInput
                                      value={quickVendorName}
                                      placeholder="e.g. Asante Wholesale"
                                      onIonInput={(event) => setQuickVendorName(event.detail.value ?? '')}
                                    />
                                  </IonItem>
                                  <IonItem lines="none" className="app-item">
                                    <IonLabel position="stacked">Contact email</IonLabel>
                                    <IonInput
                                      value={quickVendorEmail}
                                      placeholder="accounts@vendor.com"
                                      onIonInput={(event) => setQuickVendorEmail(event.detail.value ?? '')}
                                    />
                                  </IonItem>
                                </div>
                                <IonItem lines="none" className="app-item">
                                  <IonLabel position="stacked">Location</IonLabel>
                                  <IonInput
                                    value={quickVendorLocation}
                                    placeholder="Accra, Ghana"
                                    onIonInput={(event) => setQuickVendorLocation(event.detail.value ?? '')}
                                  />
                                </IonItem>
                                <IonButton expand="block" onClick={handleCreatePurchaseVendor}>
                                  Create Supplier
                                </IonButton>
                              </div>
                            ) : null}
                            {showQuickProductForm && hasPermission('inventory.create') ? (
                              <div className="list-block">
                                <div className="list-row">
                                  <div>
                                    <strong>New stock item</strong>
                                    <p>Add the item with zero opening stock; the purchase unit cost below becomes its item cost.</p>
                                  </div>
                                </div>
                                <div className="dual-stat">
                                  <IonItem lines="none" className="app-item">
                                    <IonLabel position="stacked">Item name</IonLabel>
                                    <IonInput
                                      value={quickProductName}
                                      placeholder="e.g. Jasmine rice"
                                      onIonInput={(event) => setQuickProductName(event.detail.value ?? '')}
                                    />
                                  </IonItem>
                                  <IonItem lines="none" className="app-item">
                                    <IonLabel position="stacked">Inventory ID</IonLabel>
                                    <IonInput
                                      value={quickProductInventoryId}
                                      placeholder="Auto-generated if blank"
                                      onIonInput={(event) => setQuickProductInventoryId(event.detail.value ?? '')}
                                    />
                                  </IonItem>
                                </div>
                                <IonItem lines="none" className="app-item">
                                  <IonLabel position="stacked">Unit</IonLabel>
                                  <IonInput
                                    value={quickProductUnit}
                                    placeholder="units"
                                    onIonInput={(event) => setQuickProductUnit(event.detail.value ?? '')}
                                  />
                                </IonItem>
                                <div className="dual-stat">
                                  <IonItem lines="none" className="app-item">
                                    <IonLabel position="stacked">Selling price</IonLabel>
                                    <IonInput
                                      type="number"
                                      value={quickProductPrice}
                                      placeholder="Defaults to cost"
                                      onIonInput={(event) => setQuickProductPrice(event.detail.value === '' ? '' : Number(event.detail.value))}
                                    />
                                  </IonItem>
                                  <IonItem lines="none" className="app-item">
                                    <IonLabel position="stacked">Reorder level</IonLabel>
                                    <IonInput
                                      type="number"
                                      value={quickProductReorderLevel}
                                      onIonInput={(event) => setQuickProductReorderLevel(event.detail.value === '' ? '' : Number(event.detail.value))}
                                    />
                                  </IonItem>
                                </div>
                                <IonButton expand="block" onClick={handleCreatePurchaseProduct}>
                                  Create Stock Item
                                </IonButton>
                              </div>
                            ) : null}
                            <div className="dual-stat">
                              <IonItem lines="none" className="app-item">
                                <IonLabel position="stacked">Quantity</IonLabel>
                                <IonInput type="number" value={purchaseQuantity} onIonInput={(event) => setPurchaseQuantity(event.detail.value === '' ? '' : Number(event.detail.value))} />
                              </IonItem>
                              <IonItem lines="none" className="app-item">
                                <IonLabel position="stacked">Unit cost</IonLabel>
                                <IonInput type="number" value={purchaseUnitCost} onIonInput={(event) => setPurchaseUnitCost(event.detail.value === '' ? '' : Number(event.detail.value))} />
                              </IonItem>
                            </div>
                            <IonButton fill="outline" expand="block" onClick={handleAddPurchaseItem}>
                              Add Purchase Line
                            </IonButton>
                            <div className="sale-items-list" style={{ marginTop: '12px' }}>
                              <p className="muted-label" style={{ marginBottom: '12px' }}>Items Ordered</p>
                              {purchaseDraftItems.length === 0 ? (
                                <div className="list-row">
                                  <div>
                                    <strong>No purchase lines yet</strong>
                                    <p>Add one or more items before creating a draft.</p>
                                  </div>
                                </div>
                              ) : (
                                purchaseDraftItems.map((item, index) => (
                                  <div
                                    className="sale-item-row"
                                    key={`${item.productId}-${index}`}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 90px 40px',
                                      gap: '12px',
                                      alignItems: 'center',
                                      marginBottom: '16px',
                                      padding: '12px',
                                      background: 'rgba(0,0,0,0.02)',
                                      borderRadius: '8px',
                                    }}
                                  >
                                    <div>
                                      <strong>{item.productName}</strong>
                                      <p>{item.quantity} units at {formatCurrency(item.unitCost, currency)}</p>
                                      <p className="code-label">{item.vendorCode}</p>
                                    </div>
                                    <div className="right-meta">
                                      <strong>{formatCurrency(item.totalCost, currency)}</strong>
                                    </div>
                                    <IonButton fill="clear" color="danger" onClick={() => handleRemovePurchaseItem(index)}>
                                      ×
                                    </IonButton>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="sale-summary">
                              <div>
                                <p className="muted-label">Purchase order total</p>
                                <h3>{formatCurrency(purchaseDraftTotal, currency)}</h3>
                                <p className="muted-label">Purchase stock is added only after warehouse receipt.</p>
                              </div>
                              <div>
                                <p className="muted-label">Order lines</p>
                                <h3>{purchaseDraftItems.length}</h3>
                              </div>
                            </div>
                            <IonButton expand="block" onClick={handleCreatePurchaseDraft} disabled={purchaseDraftItems.length === 0}>
                              Create Purchase Order
                            </IonButton>
                            <SearchablePicker
                              isOpen={showPurchaseVendorPicker}
                              title="Select Vendor"
                              placeholder="Search vendor name, code, or location..."
                              items={purchaseVendorPickerItems}
                              emptyActionLabel="Create Supplier"
                              onEmptyAction={(query) => {
                                setQuickVendorName(query);
                                setShowQuickVendorForm(true);
                              }}
                              onDismiss={() => setShowPurchaseVendorPicker(false)}
                              onSelect={(item) => {
                                setPurchaseVendorId(item.id);
                                setShowPurchaseVendorPicker(false);
                              }}
                            />
                            <SearchablePicker
                              isOpen={showPurchaseProductPicker}
                              title="Select Stock Item"
                              placeholder="Search name or inventory ID..."
                              items={purchaseProductPickerItems}
                              emptyActionLabel={hasPermission('inventory.create') ? 'Create Stock Item' : undefined}
                              onEmptyAction={hasPermission('inventory.create') ? (query) => {
                                setQuickProductName(query);
                                setShowQuickProductForm(true);
                              } : undefined}
                              onDismiss={() => setShowPurchaseProductPicker(false)}
                              onSelect={(item) => {
                                setPurchaseProductId(item.id);
                                setShowPurchaseProductPicker(false);
                              }}
                            />
                      </>
                    ) : null}

                    {hasPermission('purchases.view') ? (
                      <div className="list-block">
                        <div className="list-row">
                          <div>
                            <strong>Purchase Queue</strong>
                            <p>Drafts, approvals, receipts, and cancellations stay visible in one place.</p>
                          </div>
                          <IonBadge color="primary">{state.purchases.length}</IonBadge>
                        </div>
                        {purchaseViews.length === 0 ? (
                          <div className="list-row">
                            <div>
                              <strong>No purchases yet</strong>
                              <p>Procurement drafts will appear here once created.</p>
                            </div>
                          </div>
                        ) : (
                          purchaseViews.map(({ purchase, vendorName }) => (
                            <div className="list-row" key={purchase.id}>
                              <div>
                                <strong>{purchase.purchaseCode}</strong>
                                <p>{vendorName} • {purchase.vendorCode}</p>
                                <p>{purchase.items.map((item) => `${item.productName} (${item.quantity})`).join(', ')}</p>
                                <p className="muted-label">{formatReceiptDate(purchase.createdAt)}</p>
                                <div className="button-group" style={{ marginTop: '8px' }}>
                                  {purchase.status === 'draft' && hasPermission('purchases.create') ? (
                                    <IonButton size="small" onClick={() => handlePurchaseAction(purchase.id, 'submit')}>Submit</IonButton>
                                  ) : null}
                                  {(purchase.status === 'submitted' || purchase.status === 'adminReviewed') && hasPermission('purchases.approve') ? (
                                    <IonButton size="small" fill="outline" onClick={() => handlePurchaseAction(purchase.id, 'approve')}>Approve</IonButton>
                                  ) : null}
                                  {purchase.status === 'approved' && hasPermission('purchases.receive') ? (
                                    <IonButton size="small" color="success" onClick={() => setSelectedReceiptPurchaseId(purchase.id)}>Prepare Receipt</IonButton>
                                  ) : null}
                                  {purchase.status !== 'cancelled' && purchase.status !== 'receivedToWarehouse' && hasPermission('purchases.approve') ? (
                                    <IonButton size="small" fill="clear" color="danger" onClick={() => handlePurchaseAction(purchase.id, 'cancel')}>Cancel</IonButton>
                                  ) : null}
                                </div>
                              </div>
                              <div className="right-meta">
                                <IonBadge color={
                                  purchase.status === 'receivedToWarehouse' ? 'success' :
                                  purchase.status === 'cancelled' ? 'medium' :
                                  purchase.status === 'approved' ? 'primary' :
                                  purchase.status === 'submitted' || purchase.status === 'adminReviewed' ? 'warning' : 'tertiary'
                                }>
                                  {purchase.status}
                                </IonBadge>
                                <strong>{formatCurrency(purchase.totalAmount, currency)}</strong>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}

                    {purchaseMessage ? <p className="form-message">{purchaseMessage}</p> : null}
                  </div>
                  </SectionCard>
                </section>
              )}

              {hasPermission('purchases.receive') && (
                <section ref={receiptsSectionRef}>
                  <SectionCard
                    title="Warehouse Receipts"
                    subtitle="Receive approved purchases into a warehouse and create traceable stock-in movements."
                    highlighted={arrivalSection === 'receipts'}
                    highlightLabel={arrivalSection === 'receipts' ? "You're viewing Warehouse Receipts" : undefined}
                    dataTestId="arrival-receipts"
                  >
                  {approvedPurchases.length === 0 || activeWarehouses.length === 0 ? (
                    <EmptyState
                      eyebrow="Nothing ready"
                      title="No purchases awaiting receipt."
                      message="Approve a purchase and make sure at least one warehouse location is active before receiving stock."
                    />
                  ) : (
                    <div className="form-grid">
                      <div className="dual-stat">
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Approved purchase</IonLabel>
                          <IonSelect value={selectedReceiptPurchaseId} interface="popover" onIonChange={(event) => setSelectedReceiptPurchaseId(event.detail.value)}>
                            {approvedPurchases.map((purchase) => (
                              <IonSelectOption key={purchase.id} value={purchase.id}>
                                {purchase.purchaseCode} - {purchase.vendorCode}
                              </IonSelectOption>
                            ))}
                          </IonSelect>
                        </IonItem>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Warehouse</IonLabel>
                          <IonSelect value={selectedReceiptWarehouseId} interface="popover" onIonChange={(event) => setSelectedReceiptWarehouseId(event.detail.value)}>
                            {activeWarehouses.map((warehouse) => (
                              <IonSelectOption key={warehouse.id} value={warehouse.id}>
                                {warehouse.name}
                              </IonSelectOption>
                            ))}
                          </IonSelect>
                        </IonItem>
                      </div>
                      <div className="list-block">
                        {(approvedPurchases.find((purchase) => purchase.id === selectedReceiptPurchaseId)?.items ?? []).map((item) => (
                          <div className="list-row" key={item.productId}>
                            <div>
                              <strong>{item.productName}</strong>
                              <p>Ordered: {item.quantity}</p>
                            </div>
                            <div style={{ minWidth: '120px' }}>
                              <IonItem lines="none" className="app-item">
                                <IonLabel position="stacked">Received qty</IonLabel>
                                <IonInput
                                  type="number"
                                  value={purchaseReceiptQuantities[item.productId] ?? item.quantity}
                                  onIonInput={(event) => setPurchaseReceiptQuantities((current) => ({
                                    ...current,
                                    [item.productId]: event.detail.value === '' ? '' : Number(event.detail.value),
                                  }))}
                                />
                              </IonItem>
                            </div>
                          </div>
                        ))}
                      </div>
                      <IonButton expand="block" color="success" onClick={handleReceivePurchase}>
                        Receive Into Warehouse
                      </IonButton>
                      {purchaseReceiptMessage ? <p className="form-message">{purchaseReceiptMessage}</p> : null}
                    </div>
                  )}
                  </SectionCard>
                </section>
              )}

              {hasPermission('transfers.create') && activeLocations.length > 1 && (
                <section ref={transfersSectionRef}>
                  <SectionCard
                    title="Transfer Stock"
                    subtitle="Create a warehouse-to-store transfer request using your saved supply routes."
                    highlighted={arrivalSection === 'transfers'}
                    highlightLabel={arrivalSection === 'transfers' ? "You're viewing Stock Transfers" : undefined}
                    dataTestId="arrival-transfers-create"
                  >
                  {state.locationSupplyRoutes.filter((route) => route.isActive).length === 0 ? (
                    <EmptyState
                      eyebrow="No supply route"
                      title="Create a warehouse-to-store route first."
                      message="Routes are managed in Settings so transfers stay intentional and auditable."
                      actionLabel="Open Settings"
                      onAction={() => history.push('/settings')}
                    />
                  ) : (
                    <div className="form-grid">
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Product</IonLabel>
                        <IonSelect
                          value={transferProductId}
                          interface="popover"
                          onIonChange={(event) => setTransferProductId(event.detail.value)}
                        >
                          {state.products.map((product) => (
                            <IonSelectOption key={product.id} value={product.id}>
                              {product.name}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                      <div className="dual-stat">
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Destination store</IonLabel>
                          <IonSelect
                            value={transferToLocationId}
                            interface="popover"
                            onIonChange={(event) => setTransferToLocationId(event.detail.value)}
                          >
                            {activeStores.map((location) => (
                              <IonSelectOption key={location.id} value={location.id}>{location.name}</IonSelectOption>
                            ))}
                          </IonSelect>
                        </IonItem>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Source warehouse</IonLabel>
                          <IonSelect
                            value={transferFromLocationId}
                            interface="popover"
                            onIonChange={(event) => setTransferFromLocationId(event.detail.value)}
                          >
                            {transferSourceOptions.map((location) => (
                              <IonSelectOption key={location.id} value={location.id}>
                                {location.name} ({selectProductQuantityOnHand(state, transferProductId, location.id)} available)
                              </IonSelectOption>
                            ))}
                          </IonSelect>
                        </IonItem>
                      </div>
                      <div className="dual-stat">
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Quantity to transfer</IonLabel>
                          <IonInput
                            type="number"
                            value={transferQuantity}
                            placeholder="0"
                            onIonInput={(event) => setTransferQuantity(event.detail.value === '' ? '' : Number(event.detail.value))}
                          />
                        </IonItem>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Note</IonLabel>
                          <IonInput
                            value={transferNote}
                            placeholder="Optional transfer note"
                            onIonInput={(event) => setTransferNote(event.detail.value ?? '')}
                          />
                        </IonItem>
                      </div>
                      <IonButton expand="block" onClick={handleTransferStock}>
                        Create Transfer
                      </IonButton>
                      {transferMessage ? <p className="form-message">{transferMessage}</p> : null}
                    </div>
                  )}
                  </SectionCard>
                </section>
              )}

              {hasPermission('transfers.view') && (
                <section ref={!hasPermission('transfers.create') ? transfersSectionRef : undefined}>
                  <SectionCard
                    title="Stock Transfers"
                    subtitle="Approve, dispatch, receive, or cancel transfers based on your access."
                    highlighted={arrivalSection === 'transfers'}
                    highlightLabel={arrivalSection === 'transfers' ? "You're viewing Stock Transfers" : undefined}
                    dataTestId="arrival-transfers"
                  >
                  {stockTransfers.length === 0 ? (
                    <EmptyState
                      eyebrow="No transfers"
                      title="No pending stock transfers."
                      message="Transfer requests stay visible here from pending approval through final receipt."
                    />
                  ) : (
                    <div className="list-block">
                      {stockTransfers.map((entry) => (
                        <div className="list-row" key={entry.transfer.id}>
                          <div>
                            <strong>{entry.transfer.transferCode}</strong>
                            <p>{entry.fromWarehouseName} → {entry.toStoreName}</p>
                            <p>{entry.totalItems} item line{entry.totalItems === 1 ? '' : 's'} • {entry.totalQuantity} units</p>
                            <p className="muted-label">{formatReceiptDate(entry.transfer.createdAt)}</p>
                            <p className="muted-label">
                              {entry.transfer.items.map((item) => `${item.productName} (${item.quantity})`).join(', ')}
                            </p>
                            <div className="button-group" style={{ marginTop: '8px' }}>
                              {entry.transfer.status === 'pending' && hasPermission('transfers.approve') ? (
                                <IonButton size="small" onClick={() => handleTransferAction(entry.transfer.id, 'approve')}>Approve</IonButton>
                              ) : null}
                              {entry.transfer.status === 'approved' && hasPermission('transfers.dispatch') ? (
                                <IonButton size="small" fill="outline" onClick={() => handleTransferAction(entry.transfer.id, 'dispatch')}>Dispatch</IonButton>
                              ) : null}
                              {(entry.transfer.status === 'approved' || entry.transfer.status === 'dispatched') && hasPermission('transfers.receive') ? (
                                <IonButton size="small" color="success" onClick={() => handleTransferAction(entry.transfer.id, 'receive')}>Receive</IonButton>
                              ) : null}
                              {entry.transfer.status !== 'received' && entry.transfer.status !== 'cancelled' && hasPermission('transfers.approve') ? (
                                <IonButton size="small" fill="clear" color="danger" onClick={() => handleTransferAction(entry.transfer.id, 'cancel')}>Cancel</IonButton>
                              ) : null}
                            </div>
                          </div>
                          <div className="right-meta">
                            <IonBadge color={
                              entry.transfer.status === 'received' ? 'success' :
                              entry.transfer.status === 'cancelled' ? 'medium' :
                              entry.transfer.status === 'dispatched' ? 'tertiary' :
                              entry.transfer.status === 'approved' ? 'primary' : 'warning'
                            }>
                              {entry.transfer.status}
                            </IonBadge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  </SectionCard>
                </section>
              )}

              <SectionCard
                title="Transfer History"
                subtitle="Audit recent movement between warehouses and stores."
              >
                {transferHistory.length === 0 ? (
                  <EmptyState
                    eyebrow="No transfers yet"
                    title="Warehouse/store transfers will appear here."
                    message="Once stock is moved between locations, the source and destination trail stays visible."
                  />
                ) : (
                  <div className="list-block">
                    {transferHistory.slice(0, 12).map((entry) => {
                      const product = state.products.find((item) => item.id === entry.productId);
                      const from = activeLocations.find((location) => location.id === entry.fromLocationId);
                      const to = activeLocations.find((location) => location.id === entry.toLocationId);

                      return (
                        <div className="list-row" key={entry.transferId}>
                          <div>
                            <strong>{product?.name ?? 'Unknown product'}</strong>
                            <p className="code-label">{entry.referenceNumber ?? entry.outboundMovement.movementNumber}</p>
                            <p>{from?.name ?? 'Unknown source'} → {to?.name ?? 'Unknown destination'}</p>
                            <p className="muted-label">{formatReceiptDate(entry.createdAt)}</p>
                          </div>
                          <div className="right-meta">
                            <strong>{entry.quantity}</strong>
                            <p>{product?.unit ?? 'units'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              {/* REQUEST FORM - For Staff */}
              {selectedProductId && hasPermission('restockRequests.create') && (
                <SectionCard 
                  title="Request Restock" 
                  subtitle={`Request more ${selectedSummary?.product.name ?? 'stock'} for this shop.`}
                >
                  <div className="form-grid">
                    <div className="dual-stat">
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Requested quantity</IonLabel>
                        <IonInput 
                          type="number" 
                          value={restockQty} 
                          placeholder="0"
                          onIonInput={(e) => setRestockQty(e.detail.value === '' ? '' : Number(e.detail.value))} 
                        />
                      </IonItem>
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Urgency</IonLabel>
                        <IonInput 
                          value={urgency} 
                          readonly 
                          onClick={() => {
                            const next: Record<string, 'Low'|'Medium'|'High'> = { 'Low': 'Medium', 'Medium': 'High', 'High': 'Low' };
                            setUrgency(next[urgency]);
                          }} 
                        />
                      </IonItem>
                    </div>
                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Notes (reason for restock)</IonLabel>
                      <IonInput 
                        value={restockNote} 
                        placeholder="e.g. Sudden demand spike"
                        onIonInput={(e) => setRestockNote(e.detail.value ?? '')} 
                      />
                    </IonItem>
                    <IonButton fill="outline" expand="block" onClick={handleRequestRestock}>
                      Submit Request
                    </IonButton>
                    {restockMessage && <p className="form-message">{restockMessage}</p>}
                  </div>
                </SectionCard>
              )}

              {/* ADMIN TASK LIST - Approved items needing physical restock */}
              {hasPermission('restockRequests.manage') && (state.restockRequests ?? []).filter(r => r.status === 'Approved').length > 0 && (
                <SectionCard 
                  title="To-Restock List" 
                  subtitle="These requests are approved. Once the physical stock arrives at the shop, mark them as fulfilled to update inventory."
                >
                  <div className="list-block">
                    {(state.restockRequests ?? [])
                      .filter(r => r.status === 'Approved')
                      .map(req => {
                        const product = state.products.find(p => p.id === req.productId);
                        return (
                          <div className="list-row" key={req.id} style={{ borderLeft: '4px solid var(--ion-color-success)', paddingLeft: '12px' }}>
                            <div>
                              <strong>{req.requestedQuantity} {product?.unit ?? 'units'}</strong>
                              <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{product?.name ?? 'Unknown item'}</p>
                              <p className="muted-label">Approved by {req.reviewedByName} • {formatReceiptDate(req.reviewedAt!)}</p>
                              <IonButton 
                                color="secondary" 
                                size="small" 
                                style={{ marginTop: '8px' }}
                                onClick={() => handleReviewRequest(req.id, 'Fulfilled')}
                              >
                                Mark as Received (Fulfilled)
                              </IonButton>
                            </div>
                            <div className="right-meta">
                              <IonBadge color="success">TO RESTOCK</IonBadge>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </SectionCard>
              )}

              {/* GENERAL LIST / PENDING APPROVALS */}
              <SectionCard 
                title={hasPermission('restockRequests.manage') ? "Review Requests" : "Request History"} 
                subtitle={hasPermission('restockRequests.manage') ? "Manage pending restock requests from the shop floor." : "Track the status of your submitted replenishment requests."}
              >
                {(state.restockRequests ?? []).filter(r => r.status !== 'Approved' || !hasPermission('restockRequests.manage')).length === 0 ? (
                  <EmptyState 
                    eyebrow="Clean queue"
                    title={hasPermission('restockRequests.manage') ? "No pending decisions" : "No requests yet"}
                    message={hasPermission('restockRequests.manage') ? "All restock requests have been approved, rejected, or are currently in the To-Restock list." : "When items run low, submit a request above."}
                  />
                ) : (
                  <div className="list-block">
                    {(state.restockRequests ?? [])
                      .filter(r => r.status !== 'Approved' || !hasPermission('restockRequests.manage'))
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(req => {
                        const product = state.products.find(p => p.id === req.productId);
                        const isPending = req.status === 'Pending';

                        return (
                          <div className="list-row" key={req.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '16px 0' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong>{req.requestedQuantity} {product?.unit ?? 'units'}</strong>
                                <IonBadge color={
                                  req.urgency === 'High' ? 'danger' : 
                                  req.urgency === 'Medium' ? 'warning' : 'primary'
                                } mode="ios">{req.urgency}</IonBadge>
                              </div>
                              <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '4px' }}>{product?.name ?? 'Unknown item'}</p>
                              <p>Requested by: {req.requestedByName}</p>
                              <p className="muted-label">Requested {formatReceiptDate(req.createdAt)}</p>
                              
                              {(req.status === 'Fulfilled' || req.status === 'Rejected') && (
                                <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', fontSize: '0.85rem' }}>
                                  <p><strong>Review Result:</strong> {req.reviewNote || 'No comment'}</p>
                                  <p className="muted-label">By {req.reviewedByName} • {formatReceiptDate(req.reviewedAt!)}</p>
                                </div>
                              )}

                              {isPending && hasPermission('restockRequests.manage') && (
                                <div className="form-grid" style={{ marginTop: '14px' }}>
                                  <IonItem lines="none" className="app-item">
                                    <IonLabel position="stacked">Decision Note (optional)</IonLabel>
                                    <IonInput 
                                      placeholder="e.g. Approving for delivery this Friday"
                                      value={reviewNote}
                                      onIonInput={(e) => setReviewNote(e.detail.value ?? '')}
                                    />
                                  </IonItem>
                                  <div className="dual-stat">
                                    <IonButton color="success" size="small" onClick={() => handleReviewRequest(req.id, 'Approved')}>Approve</IonButton>
                                    <IonButton color="danger" fill="outline" size="small" onClick={() => handleReviewRequest(req.id, 'Rejected')}>Reject</IonButton>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="right-meta">
                              <strong className={
                                req.status === 'Approved' ? 'success-text' : 
                                req.status === 'Rejected' ? 'danger-text' : 
                                req.status === 'Fulfilled' ? 'primary-text' : 'warning-text'
                               } style={{ fontSize: '1.1rem' }}>
                                {req.status}
                              </strong>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </IonContent>
      <IonModal isOpen={!!expandedImage} onDidDismiss={() => setExpandedImage(null)}>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonTitle>{expandedImage?.alt ?? 'Product image'}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen={true}>
          {expandedImage ? (
            <div className="image-viewer-shell">
              <img className="image-viewer-image" src={expandedImage.src} alt={expandedImage.alt} />
              <IonButton fill="outline" onClick={() => setExpandedImage(null)}>
                Close
              </IonButton>
            </div>
          ) : null}
        </IonContent>
      </IonModal>
      <IonModal isOpen={showImportModal} onDidDismiss={closeImportModal}>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonTitle>Bulk Inventory Import</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen={true}>
          <div className="page-shell">
            <SectionCard
              title="CSV preview"
              subtitle={importFileName ? `Review ${importFileName} before creating inventory items.` : 'Upload the BisaPilot inventory template to preview rows before import.'}
            >
              <div className="form-grid">
                <div className="dual-stat">
                  <div className="mini-stat">
                    <p className="muted-label">Template format</p>
                    <h3>CSV</h3>
                  </div>
                  <div className="mini-stat">
                    <p className="muted-label">Valid rows</p>
                    <h3>{importPreview?.validRows.length ?? 0}</h3>
                  </div>
                  <div className="mini-stat">
                    <p className="muted-label">Invalid rows</p>
                    <h3>{importPreview?.invalidRows.length ?? 0}</h3>
                  </div>
                </div>

                {importMessage ? <p className="form-message">{importMessage}</p> : null}

                {!importPreview ? (
                  <EmptyState
                    eyebrow="No file loaded"
                    title="Upload the completed CSV template"
                    message="Download the template, fill it offline in Excel, then upload it here to validate and preview every row before import. Required columns are Item Name, Cost Price, Selling Price, Quantity In Stock, and Reorder Level."
                  />
                ) : (
                  <div className="list-block">
                    {importPreview.rows.map((row) => (
                      <div className="list-row" key={row.rowNumber}>
                        <div>
                          <strong>Row {row.rowNumber}: {row.values['Item Name'] || 'Unnamed item'}</strong>
                          <p className="code-label">{row.values['Inventory ID'] || 'Auto-generate Inventory ID'} • {row.values['Unit'] || 'units'}</p>
                          {row.values['Category'] ? <p className="muted-label">Category: {row.values['Category']}</p> : null}
                          <p>
                            Cost {row.values['Cost Price'] || '—'} • Price {row.values['Selling Price'] || '—'} • Stock {row.values['Quantity In Stock'] || '—'} • Reorder {row.values['Reorder Level'] || '—'}
                          </p>
                          {row.errors.length > 0 ? (
                            <p className="danger-text">{row.errors.join(' ')}</p>
                          ) : (
                            <p className="success-text">Ready to import.</p>
                          )}
                        </div>
                        <div className="right-meta">
                          <IonBadge color={row.errors.length > 0 ? 'danger' : 'success'}>
                            {row.errors.length > 0 ? 'Invalid' : 'Valid'}
                          </IonBadge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="button-group">
                  <IonButton fill="outline" onClick={handleDownloadTemplate}>
                    Download Template
                  </IonButton>
                  <IonButton fill="outline" onClick={() => document.getElementById('inventory-import-input')?.click()}>
                    Upload Another File
                  </IonButton>
                  <IonButton onClick={handleConfirmImport} disabled={!importPreview || importPreview.headerErrors.length > 0 || importPreview.validRows.length === 0 || importPreview.invalidRows.length > 0 || isImporting}>
                    {isImporting ? 'Importing...' : 'Confirm Import'}
                  </IonButton>
                </div>
              </div>
            </SectionCard>
          </div>
        </IonContent>
      </IonModal>
      <IonToast
        isOpen={showSuccessToast}
        message={`${savedItemName} added successfully.`}
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowSuccessToast(false)}
      />
      <IonToast
        isOpen={showRestockSuccess}
        message="Restock request submitted to administrator."
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowRestockSuccess(false)}
      />
      <IonToast
        isOpen={showTransferSuccess}
        message="Stock transfer recorded."
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowTransferSuccess(false)}
      />
      <IonToast
        isOpen={showPurchaseSuccess}
        message="Purchase draft created."
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowPurchaseSuccess(false)}
      />
      <IonToast
        isOpen={showPurchaseReceiptSuccess}
        message="Purchase received into warehouse."
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowPurchaseReceiptSuccess(false)}
      />
      <IonToast
        isOpen={showReviewToast}
        message={reviewMessage}
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowReviewToast(false)}
      />
      <IonToast
        isOpen={showImportToast}
        message={importSummaryMessage}
        duration={2200}
        color="success"
        position="top"
        onDidDismiss={() => setShowImportToast(false)}
      />
    </IonPage>
  );
};

export default InventoryPage;
