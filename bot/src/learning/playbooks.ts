/**
 * Playbook ledger helpers for offline optimization memory.
 *
 * This is append-only by construction. It does not mutate lower-layer truth and it does
 * not provide any execution authority surface.
 */
import { assertPlaybookRevision, type PlaybookRevision, type PlaybookReviewState } from "../core/contracts/playbooks.js";

export type PlaybookRevisionView = PlaybookRevision & {
  effective_review_state: PlaybookReviewState;
  superseded_by_version_id?: string;
};

function fail(details: string): never {
  throw new Error(`PLAYBOOK_LEDGER_FAILED:${details}`);
}

function clonePlaybookRevision<T>(value: T): T {
  return structuredClone(value);
}

function deriveEffectiveReviewState(
  revision: PlaybookRevision,
  successorVersionId?: string
): PlaybookReviewState {
  const storedState = revision.review_metadata.review_state;
  if (storedState === "rejected") {
    return "rejected";
  }
  if (successorVersionId) {
    return "superseded";
  }
  return storedState;
}

export function derivePlaybookRevisionViews(revisions: readonly PlaybookRevision[]): PlaybookRevisionView[] {
  const successorByVersionId = new Map<string, string>();
  for (const revision of revisions) {
    const priorVersionId = revision.version_trace.prior_version_id;
    if (priorVersionId != null) {
      successorByVersionId.set(priorVersionId, revision.version_trace.version_id);
    }
  }

  return revisions.map((revision) => {
    const successorVersionId = successorByVersionId.get(revision.version_trace.version_id);
    const effectiveReviewState = deriveEffectiveReviewState(revision, successorVersionId);

    return {
      ...clonePlaybookRevision(revision),
      effective_review_state: effectiveReviewState,
      superseded_by_version_id: effectiveReviewState === "superseded" ? successorVersionId : undefined,
    };
  });
}

export class InMemoryPlaybookLedger {
  private readonly histories = new Map<string, PlaybookRevision[]>();

  append(revision: PlaybookRevision): PlaybookRevision {
    const parsed = assertPlaybookRevision(revision, "playbook-ledger.append");
    const history = this.histories.get(parsed.playbook_id) ?? [];

    if (history.some((item) => item.version_trace.version_id === parsed.version_trace.version_id)) {
      fail(`duplicate_version_id:${parsed.playbook_id}:${parsed.version_trace.version_id}`);
    }

    if (history.length === 0) {
      if (parsed.version_trace.prior_version_id !== null) {
        fail(`root_must_have_null_prior_version:${parsed.playbook_id}`);
      }
    } else {
      const latest = history.at(-1);
      if (!latest) {
        fail(`missing_latest_revision:${parsed.playbook_id}`);
      }
      if (parsed.playbook_kind !== latest.playbook_kind) {
        fail(
          `playbook_kind_mismatch:${parsed.playbook_id}:${latest.playbook_kind}:${parsed.playbook_kind}`
        );
      }
      if (parsed.version_trace.prior_version_id !== latest.version_trace.version_id) {
        fail(
          `non_linear_history:${parsed.playbook_id}:${parsed.version_trace.prior_version_id ?? "null"}:${latest.version_trace.version_id}`
        );
      }
    }

    const nextHistory = [...history, parsed];
    this.histories.set(parsed.playbook_id, nextHistory);
    return clonePlaybookRevision(parsed);
  }

  list(playbookId: string): PlaybookRevision[] {
    const history = this.histories.get(playbookId) ?? [];
    return history.map((revision) => clonePlaybookRevision(revision));
  }

  listViews(playbookId: string): PlaybookRevisionView[] {
    return derivePlaybookRevisionViews(this.list(playbookId));
  }

  get(playbookId: string, versionId: string): PlaybookRevision | null {
    const history = this.histories.get(playbookId) ?? [];
    const revision = history.find((item) => item.version_trace.version_id === versionId);
    return revision ? clonePlaybookRevision(revision) : null;
  }

  getView(playbookId: string, versionId: string): PlaybookRevisionView | null {
    return this.listViews(playbookId).find((revision) => revision.version_trace.version_id === versionId) ?? null;
  }

  getLatest(playbookId: string): PlaybookRevision | null {
    const history = this.histories.get(playbookId) ?? [];
    const latest = history.at(-1);
    return latest ? clonePlaybookRevision(latest) : null;
  }
}
