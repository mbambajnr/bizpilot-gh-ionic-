import type { UserAccessProfile } from '../../src/authz/types';
import { getSupabaseClient, hasSupabaseConfig } from '../../src/lib/supabase';

async function authHeaders(user: UserAccessProfile) {
  const headers: Record<string, string> = {};
  if (!user.employeeSessionSecret && hasSupabaseConfig) {
    const { data } = await getSupabaseClient().auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || 'The sales document request could not be completed.');
  return payload;
}

export async function uploadClientPurchaseOrder(file: File, input: { quotationId: string; businessId: string; poNumber: string; user: UserAccessProfile }) {
  const form = new FormData();
  form.set('file', file);
  form.set('quotationId', input.quotationId);
  form.set('businessId', input.businessId);
  form.set('poNumber', input.poNumber);
  const response = await fetch('/api/sales/client-purchase-orders', { method: 'POST', headers: await authHeaders(input.user), credentials: 'same-origin', body: form });
  return parseResponse(response) as Promise<{ document: { poNumber: string; name: string; storagePath: string; mimeType: string; size: number; uploadedBy: string } }>;
}

export async function getClientPurchaseOrderUrl(input: { quotationId: string; businessId: string; storagePath: string; user: UserAccessProfile }) {
  const query = new URLSearchParams({ quotationId: input.quotationId, businessId: input.businessId, storagePath: input.storagePath });
  const response = await fetch(`/api/sales/client-purchase-orders?${query}`, { headers: await authHeaders(input.user), credentials: 'same-origin' });
  return parseResponse(response) as Promise<{ url: string }>;
}

export async function deleteClientPurchaseOrder(input: { quotationId: string; businessId: string; storagePath: string; user: UserAccessProfile }) {
  const response = await fetch('/api/sales/client-purchase-orders', { method: 'DELETE', headers: { ...(await authHeaders(input.user)), 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(input) });
  return parseResponse(response);
}
