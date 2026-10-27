import { departments } from "./operations";
import type { Env } from "./types";
import type { GraphNode, GraphEdge } from "../../../portal-os/universe";
export interface Identity {
  id: string;
  kind: string;
  label: string;
  invariants: string;
  state: string;
  revision: number;
}
export const listRows = async <T>(
  env: Env,
  sql: string,
  ...values: (string | number)[]
): Promise<T[]> =>
  (
    await env.DB.prepare(sql)
      .bind(...values)
      .all<T>()
  ).results;
export function eventStatement(
  env: Env,
  entityId: string,
  type: string,
  actor: string,
  source: string,
  evidence: unknown,
  id = crypto.randomUUID(),
  observedAt = new Date().toISOString(),
) {
  return env.DB.prepare(
    "INSERT INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at) VALUES (?,?,?,?,?,?,?)",
  ).bind(
    id,
    entityId,
    type,
    actor,
    source,
    JSON.stringify(evidence),
    observedAt,
  );
}
export async function identity(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM universe_identities WHERE id=?")
    .bind(id)
    .first<Identity>();
}
/** Identity origin and key are immutable; subsequent observations only append history. */
export async function registerIdentity(
  env: Env,
  record: {
    id: string;
    kind: string;
    label: string;
    invariants: unknown;
    state?: unknown;
  },
  actor: string,
  source: string,
) {
  const invariants = JSON.stringify(record.invariants);
  const old = await identity(env, record.id);
  if (old && (old.kind !== record.kind || old.invariants !== invariants))
    throw new Error("Identity invariants do not match the persisted identity");
  if (old) return old;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO universe_identities(id,kind,label,invariants,state) VALUES (?,?,?,?,?)",
    ).bind(
      record.id,
      record.kind,
      record.label,
      invariants,
      JSON.stringify(record.state ?? {}),
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at) VALUES (?,?,'identity.registered',?,?,?,?)",
    ).bind(
      `origin:${record.id}`,
      record.id,
      actor,
      source,
      invariants,
      new Date().toISOString(),
    ),
  ]);
  const saved = (await identity(env, record.id))!;
  if (saved.kind !== record.kind || saved.invariants !== invariants)
    throw new Error("Identity conflict");
  return saved;
}
export async function identityGraph(env: Env) {
  const records = await listRows<Identity>(
    env,
    "SELECT * FROM universe_identities ORDER BY id LIMIT 5001",
  );
  const relationships = await listRows<{
    id: string;
    source: string;
    target: string;
    relation: string;
  }>(
    env,
    "SELECT id,source_id AS source,target_id AS target,relation FROM identity_relationships ORDER BY id LIMIT 5001",
  );
  if (records.length > 5000 || relationships.length > 5000)
    throw new RangeError("Identity graph exceeds 5000 records");
  return {
    nodes: records.map(
      (r) =>
        ({
          id: r.id,
          kind: r.kind,
          label: r.label,
          status: JSON.parse(r.state).status ?? "Recorded identity",
          scenes:
            JSON.parse(r.state).xrScenes ??
            JSON.parse(r.state).metadata?.xrScenes,
        }) as GraphNode,
    ),
    edges: [
      ...relationships,
      ...records.flatMap((r) => {
        const assignment = JSON.parse(r.state).assignment;
        return assignment
          ? [
              {
                id: `assignment:${r.id}`,
                source: r.id,
                target: assignment.departmentId,
                relation: "assigned_to",
              },
            ]
          : [];
      }),
    ] as GraphEdge[],
  };
}
export async function synchroniseIdentities(env: Env) {
  // Set-based projections avoid one D1 request per entity. Governed state is never overwritten.
  await env.DB.batch([
    env.DB
      .prepare(`INSERT INTO universe_identities(id,kind,label,invariants,source_version)
      SELECT 'product:'||id,'product',name,json_object('origin','products','key',id),updated_at||':'||stage||':'||status FROM products WHERE true
      ON CONFLICT(id) DO UPDATE SET label=excluded.label,source_version=excluded.source_version,revision=universe_identities.revision+1 WHERE universe_identities.label<>excluded.label OR universe_identities.source_version<>excluded.source_version`),
    env.DB.prepare(`INSERT INTO universe_identities(id,kind,label,invariants)
      SELECT 'division:'||id,'division',name,json_object('origin','divisions','key',id) FROM divisions WHERE true
      ON CONFLICT(id) DO UPDATE SET label=excluded.label,revision=universe_identities.revision+1 WHERE universe_identities.label<>excluded.label`),
    env.DB
      .prepare(`INSERT INTO universe_identities(id,kind,label,invariants,source_version)
      SELECT 'project:'||id,'project',stage||' · '||id,json_object('origin','factory_runs','key',id),updated_at||':'||stage||':'||status FROM factory_runs WHERE true
      ON CONFLICT(id) DO UPDATE SET label=excluded.label,source_version=excluded.source_version,revision=universe_identities.revision+1 WHERE universe_identities.source_version<>excluded.source_version`),
    env.DB
      .prepare(`INSERT INTO universe_identities(id,kind,label,invariants,source_version)
      SELECT 'approval:'||id,'approval',action,json_object('origin','approvals','key',id),status FROM approvals WHERE true
      ON CONFLICT(id) DO UPDATE SET source_version=excluded.source_version,revision=universe_identities.revision+1 WHERE universe_identities.source_version<>excluded.source_version`),
    env.DB
      .prepare(`INSERT OR IGNORE INTO universe_identities(id,kind,label,invariants)
      SELECT DISTINCT 'pipeline:'||stage,'pipeline',stage,json_object('origin','lifecycle','key',stage) FROM products`),
    ...departments.map((d) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO universe_identities(id,kind,label,invariants) VALUES (?,'department',?,?)",
      ).bind(
        `department:${d.id}`,
        d.name,
        JSON.stringify({ origin: "ICVS", key: d.id }),
      ),
    ),
    env.DB
      .prepare(`INSERT OR IGNORE INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
      SELECT 'origin:'||id,id,'identity.registered','ICVS','native registry',invariants,CURRENT_TIMESTAMP FROM universe_identities`),
    env.DB
      .prepare(`INSERT OR IGNORE INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
      SELECT 'lifecycle:'||id||':'||updated_at||':'||stage||':'||status,'product:'||id,'lifecycle.observed','ICVS','products',json_object('stage',stage,'status',status),updated_at FROM products`),
    env.DB
      .prepare(`INSERT OR IGNORE INTO universe_events(id,entity_id,type,actor,source,evidence,observed_at)
      SELECT 'workflow:'||w.id,'product:'||w.product_id,'lifecycle.transition',w.actor,'factory',
      json_object('from',w.from_stage,'to',w.to_stage,'engine',w.engine,'reason',w.reason,'evidence',w.evidence),w.created_at
      FROM workflow_events w JOIN universe_identities i ON i.id='product:'||w.product_id`),
  ]);
}
