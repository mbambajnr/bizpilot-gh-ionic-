export type BusinessEmailConfig = {
  businessId: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  fromEmail: string;
  fromName: string;
  hasPassword: boolean;
  updatedAt?: string;
};

export type SaveBusinessEmailConfigInput = {
  businessId: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass?: string;
  fromEmail: string;
  fromName: string;
};

async function parseApiPayload(response: Response, fallbackMessage: string) {
  const rawText = await response.text();

  if (!rawText.trim()) {
    return { ok: false, message: fallbackMessage };
  }

  try {
    return JSON.parse(rawText) as { ok?: boolean; message?: string; config?: BusinessEmailConfig | null };
  } catch {
    return { ok: false, message: fallbackMessage };
  }
}

export async function loadBusinessEmailConfig(businessId: string) {
  let response: Response;
  try {
    response = await fetch(`/api/email/config/${encodeURIComponent(businessId)}`);
  } catch {
    throw new Error('Business email service is unavailable. Start the email server and try again.');
  }
  const payload = await parseApiPayload(response, 'Business email config returned an invalid response.');

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || 'Business email config could not be loaded.');
  }

  return payload as { ok: true; config: BusinessEmailConfig | null };
}

export async function saveBusinessEmailConfig(input: SaveBusinessEmailConfigInput) {
  let response: Response;
  try {
    response = await fetch('/api/email/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('Business email service is unavailable. Start the email server and try again.');
  }

  const payload = await parseApiPayload(response, 'Business email config returned an invalid response.');

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || 'Business email config could not be saved.');
  }

  return payload as { ok: true; message: string; config: BusinessEmailConfig };
}
