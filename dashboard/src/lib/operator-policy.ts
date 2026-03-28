export type DashboardOperatorRole = "viewer" | "operator" | "admin";

export type DashboardControlAction =
  | "read_only"
  | "pause"
  | "resume"
  | "acknowledge_restart_alert"
  | "resolve_restart_alert"
  | "emergency_stop"
  | "reset_kill_switch"
  | "restart_worker"
  | "mode_change"
  | "runtime_config_change"
  | "reload"
  | "live_promotion_request"
  | "live_promotion_approve"
  | "live_promotion_deny"
  | "live_promotion_apply"
  | "live_promotion_rollback";

export interface DashboardOperatorDescriptor {
  username: string;
  displayName: string;
  role: DashboardOperatorRole;
  active?: boolean;
}

export interface DashboardOperatorDirectoryEntry extends DashboardOperatorDescriptor {
  passwordHash: string;
  passwordSalt: string;
  passwordIterations?: number;
}

export interface DashboardOperatorSession {
  sessionId: string;
  actorId: string;
  displayName: string;
  role: DashboardOperatorRole;
  issuedAt: string;
  expiresAt: string;
}

export interface DashboardSessionEnvelope {
  version: 1;
  session: DashboardOperatorSession;
}

export const DASHBOARD_SESSION_COOKIE = "bobbyexecute_dashboard_session";
export const DASHBOARD_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const ROLE_RANK: Record<DashboardOperatorRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

const ADMIN_ONLY_ACTIONS = new Set<DashboardControlAction>([
  "emergency_stop",
  "reset_kill_switch",
  "restart_worker",
  "mode_change",
  "runtime_config_change",
  "reload",
  "live_promotion_request",
  "live_promotion_approve",
  "live_promotion_deny",
  "live_promotion_apply",
  "live_promotion_rollback",
]);

const OPERATOR_ACTIONS = new Set<DashboardControlAction>([
  "pause",
  "resume",
  "acknowledge_restart_alert",
  "resolve_restart_alert",
]);

const DEFAULT_ALLOWED_KEYS = new Set([
  "pause",
  "resume",
  "acknowledge_restart_alert",
  "resolve_restart_alert",
  "emergency_stop",
  "reset_kill_switch",
  "restart_worker",
  "mode_change",
  "runtime_config_change",
  "reload",
  "live_promotion_request",
  "live_promotion_approve",
  "live_promotion_deny",
  "live_promotion_apply",
  "live_promotion_rollback",
]);

export function compareOperatorRoles(left: DashboardOperatorRole, right: DashboardOperatorRole): number {
  return ROLE_RANK[left] - ROLE_RANK[right];
}

export function canRolePerformAction(role: DashboardOperatorRole | undefined, action: DashboardControlAction): boolean {
  if (!role) {
    return false;
  }

  if (action === "read_only") {
    return true;
  }

  if (ADMIN_ONLY_ACTIONS.has(action)) {
    return role === "admin";
  }

  if (OPERATOR_ACTIONS.has(action)) {
    return role === "operator" || role === "admin";
  }

  return false;
}

export function requiredRoleForAction(action: DashboardControlAction): DashboardOperatorRole | null {
  if (action === "read_only") {
    return null;
  }

  if (ADMIN_ONLY_ACTIONS.has(action)) {
    return "admin";
  }

  if (OPERATOR_ACTIONS.has(action)) {
    return "operator";
  }

  return "admin";
}

export function normalizeDashboardControlAction(value: string): DashboardControlAction | null {
  return DEFAULT_ALLOWED_KEYS.has(value) ? (value as DashboardControlAction) : null;
}

export function describeOperatorRole(role?: DashboardOperatorRole): string {
  switch (role) {
    case "admin":
      return "admin";
    case "operator":
      return "operator";
    case "viewer":
      return "viewer";
    default:
      return "unauthenticated";
  }
}

export function isDashboardOperatorRole(value: unknown): value is DashboardOperatorRole {
  return value === "viewer" || value === "operator" || value === "admin";
}
