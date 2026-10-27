import type { Universe } from "./universe";
export const bemaxQuestions = [
  "What changed?",
  "What matters?",
  "What should I do next?",
  "What should be published?",
  "What represents the highest opportunity?",
] as const;
export function briefUniverse(u: Universe, question: string) {
  const query = question.toLowerCase();
  const selected = query.includes("publish")
    ? u.products.filter((p) => p.stage === "Ready")
    : query.includes("opportunity")
      ? u.products.filter((p) => p.promotionCandidate)
      : u.products.filter((p) => p.risk > 0 || p.recommendations.length > 0);
  return {
    question,
    summary: `${u.summary.products} products; ${u.summary.riskProducts} with observed risk flags. ${u.nextBestAction}`,
    recommendations: [...selected]
      .sort(
        (a, b) =>
          b.risk - a.risk || b.score - a.score || a.id.localeCompare(b.id),
      )
      .map((p) => ({
        entityId: `product:${p.id}`,
        label: p.name,
        action: p.nextBestAction,
        evidence: {
          stage: p.stage,
          score: p.score,
          riskFlags: p.risks,
          blockedDependencies: p.blockedDependencies,
          reportedMonthlyUsd: p.revenue,
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
    methods: u.methods,
  };
}
