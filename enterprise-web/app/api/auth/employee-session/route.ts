import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

import { createEmployeeSessionToken, EMPLOYEE_SESSION_COOKIE, EMPLOYEE_SESSION_MAX_AGE } from '@/lib/employee-session';

function sessionSecret() {
  return process.env.BIZPILOT_EMPLOYEE_SESSION_SECRET || '';
}

export async function POST(request: NextRequest) {
  const secret = sessionSecret();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (secret.length < 32 || !url || !publishableKey) return NextResponse.json({ message: 'Employee server sessions are not configured.' }, { status: 503 });
  const body = await request.json().catch(() => null) as { identifier?: string; password?: string } | null;
  if (!body?.identifier?.trim() || !body.password?.trim()) return NextResponse.json({ message: 'Employee credentials are required.' }, { status: 400 });
  const supabase = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc('authenticate_employee_credential', { credential_identifier: body.identifier.trim(), credential_password: body.password.trim() });
  const employee = Array.isArray(data) ? data[0] : null;
  if (error || !employee) return NextResponse.json({ message: 'Employee credentials could not be verified.' }, { status: 401 });
  const token = createEmployeeSessionToken({ employeeId: employee.id, businessId: employee.business_id, role: employee.role }, secret);
  const response = NextResponse.json({ ok: true, expiresIn: EMPLOYEE_SESSION_MAX_AGE });
  response.cookies.set(EMPLOYEE_SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: EMPLOYEE_SESSION_MAX_AGE });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(EMPLOYEE_SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}
