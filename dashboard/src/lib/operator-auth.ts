import "server-only";

import { createHmac, pbkdf2Sync, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  DashboardControlAction,
  DashboardOperatorDirectoryEntry,
  DashboardOperatorRole,
  DashboardOperatorSession,
  DashboardSessionEnvelope,
} from "./operator-policy";
import { DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_MAX_AGE_SECONDS, isDashboardOperatorRole } from "./operator-policy";
import { resolveControlServiceToken } from "./control-client";

const DEFAULT_PASSWORD_ITERATIONS = 120_000;
const SIGNATURE_SECRET_ALGORITHM = "sha256";

export const DASHBOARD_OPERATOR_DIRECTORY_ENV = "DASHBOARD_OPERATOR_DIRECTORY_JSON";
export const DASHBOARD_SESSION_SECRET_ENV = "DASHBOARD_SESSION_SECRET";

export type DashboardAuthResult =
  | {
      configured: true;
      authenticated: true;
      session: DashboardOperatorSession;
      operator: DashboardOperatorDirectoryEntry;
    }
  | {
      configured: true;
      authenticated: false;
      reason: string;
    }
  | {
      configured: false;
      authenticated: false;
      reason: string;
    };

export interface DashboardOperatorAssertion {
  version: 1;
  actorId: string;
  displayName: string;
  role: DashboardOperatorRole;
  sessionId: string;
  issuedAt: string;
  expiresAt: string;
  authResult: "authorized" | "denied";
  action: DashboardControlAction;
  target: string;
  requestId?: string;
  reason?: string;
}

export interface DashboardOperatorAssertionContext {
  action: DashboardControlAction;
  target: string;
  requestId?: string;
  authResult: "authorized" | "denied";
  reason?: string;
}

export interface DashboardSessionCookieSettings {
  name?: string;
  maxAgeSeconds?: number;
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function getNowIso(): string {
  return new Date().toISOString();
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(payload: string, secret: string): string {
  return createHmac(SIGNATURE_SECRET_ALGORITHM, secret).update(payload).digest("base64url");
}

function serializeSignedEnvelope<T extends object>(envelope: T, secret: string): string {
  const payload = base64UrlEncode(JSON.stringify(envelope));
  const signature = signValue(payload, secret);
  return `${payload}.${signature}`;
}

function parseSignedEnvelope<T extends object>(value: string | undefined, secret: string): T | null {
  const raw = trimOrUndefined(value);
  if (!raw) {
    return null;
  }

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) {
    return null;
  }

  let parsedPayload: T;
  try {
    const decoded = base64UrlDecode(payload);
    parsedPayload = JSON.parse(decoded) as T;
  } catch {
    return null;
  }

  const expected = signValue(payload, secret);
  const actual = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) {
    return null;
  }

  return parsedPayload;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const trimmed = trimOrUndefined(value);
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isDashboardAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(resolveDashboardSessionSecret(env) && loadDashboardOperatorDirectory(env).length > 0);
}

export function resolveDashboardSessionSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return trimOrUndefined(env[DASHBOARD_SESSION_SECRET_ENV]);
}

