# Journaling Memory Architecture Spec

## Status
Draft v1 — integrated architecture spec derived from the uploaded journaling-memory logic and aligned to a journal-first, case-driven, semantically compressible system.

---

# 1. Purpose

This spec defines a production-ready architecture for a **steadily growing journaling and memory base** that improves the pipeline:

```text
analyse → decision → execute
```

The system is designed to transform raw historical behavior into reusable structured knowledge through the following progression:

```text
immutable journal
→ canonical case memory
→ derived knowledge views
→ playbooks and optimization loops
```

The target is **not** a loose archive of logs, screenshots, notes, and ad hoc summaries.
The target is a **journal-first, entity-linked, case-driven memory architecture** that preserves forensic truth while enabling repeatable learning, scoring, retrieval, and operational improvement.

This spec is intended to plug directly into the architecture logic for:
- journaling
- replay
- knowledge base growth
- trade and meta analysis
- signal classification
- operator review
- bot-consumable priors
- optimization loops

---

# 2. Core Design Thesis

## 2.1 Primary thesis

The system must separate four different realities that are often incorrectly mixed together:

1. **What objectively happened**
2. **How that event should be structured as a case**
3. **What can be learned from many cases over time**
4. **What should operationally change as a result**

These map to four distinct architecture layers:

- **Layer 1 — Raw Journal Truth**
- **Layer 2 — Canonical Case Records**
- **Layer 3 — Derived Knowledge Views**
- **Layer 4 — Playbooks / Optimization Memory**

## 2.2 Non-goal

This architecture must not collapse all information into a single note system, a single table, or a single “AI memory.”
That would destroy provenance, truth separation, and auditability.

## 2.3 Governing principle

```text
Journal = truth
Case memory = structured compression of truth
Knowledge = derived interpretation across cases
Playbook = operationalized consequence
```

Never reverse this order.

---

# 3. Foundational Principles

## 3.1 Journal-first, memory-second

The journal is authoritative.
All later structures are derived from it.

This prevents:
- retrospective distortion
- narrative rewriting after the fact
- fuzzy mixing of “what was known then” and “what we know now”
- unverifiable optimization claims

## 3.2 Entity-linked, not only chronological

Pure chronology is insufficient.
The memory system must be queryable by entity.

Core entities:
- token
- trade
- meta
- KOL / account
- signal cluster
- setup type
- market regime
- failure mode
- review period
- playbook

## 3.3 Case-driven compression

The architecture should not only store rows and events.
It must transform related raw events into **case containers** that represent a meaningful unit of understanding.

Examples:
- trade case
- meta shift case
- signal cluster case
- KOL influence case
- post-mortem case

## 3.4 Observed vs inferred vs learned

Every record that enters the memory system must explicitly declare its epistemic mode.

### Observed
Directly observed facts.

Examples:
- a post existed
- liquidity rose by 38%
- holder count increased
- entry happened at a given market cap
- the account posted 4 times in 6 hours

### Inferred
Interpretive synthesis derived from observations.

Examples:
- meta rotated from one regime to another
- KOL acted as a second-wave amplifier
- breakout was attention-led rather than liquidity-led

### Learned
Repeatedly validated pattern or operating tendency.

Examples:
- setup X under regime Y tends to outperform
- KOL class Z creates noise more often than signal
- retest entries after first spike produce better RR than initial chase entries

### Rule
Observed facts may feed cases.
Cases may feed derived views.
Derived views may influence playbooks.
Free-form inference must never be treated as raw fact.

## 3.5 Bot-safe vs operator-freeform

The system must separate:
- **validated machine-consumable memory**
- **exploratory human/operator notes**

Bot logic may consume:
- trusted KOL tiers
- setup priors
- regime priors
- known bad signal patterns
- failure-mode priors
- timing priors

Bot logic must not directly consume:
- loose notes
- experimental thoughts
- raw hunches
- unreviewed operator commentary

---

# 4. Architecture Layers

## 4.1 Layer 1 — Raw Journal Truth

