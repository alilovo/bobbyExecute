/**
 * M6: Pump velocity without holder growth.
 */
import type { ChaosResult } from "../contracts/chaos-result.js";

export interface PumpVelocityInput {
  priceChange24h: number;
  holderGrowth: number;
  volumeSpike: number;
}

export function detectPumpVelocityNoHolders(input: PumpVelocityInput): ChaosResult {
  if (input.priceChange24h > 0.5 && input.holderGrowth < 0.1 && input.volumeSpike > 3) {
    return {
      hit: true,
      severity: 0.7,
      reasonCode: "PUMP_NO_HOLDER_GROWTH",
      evidence: {
        priceChange24h: input.priceChange24h,
        holderGrowth: input.holderGrowth,
        volumeSpike: input.volumeSpike,
      },
    };
  }
  return { hit: false, severity: 0 };
}
