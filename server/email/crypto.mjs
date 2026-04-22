import crypto from 'node:crypto';

function getSecret() {
  const secret = process.env.EMAIL_CONFIG_SECRET;
  if (!secret) {
    throw new Error('Missing required server environment variable: EMAIL_CONFIG_SECRET');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(value) {
  const key = getSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    value: encrypted.toString('base64'),
  };
}

export function decryptSecret(payload) {
  const key = getSecret();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64')
  );

  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.value, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
