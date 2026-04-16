import type { BusinessProfile } from './seedBusiness';
import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';

type BusinessProfileRow = {
  id: string;
  business_name: string;
  business_type: string;
  currency: string;
  country: string;
  receipt_prefix: string;
  invoice_prefix: string;
  phone: string | null;
  email: string | null;
};

export type BusinessProfileLoadResult =
  | { status: 'loaded'; profile: BusinessProfile; message: string }
  | { status: 'empty' | 'skipped' | 'error'; message: string };

export type BusinessProfileBootstrapInput = {
  ownerId: string;
  email?: string;
  businessName?: string;
};

export type BusinessProfileBootstrapResult =
  | { status: 'ready'; profile: BusinessProfile; message: string }
  | { status: 'skipped' | 'error'; message: string };

function mapBusinessProfile(row: BusinessProfileRow): BusinessProfile {
  return {
    id: row.id,
    businessName: row.business_name,
    businessType: row.business_type,
    currency: row.currency,
    country: row.country,
    receiptPrefix: row.receipt_prefix,
    invoicePrefix: row.invoice_prefix,
    phone: row.phone ?? '',
    email: row.email ?? '',
  };
}

export async function loadBusinessProfileFromSupabase(ownerId?: string): Promise<BusinessProfileLoadResult> {
  if (!hasSupabaseConfig) {
    return {
      status: 'skipped',
      message: 'Supabase env vars are not configured, so BizPilot is using local business settings.',
    };
  }

  const supabase = getSupabaseClient();
  let userId = ownerId;

  if (!userId) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      return {
        status: 'error',
        message: sessionError.message,
      };
    }

    userId = sessionData.session?.user.id;
  }

  if (!userId) {
    return {
      status: 'skipped',
      message: 'No signed-in Supabase user yet, so BizPilot is using local business settings.',
    };
  }

  const { data, error } = await supabase
    .from('businesses')
    .select('id, business_name, business_type, currency, country, receipt_prefix, invoice_prefix, phone, email')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<BusinessProfileRow>();

  if (error) {
    return {
      status: 'error',
      message: error.message,
    };
  }

  if (!data) {
    return {
      status: 'empty',
      message: 'Supabase is connected, but no business profile exists for this user yet.',
    };
  }

  return {
    status: 'loaded',
    profile: mapBusinessProfile(data),
    message: 'Business profile loaded from Supabase.',
  };
}

export async function ensureBusinessProfileForOwner(
  input: BusinessProfileBootstrapInput
): Promise<BusinessProfileBootstrapResult> {
  if (!hasSupabaseConfig) {
    return {
      status: 'skipped',
      message: 'Supabase env vars are not configured, so business bootstrap was skipped.',
    };
  }

  const existing = await loadBusinessProfileFromSupabase(input.ownerId);

  if (existing.status === 'loaded') {
    return {
      status: 'ready',
      profile: existing.profile,
      message: 'Business profile already exists for this owner.',
    };
  }

  if (existing.status === 'error' || existing.status === 'skipped') {
    return {
      status: existing.status,
      message: existing.message,
    };
  }

  const supabase = getSupabaseClient();
  const fallbackName = input.businessName?.trim() || input.email?.split('@')[0] || 'BizPilot Business';
  const { data, error } = await supabase
    .from('businesses')
    .insert({
      owner_id: input.ownerId,
      business_code: `biz-${input.ownerId}`,
      business_name: fallbackName,
      business_type: 'General Retail',
      currency: 'GHS',
      country: 'Ghana',
      receipt_prefix: 'RCP-',
      invoice_prefix: 'INV-',
      phone: '',
      email: input.email ?? '',
    })
    .select('id, business_name, business_type, currency, country, receipt_prefix, invoice_prefix, phone, email')
    .single<BusinessProfileRow>();

  if (error) {
    return {
      status: 'error',
      message: error.message,
    };
  }

  return {
    status: 'ready',
    profile: mapBusinessProfile(data),
    message: 'Business profile created for this owner.',
  };
}
