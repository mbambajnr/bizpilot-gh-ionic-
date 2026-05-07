import React, { useEffect, useRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../data/seedBusiness';
import { addQuotationToState } from '../utils/businessLogic';
import { BusinessProvider, useBusiness } from './BusinessContext';
import { syncBusinessProfile, syncEmployeeCredential, syncQuotation, syncSale } from '../data/supabaseSync';

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../data/supabaseBusinessProfile', () => ({
  loadBusinessProfileFromSupabase: vi.fn(() =>
    Promise.resolve({
      status: 'skipped',
      message: 'Test mode skipped business profile load.',
    })
  ),
}));

vi.mock('../data/supabaseDataLoader', () => ({
  loadFullBusinessDataFromSupabase: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../data/supabaseSync', () => ({
  syncProduct: vi.fn(() => Promise.resolve(true)),
  syncCustomer: vi.fn(() => Promise.resolve(true)),
  syncSale: vi.fn(() => Promise.resolve(true)),
  syncExpense: vi.fn(() => Promise.resolve(true)),
  syncBusinessProfile: vi.fn(() => Promise.resolve(true)),
  getLastSupabaseSyncErrorMessage: vi.fn(() => null),
  syncProductCategory: vi.fn(() => Promise.resolve(true)),
  syncQuotation: vi.fn(() => Promise.resolve(true)),
  syncBusinessLocation: vi.fn(() => Promise.resolve(true)),
  syncSupplyRoute: vi.fn(() => Promise.resolve(true)),
  syncStockMovement: vi.fn(() => Promise.resolve(true)),
  syncEmployeeCredential: vi.fn(() => Promise.resolve(true)),
  syncPurchase: vi.fn(() => Promise.resolve(true)),
  syncEmployeePurchase: vi.fn(() => Promise.resolve(true)),
}));

const STORAGE_KEY = 'bizpilot-gh-state-v1';

function ConvertQuotationHarness({ quotationId }: { quotationId: string }) {
  const didConvert = useRef(false);
  const { convertQuotationToSale } = useBusiness();

  useEffect(() => {
    if (didConvert.current) {
      return;
    }

    didConvert.current = true;
    convertQuotationToSale({
      quotationId,
      paymentMethod: 'Cash',
      amountPaid: 35,
    });
  }, [convertQuotationToSale, quotationId]);

  return null;
}

function UpdateBusinessProfileHarness({
  nextName,
  onDone,
}: {
  nextName: string;
  onDone: (payload: { ok: boolean; name: string }) => void;
}) {
  const didRun = useRef(false);
  const { updateBusinessProfile, state } = useBusiness();

  useEffect(() => {
    if (didRun.current) {
      return;
    }

    didRun.current = true;
    void updateBusinessProfile({
      businessName: nextName,
      businessType: state.businessProfile.businessType,
      currency: state.businessProfile.currency,
      country: state.businessProfile.country,
      receiptPrefix: state.businessProfile.receiptPrefix,
      invoicePrefix: state.businessProfile.invoicePrefix,
      phone: state.businessProfile.phone,
      email: state.businessProfile.email,
      address: state.businessProfile.address,
      website: state.businessProfile.website,
      waybillPrefix: state.businessProfile.waybillPrefix,
    });
  }, [nextName, onDone, state.businessProfile, updateBusinessProfile]);

  useEffect(() => {
    if (!didRun.current) {
      return;
    }

    onDone({ ok: true, name: state.businessProfile.businessName });
  }, [onDone, state.businessProfile.businessName]);

  return null;
}

