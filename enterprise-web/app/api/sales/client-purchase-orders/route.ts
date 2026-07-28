import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { EMPLOYEE_SESSION_COOKIE, verifyEmployeeSessionToken } from '@/lib/employee-session';

// Shared private document bucket. Paths are prefixed with businessId/quotationId so sales and
// procurement uploads never collide. Point SUPABASE_DOCUMENTS_BUCKET at the per-environment bucket
// (e.g. documents_dev / documents_prod); defaults to `documents`.
const BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || 'documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf']);
const ALLOWED_ROLES = new Set(['Admin', 'GeneralManager', 'SalesManager', 'Accountant']);

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authorize(request: NextRequest, businessId: string, quotationId: string) {
  const admin = getAdminClient();
  if (!admin) return { error: 'Private sales document storage is not configured on the server.', status: 503 } as const;

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
      return { error: 'Your role cannot manage client purchase order documents.', status: 403 } as const;
    }
    actorId = employeeSession.employeeId;
    authorizedBusinessId = employeeSession.businessId;
  } else {
    return { error: 'Authentication is required.', status: 401 } as const;
  }

  const { data: quotation } = await admin.from('quotations').select('id').eq('id', quotationId).eq('business_id', authorizedBusinessId).maybeSingle();
  if (!quotation) return { error: 'Quotation not found for this business.', status: 404 } as const;
  return { admin, actorId, businessId: authorizedBusinessId } as const;
}

function cleanFileName(name: string) {
  const cleaned = name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+/, '').slice(-120);
  return cleaned || 'client-purchase-order.pdf';
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const quotationId = String(form?.get('quotationId') || '').trim();
  const businessId = String(form?.get('businessId') || '').trim();
  const poNumber = String(form?.get('poNumber') || '').trim();
  if (!(file instanceof File) || !quotationId || !businessId || !poNumber) return NextResponse.json({ message: 'File, quotation, business, and PO number are required.' }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ message: 'Client PO PDFs must be between 1 byte and 10 MB.' }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ message: 'Upload the client purchase order as a PDF.' }, { status: 400 });

  const auth = await authorize(request, businessId, quotationId);
  if ('error' in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
  const storagePath = `${businessId}/${quotationId}/${crypto.randomUUID()}-${cleanFileName(file.name)}`;
  const { error } = await auth.admin.storage.from(BUCKET).upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ message: `Upload failed: ${error.message}` }, { status: 502 });
  return NextResponse.json({ document: { poNumber, name: file.name, storagePath, mimeType: file.type, size: file.size, uploadedBy: auth.actorId } }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const quotationId = request.nextUrl.searchParams.get('quotationId') || '';
  const businessId = request.nextUrl.searchParams.get('businessId') || '';
  const storagePath = request.nextUrl.searchParams.get('storagePath') || '';
  const auth = await authorize(request, businessId, quotationId);
  if ('error' in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
  if (!storagePath.startsWith(`${businessId}/${quotationId}/`)) return NextResponse.json({ message: 'Invalid document path.' }, { status: 403 });
  const { data, error } = await auth.admin.storage.from(BUCKET).createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ message: 'The client PO could not be opened.' }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null) as { quotationId?: string; businessId?: string; storagePath?: string } | null;
  const quotationId = body?.quotationId || '';
  const businessId = body?.businessId || '';
  const storagePath = body?.storagePath || '';
  const auth = await authorize(request, businessId, quotationId);
  if ('error' in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
  if (!storagePath.startsWith(`${businessId}/${quotationId}/`)) return NextResponse.json({ message: 'Invalid document path.' }, { status: 403 });
  const { error } = await auth.admin.storage.from(BUCKET).remove([storagePath]);
  if (error) return NextResponse.json({ message: `Client PO removal failed: ${error.message}` }, { status: 502 });
  return NextResponse.json({ ok: true });
}