### Purpose
Append-only forensic truth store.
This layer answers:

**What objectively happened?**

### Examples
- market onchain snapshots
- timeline snapshots
- account post captures
- KOL mention events
- decision inputs
- risk flag events
- execution events
- outcome events
- state transitions
- external evidence references

### Requirements
- append-only or effectively immutable
- time-stamped
- source-attributed
- reproducible where possible
- evidence-preserving
- no retrospective editing of truth claims

### Storage model
Recommended as normalized event tables plus raw payload retention where necessary.

---

## 4.2 Layer 2 — Canonical Case Records

### Purpose
Official structured case containers derived from raw journal truth.
This layer answers:

**How should this event be documented as a coherent unit?**

### Examples
- trade case
- meta shift case
- signal cluster case
- KOL influence case
- trade post-mortem case
- weekly review case

### Requirements
- versioned
- link back to evidence
- typed and schema-bound
- support structured scoring
- preserve “what was known at decision time” separately from later review

### Compression function
This layer is the first intentional semantic compression layer.
It should reduce many raw events into a stable structured unit without losing traceability.

---

## 4.3 Layer 3 — Derived Knowledge Views

### Purpose
Analytical learning layer.
This layer answers:

**What do we learn from many cases?**

### Examples
- best setups by meta regime
- failed setups by entry type
- KOL ranking by early signal accuracy
- signal clusters correlated with runners
- failure mode frequency reports
- regime transition reliability views
- latency-to-entry and outcome relationship views

### Requirements
- explicitly marked as derived
- recomputable from lower layers
- not treated as raw truth
- suitable for bot consumption if validated

---

## 4.4 Layer 4 — Playbooks / Optimization Memory

### Purpose
Operational improvement layer.
This layer answers:

**How should future behavior change?**

### Examples
- entry playbooks
- abort rules
- regime-specific checklists
- KOL trust classes
- timing discipline rules
- “when not to trade” patterns
- post-mortem-driven execution adjustments

### Requirements
- human-readable and operational
- linked to evidence and derived views
- versioned and reviewable
- never silently overwrite old guidance without version history

---

# 5. Information Modes and Record Semantics

Every major memory object should declare the following semantic metadata:

- `knowledge_mode` = observed | inferred | learned | operational
- `authority_level` = raw | canonical | derived | playbook
- `validation_state` = draft | reviewed | accepted | deprecated
- `source_scope` = manual | bot | external | mixed
- `evidence_strength` = weak | moderate | strong
- `time_basis` = decision_time | post_outcome | retrospective_review

This allows the system to distinguish:
- what was directly observed
- what was interpreted later
- what has been validated repeatedly
- what is currently safe to operationalize

---

# 6. Canonical Entity Model

## 6.1 Core entities

The architecture should center on these first-class entities:

- `Token`
- `Trade`
- `Meta`
- `Account`
- `SignalCluster`
- `SetupType`
- `MarketRegime`
- `FailureMode`
- `ReviewPeriod`
- `Playbook`

## 6.2 Entity identity rules

Each entity should have:
- stable primary key
- canonical display name
- aliases if needed
- creation timestamp
- update timestamp
- source provenance
- optional active/inactive status

## 6.3 Entity linking

Cases should link to entities through join tables rather than free-form string duplication whenever possible.

Examples:
- one trade case links to one token, one setup type, one market regime, many accounts, many signal snapshots, many raw events
- one meta shift case links to multiple tokens and accounts
- one KOL influence record links one account to many tokens/trades over time

---

# 7. Postgres Architecture

## 7.1 Database strategy

Use Postgres as the authoritative structured memory engine.

Recommended logical schemas:

- `registry` — entity registry and controlled vocabularies
- `journal` — raw immutable event truth
- `casebook` — canonical case records
- `knowledge` — derived views, scores, and learned patterns
- `playbook` — operational rules and recommendations
- `ops` — jobs, refresh state, review workflow, audit trail

## 7.2 Why schema separation matters

