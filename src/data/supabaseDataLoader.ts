import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';
import type { AppPermission, AppRole, UserAccessProfile } from '../authz/types';
import type { AccountsPayable, ActivityLogEntry, AppNotification, BusinessLocation, BusinessState, LocationSupplyRoute, Product, ProductCategory, Customer, CreditNote, CustomerRefund, Sale, Expense, Payment, Quotation, RestockRequest, StockMovement, StockTransfer, TaxSnapshot, WithholdingTaxSnapshot, Purchase, Vendor } from './seedBusiness';

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

type VendorRow = {
  id: string;
  vendor_code: string;
  name: string;
  contact_email: string | null;
  location: string;
  status: Vendor['status'];
  created_at: string;
  updated_at: string;
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
  customer_id: string | null;
  prospect_details: Quotation['prospect'] | null;
  prospect_converted_at: string | null;
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
  client_purchase_orders: Quotation['clientPurchaseOrders'] | null;
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

type CreditNoteRow = {
  id: string; credit_note_number: string; invoice_id: string; invoice_number: string; customer_id: string;
  subtotal_amount: number; tax_amount: number; total_amount: number; receivable_credit_amount: number;
  reason: string; status: CreditNote['status']; issued_by: string; approved_by: string; created_at: string;
  credit_note_items: Array<{
    product_id: string; product_name: string; inventory_id: string; quantity: number; unit_price: number;
    subtotal_amount: number; credit_amount: number; disposition: CreditNote['items'][number]['disposition']; location_id: string | null;
  }> | null;
};

type CustomerRefundRow = {
  id: string; refund_number: string; credit_note_id: string; invoice_id: string; customer_id: string; amount: number;
  method: CustomerRefund['method']; reference: string | null; status: CustomerRefund['status']; processed_by: string;
  approved_by: string; created_at: string;
};

type EmployeeCredentialRow = {
  id: string;
  business_id: string;
  name: string;
  email: string;
  username: string;
  temporary_password: string | null;
  requires_password_change: boolean | null;
  credentials_generated_at: string | null;
  account_status: 'active' | 'deactivated';
  deactivated_at: string | null;
  role: AppRole;
  role_label: string | null;
  granted_permissions: AppPermission[] | null;
  revoked_permissions: AppPermission[] | null;
  customer_email_sender_name: string | null;
  customer_email_sender_email: string | null;
};

type PurchaseItemRow = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  vendor_code: string;
};

type PurchaseRow = {
  id: string;
  purchase_code: string;
  vendor_id: string;
  vendor_code: string;
  total_amount: number;
  status: Purchase['status'];
  created_by: string;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  declined_by: string | null;
  declined_at: string | null;
  decline_note: string | null;
  received_warehouse_id: string | null;
  receipts: Purchase['receipts'] | null;
  supplier_invoice_number: string | null;
  supplier_invoice_amount: number | null;
  supplier_invoice_date: string | null;
  supplier_invoice_recorded_by: string | null;
  supplier_invoice_recorded_at: string | null;
  three_way_match_status: Purchase['threeWayMatchStatus'] | null;
  three_way_match_variance: number | null;
  expected_delivery_date: string | null;
  payment_terms: string | null;
  internal_notes: string | null;
  procurement_documents: Purchase['documents'] | null;
  created_at: string;
  updated_at: string;
  purchase_items: PurchaseItemRow[] | null;
};

type AuditEventRow = {
  id: string;
  activity_number: string;
  entity_type: ActivityLogEntry['entityType'];
  entity_id: string;
  action_type: ActivityLogEntry['actionType'];
  title: string;
  detail: string;
  status: ActivityLogEntry['status'];
  reference_number: string | null;
  related_entity_id: string | null;
  related_sale_id: string | null;
  created_at: string;
};

type AppNotificationRow = {
  id: string;
  title: string;
  message: string;
  recipient_user_ids: string[] | null;
  recipient_roles: AppNotification['recipientRoles'] | null;
  entity_type: AppNotification['entityType'];
  entity_id: string;
  reference_number: string | null;
  action_url: string | null;
  created_at: string;
  app_notification_reads?: Array<{
    user_id: string;
  }> | null;
};

