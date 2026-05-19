import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';
import type { UserAccessProfile } from '../authz/types';
import type { ActivityLogEntry, AppNotification, BusinessLocation, LocationSupplyRoute, Product, ProductCategory, Customer, Sale, Expense, BusinessProfile, Quotation, StockMovement, Purchase } from './seedBusiness';

let lastSupabaseSyncErrorMessage: string | null = null;

function setLastSupabaseSyncErrorMessage(message: string | null) {
  lastSupabaseSyncErrorMessage = message;
}

export function getLastSupabaseSyncErrorMessage() {
  return lastSupabaseSyncErrorMessage;
}

export function formatSupabaseSyncErrorMessage(rawMessage: string) {
  const missingColumnMatch = rawMessage.match(/Could not find the '([^']+)' column of '([^']+)' in the schema cache/i);
  if (missingColumnMatch) {
    const [, column, table] = missingColumnMatch;
    return `Supabase schema is missing ${table}.${column}. Apply the latest database migrations, then try again.`;
  }

  const missingRelationMatch = rawMessage.match(/relation ['"]?([^'"]+)['"]? does not exist/i);
  if (missingRelationMatch) {
    const [, relation] = missingRelationMatch;
    return `Supabase table ${relation} is missing. Apply the latest database migrations, then try again.`;
  }

  if (/row-level security/i.test(rawMessage)) {
    return 'Supabase denied this save. Check that the signed-in user owns this business and that the latest RLS policies are applied.';
  }

  if (/invalid input syntax for type uuid/i.test(rawMessage)) {
    return 'Supabase rejected this save because one of the IDs is not a valid UUID. Refresh into the real cloud workspace or apply the latest migrations before trying again.';
  }

  return rawMessage;
}

function extractMissingSchemaColumn(rawMessage: string, table: string) {
  const match = rawMessage.match(/Could not find the '([^']+)' column of '([^']+)' in the schema cache/i);
  if (!match) {
    return null;
  }

  const [, column, matchedTable] = match;
  if (matchedTable !== table) {
    return null;
  }

  return column;
}

function mapPaymentMethodForSync(paymentMethod: Sale['paymentMethod']) {
  if (paymentMethod === 'Mobile Money') {
    return 'mobile_money';
  }

  if (paymentMethod === 'Bank Account') {
    return 'bank_account';
  }

  return 'cash';
}

/**
 * Generic sync helper for BizPilot entities.
 * Follows an 'upsert' pattern (ID-based insert or update).
 * Returns true if sync successful or skipped (no config), false on error.
 */
async function upsertEntity(table: string, payload: Record<string, unknown>, onConflict = 'id'): Promise<boolean> {
  if (!hasSupabaseConfig) return true;

  try {
    const supabase = getSupabaseClient();
    const nextPayload = { ...payload };

    while (true) {
      const response = await supabase.from(table).upsert(nextPayload, { onConflict });
      const error = response?.error ?? null;

      if (!error) {
        setLastSupabaseSyncErrorMessage(null);
        return true;
      }

      const missingColumn = extractMissingSchemaColumn(error.message, table);
      if (missingColumn && missingColumn in nextPayload) {
        delete nextPayload[missingColumn];
        continue;
      }

      setLastSupabaseSyncErrorMessage(formatSupabaseSyncErrorMessage(error.message));
      console.error(`[SupabaseSync] Error upserting to ${table}:`, error.message);
      return false;
    }
  } catch (err) {
    setLastSupabaseSyncErrorMessage('Supabase sync failed before the request could complete.');
    console.error(`[SupabaseSync] Fatal error in ${table} sync:`, err);
    return false;
  }
}

export async function syncProduct(businessId: string, product: Product) {
  return upsertEntity('products', {
    id: product.id,
    business_id: businessId,
    name: product.name,
    unit: product.unit,
    price: product.price,
    cost: product.cost,
    reorder_level: product.reorderLevel,
    inventory_id: product.inventoryId,
    image_url: product.image,
    // The database now enforces that any category_id must belong to this same business_id.
    category_id: product.categoryId ?? null,
  });
}

export async function syncProductCategory(businessId: string, category: ProductCategory) {
  return upsertEntity('product_categories', {
    id: category.id,
    business_id: businessId,
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    parent_category_id: category.parentCategoryId ?? null,
    sort_order: category.sortOrder,
    is_active: category.isActive,
  });
}

export async function syncBusinessLocation(businessId: string, location: BusinessLocation) {
  return upsertEntity('business_locations', {
    id: location.id,
    business_id: businessId,
    location_code: location.locationCode ?? null,
    name: location.name,
    type: location.type,
    address: location.address ?? null,
    manager_name: location.managerName ?? null,
    linked_warehouse_id: location.linkedWarehouseId ?? null,
    is_default: location.isDefault,
    is_active: location.isActive,
  });
}

