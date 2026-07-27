import { describe, expect, it } from 'vitest';

import { createEmployeeSessionToken, EMPLOYEE_SESSION_MAX_AGE, verifyEmployeeSessionToken } from './employee-session';

const secret = 'test-only-session-secret-with-more-than-32-characters';
const issuedAt = Date.parse('2026-07-15T20:00:00.000Z');

describe('employee server sessions', () => {
  it('round-trips the minimal employee authorization claims', () => {
    const token = createEmployeeSessionToken({ employeeId: 'employee-1', businessId: 'business-1', role: 'Accountant' }, secret, issuedAt);
    expect(verifyEmployeeSessionToken(token, secret, issuedAt + 1_000)).toMatchObject({ employeeId: 'employee-1', businessId: 'business-1', role: 'Accountant' });
  });

  it('rejects tampered session payloads', () => {
    const token = createEmployeeSessionToken({ employeeId: 'employee-1', businessId: 'business-1', role: 'Accountant' }, secret, issuedAt);
    const [payload, signature] = token.split('.');
    expect(verifyEmployeeSessionToken(`${payload}x.${signature}`, secret, issuedAt + 1_000)).toBeNull();
  });

  it('rejects expired sessions', () => {
    const token = createEmployeeSessionToken({ employeeId: 'employee-1', businessId: 'business-1', role: 'Accountant' }, secret, issuedAt);
    expect(verifyEmployeeSessionToken(token, secret, issuedAt + EMPLOYEE_SESSION_MAX_AGE * 1_000 + 1)).toBeNull();
  });

  it('requires a strong signing secret', () => {
    expect(() => createEmployeeSessionToken({ employeeId: 'employee-1', businessId: 'business-1', role: 'Accountant' }, 'short', issuedAt)).toThrow(/32 characters/);
  });
});