This separation preserves:
- truth boundaries
- clearer ownership
- easier permissioning
- recomputation discipline
- lower risk of derived data being mistaken for raw fact

---

# 8. Recommended Table Map

## 8.1 `registry` schema

### `registry.tokens`
Canonical token registry.

Suggested fields:
- `token_id` uuid pk
- `chain` text
- `ticker` text
- `name` text
- `contract_address` text unique
- `first_seen_at` timestamptz
- `last_seen_at` timestamptz
- `status` text
- `tags` jsonb
- `created_at` timestamptz
- `updated_at` timestamptz

### `registry.accounts`
Canonical account/KOL registry.

Suggested fields:
- `account_id` uuid pk
- `platform` text
- `handle` text
- `display_name` text
- `platform_account_id` text
- `follower_count_last_known` bigint
- `first_seen_at` timestamptz
- `last_seen_at` timestamptz
- `status` text
- `created_at` timestamptz
- `updated_at` timestamptz

### `registry.metas`
Narrative/meta buckets.

Suggested fields:
- `meta_id` uuid pk
- `meta_key` text unique
- `meta_label` text
- `description` text
- `active_status` text
- `created_at` timestamptz
- `updated_at` timestamptz

### `registry.setup_types`
Setup taxonomy.

Suggested fields:
- `setup_type_id` uuid pk
- `setup_key` text unique
- `label` text
- `description` text
- `created_at` timestamptz
- `updated_at` timestamptz

### `registry.market_regimes`
Regime taxonomy.

Suggested fields:
- `market_regime_id` uuid pk
- `regime_key` text unique
- `label` text
- `description` text
- `created_at` timestamptz
- `updated_at` timestamptz

### `registry.failure_modes`
Failure-mode vocabulary.

Suggested fields:
- `failure_mode_id` uuid pk
- `failure_key` text unique
- `label` text
- `description` text
- `class` text
- `created_at` timestamptz
- `updated_at` timestamptz

---

## 8.2 `journal` schema

### Design rule
This schema stores append-only facts and evidence-bearing events.
Updates should be rare and limited to metadata repair, never semantic rewriting.

### `journal.market_snapshots`
Point-in-time onchain/market state.

Suggested fields:
- `snapshot_id` uuid pk
- `token_id` uuid fk
- `captured_at` timestamptz
- `source` text
- `market_cap` numeric
- `price` numeric
- `liquidity` numeric
- `volume_5m` numeric
- `volume_1h` numeric
- `holder_count` integer
- `buy_count` integer
- `sell_count` integer
- `raw_payload` jsonb
- `ingested_at` timestamptz

### `journal.timeline_snapshots`
Structured timeline capture windows.

Suggested fields:
- `timeline_snapshot_id` uuid pk
- `captured_at` timestamptz
- `window_start` timestamptz
- `window_end` timestamptz
- `platform` text
- `keyword_cluster` jsonb
- `narrative_cluster` jsonb
- `post_count` integer
- `unique_account_count` integer
- `raw_payload` jsonb
- `ingested_at` timestamptz

### `journal.account_posts`
Observed posts or mentions.

Suggested fields:
- `post_id` uuid pk
- `account_id` uuid fk
- `platform` text
- `external_post_id` text
- `posted_at` timestamptz
- `content_text` text
- `engagement_metrics` jsonb
- `referenced_tokens` jsonb
- `referenced_metas` jsonb
- `raw_payload` jsonb
- `ingested_at` timestamptz

### `journal.kol_mentions`
Normalized mention events.

Suggested fields:
- `mention_id` uuid pk
- `account_id` uuid fk
- `token_id` uuid fk null
- `meta_id` uuid fk null
- `post_id` uuid fk null
- `mentioned_at` timestamptz
- `mention_type` text
- `strength_signal` numeric
- `context_payload` jsonb
- `ingested_at` timestamptz

### `journal.decision_inputs`
Snapshot of all relevant decision-time inputs.

