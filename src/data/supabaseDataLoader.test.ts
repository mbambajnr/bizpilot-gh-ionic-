import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFrom = vi.fn();

vi.mock('../lib/supabase', () => ({
  hasSupabaseConfig: true,
  getSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

function buildQueryResult(data: unknown) {
  const result = Promise.resolve({ data });
  let orderedResult: {
    order: ReturnType<typeof vi.fn>;
    then: Promise<{ data: unknown }>['then'];
    catch: Promise<{ data: unknown }>['catch'];
    finally: Promise<{ data: unknown }>['finally'];
  };

  orderedResult = {
    order: vi.fn(() => orderedResult),
    then: result.then.bind(result),
    catch: result.catch.bind(result),
    finally: result.finally.bind(result),
  };

  return {
    eq: vi.fn(() => orderedResult),
    order: vi.fn(() => orderedResult),
  };
}

describe('supabaseDataLoader', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn(() => {
        const data = table === 'employee_credentials'
          ? [
              {
                id: 'user-1',
                business_id: 'biz-1',
                name: 'Store Lead',
                email: 'store@example.com',
                username: 'store@example.com',
                temporary_password: 'BP-Temp1',
                credentials_generated_at: '2026-05-07T08:00:00.000Z',
                account_status: 'active',
                deactivated_at: null,
                role: 'PurchaseManager',
                role_label: null,
                granted_permissions: [],
                revoked_permissions: [],
                customer_email_sender_name: null,
                customer_email_sender_email: null,
              },
            ]
          : [];

        return buildQueryResult(data);
      }),
    }));
  });

  it('preserves businessId on cloud employee credentials', async () => {
    const { loadFullBusinessDataFromSupabase } = await import('./supabaseDataLoader');

    const result = await loadFullBusinessDataFromSupabase('biz-1');

    expect(result.users).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        businessId: 'biz-1',
        email: 'store@example.com',
      }),
    ]);
  });
});
