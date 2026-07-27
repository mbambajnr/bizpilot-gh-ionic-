import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockUpsert = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('../lib/supabase', () => ({
  hasSupabaseConfig: true,
  getSupabaseClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

describe('supabaseSync', () => {
  beforeEach(() => {
    vi.resetModules();
    mockUpdate.mockReset();
    mockEq.mockReset();
    mockUpsert.mockReset();
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockFrom.mockReturnValue({ update: mockUpdate, upsert: mockUpsert });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockUpsert.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ error: null });
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

  it('sends bulk inventory through the atomic import RPC with the live product image column', async () => {
    const { syncInventoryImportBatch } = await import('./supabaseSync');
    const ok = await syncInventoryImportBatch({
      businessId: '00000000-0000-4000-8000-000000000001',
      user: { userId: 'owner-1', name: 'Owner', email: 'owner@example.com', role: 'GeneralManager', grantedPermissions: [], revokedPermissions: [] },
      products: [{
        id: '00000000-0000-4000-8000-000000000010',
        inventoryId: 'BULK-001',
        name: 'Bulk item',
        unit: 'units',
        price: 20,
        cost: 12,
        reorderLevel: 5,
        image: 'data:image/svg+xml;base64,test',
      }],
      stockMovements: [],
      locations: [{
        id: '00000000-0000-4000-8000-000000000020',
        locationCode: 'ST-0001',
        name: 'Main Store',
        type: 'store',
        isDefault: true,
        isActive: true,
      }],
    });

    expect(ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('import_inventory_batch', expect.objectContaining({
      batch_payload: expect.objectContaining({
        locations: [expect.objectContaining({
          id: '00000000-0000-4000-8000-000000000020',
          location_code: 'ST-0001',
          name: 'Main Store',
        })],
        products: [expect.objectContaining({ image: 'data:image/svg+xml;base64,test' })],
      }),
    }));
  });

  it('authenticates employee inventory imports with the employee identifier and one-time password', async () => {
    const { syncInventoryImportBatch } = await import('./supabaseSync');
    const businessId = '00000000-0000-4000-8000-000000000001';
    const ok = await syncInventoryImportBatch({
      businessId,
      user: {
        userId: 'manager-1',
        businessId,
        name: 'General Manager',
        email: 'manager@example.com',
        username: 'manager',
        role: 'GeneralManager',
        employeeSessionSecret: 'confirmed-password',
        grantedPermissions: [],
        revokedPermissions: [],
      },
      products: [],
      stockMovements: [],
    });

    expect(ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('import_inventory_batch', expect.objectContaining({
      credential_identifier: 'manager',
      credential_password: 'confirmed-password',
    }));
  });

  it('stops a restored employee session before it can fall through to owner authorization', async () => {
    const { getLastSupabaseSyncErrorMessage, syncInventoryImportBatch } = await import('./supabaseSync');
    const businessId = '00000000-0000-4000-8000-000000000001';
    const ok = await syncInventoryImportBatch({
      businessId,
      user: {
        userId: 'manager-1',
        businessId,
        name: 'General Manager',
        email: 'manager@example.com',
        username: 'manager',
        role: 'GeneralManager',
        grantedPermissions: [],
        revokedPermissions: [],
      },
      products: [],
      stockMovements: [],
    });

    expect(ok).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(getLastSupabaseSyncErrorMessage()).toBe('Confirm your employee password before importing inventory.');
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

  it('routes employee payable payments through the server-enforced workflow RPC', async () => {
    const { syncPaymentForUser } = await import('./supabaseSync');

    const ok = await syncPaymentForUser(
      'biz-123',
      {
        userId: 'accountant-1',
        businessId: 'biz-123',
        name: 'Accountant',
        email: 'accountant@example.com',
        username: 'accountant@example.com',
        role: 'Accountant',
        grantedPermissions: [],
        revokedPermissions: [],
        employeeSessionSecret: 'session-secret',
      },
      {
        id: 'pay-123',
        paymentCode: 'PAY-001',
        sourceType: 'payable',
        sourceId: 'ap-123',
        amount: 100,
        method: 'bank',
        reference: 'BANK-1',
        recordedBy: 'accountant-1',
        createdAt: '2026-05-19T10:00:00.000Z',
      }
    );

    expect(ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('sync_employee_workflow', {
      credential_identifier: 'accountant@example.com',
      credential_password: 'session-secret',
      workflow_type: 'payment',
      workflow_payload: expect.objectContaining({
        id: 'pay-123',
        sourceType: 'payable',
        amount: 100,
      }),
    });
    expect(mockFrom).not.toHaveBeenCalledWith('payments');
  });

  it('posts receivable evidence through one atomic command for employee sessions', async () => {
    const { syncReceivablePaymentCommand } = await import('./supabaseSync');
    const ok = await syncReceivablePaymentCommand({
      businessId: '00000000-0000-4000-8000-000000000001',
      user: {
        userId: 'accountant-1', businessId: '00000000-0000-4000-8000-000000000001', name: 'Accountant',
        email: 'accountant@example.com', username: 'accountant', role: 'Accountant',
        grantedPermissions: [], revokedPermissions: [], employeeSessionSecret: 'employee-secret',
      },
      sale: {
        id: '00000000-0000-4000-8000-000000000010', invoiceNumber: 'INV-100', receiptId: 'RCP-100',
        customerId: '00000000-0000-4000-8000-000000000020', items: [], productId: '00000000-0000-4000-8000-000000000030',
        quantity: 1, paymentMethod: 'Bank Account', paidAmount: 25, totalAmount: 100,
        createdAt: '2026-07-16T09:00:00.000Z', status: 'Completed',
      },
      payment: {
        id: '00000000-0000-4000-8000-000000000040', paymentCode: 'PAY-100', sourceType: 'invoice',
        sourceId: '00000000-0000-4000-8000-000000000010', amount: 25, method: 'bank',
        reference: 'BANK-100', recordedBy: 'accountant-1', createdAt: '2026-07-16T10:00:00.000Z',
      },
      ledgerEntry: {
        id: 'led-local', entryNumber: 'LED-100', customerId: '00000000-0000-4000-8000-000000000020',
        type: 'payment_received', amountDelta: -25, createdAt: '2026-07-16T10:00:00.000Z',
        relatedSaleId: '00000000-0000-4000-8000-000000000010', note: 'Payment received',
      },
      activity: {
        id: 'act-100', activityNumber: 'ACT-100', entityType: 'sale', entityId: '00000000-0000-4000-8000-000000000010',
        actionType: 'payment_recorded', title: 'Customer payment recorded', detail: 'Payment received', status: 'success',
        createdAt: '2026-07-16T10:00:00.000Z',
      },
      notification: {
        id: 'note-100', title: 'Customer payment recorded', message: 'Payment received', createdAt: '2026-07-16T10:00:00.000Z',
        recipientRoles: ['Accountant'], readByUserIds: [], entityType: 'sale', entityId: '00000000-0000-4000-8000-000000000010',
      },
    });

    expect(ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('record_receivable_payment_command', {
      credential_identifier: 'accountant',
      credential_password: 'employee-secret',
      workflow_payload: expect.objectContaining({
        businessId: '00000000-0000-4000-8000-000000000001',
        saleId: '00000000-0000-4000-8000-000000000010',
        paymentId: '00000000-0000-4000-8000-000000000040',
        paymentCode: 'PAY-100',
        ledgerEntryNumber: 'LED-100',
        activityNumber: 'ACT-100',
        notificationId: 'note-100',
      }),
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
