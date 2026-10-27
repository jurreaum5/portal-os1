import { dependencyAnalysis, type ManifoldGraph } from "./manifold";
import type { Universe } from "./universe";
export const bemaxQuestions = [
  "What should I focus on this quarter?",
  "What has the highest long-term impact?",
  "What creates the largest ecosystem risk?",
  "What should be funded next?",
  "What should be archived next?",
  "What is slowing growth?",
  "What changed since my last review?",
  "What changed?",
  "What matters?",
  "What should I do next?",
  "What should be published?",
  "What represents the highest opportunity?",
] as const;
export function briefUniverse(
  u: Universe,
  question: string,
  graph: ManifoldGraph = { nodes: [], edges: [] },
) {
  const query = question.toLowerCase();
  const analyses = new Map(
    u.products.map((p) => [p.id, dependencyAnalysis(graph, `product:${p.id}`)]),
  );
  const selected = query.includes("archiv")
    ? u.products.filter(
        (p) => p.stage !== "Archived" && (p.status === "Paused" || p.risk > 0),
      )
    : query.includes("growth")
      ? u.products.filter(
          (p) =>
            p.blockedDependencies.length ||
            p.blockedRuns ||
            (p.observedGrowthPct !== null && p.observedGrowthPct < 0),
        )
      : query.includes("fund") ||
          query.includes("quarter") ||
          query.includes("impact")
        ? u.products.filter((p) => p.stage !== "Archived")
        : query.includes("publish")
          ? u.products.filter((p) => p.stage === "Ready")
          : query.includes("opportunity")
            ? u.products.filter((p) => p.promotionCandidate)
            : u.products.filter(
                (p) => p.risk > 0 || p.recommendations.length > 0,
              );
  return {
    question,
    summary: `${u.summary.products} products; ${u.summary.riskProducts} with observed risk flags. ${u.nextBestAction}`,
    recommendations: [...selected]
      .sort(
        (a, b) =>
          (!query.includes("fund") &&
          !query.includes("quarter") &&
          !query.includes("impact")
            ? b.risk - a.risk
            : 0) ||
          analyses.get(b.id)!.affectedConsumers.length -
            analyses.get(a.id)!.affectedConsumers.length ||
          b.score - a.score ||
          a.id.localeCompare(b.id),
      )
      .map((p) => ({
        entityId: `product:${p.id}`,
        label: p.name,
        action: query.includes("archiv")
          ? "Review archive eligibility and affected consumers through existing lifecycle approvals."
          : query.includes("fund")
            ? "Review resource allocation against recorded readiness and dependency exposure."
            : p.nextBestAction,
        impactScope: {
          entityId: `product:${p.id}`,
          divisionId: p.divisionId,
          affectedEntities: analyses
            .get(p.id)!
            .affectedConsumers.map((v) => v.id),
        },
        dependencyAnalysis: analyses.get(p.id)!,
        evidence: {
          stage: p.stage,
          score: p.score,
          riskFlags: p.risks,
          blockedDependencies: p.blockedDependencies,
          reportedMonthlyUsd: p.revenue,
          observedGrowthPct: p.observedGrowthPct,
          telemetryAt: p.telemetryAt,
        },
        sources: [
          `/api/twin/products/${encodeURIComponent(p.id)}`,
          "/api/intelligence",
        ],
        confidence:
          "Rule-based operational triage; score measures lifecycle evidence, not market potential",
        tradeoffs: [
          "Prioritising this product delays other work",
          "Publishing still requires verified QA, package evidence and Governor approval",
        ],
        navigateTo: `/portal/products/${encodeURIComponent(p.id)}/twin`,
      })),
    evidence: u.summary,
    sources: ["/api/intelligence", "/api/twin/graph"],
    confidence:
      "Operational heuristics over recorded twins; long-term returns and causal effects are unknown",
    tradeoffs: [
      "Dependency exposure can favour shared infrastructure over independent growth",
      "Funding and archive recommendations require evidence-backed Governor decisions",
    ],
    impactScope: u.divisions.map((d) => ({ id: d.id, name: d.name })),
    dependencyAnalysis: {
      method:
        "Directed depends_on reachability up to eight hops; no inferred links",
    },
    ecosystemHealth: u.summary.ecosystemHealth,
    growthAnalysis: {
      observedGrowthPct: u.summary.observedGrowthPct,
      divisions: u.divisions.map((d) => ({
        id: d.id,
        observedGrowthPct: d.observedGrowthPct,
      })),
    },
    rankingMethod:
      "Quarter, impact and funding focus: affected consumers then lifecycle completeness. Other focus: observed risk first. No predicted ROI.",
    methods: u.methods,
  };
}
