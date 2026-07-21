import { createHmac, timingSafeEqual } from 'node:crypto';

export const EMPLOYEE_SESSION_COOKIE = 'bizpilot_employee_session';
export const EMPLOYEE_SESSION_MAX_AGE = 8 * 60 * 60;

export type EmployeeServerSession = {
  employeeId: string;
  businessId: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
};

function encode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signature(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createEmployeeSessionToken(input: Omit<EmployeeServerSession, 'issuedAt' | 'expiresAt'>, secret: string, now = Date.now()) {
  if (secret.length < 32) throw new Error('Employee session secret must contain at least 32 characters.');
  const session: EmployeeServerSession = { ...input, issuedAt: now, expiresAt: now + EMPLOYEE_SESSION_MAX_AGE * 1000 };
  const payload = encode(JSON.stringify(session));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyEmployeeSessionToken(token: string | undefined, secret: string, now = Date.now()): EmployeeServerSession | null {
  if (!token || secret.length < 32) return null;
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = signature(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as EmployeeServerSession;
    if (!session.employeeId || !session.businessId || !session.role || session.expiresAt <= now || session.issuedAt > now + 60_000) return null;
    return session;
  } catch {
    return null;
  }
}
