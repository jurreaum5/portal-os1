import type { GraphNode, GraphEdge } from "./universe";
export interface ManifoldGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
/** depends_on points from consumer to prerequisite. Influence follows the reverse. */
export function traverse(
  g: ManifoldGraph,
  root: string,
  direction: "outgoing" | "incoming" | "both",
  relation?: string,
  depth = 8,
) {
  const adjacency = new Map<string, { id: string; edgeId: string }[]>();
  for (const e of g.edges) {
    if (relation && e.relation !== relation) continue;
    if (direction !== "incoming")
      adjacency.set(e.source, [
        ...(adjacency.get(e.source) ?? []),
        { id: e.target, edgeId: e.id },
      ]);
    if (direction !== "outgoing")
      adjacency.set(e.target, [
        ...(adjacency.get(e.target) ?? []),
        { id: e.source, edgeId: e.id },
      ]);
  }
  const found = new Map([
    [
      root,
      {
        id: root,
        depth: 0,
        via: null as string | null,
        edgeId: null as string | null,
      },
    ],
  ]);
  const queue = [root];
  for (let i = 0; i < queue.length; i++) {
    const parent = found.get(queue[i])!;
    if (parent.depth >= depth) continue;
    for (const next of adjacency.get(parent.id) ?? [])
      if (!found.has(next.id)) {
        found.set(next.id, {
          ...next,
          depth: parent.depth + 1,
          via: parent.id,
        });
        queue.push(next.id);
      }
  }
  return [...found.values()];
}
export function dependencyAnalysis(g: ManifoldGraph, root: string) {
  return {
    prerequisites: traverse(g, root, "outgoing", "depends_on").slice(1),
    affectedConsumers: traverse(g, root, "incoming", "depends_on").slice(1),
    maxDepth: 8,
    method:
      "Directed depends_on reachability, capped at eight hops; cycles visited once. Reachability is exposure, not causal probability.",
  };
}
export function manifoldView(
  g: ManifoldGraph,
  root: string,
  direction: "outgoing" | "incoming" | "both",
  relation?: string,
  depth = 8,
) {
  const visits = traverse(g, root, direction, relation, depth);
  const ids = new Set(visits.map((v) => v.id));
  return {
    root,
    direction,
    relation: relation ?? null,
    depth,
    visits,
    nodes: g.nodes.filter((n) => ids.has(n.id)),
    edges: g.edges.filter(
      (e) =>
        ids.has(e.source) &&
        ids.has(e.target) &&
        (!relation || e.relation === relation),
    ),
    dependencyAnalysis: dependencyAnalysis(g, root),
    sources: ["/api/twin/graph"],
    confidence:
      "Recorded graph relationships; missing relationships are unknown",
  };
}
