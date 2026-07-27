import { NextResponse } from 'next/server';

/**
 * Reports whether server-side private document storage is configured, so the UI can guide the user
 * instead of letting an upload dead-end. Returns only a boolean — never any key material.
 */
export function GET() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return NextResponse.json({ configured: Boolean(url && serviceKey) });
}
