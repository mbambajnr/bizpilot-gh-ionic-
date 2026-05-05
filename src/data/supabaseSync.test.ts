import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('../lib/supabase', () => ({
  hasSupabaseConfig: true,
  getSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

describe('supabaseSync', () => {
  beforeEach(() => {
    vi.resetModules();
    mockUpdate.mockReset();
    mockEq.mockReset();
    mockFrom.mockReset();
    mockFrom.mockReturnValue({ update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  it('formats missing-column schema cache errors clearly', async () => {
    const { formatSupabaseSyncErrorMessage } = await import('./supabaseSync');

    expect(
      formatSupabaseSyncErrorMessage("Could not find the 'address' column of 'businesses' in the schema cache")
    ).toBe('Supabase schema is missing businesses.address. Apply the latest database migrations, then try again.');
  });

  it('retries business profile sync without legacy optional columns when the cloud schema is older', async () => {
    const { syncBusinessProfile } = await import('./supabaseSync');
    const payloadSnapshots: Array<Record<string, unknown>> = [];
    const profile = {
      id: 'biz-123',
      businessName: 'Bisa Test',
      businessType: 'Retail',
      currency: 'GHS',
      country: 'Ghana',
      receiptPrefix: 'RCP-',
      invoicePrefix: 'INV-',
      phone: '',
      email: '',
      address: 'Accra',
      website: 'https://example.com',
      waybillPrefix: 'WAY-',
      inventoryCategoriesEnabled: false,
      customerClassificationEnabled: false,
      taxEnabled: false,
      taxPreset: 'ghana-standard' as const,
      taxMode: 'exclusive' as const,
      applyTaxByDefault: true,
      taxComponents: [
        { key: 'vat', label: 'VAT', rate: 12.5, enabled: true },
      ],
      withholdingTaxEnabled: false,
      defaultWithholdingTaxRate: 0,
      defaultWithholdingTaxLabel: 'Withholding Tax',
      defaultWithholdingTaxBasis: 'taxInclusiveTotal' as const,
    };

    mockUpdate.mockImplementation((payload) => {
      payloadSnapshots.push({ ...payload });
      return { eq: mockEq };
    });

    mockEq
      .mockResolvedValueOnce({
        error: { message: "Could not find the 'address' column of 'businesses' in the schema cache" },
      })
      .mockResolvedValueOnce({ error: null });

    const ok = await syncBusinessProfile(profile);

    expect(ok).toBe(true);
    expect(mockEq).toHaveBeenCalledTimes(2);
    const [firstPayload, secondPayload] = payloadSnapshots;
    expect(firstPayload.address).toBe('Accra');
    expect(secondPayload.address).toBeUndefined();
    expect(secondPayload.inventory_categories_enabled).toBe(false);
  });

  it('retries business profile sync without newer optional columns when the cloud schema is older', async () => {
    const { getLastSupabaseSyncErrorMessage, syncBusinessProfile } = await import('./supabaseSync');
    const payloadSnapshots: Array<Record<string, unknown>> = [];
    const profile = {
      id: 'biz-123',
      businessName: 'Bisa Test',
      businessType: 'Retail',
      currency: 'GHS',
      country: 'Ghana',
      receiptPrefix: 'RCP-',
      invoicePrefix: 'INV-',
      phone: '',
      email: '',
      address: '',
      website: '',
      waybillPrefix: 'WAY-',
      inventoryCategoriesEnabled: true,
      customerClassificationEnabled: false,
      taxEnabled: false,
      taxPreset: 'ghana-standard' as const,
      taxMode: 'exclusive' as const,
      applyTaxByDefault: true,
      taxComponents: [
        { key: 'vat', label: 'VAT', rate: 12.5, enabled: true },
      ],
      withholdingTaxEnabled: false,
      defaultWithholdingTaxRate: 0,
      defaultWithholdingTaxLabel: 'Withholding Tax',
      defaultWithholdingTaxBasis: 'taxInclusiveTotal' as const,
    };

    mockUpdate.mockImplementation((payload) => {
      payloadSnapshots.push({ ...payload });
      return { eq: mockEq };
    });

    mockEq
      .mockResolvedValueOnce({
        error: { message: "Could not find the 'inventory_categories_enabled' column of 'businesses' in the schema cache" },
      })
      .mockResolvedValueOnce({ error: null });

    const ok = await syncBusinessProfile(profile);

    expect(ok).toBe(true);
    expect(mockEq).toHaveBeenCalledTimes(2);
    const [firstPayload, secondPayload] = payloadSnapshots;
    expect(firstPayload.inventory_categories_enabled).toBe(true);
    expect(secondPayload.inventory_categories_enabled).toBeUndefined();
    expect(getLastSupabaseSyncErrorMessage()).toBeNull();
  });
});