export async function syncEmployeeCredential(businessId: string, user: UserAccessProfile) {
  if (!hasSupabaseConfig) return true;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('upsert_employee_credential', {
      credential_user_id: user.userId,
      credential_business_id: businessId,
      credential_name: user.name,
      credential_email: user.email,
      credential_username: user.username ?? user.email,
      credential_password: user.temporaryPassword ?? null,
      credential_requires_password_change: user.passwordChangeRequired ?? Boolean(user.temporaryPassword),
      credential_generated_at: user.credentialsGeneratedAt ?? null,
      credential_account_status: user.accountStatus ?? 'active',
      credential_deactivated_at: user.deactivatedAt ?? null,
      credential_role: user.role,
      credential_role_label: user.roleLabel ?? null,
      credential_granted_permissions: user.grantedPermissions ?? [],
      credential_revoked_permissions: user.revokedPermissions ?? [],
      credential_customer_email_sender_name: user.customerEmailSenderName ?? null,
      credential_customer_email_sender_email: user.customerEmailSenderEmail ?? null,
    });

    if (error) {
      setLastSupabaseSyncErrorMessage(formatSupabaseSyncErrorMessage(error.message));
      console.error('[SupabaseSync] Error syncing employee credential:', error.message);
      return false;
    }

    setLastSupabaseSyncErrorMessage(null);
    return true;
  } catch (err) {
    setLastSupabaseSyncErrorMessage('Employee credential sync failed before the request could complete.');
    console.error('[SupabaseSync] Fatal error syncing employee credential:', err);
    return false;
  }
}

type EmployeeCredentialVerificationRow = {
  id: string;
  business_id: string;
};

type EmployeeCredentialRotationRow = {
  id: string;
  business_id: string;
  email: string;
  username: string;
  credentials_generated_at: string | null;
};

export async function verifyEmployeeCredential(businessId: string, user: UserAccessProfile) {
  if (!hasSupabaseConfig) return true;

  if (!user.temporaryPassword) {
    setLastSupabaseSyncErrorMessage('Employee credential verification is missing the temporary password.');
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('authenticate_employee_credential', {
      credential_identifier: user.username ?? user.email,
      credential_password: user.temporaryPassword,
    });

    if (error) {
      setLastSupabaseSyncErrorMessage(formatSupabaseSyncErrorMessage(error.message));
      console.error('[SupabaseSync] Error verifying employee credential:', error.message);
      return false;
    }

    const matchesCredential = ((data ?? []) as EmployeeCredentialVerificationRow[]).some(
      (row) => row.id === user.userId && row.business_id === businessId
    );

    if (!matchesCredential) {
      setLastSupabaseSyncErrorMessage('Temporary password could not be confirmed by sign-in verification yet.');
      return false;
    }

    setLastSupabaseSyncErrorMessage(null);
    return true;
  } catch (err) {
    setLastSupabaseSyncErrorMessage('Employee credential verification failed before the request could complete.');
    console.error('[SupabaseSync] Fatal error in employee credential verification:', err);
    return false;
  }
}

export async function rotateEmployeePassword(user: UserAccessProfile, currentPassword: string, nextPassword: string) {
  if (!hasSupabaseConfig) {
    setLastSupabaseSyncErrorMessage('Supabase is not configured for employee password updates.');
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    // TODO(security): This RPC still depends on plaintext credential comparison.
    // Keep it only until employee sign-in moves to hashed verification or Supabase Auth.
    const { data, error } = await supabase.rpc('rotate_employee_credential_password', {
      credential_identifier: user.username ?? user.email,
      current_password: currentPassword.trim(),
      next_password: nextPassword.trim(),
    });

    if (error) {
      setLastSupabaseSyncErrorMessage(formatSupabaseSyncErrorMessage(error.message));
      console.error('[SupabaseSync] Error rotating employee password:', error.message);
      return false;
    }

    const [row] = (data ?? []) as EmployeeCredentialRotationRow[];
    if (!row || row.id !== user.userId || row.business_id !== user.businessId) {
      setLastSupabaseSyncErrorMessage('We could not confirm the current password for this employee account.');
      return false;
    }

    setLastSupabaseSyncErrorMessage(null);
    return true;
  } catch (err) {
    setLastSupabaseSyncErrorMessage('Employee password update failed before the request could complete.');
    console.error('[SupabaseSync] Fatal error rotating employee password:', err);
    return false;
  }
}

