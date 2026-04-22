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

export async function loadBusinessEmailConfig(businessId: string) {
  const response = await fetch(`/api/email/config/${encodeURIComponent(businessId)}`);
  const payload = await response.json().catch(() => ({
    ok: false,
    message: 'Business email config returned an invalid response.',
  }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || 'Business email config could not be loaded.');
  }

  return payload as { ok: true; config: BusinessEmailConfig | null };
}

export async function saveBusinessEmailConfig(input: SaveBusinessEmailConfigInput) {
  const response = await fetch('/api/email/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({
    ok: false,
    message: 'Business email config returned an invalid response.',
  }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || 'Business email config could not be saved.');
  }

  return payload as { ok: true; message: string; config: BusinessEmailConfig };
}
