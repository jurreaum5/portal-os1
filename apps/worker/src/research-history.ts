import type { Env } from "./types";
/** Version family in both directions; derivation follows the exact referenced source. UNION terminates cycles. */
const ancestry = `WITH RECURSIVE family(id) AS (
 SELECT ?
 UNION SELECT v.output_id FROM research_versions v JOIN family f ON v.predecessor_id=f.id
 UNION SELECT v.predecessor_id FROM research_versions v JOIN family f ON v.output_id=f.id WHERE v.predecessor_id IS NOT NULL
), lineage(id) AS (
 SELECT id FROM family
 UNION SELECT r.target_id FROM identity_relationships r JOIN lineage l ON l.id=r.source_id
 JOIN universe_identities i ON i.id=r.target_id AND i.kind='research-output'
 WHERE r.relation IN ('derives_from','supersedes','depends_on')
)`;
export async function researchHistory(env: Env, root: string, page: number) {
  const limit = 100,
    offset = page * limit;
  const [records, edges, history] = await Promise.all([
    env.DB.prepare(
      ancestry +
        ` SELECT i.*,v.version,v.predecessor_id FROM lineage l JOIN universe_identities i ON i.id=l.id LEFT JOIN research_versions v ON v.output_id=i.id ORDER BY i.id LIMIT ? OFFSET ?`,
    )
      .bind(root, limit + 1, offset)
      .all<{
        id: string;
        kind: string;
        label: string;
        state: string;
        version: number;
        predecessor_id: string | null;
      }>(),
    env.DB.prepare(
      ancestry +
        ` SELECT r.id,r.source_id AS source,r.target_id AS target,r.relation,r.evidence FROM identity_relationships r WHERE r.source_id IN (SELECT id FROM lineage) AND r.target_id IN (SELECT id FROM lineage) ORDER BY r.id LIMIT ? OFFSET ?`,
    )
      .bind(root, limit + 1, offset)
      .all(),
    env.DB.prepare(
      ancestry +
        ` SELECT e.* FROM universe_events e WHERE e.entity_id IN (SELECT id FROM lineage) ORDER BY e.sequence LIMIT ? OFFSET ?`,
    )
      .bind(root, limit + 1, offset)
      .all(),
  ]);
  const more = [records, edges, history].some((r) => r.results.length > limit);
  return {
    root,
    researchRecords: records.results
      .slice(0, limit)
      .map((r) => ({
        ...r,
        source: JSON.parse(r.state).source,
        status: JSON.parse(r.state).status,
      })),
    nodes: records.results
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        label: r.label,
        status: JSON.parse(r.state).status,
      })),
    edges: edges.results.slice(0, limit),
    publicationHistory: history.results.slice(0, limit),
    pagination: {
      page,
      limit,
      nextPage: more ? page + 1 : null,
      complete: !more,
    },
    method:
      "Complete retained version family and referenced research ancestry, without a navigation depth cap. Each page includes up to 100 records, edges and events. Refresh from page zero after concurrent additions.",
  };
}
