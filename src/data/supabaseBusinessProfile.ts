import type { BusinessProfile, TaxComponent } from './seedBusiness';
import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';

type BusinessProfileRow = {
  id: string;
  business_name: string;
  business_type: string;
  currency: string;
  country: string;
  receipt_prefix: string;
  invoice_prefix: string;
  waybill_prefix: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  signature_url: string | null;
  address: string | null;
  website: string | null;
  inventory_categories_enabled: boolean | null;
  customer_classification_enabled: boolean | null;
  tax_enabled: boolean | null;
  tax_preset: 'ghana-standard' | null;
  tax_mode: 'exclusive' | 'inclusive' | null;
  apply_tax_by_default: boolean | null;
  tax_components: TaxComponent[] | null;
  withholding_tax_enabled: boolean | null;
  default_withholding_tax_rate: number | null;
  default_withholding_tax_label: string | null;
  default_withholding_tax_basis: 'subtotal' | 'taxInclusiveTotal' | 'taxExclusiveSubtotal' | null;
  launched_at: string | null;
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
    address: row.address ?? '',
    website: row.website ?? '',
    logoUrl: row.logo_url ?? undefined,
    signatureUrl: row.signature_url ?? undefined,
    waybillPrefix: row.waybill_prefix ?? 'WAY-',
    inventoryCategoriesEnabled: row.inventory_categories_enabled ?? false,
    customerClassificationEnabled: row.customer_classification_enabled ?? false,
    taxEnabled: row.tax_enabled ?? false,
    taxPreset: row.tax_preset ?? 'ghana-standard',
    taxMode: row.tax_mode ?? 'exclusive',
    applyTaxByDefault: row.apply_tax_by_default ?? true,
    taxComponents: row.tax_components ?? [
      { key: 'vat', label: 'VAT', rate: 12.5, enabled: true },
      { key: 'nhil', label: 'NHIL', rate: 2.5, enabled: true },
      { key: 'getfund', label: 'GETFund', rate: 2.5, enabled: true },
    ],
    withholdingTaxEnabled: row.withholding_tax_enabled ?? false,
    defaultWithholdingTaxRate: row.default_withholding_tax_rate ?? 0,
    defaultWithholdingTaxLabel: row.default_withholding_tax_label ?? 'Withholding Tax',
    defaultWithholdingTaxBasis: row.default_withholding_tax_basis ?? 'taxInclusiveTotal',
    launchedAt: row.launched_at ?? undefined,
  };
}

export async function loadBusinessProfileFromSupabase(ownerId?: string): Promise<BusinessProfileLoadResult> {
  if (!hasSupabaseConfig) {
    return {
      status: 'skipped',
      message: 'Supabase env vars are not configured, so BisaPilot is using local business settings.',
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
      message: 'No signed-in Supabase user yet, so BisaPilot is using local business settings.',
    };
  }

  const { data, error } = await supabase
    .from('businesses')
    .select('id, business_name, business_type, currency, country, receipt_prefix, invoice_prefix, waybill_prefix, phone, email, logo_url, signature_url, address, website, inventory_categories_enabled, customer_classification_enabled, tax_enabled, tax_preset, tax_mode, apply_tax_by_default, tax_components, withholding_tax_enabled, default_withholding_tax_rate, default_withholding_tax_label, default_withholding_tax_basis, launched_at')
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

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.ownerId);
  if (!isUuid) {
    return {
      status: 'skipped',
      message: 'ID is not a valid Supabase UUID. Skipping cloud bootstrap.',
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
  const fallbackName = input.businessName?.trim() || '';
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
      address: '',
      website: '',
      waybill_prefix: 'WAY-',
      inventory_categories_enabled: false,
      customer_classification_enabled: false,
      tax_enabled: false,
      tax_preset: 'ghana-standard',
      tax_mode: 'exclusive',
      apply_tax_by_default: true,
      tax_components: [
        { key: 'vat', label: 'VAT', rate: 12.5, enabled: true },
        { key: 'nhil', label: 'NHIL', rate: 2.5, enabled: true },
        { key: 'getfund', label: 'GETFund', rate: 2.5, enabled: true },
      ],
      withholding_tax_enabled: false,
      default_withholding_tax_rate: 0,
      default_withholding_tax_label: 'Withholding Tax',
      default_withholding_tax_basis: 'taxInclusiveTotal',
      launched_at: null,
    })
    .select('id, business_name, business_type, currency, country, receipt_prefix, invoice_prefix, waybill_prefix, phone, email, logo_url, signature_url, address, website, inventory_categories_enabled, customer_classification_enabled, tax_enabled, tax_preset, tax_mode, apply_tax_by_default, tax_components, withholding_tax_enabled, default_withholding_tax_rate, default_withholding_tax_label, default_withholding_tax_basis, launched_at')
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
