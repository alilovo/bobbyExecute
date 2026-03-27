import { createHash } from "node:crypto";
import { z } from "zod";
import type { Config } from "./config-schema.js";
import type { RolloutPosture as LegacyRolloutPosture } from "./safety.js";

export const RuntimeModeSchema = z.enum(["disabled", "observe", "paper", "live_limited", "live"]);
export type RuntimeMode = z.infer<typeof RuntimeModeSchema>;

export const RuntimeRolloutPostureSchema = z.enum([
  "paper_only",
  "micro_live",
  "staged_live_candidate",
  "paused_or_rolled_back",
]);
export type RuntimeRolloutPosture = z.infer<typeof RuntimeRolloutPostureSchema>;

export const RuntimeExecutionTogglesSchema = z
  .object({
    tradingEnabled: z.boolean().default(false),
    liveTestMode: z.boolean().default(false),
    dryRun: z.boolean().default(true),
  })
  .strict();
export type RuntimeExecutionToggles = z.infer<typeof RuntimeExecutionTogglesSchema>;

export const RuntimeFilterConfigSchema = z
  .object({
    allowlistTokens: z.array(z.string().min(1)).default([]),
    denylistTokens: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type RuntimeFilterConfig = z.infer<typeof RuntimeFilterConfigSchema>;

export const RuntimeAdapterTogglesSchema = z
  .object({
    executionEnabled: z.boolean().default(true),
    publishEnabled: z.boolean().default(true),
    paperAdaptersEnabled: z.boolean().default(true),
  })
  .strict();
export type RuntimeAdapterToggles = z.infer<typeof RuntimeAdapterTogglesSchema>;

export const RuntimeRateCapsSchema = z
  .object({
    requireArm: z.boolean().default(true),
    maxNotionalPerTrade: z.number().min(0.000001).default(25),
    maxTradesPerWindow: z.number().int().min(1).default(2),
    windowMs: z.number().int().min(1000).default(60 * 60 * 1000),
    cooldownMs: z.number().int().min(0).default(60 * 1000),
    maxInFlight: z.number().int().min(1).default(1),
    failuresToBlock: z.number().int().min(1).default(3),
    failureWindowMs: z.number().int().min(1000).default(15 * 60 * 1000),
    maxDailyNotional: z.number().min(0.000001).optional(),
  })
  .strict();
export type RuntimeRateCaps = z.infer<typeof RuntimeRateCapsSchema>;

export const RuntimeThresholdsSchema = z
  .object({
    maxSlippagePercent: z.number().min(0).max(100).default(5),
    circuitBreakerFailureThreshold: z.number().int().min(1).default(5),
    circuitBreakerRecoveryMs: z.number().int().min(1000).default(60_000),
    reviewPolicyMode: z.enum(["none", "draft_only", "required"]).default("required"),
  })
  .strict();
export type RuntimeThresholds = z.infer<typeof RuntimeThresholdsSchema>;

export const RuntimeBehaviorSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    mode: RuntimeModeSchema.default("disabled"),
    rolloutPosture: RuntimeRolloutPostureSchema.default("paper_only"),
    executionToggles: RuntimeExecutionTogglesSchema.default({
      tradingEnabled: false,
      liveTestMode: false,
      dryRun: true,
    }),
    pollingIntervalMs: z.number().int().min(1000).default(15_000),
    filters: RuntimeFilterConfigSchema.default({
      allowlistTokens: [],
      denylistTokens: [],
    }),
    adapterToggles: RuntimeAdapterTogglesSchema.default({
      executionEnabled: true,
      publishEnabled: true,
      paperAdaptersEnabled: true,
    }),
    rateCaps: RuntimeRateCapsSchema.default({
      requireArm: true,
      maxNotionalPerTrade: 25,
      maxTradesPerWindow: 2,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 60 * 1000,
      maxInFlight: 1,
      failuresToBlock: 3,
      failureWindowMs: 15 * 60 * 1000,
      maxDailyNotional: 50,
    }),
    thresholds: RuntimeThresholdsSchema.default({
      maxSlippagePercent: 5,
      circuitBreakerFailureThreshold: 5,
      circuitBreakerRecoveryMs: 60_000,
      reviewPolicyMode: "required",
    }),
    featureFlags: z.record(z.boolean()).default({}),
    notes: z.string().min(1).optional(),
  })
  .strict();

