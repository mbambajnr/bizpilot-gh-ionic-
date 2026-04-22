import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';
import type { BusinessState, Product, Customer, Sale, Expense } from './seedBusiness';

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
      { data: products },
      { data: customers },
      { data: invoices },
      { data: expenses }
    ] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', businessId),
      supabase.from('customers').select('*').eq('business_id', businessId),
      supabase.from('invoices').select('*').eq('business_id', businessId),
      supabase.from('expenses').select('*').eq('business_id', businessId)
    ]);

    const mappedProducts: Product[] = (products || []).map(p => ({
      id: p.id,
      inventoryId: p.inventory_id,
      name: p.name,
      unit: p.unit,
      price: p.price,
      cost: p.cost,
      reorderLevel: p.reorder_level,
      image: p.image_url || ''
    }));

    const mappedCustomers: Customer[] = (customers || []).map(c => ({
      id: c.id,
      clientId: c.client_id,
      name: c.name,
      phone: c.phone || '',
      whatsapp: c.whatsapp || '',
      email: c.email || '',
      channel: c.channel,
      status: c.status === 'terminated' ? 'terminated' : 'active',
      terminatedAt: c.terminated_at || undefined,
      terminationReason: c.termination_reason || undefined,
    }));

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
      totalAmount: s.total_amount,
      createdAt: s.created_at,
      status: s.status === 'reversed' ? 'Reversed' : 'Completed',
      quotationId: s.quotation_id || undefined,
      reversalReason: s.reversal_reason || undefined,
      reversedAt: s.reversed_at || undefined,
      reversedBy: s.reversed_by || undefined
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
      customers: mappedCustomers,
      sales: mappedSales,
      expenses: mappedExpenses
    };
  } catch (err) {
    console.error('[SupabaseLoader] Failed to load business data:', err);
    return {};
  }
}