Suggested fields:
- `decision_input_id` uuid pk
- `trade_id` uuid null
- `observed_at` timestamptz
- `token_id` uuid fk
- `setup_type_id` uuid fk null
- `market_regime_id` uuid fk null
- `meta_id` uuid fk null
- `input_payload` jsonb
- `confidence_snapshot` jsonb
- `ingested_at` timestamptz

### `journal.risk_flags`
Observed risk events.

Suggested fields:
- `risk_flag_id` uuid pk
- `trade_id` uuid null
- `token_id` uuid null
- `flagged_at` timestamptz
- `risk_type` text
- `severity` text
- `flag_payload` jsonb
- `ingested_at` timestamptz

### `journal.execution_events`
Entry/exit and execution progression.

Suggested fields:
- `execution_event_id` uuid pk
- `trade_id` uuid fk
- `event_type` text
- `event_time` timestamptz
- `price` numeric
- `market_cap` numeric
- `size` numeric
- `slippage_bps` numeric
- `payload` jsonb
- `ingested_at` timestamptz

### `journal.outcome_events`
Observed outcome states after execution.

Suggested fields:
- `outcome_event_id` uuid pk
- `trade_id` uuid fk
- `event_time` timestamptz
- `outcome_type` text
- `pnl_abs` numeric
- `pnl_pct` numeric
- `hold_duration_seconds` bigint
- `payload` jsonb
- `ingested_at` timestamptz

### `journal.evidence_links`
Cross-layer evidence references.

Suggested fields:
- `evidence_link_id` uuid pk
- `source_table` text
- `source_pk` text
- `target_type` text
- `target_id` uuid
- `link_role` text
- `created_at` timestamptz

---

## 8.3 `casebook` schema

### Purpose
This schema stores the official structured case containers.

### `casebook.trade_cases`
Primary trade case record.

Suggested fields:
- `trade_case_id` uuid pk
- `trade_id` uuid unique
- `token_id` uuid fk
- `ticker` text
- `contract_address` text
- `meta_id` uuid fk null
- `setup_type_id` uuid fk null
- `market_regime_id` uuid fk null
- `entry_time` timestamptz
- `entry_mcap` numeric
- `entry_price` numeric
- `exit_time` timestamptz
- `exit_mcap` numeric
- `exit_price` numeric
- `position_size` numeric
- `risk_bucket` text
- `outcome` text
- `pnl_abs` numeric
- `pnl_pct` numeric
- `hold_duration_seconds` bigint
- `decision_reason` text
- `abort_reason` text
- `execution_notes` text
- `post_trade_assessment` text
- `knowledge_mode` text default 'observed'
- `validation_state` text default 'reviewed'
- `created_at` timestamptz
- `updated_at` timestamptz

### `casebook.trade_case_metrics`
Expanded structured metrics for trade case.

Suggested fields:
- `trade_case_id` uuid pk fk
- `x_signal_score` numeric
- `kol_alignment_score` numeric
- `attention_velocity_score` numeric
- `narrative_fit_score` numeric
- `onchain_integrity_score` numeric
- `liquidity_quality_score` numeric
- `holder_quality_score` numeric
- `timing_regime_score` numeric
- `confidence_before_entry` numeric
- `confidence_after_review` numeric
- `setup_quality_score` numeric
- `entry_quality_score` numeric
- `execution_quality_score` numeric
- `exit_quality_score` numeric
- `risk_discipline_score` numeric
- `thesis_quality_score` numeric
- `updated_at` timestamptz

### `casebook.meta_shift_cases`
Narrative/meta rotation case.

Suggested fields:
- `meta_shift_case_id` uuid pk
- `from_meta_id` uuid fk null
- `to_meta_id` uuid fk
- `shift_type` text
- `first_observed_at` timestamptz
- `confirmation_window_start` timestamptz
- `confirmation_window_end` timestamptz
- `drivers_summary` text
- `key_accounts_summary` text
- `top_tokens_summary` text
- `confidence` numeric
- `impact_assessment` text
- `knowledge_mode` text default 'inferred'
- `validation_state` text default 'reviewed'
- `created_at` timestamptz
- `updated_at` timestamptz