export type RuntimeBehaviorConfig = z.infer<typeof RuntimeBehaviorSchema>;

export const RuntimeBehaviorPatchSchema = z
  .object({
    mode: RuntimeModeSchema.optional(),
    rolloutPosture: RuntimeRolloutPostureSchema.optional(),
    executionToggles: RuntimeExecutionTogglesSchema.partial().optional(),
    pollingIntervalMs: z.number().int().min(1000).optional(),
    filters: RuntimeFilterConfigSchema.partial().optional(),
    adapterToggles: RuntimeAdapterTogglesSchema.partial().optional(),
    rateCaps: RuntimeRateCapsSchema.partial().optional(),
    thresholds: RuntimeThresholdsSchema.partial().optional(),
    featureFlags: z.record(z.boolean()).optional(),
    notes: z.union([z.string().min(1), z.null()]).optional(),
  })
  .strict();

export type RuntimeBehaviorPatch = z.infer<typeof RuntimeBehaviorPatchSchema>;

export const RuntimeOverlaySchema = z
  .object({
    paused: z.boolean().default(false),
    pauseScope: z.enum(["soft", "hard"]).optional(),
    pauseReason: z.string().optional(),
    killSwitch: z.boolean().default(false),
    killSwitchReason: z.string().optional(),
    reloadNonce: z.number().int().min(0).default(0),
    pendingRestart: z.boolean().default(false),
    pendingReason: z.string().optional(),
  })
  .strict();

export type RuntimeOverlay = z.infer<typeof RuntimeOverlaySchema>;

export const RuntimeConfigDocumentSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    behavior: RuntimeBehaviorSchema,
    overlay: RuntimeOverlaySchema,
  })
  .strict();

export type RuntimeConfigDocument = z.infer<typeof RuntimeConfigDocumentSchema>;

export interface RuntimeConfigControlView {
  requestedMode: RuntimeMode;
  appliedMode: RuntimeMode;
  requestedExecutionMode: "dry" | "paper" | "live";
  appliedExecutionMode: "dry" | "paper" | "live";
  liveTestMode: boolean;
  rolloutPosture: RuntimeRolloutPosture;
  paused: boolean;
  pauseScope?: "soft" | "hard";
  pauseReason?: string;
  killSwitch: boolean;
  killSwitchReason?: string;
  reloadNonce: number;
  pendingApply: boolean;
  pendingReason?: string;
  requiresRestart: boolean;
  activeVersionId?: string;
  requestedVersionId?: string;
  appliedVersionId?: string;
  lastValidVersionId?: string;
  filters: RuntimeFilterConfig;
  adapterToggles: RuntimeAdapterToggles;
  rateCaps: RuntimeRateCaps;
  thresholds: RuntimeThresholds;
  featureFlags: Record<string, boolean>;
  pollingIntervalMs: number;
  degraded: boolean;
  degradedReason?: string;
  reasonCode?: string;
  reasonDetail?: string;
  lastReasonAt?: string;
  lastOperatorAction?:
    | "arm"
    | "disarm"
    | "kill"
    | "reset_kill"
    | "mode"
    | "pause"
    | "resume"
    | "kill_switch"
    | "reload"
    | "runtime_config";
  lastOperatorActionAt?: string;
}

export interface RuntimeConfigStatus {
  environment: string;
  configured: boolean;
  seedSource: "boot" | "persisted";
  requestedMode: RuntimeMode;
  appliedMode: RuntimeMode;
  requestedExecutionMode: "dry" | "paper" | "live";
  appliedExecutionMode: "dry" | "paper" | "live";
  rolloutPosture: RuntimeRolloutPosture;
  executionToggles: RuntimeExecutionToggles;
  filters: RuntimeFilterConfig;
  adapterToggles: RuntimeAdapterToggles;
  rateCaps: RuntimeRateCaps;
  thresholds: RuntimeThresholds;
  featureFlags: Record<string, boolean>;
  pollingIntervalMs: number;
  requestedVersionId?: string;
  activeVersionId?: string;
  appliedVersionId?: string;
  lastValidVersionId?: string;
  reloadNonce: number;
  lastAppliedReloadNonce: number;
  paused: boolean;
  pauseScope?: "soft" | "hard";
  pauseReason?: string;
  killSwitch: boolean;
  killSwitchReason?: string;
  pendingApply: boolean;
  pendingReason?: string;
  requiresRestart: boolean;
  degraded: boolean;
  degradedReason?: string;
  effectiveVersionHash?: string;
  requestedAt?: string;
  appliedAt?: string;
  lastAppliedAt?: string;
}

