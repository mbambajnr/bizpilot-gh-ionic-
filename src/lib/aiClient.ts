/**
 * Thin client for the provider-agnostic AI gateway (server route `/api/ai/*`, reached through the
 * BisaPilot proxy at `/api/bizpilot/ai/*`). Every call fails soft: if the model is not configured or the
 * gateway is unreachable, callers fall back to the deterministic behaviour they already have.
 */

export type AiStatus = { configured: boolean; provider: string; model: string };

export async function fetchAiStatus(): Promise<AiStatus | null> {
  try {
    const response = await fetch('/api/bizpilot/ai/health', { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    if (!payload?.ok) return null;
    return { configured: Boolean(payload.configured), provider: String(payload.provider ?? ''), model: String(payload.model ?? '') };
  } catch {
    return null;
  }
}

/** Returns the model's text, or null on any failure (unconfigured, offline, bad response). */
export async function aiComplete(input: { system?: string; prompt: string }): Promise<string | null> {
  try {
    const response = await fetch('/api/bizpilot/ai/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || typeof payload.text !== 'string') return null;
    return payload.text;
  } catch {
    return null;
  }
}
