import type { GraphEdge } from "./universe";
/** Cycle-safe directed graph analysis. Edges point from a record to its dependency. */
export function analyseSubstrateGraph(
  edges: GraphEdge[],
  root: string,
  target?: string,
) {
  function walk(start: string, reverse: boolean, relations: string[]) {
    const seen = new Set([start]),
      queue = [start],
      parents = new Map<string, string>();
    for (let i = 0; i < queue.length; i++)
      for (const edge of edges) {
        if (!relations.includes(edge.relation)) continue;
        const from = reverse ? edge.target : edge.source,
          to = reverse ? edge.source : edge.target;
        if (from === queue[i] && !seen.has(to)) {
          seen.add(to);
          queue.push(to);
          parents.set(to, from);
        }
      }
    return { ids: queue.slice(1), parents };
  }
  const dependencies = walk(root, false, [
    "depends_on",
    "derived_from",
    "governed_by",
    "simulates",
  ]);
  const influence = walk(root, true, [
    "depends_on",
    "derived_from",
    "governed_by",
    "simulates",
  ]);
  const explicitInfluence = walk(root, false, ["influences"]);
  const path: string[] = [];
  if (target && (target === root || dependencies.parents.has(target))) {
    let current = target;
    path.push(current);
    while (current !== root) {
      current = dependencies.parents.get(current)!;
      path.push(current);
    }
    path.reverse();
  }
  return {
    root,
    dependencies: dependencies.ids,
    influence: [...new Set([...influence.ids, ...explicitInfluence.ids])],
    riskPropagation: influence.ids,
    opportunityDiscovery: explicitInfluence.ids,
    shortestDependencyPath: target ? path : null,
    method:
      "Declared directed relationships; risk propagation identifies affected records, not a probability estimate.",
  };
}
