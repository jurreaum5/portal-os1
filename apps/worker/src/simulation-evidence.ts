import { sha256 } from "./access";
import { simulateScenario } from "../../../portal-os/substrate";
/** Object-key order does not alter a run identity; array order remains significant. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function simulationEvidence(input: unknown, output: unknown) {
  return {
    inputHash: await sha256(canonical(input)),
    outputHash: await sha256(canonical(output)),
    hashAlgorithm: "SHA-256",
    canonicalisation: "sorted-object-keys-v1",
    engine: "MAX-CORE Simulation",
    engineVersion: "supplied-event-v1",
  };
}
export async function replayEvidence(input: unknown, output: unknown) {
  const expected = await simulationEvidence(input, output),
    actual = await simulationEvidence(input, simulateScenario(input));
  return {
    ...expected,
    actualOutputHash: actual.outputHash,
    matched: expected.outputHash === actual.outputHash,
  };
}
