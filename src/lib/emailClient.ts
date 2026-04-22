export type SendEmailInput = {
  businessId: string;
  recipient: string;
  subject: string;
  message: string;
  businessName?: string;
  logoUrl?: string;
  fromEmail?: string;
  fromName?: string;
};

export async function sendEmail(input: SendEmailInput) {
  const response = await fetch('/api/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({
    ok: false,
    message: 'Email server returned an invalid response.',
  }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || 'Email could not be sent.');
  }

  return payload as { ok: true; message: string; messageId?: string };
}
