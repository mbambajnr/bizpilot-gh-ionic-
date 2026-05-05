import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';
import type { BusinessLocation, BusinessState, LocationSupplyRoute, Product, ProductCategory, Customer, Sale, Expense, StockMovement, TaxSnapshot, WithholdingTaxSnapshot } from './seedBusiness';

type BusinessLocationRow = {
  id: string;
  location_code: string | null;
  name: string;
  type: 'store' | 'warehouse';
  address: string | null;
  manager_name: string | null;
  linked_warehouse_id: string | null;
  is_default: boolean;
  is_active: boolean;
};

type ProductCategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_category_id: string | null;
  sort_order: number;
  is_active: boolean;
};

type LocationSupplyRouteRow = {
  id: string;
  from_location_id: string;
  to_location_id: string;
  is_active: boolean;
};

type CustomerRow = {
  id: string;
  client_id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  channel: string;
  status: string;
  customer_type: 'B2B' | 'B2C' | null;
  tax_exempt: boolean | null;
  tax_exemption_reason: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
};

type QuotationItemRow = {
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  products:
    | {
        id: string;
        name: string;
        inventory_id: string;
      }
    | {
        id: string;
        name: string;
        inventory_id: string;
      }[]
    | null;
};

type QuotationRow = {
  id: string;
  quotation_number: string;
  customer_id: string;
  total_amount: number;
  subtotal_amount: number | null;
  tax_amount: number | null;
  tax_snapshot: TaxSnapshot | null;
  withholding_tax_amount: number | null;
  net_receivable_amount: number | null;
  withholding_tax_snapshot: WithholdingTaxSnapshot | null;
  status: 'draft' | 'open' | 'approved' | 'converted' | 'rejected' | 'expired' | 'cancelled';
  valid_until: string | null;
  rejection_reason: string | null;
  converted_at: string | null;
  converted_invoice_id: string | null;
  customer_type: 'registered' | 'walkIn' | null;
  created_at: string;
  customer_type_snapshot: 'B2B' | 'B2C' | null;
  quotation_items: QuotationItemRow[] | null;
};

type StockMovementRow = {
  id: string;
  movement_number: string;
  product_id: string;
  location_id: string | null;
  movement_type: StockMovement['type'];
  quantity_delta: number;
  quantity_after: number;
  transfer_id: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  invoice_id: string | null;
  reference_number: string | null;
  source_type: StockMovement['sourceType'] | null;
  source_id: string | null;
  vendor_id: string | null;
  vendor_code: string | null;
  from_warehouse_id: string | null;
  to_store_id: string | null;
  performed_by: string | null;
  note: string;
  created_at: string;
};

function mapPaymentMethod(value: string | null | undefined): Sale['paymentMethod'] {
  if (value === 'mobile_money') {
    return 'Mobile Money';
  }

  if (value === 'bank_account') {
    return 'Bank Account';
  }

  return 'Cash';
}