function UpdateBrandingHarness({
  nextLogoUrl,
  onDone,
}: {
  nextLogoUrl: string;
  onDone: (payload: { ok: boolean; logoUrl?: string; message?: string }) => void;
}) {
  const didRun = useRef(false);
  const { updateBranding, state } = useBusiness();

  useEffect(() => {
    if (didRun.current) {
      return;
    }

    didRun.current = true;
    void updateBranding({ logoUrl: nextLogoUrl }).then((result) => {
      onDone({
        ok: result.ok,
        message: result.ok ? undefined : result.message,
        logoUrl: result.ok ? nextLogoUrl : undefined,
      });
    });
  }, [nextLogoUrl, onDone, updateBranding]);

  useEffect(() => {
    if (!didRun.current) {
      return;
    }

    if (state.businessProfile.logoUrl === nextLogoUrl) {
      onDone({ ok: true, logoUrl: state.businessProfile.logoUrl });
    }
  }, [nextLogoUrl, onDone, state.businessProfile.logoUrl]);

  return null;
}

function AddEmployeeHarness({
  onDone,
}: {
  onDone: (payload: { ok: boolean; username?: string; temporaryPassword?: string; totalUsers: number }) => void;
}) {
  const didRun = useRef(false);
  const { addUserAccount, state } = useBusiness();

  useEffect(() => {
    if (didRun.current) {
      return;
    }

    didRun.current = true;
    const result = addUserAccount({
      name: 'Kwame Mensah',
      email: 'kwame@example.com',
      role: 'WarehouseManager',
    });

    onDone({
      ok: result.ok,
      username: result.ok ? result.data?.username : undefined,
      temporaryPassword: result.ok ? result.data?.temporaryPassword : undefined,
      totalUsers: state.users.length,
    });
  }, [addUserAccount, onDone, state.users.length]);

  return null;
}

function ResetEmployeePasswordHarness({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (payload: { ok: boolean; username?: string; temporaryPassword?: string }) => void;
}) {
  const didRun = useRef(false);
  const { resetEmployeeTemporaryPassword } = useBusiness();

  useEffect(() => {
    if (didRun.current) {
      return;
    }

    didRun.current = true;
    const result = resetEmployeeTemporaryPassword(userId);
    onDone({
      ok: result.ok,
      username: result.ok ? result.data?.username : undefined,
      temporaryPassword: result.ok ? result.data?.temporaryPassword : undefined,
    });
  }, [onDone, resetEmployeeTemporaryPassword, userId]);

  return null;
}

