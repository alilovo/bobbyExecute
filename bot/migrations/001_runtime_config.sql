CREATE TABLE IF NOT EXISTS runtime_config_versions (
  id text PRIMARY KEY,
  environment text NOT NULL,
  version_number integer NOT NULL,
  schema_version integer NOT NULL,
  config_json jsonb NOT NULL,
  config_hash text NOT NULL,
  previous_version_id text,
  status text NOT NULL,
  created_by text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL,
  activated_at timestamptz,
  activated_by text,
  applied_at timestamptz,
  applied_by text,
  UNIQUE (environment, version_number)
);

CREATE INDEX IF NOT EXISTS runtime_config_versions_environment_created_at_idx
  ON runtime_config_versions (environment, created_at DESC);

CREATE INDEX IF NOT EXISTS runtime_config_versions_environment_status_idx
  ON runtime_config_versions (environment, status);

CREATE TABLE IF NOT EXISTS runtime_config_active (
  environment text PRIMARY KEY,
  active_version_id text NOT NULL,
  requested_version_id text NOT NULL,
  applied_version_id text NOT NULL,
  last_valid_version_id text NOT NULL,
  reload_nonce integer NOT NULL DEFAULT 0,
  paused boolean NOT NULL DEFAULT false,
  pause_scope text,
  pause_reason text,
  kill_switch boolean NOT NULL DEFAULT false,
  kill_switch_reason text,
  pending_apply boolean NOT NULL DEFAULT false,
  pending_reason text,
  requires_restart boolean NOT NULL DEFAULT false,
  requested_at timestamptz NOT NULL,
  applied_at timestamptz,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS runtime_config_active_environment_idx
  ON runtime_config_active (environment);

CREATE TABLE IF NOT EXISTS config_change_log (
  id text PRIMARY KEY,
  environment text NOT NULL,
  version_id text,
  action text NOT NULL,
  actor text NOT NULL,
  accepted boolean NOT NULL,
  before_config jsonb,
  after_config jsonb,
  before_overlay jsonb,
  after_overlay jsonb,
  reason text,
  rejection_reason text,
  result_version_id text,
  reload_nonce integer NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS config_change_log_environment_created_at_idx
  ON config_change_log (environment, created_at DESC);
