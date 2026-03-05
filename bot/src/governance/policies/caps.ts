/**
 * M9: Caps Policy - enforce caps on risk sub-scores.
 */
export interface CapsPolicyInput {
  liquidity?: number;
  socialManip?: number;
  momentumExhaust?: number;
  structuralWeakness?: number;
}

const DEFAULT_CAPS: Required<CapsPolicyInput> = {
  liquidity: 0.8,
  socialManip: 0.9,
  momentumExhaust: 0.7,
  structuralWeakness: 0.85,
};

export function applyCaps(input: CapsPolicyInput, caps = DEFAULT_CAPS): {
  capped: CapsPolicyInput;
  capsApplied: string[];
} {
  const capped: CapsPolicyInput = {};
  const applied: string[] = [];
  for (const [k, v] of Object.entries(input)) {
    const capVal = caps[k as keyof CapsPolicyInput];
    if (typeof v === "number" && typeof capVal === "number") {
      const c = Math.min(v, capVal);
      capped[k as keyof CapsPolicyInput] = c;
      if (c < v) applied.push(k);
    }
  }
  return { capped, capsApplied: applied };
}
