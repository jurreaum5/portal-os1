import type { Env } from "./types";
import { sha256 } from "./access";
import {
  canonical,
  registries,
  divisions,
  charterSections,
  lawLayers,
  councils,
  text,
  object,
  uncertainty,
  type Revision,
  type Reference,
} from "../../../uss/contracts";

export class SubstrateError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const fail = (message: string, status = 400): never => {
  throw new SubstrateError(message, status);
};
export async function bounded<T>(
  env: Env,
  sql: string,
  ...args: (string | number)[]
) {
  const result = await env.DB.prepare(sql)
    .bind(...args)
    .all<T>();
  if (result.results.length > 5000)
    fail("Projection exceeds 5000 records; narrow the query.", 413);
  return result.results;
}
export async function revision(
  env: Env,
  id: string,
  version?: number,
): Promise<Revision> {
  const row = await env.DB.prepare(
    version === undefined
      ? "SELECT snapshot FROM uss_revisions WHERE identity_id=? ORDER BY version DESC LIMIT 1"
      : "SELECT snapshot FROM uss_revisions WHERE identity_id=? AND version=?",
  )
    .bind(...(version === undefined ? [id] : [id, version]))
    .first<{ snapshot: string }>();
  if (!row) return fail("Identity revision not found", 404);
  return JSON.parse(row.snapshot);
}
export function event(
  env: Env,
  id: string,
  version: number,
  kind: string,
  actor: string,
  payload: unknown,
) {
  return env.DB.prepare(
    "INSERT INTO uss_events(id,identity_id,version,kind,actor,payload,created_at) VALUES (?,?,?,?,?,?,?)",
  ).bind(
    crypto.randomUUID(),
    id,
    version,
    kind,
    actor,
    canonical(payload),
    new Date().toISOString(),
  );
}
export async function approved(env: Env, id: string, version: number) {
  const decision = await env.DB.prepare(
    "SELECT action FROM uss_decisions WHERE identity_id=? AND version=?",
  )
    .bind(id, version)
    .first<{ action: string }>();
  return decision?.action === "approve" || decision?.action === "override";
}
export async function prepareRevision(
  env: Env,
  input: Record<string, unknown>,
  actor: string,
  existing?: Revision,
) {
  const id = existing?.id ?? crypto.randomUUID();
  const registry = existing?.registry ?? input.registry;
  if (!(registries as readonly unknown[]).includes(registry))
    fail("Unknown registry");
  if (existing && input.expectedVersion !== existing.version)
    fail("Revision conflict", 409);
  if (
    !text(input.title) ||
    !text(input.owner) ||
    !(divisions as readonly unknown[]).includes(input.division) ||
    !text(input.lifecycle, 80) ||
    !object(input.content) ||
    !uncertainty(input.uncertainty)
  )
    fail(
      "Title, ownership, division, lifecycle, content and uncertainty metadata are required",
    );
  const content = input.content as Record<string, unknown>;
  if (
    registry === "charter" &&
    !charterSections.every((k) => text(content[k], 4000))
  )
    fail("All mission charter principles are required");
  if (
    registry === "law" &&
    (!(lawLayers as readonly unknown[]).includes(content.layer) ||
      !text(content.statement, 8000))
  )
    fail("A valid law layer and statement are required");
  if (
    registry === "council" &&
    !(councils as readonly unknown[]).includes(content.name)
  )
    fail("Unknown Institute council");
  if (
    registry === "membership" &&
    (!text(content.member) ||
      !(councils as readonly unknown[]).includes(content.council))
  )
    fail("Member and council required");
  if (
    registry === "emergence" &&
    (![
      "pattern",
      "cluster",
      "anomaly",
      "behaviour-change",
      "system-effect",
    ].includes(String(content.kind)) ||
      !text(content.method, 2000))
  )
    fail("Emergence observation kind and method required");
  if (!Array.isArray(input.references) || input.references.length > 100)
    fail("At most 100 pinned references are required");
  const refs = input.references as Reference[];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (
      !object(ref) ||
      !text(ref.id) ||
      !Number.isSafeInteger(ref.version) ||
      ref.version < 1 ||
      ![
        "derived_from",
        "depends_on",
        "member_of",
        "owned_by",
        "governed_by",
        "influences",
        "simulates",
      ].includes(ref.relation)
    )
      fail("Invalid pinned reference");
    const key = canonical(ref);
    if (seen.has(key)) fail("Duplicate reference");
    seen.add(key);
    await revision(env, ref.id, ref.version);
  }
  const origins: Record<string, string[]> = {
    framework: ["research"],
    publication: ["research", "framework"],
    course: ["research", "framework", "publication"],
    standard: ["research", "framework", "course"],
    protocol: ["standard"],
    certification: ["course", "standard"],
  };
  if (origins[String(registry)]) {
    const parents = await Promise.all(
      refs
        .filter((r) => r.relation === "derived_from")
        .map((r) => revision(env, r.id, r.version)),
    );
    if (!parents.some((p) => origins[String(registry)].includes(p.registry)))
      fail(`A ${registry} requires a pinned originating record`);
  }
  const base = {
    id,
    version: (existing?.version ?? 0) + 1,
    registry: registry as Revision["registry"],
    title: input.title as string,
    owner: input.owner as string,
    division: input.division as string,
    lifecycle: input.lifecycle as string,
    content,
    references: refs,
    uncertainty: input.uncertainty as Revision["uncertainty"],
    author: actor,
    createdAt: new Date().toISOString(),
    previousHash: existing?.hash ?? null,
  };
  const record: Revision = { ...base, hash: await sha256(canonical(base)) };
  const statements = [
    ...(!existing
      ? [
          env.DB.prepare(
            "INSERT INTO uss_identities(id,registry,created_at) VALUES (?,?,?)",
          ).bind(id, registry, record.createdAt),
        ]
      : []),
    env.DB.prepare(
      "INSERT INTO uss_revisions(identity_id,version,snapshot,hash,previous_hash,created_at) VALUES (?,?,?,?,?,?)",
    ).bind(
      id,
      record.version,
      canonical(record),
      record.hash,
      record.previousHash,
      record.createdAt,
    ),
    ...refs.map((ref) =>
      env.DB.prepare(
        "INSERT INTO uss_links(source_id,source_version,target_id,target_version,relation) VALUES (?,?,?,?,?)",
      ).bind(id, record.version, ref.id, ref.version, ref.relation),
    ),
    event(env, id, record.version, "revision", actor, {
      hash: record.hash,
      previousHash: record.previousHash,
    }),
  ];
  return { record, statements };
}
export async function saveRevision(
  env: Env,
  input: Record<string, unknown>,
  actor: string,
  existing?: Revision,
) {
  const { record, statements } = await prepareRevision(
    env,
    input,
    actor,
    existing,
  );
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (String(error).includes("UNIQUE constraint"))
      fail("Concurrent revision conflict", 409);
    throw error;
  }
  return record;
}
export async function decide(
  env: Env,
  id: string,
  version: number,
  actor: string,
  action: string,
  reason: unknown,
) {
  await revision(env, id, version);
  if (
    !["approve", "reject", "override"].includes(action) ||
    !text(reason, 2000) ||
    reason.trim().length < 10
  )
    fail("Decision and a reason of 10–2000 characters required");
  if (
    !(await env.DB.prepare(
      "SELECT id FROM uss_events WHERE identity_id=? AND version=? AND kind='review' LIMIT 1",
    )
      .bind(id, version)
      .first())
  )
    fail("Review is required before a decision", 409);
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO uss_decisions(identity_id,version,action,actor,reason,created_at) VALUES (?,?,?,?,?,?)",
      ).bind(id, version, action, actor, reason, new Date().toISOString()),
      event(env, id, version, "decision", actor, { action, reason }),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE constraint"))
      fail("Decision already final", 409);
    throw error;
  }
  return { id, version, action };
}
export async function substrateGraph(env: Env) {
  const records = await bounded<{ snapshot: string; decision: string | null }>(
    env,
    "SELECT r.snapshot,d.action AS decision FROM uss_revisions r LEFT JOIN uss_decisions d ON d.identity_id=r.identity_id AND d.version=r.version WHERE r.version=(SELECT MAX(version) FROM uss_revisions WHERE identity_id=r.identity_id) LIMIT 5001",
  );
  const links = await bounded<{
    source: string;
    target: string;
    relation: string;
  }>(
    env,
    "SELECT DISTINCT 'uss:'||source_id AS source,'uss:'||target_id AS target,relation FROM uss_links l WHERE source_version=(SELECT MAX(version) FROM uss_revisions WHERE identity_id=l.source_id) LIMIT 5001",
  );
  return {
    nodes: records.map(({ snapshot, decision }) => {
      const r: Revision = JSON.parse(snapshot);
      return {
        id: `uss:${r.id}`,
        kind: r.registry,
        label: r.title,
        status: `${decision ?? "pending"} · ${r.lifecycle}`,
        divisionId: "max-institute",
      };
    }),
    edges: links.map((r) => ({
      ...r,
      id: `uss-link:${r.source}:${r.target}:${r.relation}`,
    })),
  };
}
export async function lineage(env: Env, id: string) {
  await revision(env, id);
  const ancestors = await bounded<{
    identity_id: string;
    version: number;
    snapshot: string;
  }>(
    env,
    `WITH RECURSIVE ancestry(id,version) AS (
    SELECT identity_id,version FROM uss_revisions WHERE identity_id=?
    UNION SELECT l.target_id,l.target_version FROM uss_links l JOIN ancestry a ON l.source_id=a.id AND l.source_version=a.version WHERE l.relation IN ('derived_from','depends_on')
  ) SELECT r.* FROM uss_revisions r JOIN ancestry a ON a.id=r.identity_id AND a.version=r.version LIMIT 5001`,
    id,
  );
  const children = await bounded(
    env,
    "SELECT source_id,source_version,relation,target_version FROM uss_links WHERE target_id=? LIMIT 5001",
    id,
  );
  return {
    origin: id,
    ancestors: ancestors.map((r) => JSON.parse(r.snapshot)),
    children,
  };
}

/** Verify and reconstruct the recorded timeline without executing historical side effects. */
export async function replayEvents(env: Env, id: string) {
  const history = await bounded<{ snapshot: string }>(
    env,
    "SELECT snapshot FROM uss_revisions WHERE identity_id=? ORDER BY version LIMIT 5001",
    id,
  );
  if (!history.length) fail("Identity not found", 404);
  let previousHash: string | null = null;
  for (let i = 0; i < history.length; i++) {
    const record: Revision = JSON.parse(history[i].snapshot);
    const { hash, ...snapshot } = record;
    if (
      record.version !== i + 1 ||
      record.previousHash !== previousHash ||
      hash !== (await sha256(canonical(snapshot)))
    )
      fail("Snapshot integrity validation failed", 409);
    previousHash = hash;
  }
  const events = await bounded(
    env,
    "SELECT * FROM uss_events WHERE identity_id=? ORDER BY sequence LIMIT 5001",
    id,
  );
  return {
    identity: id,
    head: JSON.parse(history[history.length - 1].snapshot),
    verifiedRevisions: history.length,
    events,
    mode: "audit reconstruction; external effects are never re-executed",
  };
}
