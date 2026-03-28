CREATE TABLE IF NOT EXISTS runtime_visibility_snapshots (
  id text PRIMARY KEY,
  environment text NOT NULL UNIQUE,
  worker_id text NOT NULL,
  snapshot_json jsonb NOT NULL,
  last_heartbeat_at timestamptz NOT NULL,
  last_cycle_at timestamptz,
  last_seen_reload_nonce integer,
  last_applied_version_id text,
  last_valid_version_id text,
  degraded boolean NOT NULL DEFAULT false,
  degraded_reason text,
  error_state text,
  observed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS runtime_visibility_snapshots_environment_updated_at_idx
  ON runtime_visibility_snapshots (environment, updated_at DESC);