describe('BusinessContext quotation conversion sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('syncs the created sale when converting a quotation', async () => {
    const classifiedState = {
      ...seedState,
      customers: seedState.customers.map((customer) =>
        customer.id === 'c1' ? { ...customer, customerType: 'B2B' as const } : customer
      ),
      businessProfile: {
        ...seedState.businessProfile,
        customerClassificationEnabled: true,
        taxEnabled: true,
        taxPreset: 'ghana-standard' as const,
        taxMode: 'exclusive' as const,
        applyTaxByDefault: true,
      },
    };
    const withQuotation = addQuotationToState(classifiedState, {
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 1 }],
    });

    expect(withQuotation.ok).toBe(true);
    if (!withQuotation.ok || !withQuotation.data) {
      return;
    }

    const quotationId = withQuotation.data.quotations[0].id;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(withQuotation.data));

    render(
      <BusinessProvider>
        <ConvertQuotationHarness quotationId={quotationId} />
      </BusinessProvider>
    );

    await waitFor(() => {
      expect(syncQuotation).toHaveBeenCalledTimes(1);
      expect(syncSale).toHaveBeenCalledTimes(1);
    });
    expect(syncSale).toHaveBeenCalledWith(
      seedState.businessProfile.id,
      expect.objectContaining({
        quotationId,
        customerTypeSnapshot: 'B2B',
        taxSnapshot: expect.objectContaining({
          preset: 'ghana-standard',
          totalRate: 17.5,
        }),
        taxAmount: 6.13,
      })
    );
  });

  it('only commits business profile changes after durable sync succeeds', async () => {
    const onDone = vi.fn();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));

    render(
      <BusinessProvider>
        <UpdateBusinessProfileHarness nextName="Bisa Durable" onDone={onDone} />
      </BusinessProvider>
    );

    await waitFor(() => {
      expect(syncBusinessProfile).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bisa Durable' }));
    });
  });

  it('keeps business profile changes locally when durable sync fails', async () => {
    vi.mocked(syncBusinessProfile).mockResolvedValueOnce(false);
    const onDone = vi.fn();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));

    render(
      <BusinessProvider>
        <UpdateBusinessProfileHarness nextName="Should Not Persist" onDone={onDone} />
      </BusinessProvider>
    );

    await waitFor(() => {
      expect(syncBusinessProfile).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ name: 'Should Not Persist' }));
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').businessProfile?.businessName ?? '').toBe('Should Not Persist');
  });

  it('only commits branding changes after durable sync succeeds', async () => {
    const onDone = vi.fn();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));

    render(
      <BusinessProvider>
        <UpdateBrandingHarness nextLogoUrl="data:image/png;base64,durable-logo" onDone={onDone} />
      </BusinessProvider>
    );

    await waitFor(() => {
      expect(syncBusinessProfile).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ ok: true, logoUrl: 'data:image/png;base64,durable-logo' }));
    });
  });

  it('keeps branding changes locally when durable sync fails', async () => {
    vi.mocked(syncBusinessProfile).mockResolvedValueOnce(false);
    const onDone = vi.fn();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));

    render(
      <BusinessProvider>
        <UpdateBrandingHarness nextLogoUrl="data:image/png;base64:should-not-persist" onDone={onDone} />
      </BusinessProvider>
    );

    await waitFor(() => {
      expect(syncBusinessProfile).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          logoUrl: 'data:image/png;base64:should-not-persist',
        })
      );
    });

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').businessProfile?.logoUrl ?? '').toBe(
      'data:image/png;base64:should-not-persist'
    );
  });

  it('generates employee credentials when a new employee account is created', async () => {
    const onDone = vi.fn();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));

    render(
      <BusinessProvider>
        <AddEmployeeHarness onDone={onDone} />
      </BusinessProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          username: 'kwame@example.com',
          temporaryPassword: expect.stringMatching(/^BP-/),
        })
      );
    });

    const savedState = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    const createdUser = savedState.users?.find((user: { email?: string }) => user.email === 'kwame@example.com');
    expect(createdUser?.username).toBe('kwame@example.com');
    expect(createdUser?.temporaryPassword).toMatch(/^BP-/);
    expect(syncEmployeeCredential).toHaveBeenCalledWith(
      seedState.businessProfile.id,
      expect.objectContaining({
        email: 'kwame@example.com',
        username: 'kwame@example.com',
        temporaryPassword: expect.stringMatching(/^BP-/),
      })
    );
  });

  it('lets admins create a fresh temporary password for an existing employee', async () => {
    const onDone = vi.fn();
    const existingState = {
      ...seedState,
      users: [
        ...seedState.users,
        {
          userId: 'u-store-operator',
          name: 'Store Operator',
          email: 'store@example.com',
          username: 'store.operator',
          role: 'StoreManager' as const,
          grantedPermissions: [],
          revokedPermissions: [],
          accountStatus: 'active' as const,
        },
      ],
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existingState));

    render(
      <BusinessProvider>
        <ResetEmployeePasswordHarness userId="u-store-operator" onDone={onDone} />
      </BusinessProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          username: 'store@example.com',
          temporaryPassword: expect.stringMatching(/^BP-/),
        })
      );
    });

    const savedState = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    const updatedUser = savedState.users?.find((user: { userId?: string }) => user.userId === 'u-store-operator');
    expect(updatedUser?.username).toBe('store@example.com');
    expect(updatedUser?.temporaryPassword).toMatch(/^BP-/);
    expect(syncEmployeeCredential).toHaveBeenCalledWith(
      seedState.businessProfile.id,
      expect.objectContaining({
        userId: 'u-store-operator',
        email: 'store@example.com',
        username: 'store@example.com',
        temporaryPassword: expect.stringMatching(/^BP-/),
      })
    );
  });
});
