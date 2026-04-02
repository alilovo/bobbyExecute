import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODULES = [
  {
    path: "src/intelligence/universe/index.ts",
    specifier: "@bot/intelligence/universe/index.js",
    exportCount: 2,
    expectedExports: [
      "UniverseBuildResultSchema",
      "UniverseCoverageStateSchema",
      "UniverseSourceCoverageEntrySchema",
      "buildUniverseResult",
    ],
  },
  {
    path: "src/intelligence/quality/index.ts",
    specifier: "@bot/intelligence/quality/index.js",
    exportCount: 2,
    expectedExports: [
      "DataQualityStatusSchema",
      "DataQualityV1Schema",
      "buildDataQualityV1",
    ],
  },
  {
    path: "src/intelligence/cqd/index.ts",
    specifier: "@bot/intelligence/cqd/index.js",
    exportCount: 2,
    expectedExports: [
      "CQDSnapshotV1Schema",
      "buildCQDSnapshotV1",
    ],
  },
  {
    path: "src/intelligence/forensics/index.ts",
    specifier: "@bot/intelligence/forensics/index.js",
    exportCount: 3,
    expectedExports: [
      "SignalPackCoverageStatusSchema",
      "SignalPackHolderFlowSchema",
      "SignalPackLiquiditySchema",
      "SignalPackManipulationFlagsSchema",
      "SignalPackMarketStructureSchema",
      "SignalPackSourceCoverageEntrySchema",
      "SignalPackV1Schema",
      "SignalPackVolatilitySchema",
      "SignalPackVolumeSchema",
      "TrendReversalMonitorInputAvailabilitySchema",
      "TrendReversalMonitorInputV1Schema",
      "TrendReversalObservationParticipationSignalsSchema",
      "TrendReversalObservationRiskSignalsSchema",
      "TrendReversalObservationSourceCoverageEntrySchema",
      "TrendReversalObservationV1Schema",
      "TrendReversalObservationStateSchema",
      "TrendReversalObservationStructureSignalsSchema",
      "assertSignalPackV1",
      "assertTrendReversalMonitorInputV1",
      "assertTrendReversalObservationV1",
      "buildHolderFlowSnapshotV1",
      "buildManipulationFlagsV1",
      "buildMarketStructureV1",
      "buildSignalPackV1",
      "buildTrendReversalMonitorInputV1",
      "buildTrendReversalObservationV1",
      "deriveParticipationSignals",
      "deriveRiskSignals",
      "deriveState",
      "deriveStructureSignals",
    ],
  },
  {
    path: "src/intelligence/scoring/index.ts",
    specifier: "@bot/intelligence/scoring/index.js",
    exportCount: 2,
    expectedExports: [
      "ScoreCardAggregateScoresSchema",
      "ScoreCardBuildStatusSchema",
      "ScoreCardSourceCoverageEntrySchema",
      "ScoreCardV1Schema",
      "ScoreComponentIdSchema",
      "ScoreComponentStatusSchema",
      "ScoreComponentV1Schema",
      "assertScoreCardV1",
      "assertScoreComponentV1",
      "buildScoreCardV1",
    ],
  },
  {
    path: "src/intelligence/signals/index.ts",
    specifier: "@bot/intelligence/signals/index.js",
    exportCount: 2,
    expectedExports: [
      "ConstructedSignalDirectionSchema",
      "ConstructedSignalSetBuildStatusSchema",
      "ConstructedSignalSetSourceCoverageEntrySchema",
      "ConstructedSignalSetV1Schema",
      "ConstructedSignalStatusSchema",
      "ConstructedSignalTypeSchema",
      "ConstructedSignalV1Schema",
      "assertConstructedSignalSetV1",
      "assertConstructedSignalV1",
      "buildConstructedSignalSetV1",
      "deriveFragilitySignals",
      "deriveManipulationSignals",
      "deriveParticipationSignals",
      "deriveStructureSignals",
    ],
  },
] as const;

describe("intelligence module barrels", () => {
  it("contain the expected narrow export statements", () => {
    for (const { path, exportCount } of MODULES) {
      const contents = readFileSync(resolve(process.cwd(), path), "utf8").trim().split("\n");
      const exportLines = contents.filter((line) => line.trim().startsWith("export *") || line.trim().startsWith("export {"));

      expect(exportLines).toHaveLength(exportCount);
      expect(new Set(exportLines).size).toBe(exportLines.length);
    }
  });

  it("only expose the expected runtime symbols", async () => {
    for (const { specifier, expectedExports } of MODULES) {
      const module = await import(specifier);
      expect(Object.keys(module).sort()).toEqual([...expectedExports].sort());
    }
  });
});
