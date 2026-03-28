CREATE TABLE IF NOT EXISTS control_operator_audit_log (
  id text PRIMARY KEY,
  environment text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  result text NOT NULL,
  actor_id text NOT NULL,
  actor_display_name text NOT NULL,
  actor_role text NOT NULL,
  session_id text NOT NULL,
  request_id text,
  reason text,
  note text,
  created_at timestamptz NOT NULL,
  event_json jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS control_operator_audit_log_environment_created_at_idx
  ON control_operator_audit_log (environment, created_at DESC);

CREATE INDEX IF NOT EXISTS control_operator_audit_log_action_created_at_idx
  ON control_operator_audit_log (action, created_at DESC);

CREATE TABLE IF NOT EXISTS control_live_promotions (
  id text PRIMARY KEY,
  environment text NOT NULL,
  target_mode text NOT NULL,
  workflow_status text NOT NULL,
  application_status text NOT NULL,
  requested_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  record_json jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS control_live_promotions_environment_updated_at_idx
  ON control_live_promotions (environment, updated_at DESC);

CREATE INDEX IF NOT EXISTS control_live_promotions_environment_target_mode_idx
  ON control_live_promotions (environment, target_mode);
