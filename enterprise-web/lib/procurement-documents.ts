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
  if (!response.ok) throw new Error(payload.message || 'The document request could not be completed.');
  return payload;
}

export async function uploadProcurementDocument(file: File, input: { purchaseId: string; businessId: string; category: string; user: UserAccessProfile }) {
  const form = new FormData();
  form.set('file', file);
  form.set('purchaseId', input.purchaseId);
  form.set('businessId', input.businessId);
  form.set('category', input.category);
  const response = await fetch('/api/procurement/documents', { method: 'POST', headers: await authHeaders(input.user), credentials: 'same-origin', body: form });
  return parseResponse(response) as Promise<{ document: { name: string; storagePath: string; mimeType: string; size: number } }>;
}

export async function getProcurementDocumentUrl(input: { purchaseId: string; businessId: string; storagePath: string; user: UserAccessProfile }) {
  const query = new URLSearchParams({ purchaseId: input.purchaseId, businessId: input.businessId, storagePath: input.storagePath });
  const response = await fetch(`/api/procurement/documents?${query}`, { headers: await authHeaders(input.user), credentials: 'same-origin' });
  return parseResponse(response) as Promise<{ url: string }>;
}

export async function deleteProcurementDocument(input: { purchaseId: string; businessId: string; storagePath: string; user: UserAccessProfile }) {
  const response = await fetch('/api/procurement/documents', { method: 'DELETE', headers: { ...(await authHeaders(input.user)), 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(input) });
  return parseResponse(response);
}
