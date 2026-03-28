CREATE TABLE IF NOT EXISTS worker_restart_requests (
  id text PRIMARY KEY,
  environment text NOT NULL,
  request_key text,
  actor text NOT NULL,
  reason text,
  target_version_id text,
  target_service text NOT NULL,
  target_worker text,
  method text NOT NULL,
  status text NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  restart_required boolean NOT NULL DEFAULT false,
  restart_required_reason text,
  requested_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deadline_at timestamptz,
  rejection_reason text,
  failure_reason text,
  provider_status_code integer,
  provider_request_id text,
  provider_message text,
  convergence_observed_at timestamptz,
  cleared_at timestamptz
);

CREATE INDEX IF NOT EXISTS worker_restart_requests_environment_updated_at_idx
  ON worker_restart_requests (environment, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS worker_restart_requests_environment_request_key_idx
  ON worker_restart_requests (environment, request_key)
  WHERE request_key IS NOT NULL;