export async function syncSupplyRoute(businessId: string, route: LocationSupplyRoute) {
  return upsertEntity('location_supply_routes', {
    id: route.id,
    business_id: businessId,
    from_location_id: route.fromLocationId,
    to_location_id: route.toLocationId,
    is_active: route.isActive,
  });
}

export async function syncPurchase(businessId: string, purchase: Purchase) {
  if (!hasSupabaseConfig) return true;

  const purchaseOk = await upsertEntity('purchases', {
    id: purchase.id,
    business_id: businessId,
    purchase_code: purchase.purchaseCode,
    vendor_id: purchase.vendorId,
    vendor_code: purchase.vendorCode,
    total_amount: purchase.totalAmount,
    status: purchase.status,
    created_by: purchase.createdBy,
    submitted_at: purchase.submittedAt ?? null,
    approved_by: purchase.approvedBy ?? null,
    approved_at: purchase.approvedAt ?? null,
    declined_by: purchase.declinedBy ?? null,
    declined_at: purchase.declinedAt ?? null,
    decline_note: purchase.declineNote ?? null,
    received_warehouse_id: purchase.receivedWarehouseId ?? null,
    created_at: purchase.createdAt,
    updated_at: purchase.updatedAt,
  });

  if (!purchaseOk) {
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    const { error: deleteError } = await supabase.from('purchase_items').delete().eq('purchase_id', purchase.id);

    if (deleteError) {
      setLastSupabaseSyncErrorMessage(formatSupabaseSyncErrorMessage(deleteError.message));
      console.error('[SupabaseSync] Error replacing purchase items:', deleteError.message);
      return false;
    }

    if (purchase.items.length === 0) {
      setLastSupabaseSyncErrorMessage(null);
      return true;
    }

    const { error: insertError } = await supabase.from('purchase_items').insert(
      purchase.items.map((item) => ({
        purchase_id: purchase.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        total_cost: item.totalCost,
        vendor_code: item.vendorCode,
      }))
    );

    if (insertError) {
      setLastSupabaseSyncErrorMessage(formatSupabaseSyncErrorMessage(insertError.message));
      console.error('[SupabaseSync] Error inserting purchase items:', insertError.message);
      return false;
    }

    setLastSupabaseSyncErrorMessage(null);
    return true;
  } catch (err) {
    setLastSupabaseSyncErrorMessage('Supabase sync failed before the request could complete.');
    console.error('[SupabaseSync] Fatal error in purchase item sync:', err);
    return false;
  }
}

export async function syncEmployeePurchase(user: UserAccessProfile, purchase: Purchase) {
  if (!hasSupabaseConfig) return true;
  const credentialPassword = user.employeeSessionSecret;
  if (!user.businessId || !credentialPassword) {
    setLastSupabaseSyncErrorMessage('Employee purchase sync requires a fresh cloud employee sign-in.');
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('sync_employee_purchase', {
      credential_identifier: user.username ?? user.email,
      credential_password: credentialPassword,
      purchase_payload: {
        id: purchase.id,
        purchaseCode: purchase.purchaseCode,
        vendorId: purchase.vendorId,
        vendorCode: purchase.vendorCode,
        items: purchase.items,
        totalAmount: purchase.totalAmount,
        status: purchase.status,
        createdBy: purchase.createdBy,
        submittedAt: purchase.submittedAt ?? null,
        approvedBy: purchase.approvedBy ?? null,
        approvedAt: purchase.approvedAt ?? null,
        declinedBy: purchase.declinedBy ?? null,
        declinedAt: purchase.declinedAt ?? null,
        declineNote: purchase.declineNote ?? null,
        receivedWarehouseId: purchase.receivedWarehouseId ?? null,
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt,
      },
    });

    if (error) {
      setLastSupabaseSyncErrorMessage(formatSupabaseSyncErrorMessage(error.message));
      console.error('[SupabaseSync] Error syncing employee purchase:', error.message);
      return false;
    }

    setLastSupabaseSyncErrorMessage(null);
    return true;
  } catch (err) {
    setLastSupabaseSyncErrorMessage('Supabase sync failed before the request could complete.');
    console.error('[SupabaseSync] Fatal error in employee purchase sync:', err);
    return false;
  }
}

export async function syncActivityLogEntry(businessId: string, entry: ActivityLogEntry) {
  return upsertEntity('business_audit_events', {
    id: entry.id,
    business_id: businessId,
    activity_number: entry.activityNumber,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action_type: entry.actionType,
    title: entry.title,
    detail: entry.detail,
    status: entry.status,
    reference_number: entry.referenceNumber ?? null,
    related_entity_id: entry.relatedEntityId ?? null,
    related_sale_id: entry.relatedSaleId ?? null,
    created_at: entry.createdAt,
  });
}

