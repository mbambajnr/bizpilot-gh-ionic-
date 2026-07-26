import { NextRequest, NextResponse } from 'next/server';

import { getBisaPilotApiUrl } from '@/lib/bizpilot-api';

const supportedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

async function proxyRequest(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!supportedMethods.has(request.method)) {
    return NextResponse.json({ ok: false, message: 'Method not allowed.' }, { status: 405 });
  }

  const { path } = await context.params;
  const upstreamUrl = new URL(getBisaPilotApiUrl(`/api/${path.join('/')}`));
  upstreamUrl.search = request.nextUrl.search;

  const headers = new Headers({ Accept: 'application/json' });
  const authorization = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  if (authorization) headers.set('Authorization', authorization);
  if (contentType) headers.set('Content-Type', contentType);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
      cache: 'no-store',
    });
    const body = await upstream.text();

    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'The BisaPilot service is currently unavailable.' },
      { status: 503 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