export function runtimeConfigDocumentHash(document: RuntimeConfigDocument): string {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

function parseIntEnv(raw: string | undefined, fallback: number, min: number): number {
  if (raw == null || raw.trim() === "") {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min) {
    throw new Error(`invalid integer '${raw}'`);
  }
  return value;
}

function parseFloatEnv(raw: string | undefined, fallback: number, min: number): number {
  if (raw == null || raw.trim() === "") {
    return fallback;
  }
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < min) {
    throw new Error(`invalid numeric '${raw}'`);
  }
  return value;
}

function parseBoolEnv(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === "") {
    return fallback;
  }
  return raw.trim().toLowerCase() === "true";
}

function parseCsv(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizeLegacyRolloutPosture(raw: string | undefined): RuntimeRolloutPosture {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    return "paper_only";
  }

  if (
    value === "paper_only" ||
    value === "micro_live" ||
    value === "staged_live_candidate" ||
    value === "paused_or_rolled_back"
  ) {
    return value;
  }

  throw new Error(`invalid rollout posture '${raw}'`);
}

function mapExecutionMode(mode: Config["executionMode"]): RuntimeMode {
  if (mode === "live") {
    return "live_limited";
  }
  if (mode === "paper") {
    return "paper";
  }
  return "observe";
}

function mergeFeatureFlags(raw: string | undefined): Record<string, boolean> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const output: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") {
        output[key] = value;
      }
    }
    return output;
  } catch {
    return {};
  }
}

export function buildRuntimeBehaviorSeed(
  config: Config,
  env: NodeJS.ProcessEnv = process.env
): RuntimeBehaviorConfig {
  const liveTestMode = parseBoolEnv(env.LIVE_TEST_MODE, config.liveTestMode);
  const mode = mapExecutionMode(config.executionMode);

  const seed = RuntimeBehaviorSchema.parse({
    schemaVersion: 1,
    mode,
    rolloutPosture: normalizeLegacyRolloutPosture(env.ROLLOUT_POSTURE),
    executionToggles: {
      tradingEnabled: parseBoolEnv(env.TRADING_ENABLED, config.tradingEnabled),
      liveTestMode,
      dryRun: parseBoolEnv(env.DRY_RUN, config.dryRun),
    },
    pollingIntervalMs: parseIntEnv(env.RUNTIME_POLLING_INTERVAL_MS, 15_000, 1000),
    filters: {
      allowlistTokens: parseCsv(env.MICRO_LIVE_ALLOWLIST_TOKENS),
      denylistTokens: parseCsv(env.RUNTIME_DENYLIST_TOKENS),
    },
    adapterToggles: {
      executionEnabled: parseBoolEnv(env.RUNTIME_EXECUTION_ENABLED, true),
      publishEnabled: parseBoolEnv(env.RUNTIME_PUBLISH_ENABLED, true),
      paperAdaptersEnabled: parseBoolEnv(env.RUNTIME_PAPER_ADAPTERS_ENABLED, true),
    },
    rateCaps: {
      requireArm: parseBoolEnv(env.MICRO_LIVE_REQUIRE_ARM, true),
      maxNotionalPerTrade: parseFloatEnv(env.MICRO_LIVE_MAX_NOTIONAL, 25, 0.000001),
      maxTradesPerWindow: parseIntEnv(env.MICRO_LIVE_MAX_TRADES_PER_WINDOW, 2, 1),
      windowMs: parseIntEnv(env.MICRO_LIVE_WINDOW_MS, 60 * 60 * 1000, 1000),
      cooldownMs: parseIntEnv(env.MICRO_LIVE_COOLDOWN_MS, 60 * 1000, 0),
      maxInFlight: parseIntEnv(env.MICRO_LIVE_MAX_INFLIGHT, 1, 1),
      failuresToBlock: parseIntEnv(env.MICRO_LIVE_FAILURES_TO_BLOCK, 3, 1),
      failureWindowMs: parseIntEnv(env.MICRO_LIVE_FAILURE_WINDOW_MS, 15 * 60 * 1000, 1000),
      maxDailyNotional:
        env.MICRO_LIVE_MAX_DAILY_NOTIONAL == null || env.MICRO_LIVE_MAX_DAILY_NOTIONAL.trim() === ""
          ? 50
          : parseFloatEnv(env.MICRO_LIVE_MAX_DAILY_NOTIONAL, 50, 0.000001),
    },
    thresholds: {
      maxSlippagePercent: parseFloatEnv(env.MAX_SLIPPAGE_PERCENT, config.maxSlippagePercent, 0),
      circuitBreakerFailureThreshold: parseIntEnv(
        env.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
        config.circuitBreakerFailureThreshold,
        1
      ),
      circuitBreakerRecoveryMs: parseIntEnv(
        env.CIRCUIT_BREAKER_RECOVERY_MS,
        config.circuitBreakerRecoveryMs,
        1000
      ),
      reviewPolicyMode: config.reviewPolicyMode,
    },
    featureFlags: mergeFeatureFlags(env.RUNTIME_FEATURE_FLAGS),
  });

  return seed;
}

