import type { Env } from "./types";
import type { Revision } from "../../../uss/contracts";
import { canonical } from "../../../uss/contracts";
import { runModel } from "../../../uss/simulation";
import { sha256 } from "./access";
import { approved, event, fail } from "./substrate";
export async function simulationContent(content: Record<string, unknown>) {
  let outputs;
  try {
    outputs = runModel(content);
  } catch (error) {
    return fail((error as Error).message);
  }
  const inputHash = await sha256(canonical(content.inputs));
  const outputHash = await sha256(canonical(outputs));
  const reproducibilityHash = await sha256(
    canonical({
      modelVersion: content.modelVersion,
      inputs: content.inputs,
      source: content.source,
      confidence: content.confidence,
    }),
  );
  return {
    ...content,
    outputs,
    inputHash,
    outputHash,
    reproducibilityHash,
    runtime: "MAX-CORE Simulation",
    arithmetic: "ECMAScript binary64",
  };
}
export async function replay(env: Env, record: Revision, actor: string) {
  if (record.registry !== "simulation") fail("Expected a simulation");
  if (!(await approved(env, record.id, record.version)))
    fail("Simulation approval required", 409);
  const result = await simulationContent(record.content);
  if (
    result.outputHash !== record.content.outputHash ||
    result.reproducibilityHash !== record.content.reproducibilityHash
  )
    fail("Reproducibility validation failed", 409);
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO uss_replays(id,identity_id,version,actor,input_hash,output_hash,reproducibility_hash,outputs,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).bind(
      id,
      record.id,
      record.version,
      actor,
      result.inputHash,
      result.outputHash,
      result.reproducibilityHash,
      canonical(result.outputs),
      new Date().toISOString(),
    ),
    event(env, record.id, record.version, "simulation-replay", actor, {
      replayId: id,
      inputHash: result.inputHash,
      outputHash: result.outputHash,
      reproducibilityHash: result.reproducibilityHash,
    }),
  ]);
  return { id, identity: record.id, version: record.version, ...result };
}
