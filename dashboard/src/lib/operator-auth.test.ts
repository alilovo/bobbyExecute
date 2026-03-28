import { beforeEach, describe, expect, it } from 'vitest';
import {
  authenticateDashboardOperator,
  buildDashboardOperatorAssertion,
  parseDashboardOperatorAssertion,
  parseDashboardSessionCookie,
  serializeDashboardSessionCookie,
  hashDashboardOperatorPassword,
  isDashboardAuthConfigured,
} from './operator-auth';

const PASSWORD = 'correct horse battery staple';
const SALT = 'operator-auth-test-salt';

beforeEach(() => {
  delete process.env.DASHBOARD_SESSION_SECRET;
  delete process.env.DASHBOARD_OPERATOR_DIRECTORY_JSON;
  delete process.env.DASHBOARD_OPERATOR_REGISTRY_JSON;
  delete process.env.DASHBOARD_OPERATORS_JSON;
  delete process.env.CONTROL_TOKEN;
});

describe('operator auth helpers', () => {
  it('authenticates configured operators and rejects expired sessions', () => {
    process.env.DASHBOARD_SESSION_SECRET = 'dashboard-session-secret';
    process.env.DASHBOARD_OPERATOR_DIRECTORY_JSON = JSON.stringify([
      {
        username: 'alice',
        displayName: 'Alice Example',
        role: 'admin',
        passwordSalt: SALT,
        passwordHash: hashDashboardOperatorPassword(PASSWORD, SALT),
      },
    ]);

    expect(isDashboardAuthConfigured(process.env)).toBe(true);
    const authResult = authenticateDashboardOperator('alice', PASSWORD, process.env);
    expect(authResult.authenticated).toBe(true);
    if (authResult.authenticated) {
      const cookie = serializeDashboardSessionCookie(authResult.session, process.env);
      const parsed = parseDashboardSessionCookie(cookie, process.env);
      expect(parsed).toMatchObject({
        actorId: 'alice',
        role: 'admin',
      });

      const expired = parseDashboardSessionCookie(
        serializeDashboardSessionCookie(
          {
            ...authResult.session,
            expiresAt: '2020-01-01T00:00:00.000Z',
          },
          process.env
        ),
        process.env
      );
      expect(expired).toBeNull();
    }
  });

  it('round-trips signed operator assertions without exposing the control token', () => {
    process.env.CONTROL_TOKEN = 'control-token-secret';
    const assertion = buildDashboardOperatorAssertion(
      {
        sessionId: 'session-1',
        actorId: 'alice',
        displayName: 'Alice Example',
        role: 'admin',
        issuedAt: '2026-03-27T12:00:00.000Z',
        expiresAt: '2026-03-27T20:00:00.000Z',
      },
      {
        action: 'mode_change',
        target: '/control/mode',
        requestId: 'req-1',
        authResult: 'authorized',
        reason: 'governed change',
      },
      process.env
    );

    expect(assertion).not.toContain('control-token-secret');
    const parsed = parseDashboardOperatorAssertion(assertion, process.env);
    expect(parsed).toMatchObject({
      actorId: 'alice',
      displayName: 'Alice Example',
      role: 'admin',
      authResult: 'authorized',
      action: 'mode_change',
      target: '/control/mode',
      requestId: 'req-1',
      reason: 'governed change',
    });
  });
});
