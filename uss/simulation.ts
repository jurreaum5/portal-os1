import { Simulation } from "../max-core/simulation/index";
import { object, text, uncertainty } from "./contracts";
export const simulationTypes = [
  "product",
  "sports",
  "forecast",
  "scenario",
  "market",
  "department",
] as const;
/** Versioned domain model atop MAX-CORE, not another simulation runtime. */
export function runModel(content: Record<string, unknown>) {
  if (
    !(simulationTypes as readonly unknown[]).includes(content.modelType) ||
    content.modelVersion !== "compound-growth-v1" ||
    !object(content.inputs) ||
    !text(content.source) ||
    !uncertainty(content.confidence)
  )
    throw new Error(
      "Model type, supported model version, source and confidence metadata required",
    );
  const { initial, rate, steps } = content.inputs;
  if (
    typeof initial !== "number" ||
    !Number.isFinite(initial) ||
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate < -1 ||
    rate > 10 ||
    typeof steps !== "number" ||
    !Number.isSafeInteger(steps) ||
    steps < 0 ||
    steps > 120
  )
    throw new Error("Expected finite initial/rate and 0–120 integer steps");
  if (
    !content.confidence.assumptions.length ||
    content.confidence.range === null
  )
    throw new Error("Simulation assumptions and forecast range required");
  const engine = new Simulation({
    initial: { value: initial },
    stepMs: 1,
    reduce: (state) => ({ value: state.value * (1 + rate) }),
  });
  engine.start();
  const outputs = engine.update(steps);
  if (!Number.isFinite(outputs.value))
    throw new Error("Simulation output overflow");
  return { value: outputs.value, ticks: engine.tick };
}
