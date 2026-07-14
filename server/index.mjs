import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getBusinessEmailConfigForClient,
  saveBusinessEmailConfig,
} from './email/configStore.mjs';
import { createBusinessEmailService } from './email/createBusinessEmailService.mjs';
import { createMagentoPosOrder, fetchMagentoCatalog, getMagentoIntegrationStatus } from './magento/client.mjs';
import { createCorsPolicy, createSecurity } from './security.mjs';
import { createStaticServer } from './static.mjs';

const host = process.env.HOST || process.env.EMAIL_SERVER_HOST || '127.0.0.1';
const port = Number(process.env.PORT || process.env.EMAIL_SERVER_PORT || 8787);
const emailService = createBusinessEmailService();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const security = createSecurity();
const applyCors = createCorsPolicy();
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const serveStatic = createStaticServer(distDir);

const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
if (!security.configured && !isLoopback) {
  console.error(
    '[BizPilot Server] Refusing to bind to a non-loopback address without authentication. ' +
      'Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.server so API requests can be verified.'
  );
  process.exit(1);
}
if (!security.configured) {
  console.warn(
    '[BizPilot Server] OPEN DEV MODE: Supabase auth env is not set, API routes are unauthenticated. ' +
      'This is only acceptable on 127.0.0.1.'
  );
}

/**
 * Authenticates the request when Supabase auth is configured.
 * Returns the verified user (or a stub in open dev mode); null means a 401
 * has already been written.
 */
async function requireUser(request, response) {
  if (!security.configured) {
    return { id: 'dev', email: '' };
  }
  const token = security.readBearerToken(request);
  const user = token ? await security.verifyToken(token) : null;
  if (!user) {
    json(response, 401, { ok: false, message: 'Sign in to use this feature.' });
    return null;
  }
  return { ...user, token };
}

/**
 * Business-scoped routes additionally require that Supabase RLS lets the
 * caller see the business — tenant isolation is enforced by the same policy
 * the app's data layer relies on.
 */
async function requireBusinessAccess(request, response, businessId) {
  const user = await requireUser(request, response);
  if (!user) {
    return null;
  }
  if (!security.configured) {
    return user;
  }
  const allowed = await security.canAccessBusiness(user.token, businessId);
  if (!allowed) {
    json(response, 403, { ok: false, message: 'You do not have access to this business.' });
    return null;
  }
  return user;
}

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

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function validateMagentoOrderInput(payload) {
  const branchId = Number(payload?.branchId);
  const customer = payload?.customer && typeof payload.customer === 'object' ? payload.customer : {};
  const name = typeof customer.name === 'string' ? customer.name.trim() : '';
  const email = typeof customer.email === 'string' ? customer.email.trim() : '';
  const phone = typeof customer.phone === 'string' ? customer.phone.trim() : '';
  const paymentMethod = typeof payload?.paymentMethod === 'string' ? payload.paymentMethod.trim() : '';
  const paymentReference = typeof payload?.paymentReference === 'string' ? payload.paymentReference.trim() : '';
  const clientRef = typeof payload?.clientRef === 'string' ? payload.clientRef.trim() : '';
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  const items = rawItems.map((item) => ({
    sku: typeof item?.sku === 'string' ? item.sku.trim() : '',
    quantity: Number(item?.quantity),
  }));

  if (!Number.isInteger(branchId) || branchId <= 0) {
    return { ok: false, message: 'Choose a valid store branch.' };
  }
  if (!name || name.length > 120) {
    return { ok: false, message: 'Enter a customer name of no more than 120 characters.' };
  }
  if (email && !emailRegex.test(email)) {
    return { ok: false, message: 'Enter a valid customer email address.' };
  }
  if (!['Cash', 'Mobile Money', 'Bank Account'].includes(paymentMethod)) {
    return { ok: false, message: 'Choose a supported payment method.' };
  }
  if (items.length === 0 || items.length > 100) {
    return { ok: false, message: 'Add between 1 and 100 products to the order.' };
  }
  if (items.some((item) => !item.sku || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    return { ok: false, message: 'Each order item needs a valid SKU and whole-number quantity.' };
  }
  if (clientRef.length > 64) {
    return { ok: false, message: 'clientRef must be 64 characters or fewer.' };
  }

  return {
    ok: true,
    data: {
      branchId,
      customer: { name, email, phone },
      paymentMethod,
      paymentReference,
      clientRef,
      items,
    },
  };
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    json(response, 404, { ok: false, message: 'Not found.' });
    return;
  }

  const cors = applyCors(request, response);
  if (!cors.proceed) {
    return;
  }

  // ---- Public health probes ----

  if (request.method === 'GET' && request.url === '/api/email/health') {
    json(response, 200, { ok: true, status: 'ready' });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/magento/health') {
    json(response, 200, { ok: true, integration: getMagentoIntegrationStatus() });
    return;
  }

  // ---- Authenticated: Magento POS ----

  if (request.method === 'GET' && request.url === '/api/magento/catalog') {
    if (!(await requireUser(request, response))) {
      return;
    }
    try {
      const catalog = await fetchMagentoCatalog();
      json(response, 200, { ok: true, catalog });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Magento catalog synchronization failed.';
      json(response, 502, { ok: false, message });
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/magento/orders') {
    if (!(await requireUser(request, response))) {
      return;
    }
    try {
      const payload = await readJsonBody(request);
      const validation = validateMagentoOrderInput(payload);
      if (!validation.ok) {
        json(response, 400, { ok: false, message: validation.message });
        return;
      }

      const order = await createMagentoPosOrder(validation.data);
      json(response, 201, { ok: true, order });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Magento POS checkout failed.';
      json(response, 502, { ok: false, message });
    }
    return;
  }

  // ---- Authenticated + business-scoped: email ----

  if (request.method === 'GET' && request.url.startsWith('/api/email/config/')) {
    const businessId = decodeURIComponent(request.url.replace('/api/email/config/', '')).trim();

    if (!businessId) {
      json(response, 400, { ok: false, message: 'Business ID is required.' });
      return;
    }
    if (!(await requireBusinessAccess(request, response, businessId))) {
      return;
    }

    const config = await getBusinessEmailConfigForClient(businessId);
    json(response, 200, { ok: true, config });
    return;
  }

  if (request.method === 'POST' && ['/api/email/send', '/api/email/config'].includes(request.url)) {
    try {
      const parsed = await readJsonBody(request);

      if (request.url === '/api/email/config') {
        const validation = validateEmailConfigInput(parsed);

        if (!validation.ok) {
          json(response, 400, { ok: false, message: validation.message });
          return;
        }
        if (!(await requireBusinessAccess(request, response, validation.data.businessId))) {
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
      if (!(await requireBusinessAccess(request, response, validation.data.businessId))) {
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
    return;
  }

  // Unknown /api routes are 404s; anything else is the web app.
  if (request.url.startsWith('/api/')) {
    json(response, 404, { ok: false, message: 'Not found.' });
    return;
  }

  if (serveStatic && serveStatic(request, response)) {
    return;
  }

  json(response, 404, { ok: false, message: 'Not found. Build the web app (npm run build) to serve it from this server.' });
});

server.listen(port, host, () => {
  const mode = serveStatic ? 'web app + API' : 'API only (no dist/ build found)';
  console.log(`[BizPilot Server] listening on http://${host}:${port} — ${mode}`);
});
