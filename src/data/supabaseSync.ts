import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';
import type { Product, Customer, Sale, Expense, BusinessProfile } from './seedBusiness';

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
async function upsertEntity(table: string, payload: any): Promise<boolean> {
  if (!hasSupabaseConfig) return true;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    
    if (error) {
      console.error(`[SupabaseSync] Error upserting to ${table}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
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
    terminated_at: customer.terminatedAt,
    termination_reason: customer.terminationReason,
  });
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
    paid_amount: sale.paidAmount,
    total_amount: sale.totalAmount,
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
    const payload = {
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
    };

    const { error } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', profile.id);

    if (error) {
      console.error('[SupabaseSync] Error updating businesses row:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[SupabaseSync] Fatal error updating businesses row:', err);
    return false;
  }
}