export function loadDashboardOperatorDirectory(env: NodeJS.ProcessEnv = process.env): DashboardOperatorDirectoryEntry[] {
  const raw =
    trimOrUndefined(env[DASHBOARD_OPERATOR_DIRECTORY_ENV]) ??
    trimOrUndefined(env.DASHBOARD_OPERATOR_REGISTRY_JSON) ??
    trimOrUndefined(env.DASHBOARD_OPERATORS_JSON);
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("DASHBOARD_OPERATOR_DIRECTORY_JSON must be a JSON array of operators.");
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`dashboard operator directory entry ${index} must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    const username = trimOrUndefined(typeof record.username === "string" ? record.username : undefined);
    const displayName = trimOrUndefined(typeof record.displayName === "string" ? record.displayName : undefined);
    const role = typeof record.role === "string" && isDashboardOperatorRole(record.role) ? record.role : undefined;
    const passwordHash = trimOrUndefined(typeof record.passwordHash === "string" ? record.passwordHash : undefined);
    const passwordSalt = trimOrUndefined(typeof record.passwordSalt === "string" ? record.passwordSalt : undefined);
    if (!username || !displayName || !role || !passwordHash || !passwordSalt) {
      throw new Error("dashboard operator directory entries must include username, displayName, role, passwordHash, and passwordSalt.");
    }

    return {
      username,
      displayName,
      role,
      active: record.active == null ? true : Boolean(record.active),
      passwordHash,
      passwordSalt,
      passwordIterations: parsePositiveInteger(
        typeof record.passwordIterations === "string" ? record.passwordIterations : undefined,
        typeof record.passwordIterations === "number" ? record.passwordIterations : DEFAULT_PASSWORD_ITERATIONS
      ),
    } satisfies DashboardOperatorDirectoryEntry;
  });
}

export function findDashboardOperator(username: string, env: NodeJS.ProcessEnv = process.env): DashboardOperatorDirectoryEntry | null {
  const normalizedUsername = trimOrUndefined(username);
  if (!normalizedUsername) {
    return null;
  }

  return loadDashboardOperatorDirectory(env).find((entry) => entry.active !== false && entry.username === normalizedUsername) ?? null;
}

export function hashDashboardOperatorPassword(password: string, salt: string, iterations = DEFAULT_PASSWORD_ITERATIONS): string {
  return pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("base64url");
}

export function authenticateDashboardOperator(
  username: string,
  password: string,
  env: NodeJS.ProcessEnv = process.env
): DashboardAuthResult {
  const directory = loadDashboardOperatorDirectory(env);
  if (directory.length === 0 || !resolveDashboardSessionSecret(env)) {
    return {
      configured: false,
      authenticated: false,
      reason: "dashboard operator auth is not configured",
    };
  }

  const operator = directory.find((entry) => entry.active !== false && entry.username === trimOrUndefined(username));
  if (!operator) {
    return {
      configured: true,
      authenticated: false,
      reason: "invalid operator credentials",
    };
  }

  const expected = Buffer.from(
    hashDashboardOperatorPassword(password, operator.passwordSalt, operator.passwordIterations ?? DEFAULT_PASSWORD_ITERATIONS),
    "base64url"
  );
  const actual = Buffer.from(operator.passwordHash, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return {
      configured: true,
      authenticated: false,
      reason: "invalid operator credentials",
    };
  }

  const now = Date.now();
  const session: DashboardOperatorSession = {
    sessionId: randomUUID(),
    actorId: operator.username,
    displayName: operator.displayName,
    role: operator.role,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DASHBOARD_SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
  };

  return {
    configured: true,
    authenticated: true,
    session,
    operator,
  };
}

export function buildDashboardSessionEnvelope(session: DashboardOperatorSession): DashboardSessionEnvelope {
  return {
    version: 1,
    session,
  };
}

export function serializeDashboardSessionCookie(
  session: DashboardOperatorSession,
  env: NodeJS.ProcessEnv = process.env
): string {
  const secret = resolveDashboardSessionSecret(env);
  if (!secret) {
    throw new Error("DASHBOARD_SESSION_SECRET must be configured to issue operator sessions.");
  }

  return serializeSignedEnvelope(buildDashboardSessionEnvelope(session), secret);
}

export function parseDashboardSessionCookie(
  value: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): DashboardOperatorSession | null {
  const secret = resolveDashboardSessionSecret(env);
  if (!secret) {
    return null;
  }

  const envelope = parseSignedEnvelope<DashboardSessionEnvelope>(value, secret);
  if (!envelope || envelope.version !== 1 || !envelope.session) {
    return null;
  }

  const expiresAtMs = Date.parse(envelope.session.expiresAt);
  const issuedAtMs = Date.parse(envelope.session.issuedAt);
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(issuedAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }

  return envelope.session;
}

export function buildDashboardSessionCookie(
  session: DashboardOperatorSession,
  env: NodeJS.ProcessEnv = process.env,
  settings: DashboardSessionCookieSettings = {}
): {
  name: string;
  value: string;
  maxAge: number;
} {
  return {
    name: settings.name ?? DASHBOARD_SESSION_COOKIE,
    value: serializeDashboardSessionCookie(session, env),
    maxAge: settings.maxAgeSeconds ?? DASHBOARD_SESSION_MAX_AGE_SECONDS,
  };
}

export function buildDashboardOperatorAssertion(
  session: DashboardOperatorSession | null,
  context: DashboardOperatorAssertionContext,
  env: NodeJS.ProcessEnv = process.env
): string {
  const secret = resolveControlServiceToken(env);
  const now = getNowIso();
  const payload: DashboardOperatorAssertion = session
    ? {
        version: 1,
        actorId: session.actorId,
        displayName: session.displayName,
        role: session.role,
        sessionId: session.sessionId,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt,
        authResult: context.authResult,
        action: context.action,
        target: context.target,
        requestId: context.requestId,
        reason: context.reason,
      }
    : {
        version: 1,
        actorId: "anonymous",
        displayName: "anonymous",
        role: "viewer",
        sessionId: "anonymous",
        issuedAt: now,
        expiresAt: now,
        authResult: context.authResult,
        action: context.action,
        target: context.target,
        requestId: context.requestId,
        reason: context.reason,
      };

  return serializeSignedEnvelope(payload, secret);
}

export function parseDashboardOperatorAssertion(
  value: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): DashboardOperatorAssertion | null {
  const secret = resolveControlServiceToken(env);
  return parseSignedEnvelope<DashboardOperatorAssertion>(value, secret);
}

export function buildDashboardOperatorIdentityLabel(session?: DashboardOperatorSession | null): string {
  if (!session) {
    return "unauthenticated";
  }

  return `${session.displayName} (${session.role})`;
}

export function isDashboardSessionActive(session?: DashboardOperatorSession | null): session is DashboardOperatorSession {
  return Boolean(session && Date.parse(session.expiresAt) > Date.now());
}
