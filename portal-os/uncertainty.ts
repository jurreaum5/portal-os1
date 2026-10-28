import type { Uncertainty } from "../uss/contracts";
/** Unknown calibration remains null rather than inventing a probability. */
export function descriptiveUncertainty(
  assumptions: string[],
  range: Uncertainty["range"] = null,
): Uncertainty {
  return {
    confidence: null,
    probability: null,
    risk: "Descriptive scenario; not a calibrated prediction or commitment.",
    assumptions,
    range,
  };
}