### `casebook.signal_cluster_cases`
Structured signal-form case.

Suggested fields:
- `signal_cluster_case_id` uuid pk
- `captured_at` timestamptz
- `window_start` timestamptz
- `window_end` timestamptz
- `keyword_cluster` jsonb
- `narrative_cluster` jsonb
- `top_posts_summary` text
- `top_accounts_summary` text
- `post_velocity` numeric
- `unique_account_count` integer
- `engagement_pattern` text
- `cross_account_convergence_score` numeric
- `attention_stage` text
- `novelty_score` numeric
- `conversion_to_token_mentions` numeric
- `observed_candidates_summary` text
- `knowledge_mode` text default 'observed'
- `validation_state` text default 'reviewed'
- `created_at` timestamptz
- `updated_at` timestamptz

### `casebook.kol_influence_cases`
Running account influence profile.

Suggested fields:
- `kol_influence_case_id` uuid pk
- `account_id` uuid fk
- `window_start` timestamptz
- `window_end` timestamptz
- `reach_strength` numeric
- `early_detection_score` numeric
- `signal_precision` numeric
- `conversion_score` numeric
- `exit_liquidity_risk` numeric
- `meta_alignment_consistency` numeric
- `pump_bias` numeric
- `repeatability_score` numeric
- `trust_tier` text
- `knowledge_mode` text default 'learned'
- `validation_state` text default 'reviewed'
- `created_at` timestamptz
- `updated_at` timestamptz

### `casebook.trade_postmortems`
Mandatory learning case for completed or aborted trades.

Suggested fields:
- `trade_postmortem_id` uuid pk
- `trade_case_id` uuid fk unique
- `analysis_correctness` text
- `decision_correctness` text
- `execution_correctness` text
- `trade_quality_vs_execution_quality` text
- `timing_assessment` text
- `abort_assessment` text
- `meta_correct_token_wrong` boolean
- `analysis_failure_mode_id` uuid fk null
- `decision_failure_mode_id` uuid fk null
- `execution_failure_mode_id` uuid fk null
- `regime_failure_mode_id` uuid fk null
- `discipline_failure_mode_id` uuid fk null
- `postmortem_summary` text
- `knowledge_mode` text default 'learned'
- `validation_state` text default 'reviewed'
- `created_at` timestamptz
- `updated_at` timestamptz

### `casebook.case_evidence_map`
Links cases to journal events.

Suggested fields:
- `case_evidence_map_id` uuid pk
- `case_type` text
- `case_id` uuid
- `source_table` text
- `source_pk` text
- `evidence_role` text
- `created_at` timestamptz

---

## 8.4 `knowledge` schema

### `knowledge.setup_performance_views`
Aggregated setup performance across regime/meta.

Suggested fields:
- `view_row_id` uuid pk
- `setup_type_id` uuid fk
- `market_regime_id` uuid fk null
- `meta_id` uuid fk null
- `sample_size` integer
- `win_rate` numeric
- `avg_pnl_pct` numeric
- `median_pnl_pct` numeric
- `avg_hold_duration_seconds` bigint
- `false_positive_rate` numeric
- `late_entry_rate` numeric
- `updated_at` timestamptz

### `knowledge.kol_rankings`
Derived KOL performance profile.

Suggested fields:
- `ranking_id` uuid pk
- `account_id` uuid fk
- `window_start` timestamptz
- `window_end` timestamptz
- `early_signal_accuracy` numeric
- `conversion_strength` numeric
- `noise_ratio` numeric
- `exit_risk_bias` numeric
- `regime_fit` numeric
- `trust_tier` text
- `sample_size` integer
- `updated_at` timestamptz

### `knowledge.meta_rotation_reports`
Derived narrative transition views.

