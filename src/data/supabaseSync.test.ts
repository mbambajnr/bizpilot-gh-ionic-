import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockUpsert = vi.fn();
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
    mockUpsert.mockReset();
    mockFrom.mockReset();
    mockFrom.mockReturnValue({ update: mockUpdate, upsert: mockUpsert });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockUpsert.mockResolvedValue({ error: null });
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

  it('syncs activity log entries to the cloud audit event table', async () => {
    const { syncActivityLogEntry } = await import('./supabaseSync');

    const ok = await syncActivityLogEntry('biz-123', {
      id: 'act-123',
      activityNumber: 'ACT-001',
      entityType: 'business',
      entityId: 'purchase-1',
      actionType: 'purchase_approved',
      title: 'Purchase approved',
      detail: 'General manager approved PO-001.',
      status: 'success',
      createdAt: '2026-05-19T10:00:00.000Z',
      referenceNumber: 'PO-001',
      relatedEntityId: 'payable-1',
    });

    expect(ok).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('business_audit_events');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'act-123',
        business_id: 'biz-123',
        activity_number: 'ACT-001',
        action_type: 'purchase_approved',
        related_entity_id: 'payable-1',
      }),
      { onConflict: 'id' }
    );
  });

  it('syncs app notifications and notification reads', async () => {
    const { syncAppNotification, syncAppNotificationRead } = await import('./supabaseSync');

    const notificationOk = await syncAppNotification('biz-123', {
      id: 'note-123',
      title: 'Payable ready',
      message: 'PO-001 is approved and ready for accountant review.',
      createdAt: '2026-05-19T10:00:00.000Z',
      recipientRoles: ['Accountant'],
      readByUserIds: ['accountant-1'],
      entityType: 'payable',
      entityId: 'payable-1',
      referenceNumber: 'PO-001',
      actionUrl: '/accounting',
    });
    const readOk = await syncAppNotificationRead('biz-123', 'note-123', 'accountant-1', '2026-05-19T10:05:00.000Z');

    expect(notificationOk).toBe(true);
    expect(readOk).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('app_notifications');
    expect(mockFrom).toHaveBeenCalledWith('app_notification_reads');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'note-123',
        business_id: 'biz-123',
        recipient_roles: ['Accountant'],
        entity_type: 'payable',
      }),
      { onConflict: 'id' }
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_id: 'note-123',
        business_id: 'biz-123',
        user_id: 'accountant-1',
      }),
      { onConflict: 'notification_id,user_id' }
    );
  });
});
