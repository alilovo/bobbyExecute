import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useDecisions: vi.fn(),
  getDecisionProvenanceAccess: vi.fn(),
}));

vi.mock('@/hooks/use-decisions', () => ({ useDecisions: mocks.useDecisions }));
vi.mock('@/lib/decision-provenance', () => ({ getDecisionProvenanceAccess: mocks.getDecisionProvenanceAccess }));

import { CanonicalDecisionHistory } from './canonical-decision-history';

function queryResult(data: unknown) {
  return { data, isLoading: false, error: null, refetch: vi.fn() };
}

describe('CanonicalDecisionHistory', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses the provenance-safe canonical accessor and keeps legacy rows out', () => {
    mocks.useDecisions.mockReturnValue(queryResult({
      decisions: [
        {
          id: 'legacy-1',
          timestamp: '2026-04-07T09:59:00.000Z',
          action: 'block',
          token: 'LEGACY-1',
          confidence: 0.2,
          reasons: ['projection'],
          provenanceKind: 'legacy_projection',
          source: 'action_log_projection',
        },
        {
          id: 'canonical-1',
          timestamp: '2026-04-07T10:00:00.000Z',
          action: 'allow',
          token: 'CANON-1',
          confidence: 0.91,
          reasons: ['canonical'],
          provenanceKind: 'canonical',
          source: 'runtime_cycle_summary',
        },
      ],
    }));
    mocks.getDecisionProvenanceAccess.mockReturnValue({
      canonicalRows: [
        {
          id: 'canonical-1',
          timestamp: '2026-04-07T10:00:00.000Z',
          action: 'allow',
          token: 'CANON-1',
          confidence: 0.91,
          reasons: ['canonical'],
          provenanceKind: 'canonical',
          source: 'runtime_cycle_summary',
        },
      ],
      legacyProjectionRows: [
        {
          id: 'legacy-1',
          timestamp: '2026-04-07T09:59:00.000Z',
          action: 'block',
          token: 'LEGACY-1',
          confidence: 0.2,
          reasons: ['projection'],
          provenanceKind: 'legacy_projection',
          source: 'action_log_projection',
        },
      ],
      firstCanonicalRow: {
        id: 'canonical-1',
        timestamp: '2026-04-07T10:00:00.000Z',
        action: 'allow',
        token: 'CANON-1',
        confidence: 0.91,
        reasons: ['canonical'],
        provenanceKind: 'canonical',
        source: 'runtime_cycle_summary',
      },
    });

    const html = renderToStaticMarkup(<CanonicalDecisionHistory />);

    expect(mocks.getDecisionProvenanceAccess).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'legacy-1', provenanceKind: 'legacy_projection' }),
      expect.objectContaining({ id: 'canonical-1', provenanceKind: 'canonical' }),
    ]));
    expect(html).toContain('Canonical Decision History');
    expect(html).toContain('CANON-1');
    expect(html).not.toContain('LEGACY-1');
  });
});
