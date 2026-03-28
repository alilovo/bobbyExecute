CREATE TABLE IF NOT EXISTS worker_restart_alerts (
  id text PRIMARY KEY,
  environment text NOT NULL,
  dedupe_key text NOT NULL,
  restart_request_id text,
  worker_service text NOT NULL,
  target_worker text,
  target_version_id text,
  source_category text NOT NULL,
  reason_code text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL,
  summary text NOT NULL,
  recommended_action text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  condition_signature text NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  last_evaluated_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  acknowledged_by text,
  acknowledgment_note text,
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  last_restart_request_status text,
  last_restart_request_updated_at timestamptz,
  last_worker_heartbeat_at timestamptz,
  last_applied_version_id text,
  requested_version_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS worker_restart_alerts_environment_dedupe_key_idx
  ON worker_restart_alerts (environment, dedupe_key);

CREATE INDEX IF NOT EXISTS worker_restart_alerts_environment_status_updated_idx
  ON worker_restart_alerts (environment, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS worker_restart_alerts_environment_request_idx
  ON worker_restart_alerts (environment, restart_request_id);

CREATE TABLE IF NOT EXISTS worker_restart_alert_events (
  id text PRIMARY KEY,
  environment text NOT NULL,
  alert_id text NOT NULL REFERENCES worker_restart_alerts (id) ON DELETE CASCADE,
  action text NOT NULL,
  actor text NOT NULL,
  accepted boolean NOT NULL DEFAULT true,
  before_status text,
  after_status text,
  reason_code text,
  summary text,
  note text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  notification_sink_name text,
  notification_sink_type text,
  notification_destination_name text,
  notification_destination_type text,
  notification_formatter_profile text,
  notification_destination_priority integer,
  notification_destination_tags_json jsonb,
  notification_event_type text,
  notification_status text,
  notification_dedupe_key text,
  notification_payload_fingerprint text,
  notification_attempt_count integer,
  notification_failure_reason text,
  notification_suppression_reason text,
  notification_route_reason text,
  notification_response_status integer,
  notification_response_body text,
  notification_scope text,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS worker_restart_alert_events_environment_alert_idx
  ON worker_restart_alert_events (environment, alert_id, created_at DESC);

CREATE INDEX IF NOT EXISTS worker_restart_alert_events_environment_created_idx
  ON worker_restart_alert_events (environment, created_at DESC);

CREATE INDEX IF NOT EXISTS worker_restart_alert_events_environment_destination_created_idx
  ON worker_restart_alert_events (environment, notification_destination_name, created_at DESC);

CREATE INDEX IF NOT EXISTS worker_restart_alert_events_environment_status_created_idx
  ON worker_restart_alert_events (environment, notification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS worker_restart_alert_events_environment_event_type_created_idx
  ON worker_restart_alert_events (environment, notification_event_type, created_at DESC);
