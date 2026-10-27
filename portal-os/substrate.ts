import { Simulation } from "../max-core/simulation/index";
import type { Json } from "../max-core/contracts/index";
/** Domain schema over the existing MAX-CORE simulation engine, never a second runtime. */
export interface SubstrateEntity {
  id: string;
  kind: string;
  revision: number;
  position: { x: number; y: number; z: number };
  values: Record<string, number>;
}
export interface SubstrateRelationship {
  id: string;
  source: string;
  target: string;
  relation: string;
}
export interface SubstrateEvent {
  id: string;
  entityId: string;
  metric: string;
  delta: number;
  tick: number;
  source: string;
}
export interface Uncertainty {
  entityId: string;
  metric: string;
  lower: number;
  upper: number;
  source: string;
}
export interface EmergenceRule {
  id: string;
  entityId: string;
  metric: string;
  threshold: number;
  source: string;
}
export interface SubstrateScenario {
  entities: SubstrateEntity[];
  relationships: SubstrateRelationship[];
  events: SubstrateEvent[];
  uncertainty: Uncertainty[];
  emergence: EmergenceRule[];
  steps: number;
}
function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
const text = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 200;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e12;
export function validateScenario(input: unknown): SubstrateScenario {
  if (!object(input)) throw new Error("Expected a scenario");
  for (const key of [
    "entities",
    "relationships",
    "events",
    "uncertainty",
    "emergence",
  ])
    if (!Array.isArray(input[key]) || input[key].length > 200)
      throw new Error(`Invalid ${key}`);
  const s = input as unknown as SubstrateScenario;
  if (!Number.isInteger(s.steps) || s.steps < 1 || s.steps > 100)
    throw new Error("steps must be 1–100");
  const ids = new Set<string>();
  for (const e of s.entities) {
    if (
      !object(e) ||
      !text(e.id) ||
      ids.has(e.id) ||
      !text(e.kind) ||
      !Number.isSafeInteger(e.revision) ||
      e.revision < 1 ||
      !object(e.position) ||
      ![e.position.x, e.position.y, e.position.z].every(finite) ||
      !object(e.values) ||
      Object.keys(e.values).length > 40 ||
      !Object.values(e.values).every(finite)
    )
      throw new Error("Invalid entity or duplicate identity");
    ids.add(e.id);
  }
  const unique = (items: { id: string }[]) =>
    new Set(items.map((i) => i.id)).size === items.length;
  if (!unique(s.relationships) || !unique(s.events) || !unique(s.emergence))
    throw new Error("Duplicate scenario records");
  for (const r of s.relationships)
    if (
      !object(r) ||
      !text(r.id) ||
      !ids.has(r.source) ||
      !ids.has(r.target) ||
      !text(r.relation)
    )
      throw new Error("Invalid relationship");
  const metric = (id: string, key: string) =>
    ids.has(id) &&
    text(key) &&
    Object.hasOwn(s.entities.find((e) => e.id === id)!.values, key);
  for (const e of s.events)
    if (
      !object(e) ||
      !text(e.id) ||
      !metric(e.entityId, e.metric) ||
      !finite(e.delta) ||
      !Number.isInteger(e.tick) ||
      e.tick < 0 ||
      e.tick >= s.steps ||
      !text(e.source)
    )
      throw new Error("Invalid event");
  for (const u of s.uncertainty)
    if (
      !object(u) ||
      !metric(u.entityId, u.metric) ||
      !finite(u.lower) ||
      !finite(u.upper) ||
      u.lower > u.upper ||
      !text(u.source)
    )
      throw new Error("Invalid uncertainty");
  for (const r of s.emergence)
    if (
      !object(r) ||
      !text(r.id) ||
      !metric(r.entityId, r.metric) ||
      !finite(r.threshold) ||
      !text(r.source)
    )
      throw new Error("Invalid emergence rule");
  return s;
}
export function simulateScenario(input: unknown) {
  const scenario = validateScenario(input);
  const engine = new Simulation({
    initial: {
      entities: scenario.entities,
      detected: [] as {
        ruleId: string;
        tick: number;
        entityId: string;
        source: string;
      }[],
    },
    stepMs: 1000,
    reduce: (state, { tick }) => {
      const entities = state.entities.map((e) => {
        const values = { ...e.values };
        for (const event of scenario.events.filter(
          (v) => v.entityId === e.id && v.tick === tick,
        ))
          values[event.metric] += event.delta;
        if (!Object.values(values).every(Number.isFinite))
          throw new Error("Scenario overflow");
        return { ...e, position: { ...e.position }, values };
      });
      const detected = [...state.detected];
      for (const rule of scenario.emergence)
        if (
          !detected.some((d) => d.ruleId === rule.id) &&
          entities.find((e) => e.id === rule.entityId)!.values[rule.metric] >=
            rule.threshold
        )
          detected.push({
            ruleId: rule.id,
            tick,
            entityId: rule.entityId,
            source: rule.source,
          });
      return { entities, detected };
    },
  });
  engine.start();
  return {
    schemaVersion: 1,
    method:
      "Deterministic supplied-event scenario using MAX-CORE; not a prediction",
    tick: scenario.steps,
    result: engine.update(scenario.steps),
    relationships: scenario.relationships,
    uncertainty: scenario.uncertainty,
    assumptions:
      "Caller-supplied bounds are retained, not calibrated probabilities. No production state is changed.",
  } as unknown as Json;
}
