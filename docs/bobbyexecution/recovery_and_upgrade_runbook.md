# Recovery and Upgrade Runbook

Use this runbook for schema upgrades, restore drills, backup capture, and worker-disk recovery after an incident.

## Migration Discipline

Schema changes are explicit and versioned under [`bot/migrations/`](../../bot/migrations/).

Use these commands from `bot/`:

```bash
npm run db:status
npm run db:migrate
```

Expected schema states:

- `ready` - all migration files are applied and checksums match
- `missing_but_migratable` - `schema_migrations` is missing, but migration files exist
- `migration_required` - the migration table exists, but one or more migrations are pending
- `unrecoverable` - checksums or tracked versions do not match the on-disk migration set

Operational rule:

- Run `npm run db:migrate` before starting a service when `db:status` reports `missing_but_migratable` or `migration_required`.
- Do not start a release on a schema that reports `unrecoverable`.
- Repository `ensureSchema()` calls now act as readiness checks. They do not create tables on boot.

## Canonical Backup Model

Postgres is the canonical durable store for control-plane truth.

Back up these Postgres tables together:

- `runtime_config_versions`
- `runtime_config_active`
- `config_change_log`
- `runtime_visibility_snapshots`
- `worker_restart_requests`
- `worker_restart_alerts`
- `worker_restart_alert_events`
- `control_operator_audit_log`
- `control_live_promotions`

Worker disk is not canonical for control-plane truth, but it still matters for safe boot and evidence retention.

Worker-local artifacts are classified as:

- canonical durable state:
  - `*.kill-switch.json`
  - `*.live-control.json`
  - `*.daily-loss.json`
  - `*.idempotency.json`
- reconstructible derivative state:
  - `*.journal.jsonl`
  - `*.actions.jsonl`
  - `*.runtime-cycles.jsonl`
  - `*.incidents.jsonl`
  - `*.execution-evidence.jsonl`

If worker disk is lost:

- canonical control-plane state remains recoverable from Postgres
- evidence files are lost unless they were separately copied off host
- the worker must fail closed if any boot-critical worker file is missing

## Backup And Restore Commands

From `bot/`:

```bash
npm run recovery:db-backup -- --environment=production --output=/tmp/control-backup.json
npm run recovery:db-restore -- --input=/tmp/control-backup.json
npm run recovery:db-validate -- --input=/tmp/control-backup.json
npm run recovery:worker-state -- --journal-path=/var/data/journal.jsonl
```

Notes:

- `recovery:db-backup` captures a control-plane snapshot for one environment.
- `recovery:db-restore` restores that snapshot into a schema-ready database.
- `recovery:db-validate` performs a restore-and-recapture round trip and reports whether the counts matched.
- `recovery:worker-state` reports which worker-disk artifacts are present, which are boot-critical, and which are evidence-only.

## Restore Validation

Validation is intentionally layered:

- automated tests:
  - `bot/tests/recovery/schema-migrations.test.ts`
  - `bot/tests/recovery/control-plane-backup.test.ts`
  - `bot/tests/recovery/worker-state-manifest.test.ts`
- operator drill:
  - capture a Postgres snapshot
  - restore it into a scratch database
  - run `npm run recovery:db-validate`
  - inspect `npm run recovery:worker-state`
- staging rehearsal:
  - promote the same migration set to staging first
  - run the restore drill against staging data before production promotion

The restore path is only considered proven when validation is run after the restore, not before it.

## Upgrade Checklist

1. Run `npm run db:status` against the target database.
2. Run `npm run db:migrate` if migrations are pending.
3. Run `npm run recovery:db-validate` against a fresh snapshot or staging clone.
4. Run `npm run recovery:worker-state` on the worker disk that will boot the new release.
5. Confirm readiness endpoints are healthy after the migration.
6. Deploy the new release only after schema and recovery prerequisites are satisfied.

Rollback notes:

- If a migration checksum changes after it has been applied, treat that as unrecoverable drift.
- Restore the database from the last known good backup before redeploying incompatible code.
- If worker boot-critical files are missing, restore them explicitly or keep the worker offline.

## Fail-Closed Rules

- Missing migration state does not imply a healthy start.
- Partial migration state is not acceptable.
- Schema checksum mismatch is unrecoverable until reconciled.
- Backup absence must be reported as a recovery gap.
- Worker disk loss must be called out explicitly.
- Restored Postgres state with stale worker disk is not automatically safe.
- Restore success claims require validation evidence.
