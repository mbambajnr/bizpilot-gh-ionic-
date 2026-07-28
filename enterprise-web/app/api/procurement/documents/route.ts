import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { EMPLOYEE_SESSION_COOKIE, verifyEmployeeSessionToken } from '@/lib/employee-session';

// Shared private document bucket. Paths are prefixed with businessId/purchaseId so sales and
// procurement uploads never collide. Point SUPABASE_DOCUMENTS_BUCKET at the per-environment bucket
// (e.g. documents_dev / documents_prod); defaults to `documents`.
const BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || 'documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const ALLOWED_ROLES = new Set(['GeneralManager', 'Accountant', 'InventoryManager']);

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authorize(request: NextRequest, businessId: string, purchaseId: string) {
  const admin = getAdminClient();
  if (!admin) return { error: 'Private document storage is not configured on the server.', status: 503 } as const;

  let actorId = '';
  let authorizedBusinessId = '';
  const authorization = request.headers.get('authorization');
  const employeeSession = verifyEmployeeSessionToken(request.cookies.get(EMPLOYEE_SESSION_COOKIE)?.value, process.env.BIZPILOT_EMPLOYEE_SESSION_SECRET || '');

  if (authorization?.startsWith('Bearer ')) {
    const { data, error } = await admin.auth.getUser(authorization.slice(7));
    if (error || !data.user) return { error: 'Your owner session is no longer valid.', status: 401 } as const;
    const { data: business } = await admin.from('businesses').select('id').eq('id', businessId).eq('owner_id', data.user.id).maybeSingle();
    if (!business) return { error: 'You do not have access to this business.', status: 403 } as const;
    actorId = data.user.id;
    authorizedBusinessId = business.id;
  } else if (employeeSession) {
    if (employeeSession.businessId !== businessId || !ALLOWED_ROLES.has(employeeSession.role)) {
      return { error: 'Your role cannot manage procurement documents.', status: 403 } as const;
    }
    actorId = employeeSession.employeeId;
    authorizedBusinessId = employeeSession.businessId;
  } else {
    return { error: 'Authentication is required.', status: 401 } as const;
  }

  const { data: purchase } = await admin.from('purchases').select('id').eq('id', purchaseId).eq('business_id', authorizedBusinessId).maybeSingle();
  if (!purchase) return { error: 'Purchase order not found for this business.', status: 404 } as const;
  return { admin, actorId, businessId: authorizedBusinessId } as const;
}

function cleanFileName(name: string) {
  const cleaned = name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+/, '').slice(-120);
  return cleaned || 'procurement-document';
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const purchaseId = String(form?.get('purchaseId') || '').trim();
  const businessId = String(form?.get('businessId') || '').trim();
  if (!(file instanceof File) || !purchaseId || !businessId) return NextResponse.json({ message: 'File, purchase, and business are required.' }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ message: 'Documents must be between 1 byte and 10 MB.' }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ message: 'Use PDF, JPG, PNG, DOCX, or XLSX files.' }, { status: 400 });

  const auth = await authorize(request, businessId, purchaseId);
  if ('error' in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
  const storagePath = `${businessId}/${purchaseId}/${crypto.randomUUID()}-${cleanFileName(file.name)}`;
  const { error } = await auth.admin.storage.from(BUCKET).upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ message: `Upload failed: ${error.message}` }, { status: 502 });
  return NextResponse.json({ document: { name: file.name, storagePath, mimeType: file.type, size: file.size, uploadedBy: auth.actorId } }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const purchaseId = request.nextUrl.searchParams.get('purchaseId') || '';
  const businessId = request.nextUrl.searchParams.get('businessId') || '';
  const storagePath = request.nextUrl.searchParams.get('storagePath') || '';
  const auth = await authorize(request, businessId, purchaseId);
  if ('error' in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
  if (!storagePath.startsWith(`${businessId}/${purchaseId}/`)) return NextResponse.json({ message: 'Invalid document path.' }, { status: 403 });
  const { data, error } = await auth.admin.storage.from(BUCKET).createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ message: 'The document could not be opened.' }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null) as { purchaseId?: string; businessId?: string; storagePath?: string } | null;
  const purchaseId = body?.purchaseId || '';
  const businessId = body?.businessId || '';
  const storagePath = body?.storagePath || '';
  const auth = await authorize(request, businessId, purchaseId);
  if ('error' in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
  if (!storagePath.startsWith(`${businessId}/${purchaseId}/`)) return NextResponse.json({ message: 'Invalid document path.' }, { status: 403 });
  const { error } = await auth.admin.storage.from(BUCKET).remove([storagePath]);
  if (error) return NextResponse.json({ message: `Document removal failed: ${error.message}` }, { status: 502 });
  return NextResponse.json({ ok: true });
}
