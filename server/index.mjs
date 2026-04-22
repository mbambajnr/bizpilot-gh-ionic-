import http from 'node:http';

import {
  getBusinessEmailConfigForClient,
  saveBusinessEmailConfig,
} from './email/configStore.mjs';
import { createBusinessEmailService } from './email/createBusinessEmailService.mjs';

const host = process.env.EMAIL_SERVER_HOST || '127.0.0.1';
const port = Number(process.env.EMAIL_SERVER_PORT || 8787);
const emailService = createBusinessEmailService();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(body));
}

function validateEmailInput(payload) {
  const businessId = typeof payload.businessId === 'string' ? payload.businessId.trim() : '';
  const recipient = typeof payload.recipient === 'string' ? payload.recipient.trim() : '';
  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const businessName = typeof payload.businessName === 'string' ? payload.businessName.trim() : '';
  const logoUrl = typeof payload.logoUrl === 'string' ? payload.logoUrl.trim() : '';
  const fromEmail = typeof payload.fromEmail === 'string' ? payload.fromEmail.trim() : '';
  const fromName = typeof payload.fromName === 'string' ? payload.fromName.trim() : '';

  if (!businessId) {
    return { ok: false, message: 'Business ID is required.' };
  }

  if (!recipient) {
    return { ok: false, message: 'Recipient email is required.' };
  }

  if (!emailRegex.test(recipient)) {
    return { ok: false, message: 'Recipient email is invalid.' };
  }

  if (!subject) {
    return { ok: false, message: 'Subject is required.' };
  }

  if (!message) {
    return { ok: false, message: 'Message body is required.' };
  }

  if (subject.length > 200) {
    return { ok: false, message: 'Subject is too long.' };
  }

  if (message.length > 10000) {
    return { ok: false, message: 'Message body is too long.' };
  }

  if (fromEmail && !emailRegex.test(fromEmail)) {
    return { ok: false, message: 'Assigned sender email is invalid.' };
  }

  return {
    ok: true,
    data: {
      recipient,
      subject,
      message,
      businessName,
      logoUrl,
      businessId,
      fromEmail,
      fromName,
    },
  };
}

function validateEmailConfigInput(payload) {
  const businessId = typeof payload.businessId === 'string' ? payload.businessId.trim() : '';
  const smtpHost = typeof payload.smtpHost === 'string' ? payload.smtpHost.trim() : '';
  const smtpPort = Number(payload.smtpPort);
  const smtpUser = typeof payload.smtpUser === 'string' ? payload.smtpUser.trim() : '';
  const smtpPass = typeof payload.smtpPass === 'string' ? payload.smtpPass : '';
  const fromEmail = typeof payload.fromEmail === 'string' ? payload.fromEmail.trim() : '';
  const fromName = typeof payload.fromName === 'string' ? payload.fromName.trim() : '';

  if (!businessId) {
    return { ok: false, message: 'Business ID is required.' };
  }

  if (!smtpHost) {
    return { ok: false, message: 'SMTP host is required.' };
  }

  if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
    return { ok: false, message: 'SMTP port is invalid.' };
  }

  if (!smtpUser) {
    return { ok: false, message: 'SMTP username is required.' };
  }

  if (!fromEmail) {
    return { ok: false, message: 'From email is required.' };
  }

  if (!emailRegex.test(fromEmail)) {
    return { ok: false, message: 'From email is invalid.' };
  }

  if (!fromName) {
    return { ok: false, message: 'From name is required.' };
  }

  return {
    ok: true,
    data: {
      businessId,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      fromEmail,
      fromName,
    },
  };
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    json(response, 404, { ok: false, message: 'Not found.' });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/email/health') {
    json(response, 200, { ok: true, status: 'ready' });
    return;
  }

  if (request.method === 'GET' && request.url.startsWith('/api/email/config/')) {
    const businessId = decodeURIComponent(request.url.replace('/api/email/config/', '')).trim();

    if (!businessId) {
      json(response, 400, { ok: false, message: 'Business ID is required.' });
      return;
    }

    const config = await getBusinessEmailConfigForClient(businessId);
    json(response, 200, { ok: true, config });
    return;
  }

  if (request.method !== 'POST' || !['/api/email/send', '/api/email/config'].includes(request.url)) {
    json(response, 404, { ok: false, message: 'Not found.' });
    return;
  }

  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });

  request.on('end', async () => {
    try {
      const parsed = JSON.parse(body || '{}');

      if (request.url === '/api/email/config') {
        const validation = validateEmailConfigInput(parsed);

        if (!validation.ok) {
          json(response, 400, { ok: false, message: validation.message });
          return;
        }

        const saved = await saveBusinessEmailConfig(validation.data);
        json(response, 200, {
          ok: true,
          message: 'Business email system saved successfully.',
          config: saved,
        });
        return;
      }

      const validation = validateEmailInput(parsed);

      if (!validation.ok) {
        json(response, 400, { ok: false, message: validation.message });
        return;
      }

      const result = await emailService.sendEmail({
        businessId: validation.data.businessId,
        to: validation.data.recipient,
        subject: validation.data.subject,
        message: validation.data.message,
        businessName: validation.data.businessName,
        logoUrl: validation.data.logoUrl,
        fromEmailOverride: validation.data.fromEmail,
        fromNameOverride: validation.data.fromName,
      });

      json(response, 200, {
        ok: true,
        message: 'Email sent successfully.',
        messageId: result.messageId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email server error.';
      json(response, 500, { ok: false, message });
    }
  });
});

server.listen(port, host, () => {
  console.log(`[BizPilot Email] listening on http://${host}:${port}`);
});