export async function syncAppNotification(businessId: string, notification: AppNotification) {
  return upsertEntity('app_notifications', {
    id: notification.id,
    business_id: businessId,
    title: notification.title,
    message: notification.message,
    recipient_user_ids: notification.recipientUserIds ?? [],
    recipient_roles: notification.recipientRoles ?? [],
    entity_type: notification.entityType,
    entity_id: notification.entityId,
    reference_number: notification.referenceNumber ?? null,
    action_url: notification.actionUrl ?? null,
    created_at: notification.createdAt,
  });
}

export async function syncAppNotificationRead(
  businessId: string,
  notificationId: string,
  userId: string,
  readAt = new Date().toISOString()
) {
  return upsertEntity('app_notification_reads', {
    notification_id: notificationId,
    business_id: businessId,
    user_id: userId,
    read_at: readAt,
  }, 'notification_id,user_id');
}

export async function syncStockMovement(businessId: string, movement: StockMovement) {
  return upsertEntity('stock_movements', {
    id: movement.id,
    business_id: businessId,
    movement_number: movement.movementNumber,
    product_id: movement.productId,
    location_id: movement.locationId ?? null,
    movement_type: movement.type,
    quantity_delta: movement.quantityDelta,
    quantity_after: movement.quantityAfter,
    transfer_id: movement.transferId ?? null,
    from_location_id: movement.fromLocationId ?? null,
    to_location_id: movement.toLocationId ?? null,
    invoice_id: movement.relatedSaleId ?? null,
    reference_number: movement.referenceNumber ?? null,
    source_type: movement.sourceType ?? null,
    source_id: movement.sourceId ?? null,
    vendor_id: movement.vendorId ?? null,
    vendor_code: movement.vendorCode ?? null,
    from_warehouse_id: movement.fromWarehouseId ?? null,
    to_store_id: movement.toStoreId ?? null,
    performed_by: movement.performedBy ?? null,
    note: movement.note,
    created_at: movement.createdAt,
  });
}

export async function syncCustomer(businessId: string, customer: Customer) {
  return upsertEntity('customers', {
    id: customer.id,
    business_id: businessId,
    name: customer.name,
    phone: customer.phone,
    whatsapp: customer.whatsapp,
    email: customer.email,
    channel: customer.channel,
    client_id: customer.clientId,
    status: customer.status,
    customer_type: customer.customerType ?? null,
    tax_exempt: customer.taxExempt ?? false,
    tax_exemption_reason: customer.taxExemptionReason ?? null,
    terminated_at: customer.terminatedAt,
    termination_reason: customer.terminationReason,
  });
}

export async function syncQuotation(businessId: string, quotation: Quotation) {
  if (!hasSupabaseConfig) return true;

  const quotationOk = await upsertEntity('quotations', {
    id: quotation.id,
    business_id: businessId,
    quotation_number: quotation.quotationNumber,
    customer_id: quotation.customerId,
    total_amount: quotation.totalAmount,
    subtotal_amount: quotation.subtotalAmount ?? null,
    tax_amount: quotation.taxAmount ?? null,
    tax_snapshot: quotation.taxSnapshot ?? null,
    withholding_tax_amount: quotation.withholdingTaxAmount ?? null,
    net_receivable_amount: quotation.netReceivableAmount ?? null,
    withholding_tax_snapshot: quotation.withholdingTaxSnapshot ?? null,
    status: quotation.status.toLowerCase(),
    valid_until: quotation.validUntil ?? null,
    rejection_reason: quotation.rejectionReason ?? null,
    converted_at: quotation.convertedAt ?? null,
    converted_invoice_id: quotation.convertedInvoiceId ?? null,
    customer_type: quotation.customerType ?? null,
    customer_type_snapshot: quotation.customerTypeSnapshot ?? null,
    created_at: quotation.createdAt,
  });

  if (!quotationOk) {
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    const { error: deleteError } = await supabase.from('quotation_items').delete().eq('quotation_id', quotation.id);

    if (deleteError) {
      setLastSupabaseSyncErrorMessage(formatSupabaseSyncErrorMessage(deleteError.message));
      console.error('[SupabaseSync] Error replacing quotation items:', deleteError.message);
      return false;
    }

    if (quotation.items.length === 0) {
      return true;
    }

    const { error: insertError } = await supabase.from('quotation_items').insert(
      quotation.items.map((item) => ({
        quotation_id: quotation.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.total,
      }))
    );

    if (insertError) {
      setLastSupabaseSyncErrorMessage(formatSupabaseSyncErrorMessage(insertError.message));
      console.error('[SupabaseSync] Error inserting quotation items:', insertError.message);
      return false;
    }

    setLastSupabaseSyncErrorMessage(null);
    return true;
  } catch (err) {
    setLastSupabaseSyncErrorMessage('Supabase sync failed before quotation items could be updated.');
    console.error('[SupabaseSync] Fatal error syncing quotation items:', err);
    return false;
  }
}