Suggested fields:
- `rotation_report_id` uuid pk
- `from_meta_id` uuid fk null
- `to_meta_id` uuid fk
- `period_start` timestamptz
- `period_end` timestamptz
- `signal_strength` numeric
- `token_expression_strength` numeric
- `kol_convergence_strength` numeric
- `durability_score` numeric
- `exhaustion_risk` numeric
- `updated_at` timestamptz

### `knowledge.failure_mode_views`
Failure-pattern aggregates.

Suggested fields:
- `failure_view_id` uuid pk
- `failure_mode_id` uuid fk
- `setup_type_id` uuid fk null
- `market_regime_id` uuid fk null
- `meta_id` uuid fk null
- `occurrence_count` integer
- `share_of_losses` numeric
- `avg_pnl_impact` numeric
- `updated_at` timestamptz

### `knowledge.signal_pattern_views`
Derived signal cluster effectiveness.

Suggested fields:
- `signal_pattern_view_id` uuid pk
- `pattern_key` text
- `sample_size` integer
- `runner_correlation` numeric
- `false_positive_rate` numeric
- `attention_durability_score` numeric
- `conversion_likelihood` numeric
- `updated_at` timestamptz

### `knowledge.bot_priors`
Strict machine-consumable priors.

Suggested fields:
- `prior_id` uuid pk
- `prior_type` text
- `subject_key` text
- `value_payload` jsonb
- `validation_state` text
- `effective_from` timestamptz
- `effective_to` timestamptz null
- `updated_at` timestamptz

---

## 8.5 `playbook` schema

### `playbook.entry_playbooks`
- `entry_playbook_id` uuid pk
- `name` text
- `setup_type_id` uuid fk null
- `market_regime_id` uuid fk null
- `meta_id` uuid fk null
- `eligibility_rules` jsonb
- `avoid_rules` jsonb
- `checklist` jsonb
- `version` integer
- `status` text
- `created_at` timestamptz
- `updated_at` timestamptz

### `playbook.abort_playbooks`
- `abort_playbook_id` uuid pk
- `name` text
- `trigger_rules` jsonb
- `exceptions` jsonb
- `version` integer
- `status` text
- `created_at` timestamptz
- `updated_at` timestamptz

### `playbook.regime_playbooks`
- `regime_playbook_id` uuid pk
- `market_regime_id` uuid fk null
- `meta_id` uuid fk null
- `rule_payload` jsonb
- `version` integer
- `status` text
- `created_at` timestamptz
- `updated_at` timestamptz

### `playbook.kol_trust_models`
- `kol_trust_model_id` uuid pk
- `account_id` uuid fk
- `trust_tier` text
- `supporting_evidence_summary` text
- `effective_from` timestamptz
- `effective_to` timestamptz null
- `version` integer
- `status` text
- `created_at` timestamptz
- `updated_at` timestamptz

---

## 8.6 `ops` schema

### `ops.refresh_jobs`
Tracks recomputation jobs.

### `ops.review_queue`
Tracks pending human review and validation.

### `ops.audit_log`
Tracks meaningful write actions and playbook changes.

### `ops.materialization_state`
Tracks latest successful derived-view refresh per view family.

---

# 9. Document and Artifact Types

The architecture should support both database-native records and repository-visible document artifacts.

## 9.1 Document families

Recommended document families:
- trade record
- meta shift record
- signal cluster snapshot
- KOL influence review
- trade post-mortem
- weekly review
- monthly recalibration report
- playbook revision note

## 9.2 Suggested repository mirror structure

```text
knowledge-base/
  00_registry/
    tokens/
    accounts/
    metas/
    setups/
    regimes/
    failure_modes/
  01_journal/
    market/
    x_timeline/
    kol/
    decisions/
    executions/
    outcomes/
  02_cases/
    trades/
    meta_shifts/
    signal_clusters/
    kol_influence/
    post_mortems/
  03_views/
    best_setups/
    failed_setups/
    kol_rankings/
    meta_rotation_reports/
    timing_reports/
    failure_modes/
  04_playbooks/
    entry/
    abort/
    regime/
    kol_trust/
  05_operator_notes/
    weekly_reviews/
    monthly_reviews/
    hypotheses/
```

