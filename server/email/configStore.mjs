import fs from 'node:fs/promises';
import path from 'node:path';

import { decryptSecret, encryptSecret } from './crypto.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const STORE_PATH = path.join(DATA_DIR, 'business-email-configs.json');

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  return JSON.parse(raw || '{}');
}

async function writeStore(payload) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

function toPublicConfig(config) {
  if (!config) {
    return null;
  }

  return {
    businessId: config.businessId,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpUser: config.smtpUser,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    hasPassword: Boolean(config.smtpPass),
    updatedAt: config.updatedAt,
  };
}

export async function getBusinessEmailConfig(businessId) {
  const store = await readStore();
  return store[businessId] ?? null;
}

export async function getBusinessEmailConfigForClient(businessId) {
  const config = await getBusinessEmailConfig(businessId);
  return toPublicConfig(config);
}

export async function saveBusinessEmailConfig(input) {
  const store = await readStore();
  const existing = store[input.businessId] ?? null;
  const nextPassword = input.smtpPass?.trim() || '';

  if (!existing?.smtpPass && !nextPassword) {
    throw new Error('SMTP password is required the first time you configure a business mailing system.');
  }

  const nextConfig = {
    businessId: input.businessId,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpUser: input.smtpUser,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    smtpPass:
      nextPassword
        ? encryptSecret(nextPassword)
        : existing?.smtpPass ?? null,
    updatedAt: new Date().toISOString(),
  };

  store[input.businessId] = nextConfig;
  await writeStore(store);

  return toPublicConfig(nextConfig);
}

export async function getBusinessEmailTransportConfig(businessId) {
  const config = await getBusinessEmailConfig(businessId);

  if (!config) {
    throw new Error('No business email system is configured yet. Ask an owner or admin to set it up in Settings.');
  }

  if (!config.smtpPass) {
    throw new Error('This business email system is missing its SMTP password.');
  }

  return {
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpUser: config.smtpUser,
    smtpPass: decryptSecret(config.smtpPass),
    fromEmail: config.fromEmail,
    fromName: config.fromName,
  };
}