export async function loadFullBusinessDataFromSupabase(businessId: string): Promise<Partial<BusinessState>> {
  if (!hasSupabaseConfig) return {};

  const supabase = getSupabaseClient();

  try {
    const [
      { data: locations },
      { data: products },
      { data: supplyRoutes },
      { data: productCategories },
      { data: customers },
      { data: quotations },
      { data: invoices },
      { data: stockMovements },
      { data: expenses }
    ] = await Promise.all([
      supabase.from('business_locations').select('*').eq('business_id', businessId).order('is_default', { ascending: false }).order('name', { ascending: true }),
      supabase.from('products').select('*').eq('business_id', businessId),
      supabase.from('location_supply_routes').select('*').eq('business_id', businessId),
      supabase.from('product_categories').select('*').eq('business_id', businessId).order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('customers').select('*').eq('business_id', businessId),
      supabase
        .from('quotations')
        .select('id, quotation_number, customer_id, total_amount, subtotal_amount, tax_amount, tax_snapshot, withholding_tax_amount, net_receivable_amount, withholding_tax_snapshot, status, valid_until, rejection_reason, converted_at, converted_invoice_id, customer_type, created_at, customer_type_snapshot, quotation_items(product_id, quantity, unit_price, line_total, products(id, name, inventory_id))')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('business_id', businessId),
      supabase.from('stock_movements').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('business_id', businessId)
    ]);

    const mappedLocations: BusinessLocation[] = ((locations || []) as BusinessLocationRow[]).map((location) => ({
      id: location.id,
      locationCode: location.location_code || undefined,
      name: location.name,
      type: location.type === 'warehouse' ? 'warehouse' : 'store',
      address: location.address || undefined,
      managerName: location.manager_name || undefined,
      linkedWarehouseId: location.linked_warehouse_id || undefined,
      isDefault: location.is_default,
      isActive: location.is_active,
    }));

    const mappedSupplyRoutes: LocationSupplyRoute[] = ((supplyRoutes || []) as LocationSupplyRouteRow[]).map((route) => ({
      id: route.id,
      fromLocationId: route.from_location_id,
      toLocationId: route.to_location_id,
      isActive: route.is_active,
    }));

    const mappedProducts: Product[] = (products || []).map(p => ({
      id: p.id,
      inventoryId: p.inventory_id,
      name: p.name,
      unit: p.unit,
      price: p.price,
      cost: p.cost,
      reorderLevel: p.reorder_level,
      image: p.image_url || '',
      categoryId: p.category_id || undefined,
    }));

    const mappedProductCategories: ProductCategory[] = ((productCategories || []) as ProductCategoryRow[]).map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || undefined,
      parentCategoryId: category.parent_category_id || undefined,
      sortOrder: category.sort_order,
      isActive: category.is_active,
    }));

    const mappedCustomers: Customer[] = ((customers || []) as CustomerRow[]).map(c => ({
      id: c.id,
      clientId: c.client_id,
      name: c.name,
      phone: c.phone || '',
      whatsapp: c.whatsapp || '',
      email: c.email || '',
      channel: c.channel,
      status: c.status === 'terminated' ? 'terminated' : 'active',
      customerType: c.customer_type || undefined,
      taxExempt: c.tax_exempt ?? false,
      taxExemptionReason: c.tax_exemption_reason || undefined,
      terminatedAt: c.terminated_at || undefined,
      terminationReason: c.termination_reason || undefined,
    }));

    const customerMap = new Map(mappedCustomers.map((customer) => [customer.id, customer]));

    const mappedQuotations = ((quotations || []) as QuotationRow[]).map((quotation) => {
      const customer = customerMap.get(quotation.customer_id);

      return {
        id: quotation.id,
        quotationNumber: quotation.quotation_number,
        customerId: quotation.customer_id,
        customerName: customer?.name ?? 'Unknown customer',
        clientId: customer?.clientId ?? 'Unknown client',
        createdAt: quotation.created_at,
        validUntil: quotation.valid_until ?? undefined,
        subtotalAmount: quotation.subtotal_amount ?? undefined,
        taxAmount: quotation.tax_amount ?? undefined,
        withholdingTaxAmount: quotation.withholding_tax_amount ?? undefined,
        netReceivableAmount: quotation.net_receivable_amount ?? undefined,
        totalAmount: quotation.total_amount,
        status: quotation.status,
        rejectionReason: quotation.rejection_reason ?? undefined,
        convertedAt: quotation.converted_at || undefined,
        convertedInvoiceId: quotation.converted_invoice_id || undefined,
        customerType: quotation.customer_type || undefined,
        customerTypeSnapshot: quotation.customer_type_snapshot || undefined,
        taxSnapshot: quotation.tax_snapshot || undefined,
        withholdingTaxSnapshot: quotation.withholding_tax_snapshot || undefined,
        items: (quotation.quotation_items || []).map((item) => {
          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          return {
            productId: item.product_id,
            productName: product?.name ?? 'Unknown product',
            inventoryId: product?.inventory_id ?? 'Unknown inventory ID',
            quantity: item.quantity,
            unitPrice: item.unit_price,
            total: item.line_total,
          };
        }),
      };
    });

    const mappedSales: Sale[] = (invoices || []).map(s => ({
      id: s.id,
      invoiceNumber: s.invoice_number,
      receiptId: s.receipt_number,
      customerId: s.customer_id,
      items: s.items || [], // Multi-item JSONB
      productId: s.product_id, // Legacy fallback
      quantity: s.quantity,     // Legacy fallback
      paymentMethod: mapPaymentMethod(s.payment_method),
      paidAmount: s.paid_amount,
      subtotalAmount: s.subtotal_amount ?? undefined,
      taxAmount: s.tax_amount ?? undefined,
      withholdingTaxAmount: s.withholding_tax_amount ?? undefined,
      netReceivableAmount: s.net_receivable_amount ?? undefined,
      totalAmount: s.total_amount,
      createdAt: s.created_at,
      status: s.status === 'reversed' ? 'Reversed' : 'Completed',
      quotationId: s.quotation_id || undefined,
      customerTypeSnapshot: s.customer_type_snapshot || undefined,
      taxSnapshot: s.tax_snapshot || undefined,
      withholdingTaxSnapshot: s.withholding_tax_snapshot || undefined,
      reversalReason: s.reversal_reason || undefined,
      reversedAt: s.reversed_at || undefined,
      reversedBy: s.reversed_by || undefined
    }));

    const mappedStockMovements: StockMovement[] = ((stockMovements || []) as StockMovementRow[]).map((movement) => ({
      id: movement.id,
      movementNumber: movement.movement_number,
      productId: movement.product_id,
      locationId: movement.location_id || undefined,
      type: movement.movement_type,
      quantityDelta: movement.quantity_delta,
      quantityAfter: movement.quantity_after,
      createdAt: movement.created_at,
      transferId: movement.transfer_id || undefined,
      fromLocationId: movement.from_location_id || undefined,
      toLocationId: movement.to_location_id || undefined,
      relatedSaleId: movement.invoice_id || undefined,
      referenceNumber: movement.reference_number || undefined,
      sourceType: movement.source_type || undefined,
      sourceId: movement.source_id || undefined,
      vendorId: movement.vendor_id || undefined,
      vendorCode: movement.vendor_code || undefined,
      fromWarehouseId: movement.from_warehouse_id || undefined,
      toStoreId: movement.to_store_id || undefined,
      performedBy: movement.performed_by || undefined,
      note: movement.note,
    }));

    const mappedExpenses: Expense[] = (expenses || []).map(e => ({
      id: e.id,
      category: e.category,
      amount: e.amount,
      note: e.note || '',
      createdAt: e.created_at,
      recordedByUserId: e.recorded_by_user_id || '',
      recordedByName: e.recorded_by_name || 'Unknown user'
    }));

    return {
      products: mappedProducts,
      locations: mappedLocations,
      locationSupplyRoutes: mappedSupplyRoutes,
      productCategories: mappedProductCategories,
      customers: mappedCustomers,
      quotations: mappedQuotations,
      sales: mappedSales,
      stockMovements: mappedStockMovements,
      expenses: mappedExpenses
    };
  } catch (err) {
    console.error('[SupabaseLoader] Failed to load business data:', err);
    return {};
  }
}