## 9.3 Repository rule

Repo-visible artifacts may mirror the DB state for operator readability, reviewability, and Git history.
The DB remains the primary structured authority.

---

# 10. Scoring Framework

## 10.1 Goal

The system should not only describe cases.
It should normalize them into reusable comparable scores.

## 10.2 Trade quality scores

Standard score family:
- setup quality
- entry quality
- timing quality
- execution quality
- exit quality
- thesis quality
- risk discipline

## 10.3 Signal scores

Standard score family:
- narrative strength
- velocity strength
- cross-KOL convergence
- novelty
- attention durability
- conversion likelihood

## 10.4 Onchain scores

Standard score family:
- holder integrity
- liquidity integrity
- flow quality
- distribution health
- toxicity risk

## 10.5 KOL scores

Standard score family:
- early signal accuracy
- conversion strength
- noise ratio
- exit-risk bias
- regime fit
- repeatability

## 10.6 Score design rules

Scores should:
- have stable definitions
- be versioned if formulas change
- be comparable across periods
- preserve calculation provenance
- avoid silent backfilling that changes historical interpretation without version trace

---

# 11. Retrieval Logic

## 11.1 Retrieval objective

The memory base is successful only if it can answer high-value architecture questions quickly and cleanly.

Examples:
- which setups work best by meta regime
- which early signal forms correlate with runners
- which KOLs are early vs merely amplifying late momentum
- which onchain configurations frequently fail
- which entry types produce systematically poor RR
- which meta shifts were real vs noise
- which errors belong to analysis, decision, execution, regime, or discipline

## 11.2 Retrieval tiers

### Tier 1 — raw evidence retrieval
Used for audit, replay, and forensic verification.

### Tier 2 — case retrieval
Used for understanding a coherent unit such as one trade or one meta shift.

### Tier 3 — derived view retrieval
Used for rankings, recurring patterns, and comparative learning.

### Tier 4 — operational retrieval
Used for surfacing playbooks and decision guidance.

## 11.3 Query rule

Never answer an evidentiary question from a playbook when a raw journal or case record is required.
Never answer a strategic pattern question from raw logs alone when derived views exist.

---

# 12. Write Path and Update Loops

## 12.1 Per-trade write path

For each trade or attempted trade:

1. write raw events into journal tables
2. create or update canonical trade case
3. create trade post-mortem once the trade outcome is sufficiently known
4. compute and normalize scores
5. refresh derived knowledge views
6. update machine-safe priors if validation threshold is met
7. optionally propose playbook change if repeated pattern is confirmed

## 12.2 Daily loop

- signal cluster review
- meta shift check
- KOL strength delta update
- unresolved hypothesis review
- anomaly detection on failed patterns

## 12.3 Weekly loop

- best setups review
- worst setups review
- false positive review
- late entry review
- best KOLs vs overhyped KOLs
- regime summary
- execution discipline review

## 12.4 Monthly loop

- playbook revision
- trust tier recalibration
- meta lifecycle pattern refresh
- scoring recalibration
- taxonomy cleanup
- deprecated hypothesis pruning

---

# 13. Process Separation: Decision-Time vs Review-Time

A critical architecture rule is to separate:

- what was known at decision time
- what became clear after execution/outcome
- what was learned after repeated review across many cases

Recommended fields for any relevant case:
- `decision_time_snapshot`
- `post_outcome_snapshot`
- `retrospective_learning_summary`

This prevents hindsight contamination.

---

# 14. Machine Compression Layer

## 14.1 Role

The canonical case layer is the correct place to support semantic compression for later retrieval and reasoning.

This means each case can additionally store a structured compressed summary that captures the minimum reconstructive semantic core of the case.

## 14.2 Recommended fields

For important case types, optionally add:
- `compressed_case_summary`
- `compressed_case_facts`
- `compressed_case_inferences`
- `compressed_case_lessons`
- `compression_version`

## 14.3 Constraint