export async function syncSale(businessId: string, sale: Sale) {
  // Map to the exact schema defined in public.invoices
  // Note: We now include the full 'items' JSONB for multi-item fidelity.
  return upsertEntity('invoices', {
    id: sale.id,
    business_id: businessId,
    invoice_number: sale.invoiceNumber,
    receipt_number: sale.receiptId,
    customer_id: sale.customerId,
    quotation_id: sale.quotationId,
    product_id: sale.productId, 
    quantity: sale.quantity,     
    items: sale.items,           // Full multi-item JSONB persistence
    payment_method: mapPaymentMethodForSync(sale.paymentMethod),
    payment_reference: sale.paymentReference ?? null,
    paid_amount: sale.paidAmount,
    total_amount: sale.totalAmount,
    subtotal_amount: sale.subtotalAmount ?? null,
    tax_amount: sale.taxAmount ?? null,
    tax_snapshot: sale.taxSnapshot ?? null,
    withholding_tax_amount: sale.withholdingTaxAmount ?? null,
    net_receivable_amount: sale.netReceivableAmount ?? null,
    withholding_tax_snapshot: sale.withholdingTaxSnapshot ?? null,
    customer_type_snapshot: sale.customerTypeSnapshot ?? null,
    status: sale.status.toLowerCase(), 
    reversal_reason: sale.reversalReason,
    reversed_at: sale.reversedAt,
    reversed_by: sale.reversedBy,
    created_at: sale.createdAt,
  });
}

export async function syncExpense(businessId: string, expense: Expense) {
  return upsertEntity('expenses', {
    id: expense.id,
    business_id: businessId,
    category: expense.category,
    amount: expense.amount,
    note: expense.note,
    proof_url: '', // placeholder for future attachment flow
    created_at: expense.createdAt,
  });
}

export async function syncBusinessProfile(profile: BusinessProfile) {
  if (!hasSupabaseConfig) return true;

  try {
    const supabase = getSupabaseClient();
    const basePayload = {
      business_name: profile.businessName,
      business_type: profile.businessType,
      currency: profile.currency,
      country: profile.country,
      receipt_prefix: profile.receiptPrefix,
      invoice_prefix: profile.invoicePrefix,
      waybill_prefix: profile.waybillPrefix ?? 'WAY-',
      phone: profile.phone,
      email: profile.email,
      logo_url: profile.logoUrl,
      signature_url: profile.signatureUrl,
      address: profile.address,
      website: profile.website,
      inventory_categories_enabled: profile.inventoryCategoriesEnabled,
      customer_classification_enabled: profile.customerClassificationEnabled,
      tax_enabled: profile.taxEnabled,
      tax_preset: profile.taxPreset,
      tax_mode: profile.taxMode,
      apply_tax_by_default: profile.applyTaxByDefault,
      tax_components: profile.taxComponents,
      withholding_tax_enabled: profile.withholdingTaxEnabled,
      default_withholding_tax_rate: profile.defaultWithholdingTaxRate,
      default_withholding_tax_label: profile.defaultWithholdingTaxLabel,
      default_withholding_tax_basis: profile.defaultWithholdingTaxBasis,
      launched_at: profile.launchedAt ?? null,
    };

    const payload: Record<string, unknown> = { ...basePayload };

    while (true) {
      const response = await supabase
        .from('businesses')
        .update(payload)
        .eq('id', profile.id);
      const error = response?.error ?? null;

      if (!error) {
        setLastSupabaseSyncErrorMessage(null);
        return true;
      }

      const missingColumn = extractMissingSchemaColumn(error.message, 'businesses');
      if (missingColumn && missingColumn in payload) {
        delete payload[missingColumn];
        continue;
      }

      setLastSupabaseSyncErrorMessage(formatSupabaseSyncErrorMessage(error.message));
      console.error('[SupabaseSync] Error updating businesses row:', error.message);
      return false;
    }
  } catch (err) {
    setLastSupabaseSyncErrorMessage('Supabase sync failed before business settings could be updated.');
    console.error('[SupabaseSync] Fatal error updating businesses row:', err);
    return false;
  }
}