type AccountsPayableRow = {
  id: string;
  payable_code: string;
  vendor_id: string;
  vendor_code: string;
  purchase_id: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date: string | null;
  status: AccountsPayable['status'];
  payment_method: AccountsPayable['paymentMethod'] | null;
  payment_reference: string | null;
  created_by: string | null;
  approved_by: string | null;
  paid_by: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

type PaymentRow = {
  id: string;
  payment_code: string;
  source_type: Payment['sourceType'];
  source_id: string;
  amount: number;
  method: Payment['method'];
  reference: string | null;
  recorded_by: string;
  created_at: string;
};

type StockTransferItemRow = {
  product_id: string;
  product_name: string;
  quantity: number;
};

type StockTransferRow = {
  id: string;
  transfer_code: string;
  from_warehouse_id: string;
  to_store_id: string;
  status: StockTransfer['status'];
  initiated_by: string;
  approved_by: string | null;
  dispatched_by: string | null;
  received_by: string | null;
  created_at: string;
  approved_at: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  stock_transfer_items: StockTransferItemRow[] | null;
};

type RestockRequestRow = {
  id: string;
  product_id: string;
  product_name: string;
  requested_by_user_id: string;
  requested_by_name: string;
  current_quantity: number;
  requested_quantity: number;
  urgency: RestockRequest['urgency'];
  note: string | null;
  status: RestockRequest['status'];
  created_at: string;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  reviewed_by_name: string | null;
  review_note: string | null;
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
      { data: vendors },
      { data: quotations },
      { data: invoices },
      { data: purchases },
      { data: stockMovements },
      { data: expenses },
      { data: employeeCredentials },
      { data: auditEvents },
      { data: appNotifications },
      { data: accountsPayable },
      { data: payments },
      { data: stockTransfers },
      { data: restockRequests },
      { data: creditNotes },
      { data: customerRefunds }
    ] = await Promise.all([
      supabase.from('business_locations').select('*').eq('business_id', businessId).order('is_default', { ascending: false }).order('name', { ascending: true }),
      supabase.from('products').select('*').eq('business_id', businessId),
      supabase.from('location_supply_routes').select('*').eq('business_id', businessId),
      supabase.from('product_categories').select('*').eq('business_id', businessId).order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('customers').select('*').eq('business_id', businessId),
      supabase.from('vendors').select('*').eq('business_id', businessId).order('name', { ascending: true }),
      supabase
        .from('quotations')
        .select('id, quotation_number, customer_id, prospect_details, prospect_converted_at, total_amount, subtotal_amount, tax_amount, tax_snapshot, withholding_tax_amount, net_receivable_amount, withholding_tax_snapshot, status, valid_until, rejection_reason, converted_at, converted_invoice_id, customer_type, created_at, customer_type_snapshot, client_purchase_orders, quotation_items(product_id, quantity, unit_price, line_total, products(id, name, inventory_id))')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('business_id', businessId),
      supabase
        .from('purchases')
        .select('id, purchase_code, vendor_id, vendor_code, total_amount, status, created_by, submitted_at, approved_by, approved_at, declined_by, declined_at, decline_note, received_warehouse_id, created_at, updated_at, purchase_items(product_id, product_name, quantity, unit_cost, total_cost, vendor_code)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase.from('stock_movements').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('business_id', businessId),
      supabase.from('employee_credentials').select('*').eq('business_id', businessId),
      supabase.from('business_audit_events').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
      supabase
        .from('app_notifications')
        .select('*, app_notification_reads(user_id)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase.from('accounts_payable').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
      supabase
        .from('stock_transfers')
        .select('*, stock_transfer_items(product_id, product_name, quantity)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase.from('restock_requests').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
      supabase.from('credit_notes').select('*, credit_note_items(*)').eq('business_id', businessId).order('created_at', { ascending: false }),
      supabase.from('customer_refunds').select('*').eq('business_id', businessId).order('created_at', { ascending: false })
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
      image: p.image || p.image_url || '',
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

    const mappedVendors: Vendor[] = ((vendors || []) as VendorRow[]).map((vendor) => ({
      id: vendor.id,
      vendorCode: vendor.vendor_code,
      name: vendor.name,
      contactEmail: vendor.contact_email ?? undefined,
      location: vendor.location,
      status: vendor.status,
      createdAt: vendor.created_at,
      updatedAt: vendor.updated_at,
    }));

    const customerMap = new Map(mappedCustomers.map((customer) => [customer.id, customer]));

    const mappedQuotations = ((quotations || []) as QuotationRow[]).map((quotation) => {
      const customer = quotation.customer_id ? customerMap.get(quotation.customer_id) : undefined;

      return {
        id: quotation.id,
        quotationNumber: quotation.quotation_number,
        customerId: quotation.customer_id ?? undefined,
        customerName: customer?.name ?? quotation.prospect_details?.name ?? 'Unknown customer',
        clientId: customer?.clientId ?? (quotation.prospect_details ? 'PROSPECT' : 'Unknown client'),
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
        prospect: quotation.prospect_details || undefined,
        prospectConvertedAt: quotation.prospect_converted_at || undefined,
        customerTypeSnapshot: quotation.customer_type_snapshot || undefined,
        clientPurchaseOrders: quotation.client_purchase_orders ?? [],
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
      customerId: s.customer_id || undefined,
      customerSnapshot: s.customer_snapshot || undefined,
      clientPoNumber: s.client_po_number || undefined,
      clientPoDocument: s.client_po_document || undefined,
      items: s.items || [], // Multi-item JSONB
      productId: s.product_id, // Legacy fallback
      quantity: s.quantity,     // Legacy fallback
      paymentMethod: mapPaymentMethod(s.payment_method),
      paymentReference: s.payment_reference || undefined,
      paidAmount: s.paid_amount,
      creditedAmount: s.credited_amount ?? 0,
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

    const mappedCreditNotes: CreditNote[] = ((creditNotes || []) as CreditNoteRow[]).map((note) => ({
      id: note.id, creditNoteNumber: note.credit_note_number, saleId: note.invoice_id, invoiceNumber: note.invoice_number,
      customerId: note.customer_id, subtotalAmount: note.subtotal_amount, taxAmount: note.tax_amount, totalAmount: note.total_amount,
      receivableCreditAmount: note.receivable_credit_amount, reason: note.reason, status: note.status, issuedBy: note.issued_by,
      approvedBy: note.approved_by, createdAt: note.created_at,
      items: (note.credit_note_items ?? []).map((item) => ({
        productId: item.product_id, productName: item.product_name, inventoryId: item.inventory_id, quantity: item.quantity,
        unitPrice: item.unit_price, subtotalAmount: item.subtotal_amount, creditAmount: item.credit_amount,
        disposition: item.disposition, locationId: item.location_id ?? undefined,
      })),
    }));
    const mappedCustomerRefunds: CustomerRefund[] = ((customerRefunds || []) as CustomerRefundRow[]).map((refund) => ({
      id: refund.id, refundNumber: refund.refund_number, creditNoteId: refund.credit_note_id, saleId: refund.invoice_id,
      customerId: refund.customer_id, amount: refund.amount, method: refund.method, reference: refund.reference ?? undefined,
      status: refund.status, processedBy: refund.processed_by, approvedBy: refund.approved_by, createdAt: refund.created_at,
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

    const mappedPurchases: Purchase[] = ((purchases || []) as PurchaseRow[]).map((purchase) => ({
      id: purchase.id,
      purchaseCode: purchase.purchase_code,
      vendorId: purchase.vendor_id,
      vendorCode: purchase.vendor_code,
      items: (purchase.purchase_items ?? []).map((item) => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitCost: item.unit_cost,
        totalCost: item.total_cost,
        vendorCode: item.vendor_code,
      })),
      totalAmount: purchase.total_amount,
      status: purchase.status,
      createdBy: purchase.created_by,
      submittedAt: purchase.submitted_at ?? undefined,
      approvedBy: purchase.approved_by ?? undefined,
      approvedAt: purchase.approved_at ?? undefined,
      declinedBy: purchase.declined_by ?? undefined,
      declinedAt: purchase.declined_at ?? undefined,
      declineNote: purchase.decline_note ?? undefined,
      receivedWarehouseId: purchase.received_warehouse_id ?? undefined,
      receipts: (purchase.receipts ?? []).map((receipt, receiptIndex) => ({
        ...receipt,
        receiptNumber: receipt.receiptNumber ?? `GRN-${purchase.purchase_code}-${String(receiptIndex + 1).padStart(2, '0')}`,
        status: receipt.status ?? 'accepted',
        items: receipt.items.map((item) => ({
          ...item,
          acceptedQuantity: item.acceptedQuantity ?? item.quantity,
          quarantinedQuantity: item.quarantinedQuantity ?? 0,
          rejectedQuantity: item.rejectedQuantity ?? 0,
        })),
      })),
      supplierInvoiceNumber: purchase.supplier_invoice_number ?? undefined,
      supplierInvoiceAmount: purchase.supplier_invoice_amount ?? undefined,
      supplierInvoiceDate: purchase.supplier_invoice_date ?? undefined,
      supplierInvoiceRecordedBy: purchase.supplier_invoice_recorded_by ?? undefined,
      supplierInvoiceRecordedAt: purchase.supplier_invoice_recorded_at ?? undefined,
      threeWayMatchStatus: purchase.three_way_match_status ?? 'pending',
      threeWayMatchVariance: purchase.three_way_match_variance ?? undefined,
      expectedDeliveryDate: purchase.expected_delivery_date ?? undefined,
      paymentTerms: purchase.payment_terms ?? undefined,
      internalNotes: purchase.internal_notes ?? undefined,
      documents: purchase.procurement_documents ?? [],
      createdAt: purchase.created_at,
      updatedAt: purchase.updated_at,
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

    const mappedUsers: UserAccessProfile[] = ((employeeCredentials || []) as EmployeeCredentialRow[]).map((employee) => ({
      userId: employee.id,
      businessId: employee.business_id,
      name: employee.name,
      email: employee.email,
      username: employee.username,
      // Do not hydrate plaintext temporary passwords into the general app state.
      // Employee sign-in should rely on the RPC/auth flow instead of broad password reads.
      temporaryPassword: undefined,
      passwordChangeRequired: employee.requires_password_change ?? false,
      credentialsGeneratedAt: employee.credentials_generated_at ?? undefined,
      accountStatus: employee.account_status ?? 'active',
      deactivatedAt: employee.deactivated_at ?? undefined,
      role: employee.role,
      roleLabel: employee.role_label ?? undefined,
      grantedPermissions: employee.granted_permissions ?? [],
      revokedPermissions: employee.revoked_permissions ?? [],
      customerEmailSenderName: employee.customer_email_sender_name ?? undefined,
      customerEmailSenderEmail: employee.customer_email_sender_email ?? undefined,
    }));

    const mappedAuditEvents: ActivityLogEntry[] = ((auditEvents || []) as AuditEventRow[]).map((event) => ({
      id: event.id,
      activityNumber: event.activity_number,
      entityType: event.entity_type,
      entityId: event.entity_id,
      actionType: event.action_type,
      title: event.title,
      detail: event.detail,
      status: event.status,
      createdAt: event.created_at,
      referenceNumber: event.reference_number ?? undefined,
      relatedEntityId: event.related_entity_id ?? undefined,
      relatedSaleId: event.related_sale_id ?? undefined,
    }));

    const mappedNotifications: AppNotification[] = ((appNotifications || []) as AppNotificationRow[]).map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      createdAt: notification.created_at,
      recipientUserIds: notification.recipient_user_ids ?? undefined,
      recipientRoles: notification.recipient_roles ?? undefined,
      readByUserIds: (notification.app_notification_reads ?? []).map((read) => read.user_id),
      entityType: notification.entity_type,
      entityId: notification.entity_id,
      referenceNumber: notification.reference_number ?? undefined,
      actionUrl: notification.action_url ?? undefined,
    }));

    const mappedAccountsPayable: AccountsPayable[] = ((accountsPayable || []) as AccountsPayableRow[]).map((payable) => ({
      id: payable.id,
      payableCode: payable.payable_code,
      vendorId: payable.vendor_id,
      vendorCode: payable.vendor_code,
      purchaseId: payable.purchase_id,
      amountDue: payable.amount_due,
      amountPaid: payable.amount_paid,
      balance: payable.balance,
      dueDate: payable.due_date ?? undefined,
      status: payable.status,
      paymentMethod: payable.payment_method ?? undefined,
      paymentReference: payable.payment_reference ?? undefined,
      createdBy: payable.created_by ?? undefined,
      approvedBy: payable.approved_by ?? undefined,
      paidBy: payable.paid_by ?? undefined,
      createdAt: payable.created_at,
      updatedAt: payable.updated_at,
      paidAt: payable.paid_at ?? undefined,
    }));

    const mappedPayments: Payment[] = ((payments || []) as PaymentRow[]).map((payment) => ({
      id: payment.id,
      paymentCode: payment.payment_code,
      sourceType: payment.source_type,
      sourceId: payment.source_id,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference ?? undefined,
      recordedBy: payment.recorded_by,
      createdAt: payment.created_at,
    }));

    const mappedStockTransfers: StockTransfer[] = ((stockTransfers || []) as StockTransferRow[]).map((transfer) => ({
      id: transfer.id,
      transferCode: transfer.transfer_code,
      fromWarehouseId: transfer.from_warehouse_id,
      toStoreId: transfer.to_store_id,
      items: (transfer.stock_transfer_items ?? []).map((item) => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
      })),
      status: transfer.status,
      initiatedBy: transfer.initiated_by,
      approvedBy: transfer.approved_by ?? undefined,
      dispatchedBy: transfer.dispatched_by ?? undefined,
      receivedBy: transfer.received_by ?? undefined,
      createdAt: transfer.created_at,
      approvedAt: transfer.approved_at ?? undefined,
      dispatchedAt: transfer.dispatched_at ?? undefined,
      receivedAt: transfer.received_at ?? undefined,
      cancelledAt: transfer.cancelled_at ?? undefined,
    }));

    const mappedRestockRequests: RestockRequest[] = ((restockRequests || []) as RestockRequestRow[]).map((request) => ({
      id: request.id,
      productId: request.product_id,
      productName: request.product_name,
      requestedByUserId: request.requested_by_user_id,
      requestedByName: request.requested_by_name,
      currentQuantity: request.current_quantity,
      requestedQuantity: request.requested_quantity,
      urgency: request.urgency,
      note: request.note ?? undefined,
      status: request.status,
      createdAt: request.created_at,
      reviewedAt: request.reviewed_at ?? undefined,
      reviewedByUserId: request.reviewed_by_user_id ?? undefined,
      reviewedByName: request.reviewed_by_name ?? undefined,
      reviewNote: request.review_note ?? undefined,
    }));

    return {
      products: mappedProducts,
      locations: mappedLocations,
      locationSupplyRoutes: mappedSupplyRoutes,
      productCategories: mappedProductCategories,
      customers: mappedCustomers,
      vendors: mappedVendors,
      quotations: mappedQuotations,
      sales: mappedSales,
      creditNotes: mappedCreditNotes,
      customerRefunds: mappedCustomerRefunds,
      purchases: mappedPurchases,
      accountsPayable: mappedAccountsPayable,
      payments: mappedPayments,
      stockTransfers: mappedStockTransfers,
      stockMovements: mappedStockMovements,
      expenses: mappedExpenses,
      activityLogEntries: mappedAuditEvents,
      notifications: mappedNotifications,
      users: mappedUsers,
      restockRequests: mappedRestockRequests
    };
  } catch (err) {
    console.error('[SupabaseLoader] Failed to load business data:', err);
    return {};
  }
}