export function buildRuntimeBehaviorFromSeed(
  seed: RuntimeBehaviorConfig,
  patch?: RuntimeBehaviorPatch
): RuntimeBehaviorConfig {
  if (!patch) {
    return seed;
  }

  const merged = {
    ...seed,
    ...patch,
    executionToggles: {
      ...seed.executionToggles,
      ...(patch.executionToggles ?? {}),
    },
    filters: {
      ...seed.filters,
      ...(patch.filters ?? {}),
    },
    adapterToggles: {
      ...seed.adapterToggles,
      ...(patch.adapterToggles ?? {}),
    },
    rateCaps: {
      ...seed.rateCaps,
      ...(patch.rateCaps ?? {}),
    },
    thresholds: {
      ...seed.thresholds,
      ...(patch.thresholds ?? {}),
    },
    featureFlags: {
      ...seed.featureFlags,
      ...(patch.featureFlags ?? {}),
    },
  } satisfies Record<string, unknown>;

  const normalized = RuntimeBehaviorSchema.parse(merged);
  return normalized;
}

export function isLiveModeFamily(mode: RuntimeMode): boolean {
  return mode === "live" || mode === "live_limited";
}

export function isPaperModeFamily(mode: RuntimeMode): boolean {
  return mode === "paper" || mode === "observe" || mode === "disabled";
}

export function deriveExecutionMode(mode: RuntimeMode): "dry" | "paper" | "live" {
  if (mode === "paper") {
    return "paper";
  }
  if (mode === "live" || mode === "live_limited") {
    return "live";
  }
  return "dry";
}

export function deriveLiveTestMode(mode: RuntimeMode, seed: RuntimeBehaviorConfig): boolean {
  if (mode === "paper" || mode === "observe" || mode === "disabled") {
    return false;
  }
  return seed.executionToggles.liveTestMode;
}

export function deriveRolloutPosture(
  mode: RuntimeMode,
  overlay: RuntimeOverlay,
  seed: RuntimeBehaviorConfig
): RuntimeRolloutPosture {
  if (overlay.killSwitch || overlay.paused) {
    return "paused_or_rolled_back";
  }

  if (mode === "paper") {
    return "paper_only";
  }

  if (mode === "live" || mode === "live_limited") {
    return seed.rolloutPosture;
  }

  return "paper_only";
}

export function fromLegacyRolloutPosture(posture: LegacyRolloutPosture | undefined): RuntimeRolloutPosture {
  if (!posture) {
    return "paper_only";
  }
  if (posture === "paper_only" || posture === "micro_live" || posture === "staged_live_candidate" || posture === "paused_or_rolled_back") {
    return posture;
  }
  return "paper_only";
}
