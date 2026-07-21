export type MagentoIntegrationStatus = {
  configured: boolean;
  baseUrl: string;
  storeCode: string;
};

export type MagentoHealthResponse = {
  ok: true;
  integration: MagentoIntegrationStatus;
};

export class BizPilotApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'BizPilotApiError';
  }
}

export function getBizPilotApiUrl(path: string) {
  const baseUrl = (process.env.BIZPILOT_API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export async function bizPilotApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(getBizPilotApiUrl(path), {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new BizPilotApiError(payload?.message || 'BizPilot API request failed.', response.status);
  }

  return payload as T;
}
