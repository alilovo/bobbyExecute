CREATE TABLE IF NOT EXISTS control_database_rehearsal_evidence (
  id text PRIMARY KEY,
  environment text NOT NULL,
  rehearsal_kind text NOT NULL,
  status text NOT NULL,
  executed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  actor_id text NOT NULL,
  actor_display_name text NOT NULL,
  actor_role text NOT NULL,
  session_id text NOT NULL,
  source_context_json jsonb NOT NULL,
  target_context_json jsonb NOT NULL,
  source_database_fingerprint text NOT NULL,
  target_database_fingerprint text NOT NULL,
  source_schema_status_json jsonb NOT NULL,
  target_schema_status_before_json jsonb NOT NULL,
  target_schema_status_after_json jsonb,
  restore_validation_json jsonb NOT NULL,
  summary text NOT NULL,
  failure_reason text,
  evidence_json jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_control_db_rehearsal_environment_executed_at
  ON control_database_rehearsal_evidence (environment, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_control_db_rehearsal_environment_status_executed_at
  ON control_database_rehearsal_evidence (environment, status, executed_at DESC);