These compressed fields are secondary memory artifacts.
They must always be backed by the canonical case and linked evidence.
They do not replace structured fields.

---

# 15. Validation and Governance

## 15.1 Review states

All major derived artifacts should move through a simple state machine:

```text
Draft → Reviewed → Accepted → Deprecated
```

## 15.2 What requires review

Human or governed review should be required for:
- trust-tier changes
- playbook changes
- scoring formula changes
- failure-mode taxonomy changes
- machine-consumable priors promoted from exploratory analysis

## 15.3 Auditability

Every high-impact change should capture:
- who changed it
- when
- why
- based on which cases / views
- resulting version number

---

# 16. Naming and ID Conventions

## 16.1 IDs

Use UUID primary keys in Postgres.
For repo-visible documents, prefer stable human-readable slugs.

Examples:
- `trade-2026-04-06-token-xyz-entry-01`
- `meta-shift-2026-04-political-culture-emergence`
- `signal-cluster-2026-04-06-window-4h-culture-political`
- `kol-review-handle-name-2026-w14`

## 16.2 Time handling

- store timestamps as `timestamptz`
- preserve UTC in DB
- render local/operator timezone in UI only
- always store window boundaries explicitly

---

# 17. Minimal Acceptance Criteria

The architecture is acceptable only if all of the following are true:

## 17.1 Truth separation
- raw journal truth is preserved and auditable
- cases do not overwrite raw evidence
- derived views are clearly marked as derived
- playbooks are clearly marked operational

## 17.2 Queryability
- entity-centric lookup works
- time-window lookup works
- setup/meta/regime/KOL/failure-mode filtering works
- cross-case comparison works

## 17.3 Learning loops
- every completed trade can produce a post-mortem
- weekly and monthly review loops are supported
- scores are normalized and queryable
- playbook changes can be linked back to evidence

## 17.4 Machine safety
- bot-consumable priors are separated from freeform notes
- validation state exists for all machine-relevant memory
- no direct unreviewed free-text enters decision authority

---

# 18. Rollout Plan

## Phase 1 — Foundation
- create schemas and registry tables
- create journal tables
- ingest append-only raw events
- ensure evidence and provenance discipline

## Phase 2 — Canonical cases
- implement trade cases
- implement meta shift cases
- implement signal cluster cases
- implement KOL influence cases
- implement post-mortems

## Phase 3 — Derived views
- implement setup performance views
- implement KOL rankings
- implement failure mode views
- implement signal pattern views
- implement machine-safe priors

## Phase 4 — Playbooks
- implement versioned playbook tables
- connect accepted derived learnings to operational guidance
- establish review workflow and audit logging

## Phase 5 — Compression and acceleration
- add compressed case summaries
- add retrieval-optimized projections
- add operator dashboards and review reports
- add strict bot retrieval boundaries

---

# 19. Architecture Summary

## One-sentence summary

Build a **journal-first, entity-linked, case-driven memory architecture** with strict separation between **observed truth, inferred interpretation, learned patterns, and operational playbooks**, backed by Postgres as the structured authority and supported by versioned review and retrieval loops.

## Practical meaning

Do not merely:
- collect logs
- save screenshots
- write free notes

Instead:
- document every trade as a case
- document every meaningful meta rotation as a case
- capture every important signal cluster as a structured snapshot
- maintain every relevant KOL as an evolving influence profile
- review every week as a learning layer
- turn repeated lessons into explicit versioned playbooks

---

# 20. Recommended Immediate Next Build Slice

The next most useful implementation slice should be:

1. Postgres schema creation for `registry`, `journal`, `casebook`, `knowledge`, `playbook`, `ops`
2. canonical JSON schema definitions for:
   - trade case
   - meta shift case
   - signal cluster case
   - KOL influence case
   - trade post-mortem
3. write rules for per-trade ingestion and case formation
4. weekly review format
5. first-pass scoring definitions
6. first machine-safe prior export format

This slice creates the minimum viable memory architecture without collapsing truth, inference, and learning into one layer.

