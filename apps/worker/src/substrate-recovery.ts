import { recoveryTransition } from "../../../icvs/substrate-governance";
import type { Env } from "./types";
import { approved, event, fail, prepareRevision, revision } from "./substrate";
import { text } from "../../../uss/contracts";
interface Recovery {
  id: string;
  identity_id: string;
  version: number;
  target_version: number;
  status: string;
  reason: string;
}
export async function recommendRecovery(
  env: Env,
  id: string,
  version: number,
  targetVersion: unknown,
  reason: unknown,
  actor: string,
) {
  if (
    !Number.isSafeInteger(targetVersion) ||
    Number(targetVersion) >= version ||
    Number(targetVersion) < 1 ||
    !text(reason, 2000)
  )
    fail("Earlier target version and failure reason required");
  await revision(env, id, version);
  await revision(env, id, Number(targetVersion));
  if (!(await approved(env, id, Number(targetVersion))))
    fail("Recovery target must have approval", 409);
  const recoveryId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO uss_recoveries(id,identity_id,version,target_version,status,reason,actor,created_at) VALUES (?,?,?,?,'recommended',?,?,?)",
    ).bind(
      recoveryId,
      id,
      version,
      targetVersion,
      reason,
      actor,
      new Date().toISOString(),
    ),
    event(env, id, version, "failure-detected", actor, { recoveryId, reason }),
    event(env, id, version, "recovery-recommended", actor, {
      recoveryId,
      targetVersion,
      reason,
    }),
  ]);
  return { id: recoveryId, status: "recommended" };
}
export async function recoveryAction(
  env: Env,
  id: string,
  action: string,
  actor: string,
  reason: unknown,
) {
  const recovery = await env.DB.prepare(
    "SELECT * FROM uss_recoveries WHERE id=?",
  )
    .bind(id)
    .first<Recovery>();
  if (!recovery) return fail("Recovery not found", 404);
  if (!text(reason, 2000) || reason.trim().length < 10)
    fail("A reason of 10–2000 characters required");
  const transition = recoveryTransition(action);
  if (!transition) return fail("Unsupported recovery action");
  const expected = transition.from;
  if (recovery.status !== expected)
    fail("Recovery transition requires review and approval", 409);
  if (action === "execute") {
    const current = await revision(env, recovery.identity_id);
    if (current.version !== recovery.version)
      fail("Identity advanced; recommend a new recovery", 409);
    const target = await revision(
      env,
      recovery.identity_id,
      recovery.target_version,
    );
    const { record, statements } = await prepareRevision(
      env,
      { ...target, expectedVersion: current.version },
      actor,
      current,
    );
    // D1 batch is atomic: compensation, approved restoration, validation, audit and state commit together.
    const claim = env.DB.prepare(
      "UPDATE uss_recoveries SET status='validated' WHERE id=? AND status='approved'",
    ).bind(id);
    try {
      await env.DB.batch([
        ...statements,
        env.DB.prepare(
          "INSERT INTO uss_decisions(identity_id,version,action,actor,reason,created_at) VALUES (?,?,'approve',?,?,?)",
        ).bind(
          record.id,
          record.version,
          actor,
          `Approved recovery ${id}: ${reason}`,
          new Date().toISOString(),
        ),
        event(env, record.id, record.version, "recovery-executed", actor, {
          recoveryId: id,
          restoredVersion: target.version,
        }),
        event(env, record.id, record.version, "compensation", actor, {
          recoveryId: id,
          from: current.version,
          to: target.version,
        }),
        event(env, record.id, record.version, "rollback-validated", actor, {
          recoveryId: id,
          restoredContentHash: target.hash,
        }),
        claim,
      ]);
    } catch (error) {
      if (String(error).includes("UNIQUE constraint"))
        fail("Concurrent recovery conflict", 409);
      throw error;
    }
    return { id, status: "validated", record };
  }
  const next = transition.to;
  // Audit uses conditional INSERT before update so a losing concurrent transition cannot invent a decision.
  const committed = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO uss_events(id,identity_id,version,kind,actor,payload,created_at) SELECT ?,identity_id,version,?,?,?,? FROM uss_recoveries WHERE id=? AND status=?",
    ).bind(
      crypto.randomUUID(),
      `recovery-${action}`,
      actor,
      JSON.stringify({ recoveryId: id, reason }),
      new Date().toISOString(),
      id,
      expected,
    ),
    env.DB.prepare(
      "UPDATE uss_recoveries SET status=? WHERE id=? AND status=?",
    ).bind(next, id, expected),
  ]);
  if (committed[1].meta.changes !== 1)
    fail("Concurrent recovery transition", 409);
  return { id, status: next };
}
