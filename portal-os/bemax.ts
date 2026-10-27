import type { Universe } from "./universe";
export const questions = [
  "What needs attention?",
  "What is my highest opportunity?",
  "What should be published?",
  "What risks should I address?",
  "What changed since yesterday?",
  "What is slowing growth?",
];
export const actionKinds = [
  "Publish Product",
  "Pause Project",
  "Increase Resources",
  "Archive Asset",
  "Promote Product",
  "Generate Report",
  "Create Forecast",
] as const;
export type ActionKind = (typeof actionKinds)[number];
export interface Reasoning {
  domain: string;
  priority?: number;
  title: string;
  why: string;
  evidence: string[];
  sources: string[];
  confidence: string;
  tradeoffs: string;
  entityId: string | null;
}
export function reason(u: Universe): Reasoning[] {
  const result: Reasoning[] = [];
  for (const p of u.products) {
    const base = {
      entityId: `product:${p.id}`,
      sources: [`/api/twin/products/${encodeURIComponent(p.id)}`],
      confidence: "Rule-based triage; not a probability",
      tradeoffs:
        "Prioritising this product can delay other work; validate current execution evidence.",
    };
    if (p.risk)
      result.push({
        ...base,
        domain: "risk",
        priority: p.risk,
        title: `Review ${p.name}`,
        why: p.risks.join(" "),
        evidence: [
          `Risk heuristic ${p.risk}/100`,
          `Status: ${p.status}`,
          `Blocked operations: ${p.blockedRuns}`,
        ],
      });
    if (p.dependencies.length)
      result.push({
        ...base,
        domain: "dependency",
        title: `Review dependencies of ${p.name}`,
        why: p.blockedDependencies.length
          ? "Unavailable dependencies may prevent delivery."
          : "Dependencies couple delivery schedules.",
        evidence: p.dependencies.map(
          (id) =>
            `Dependency: ${id}${p.blockedDependencies.includes(id) ? " (flagged)" : ""}`,
        ),
      });
    if (p.promotionCandidate || p.stage === "Ready")
      result.push({
        ...base,
        domain: "portfolio",
        priority: p.score,
        title: `Review ${p.name} for publication`,
        why: "Lifecycle or score evidence warrants Governor review; only a verified ICVS release gate can publish.",
        evidence: [
          `Stage: ${p.stage}`,
          `Score: ${p.score}`,
          `Risk flags: ${p.risks.length}`,
        ],
      });
    if (p.observedGrowthPct !== null)
      result.push({
        ...base,
        domain: "growth",
        priority: -p.observedGrowthPct,
        title: `Evaluate growth of ${p.name}`,
        why: "Observed revenue change informs prioritisation, but does not establish causation.",
        evidence: [
          `Observed change: ${p.observedGrowthPct}%`,
          `Reported monthly USD: ${p.revenue}`,
        ],
      });
  }
  result.push({
    domain: "forecast",
    title: "Review the revenue baseline",
    why: "Use recorded revenue until sufficient history supports a predictive model.",
    evidence: [`Flat next-month baseline: USD ${u.summary.reportedMonthlyUsd}`],
    sources: ["/api/intelligence/forecasts"],
    confidence: "Descriptive scenario only",
    tradeoffs: "A flat baseline omits seasonality and future growth.",
    entityId: null,
  });
  return result;
}
export function answer(
  question: string,
  u: Universe,
  reasoning: Reasoning[],
  changes: number,
  memory: { kind: string; content: string }[],
) {
  const q = question.toLowerCase();
  if (/yesterday|changed/.test(q))
    return `${changes} identity history event(s) recorded in the last 24 hours. History begins at migration; these include recorded updates, not an inferred daily comparison.`;
  if (/remember|discussion|approval|past|decision/.test(q)) {
    const relevant = memory.filter((m) =>
      /approval/.test(q)
        ? m.kind === "approval"
        : /forecast/.test(q)
          ? m.content.includes("Create Forecast")
          : /discussion/.test(q)
            ? m.kind === "discussion"
            : true,
    );
    const selectedMemory = relevant.length ? relevant : memory;
    return selectedMemory.length
      ? `Recent retained context:\n${selectedMemory
          .slice(0, 8)
          .map((m) => `${m.kind}: ${m.content.slice(0, 1200)}`)
          .join("\n")}`
      : "No retained personal context yet. Existing approval and product history remain available in the Universe.";
  }
  const domain = /publish|opportunity/.test(q)
    ? "portfolio"
    : /growth/.test(q)
      ? "growth"
      : /forecast/.test(q)
        ? "forecast"
        : /resource|capacity/.test(q)
          ? "resource"
          : "risk";
  const selected = reasoning
    .filter((r) => r.domain === domain)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 5);
  return (
    `${u.summary.products} products · ${u.summary.ecosystemHealth} · USD ${u.summary.reportedMonthlyUsd} reported monthly revenue.\n` +
    (selected.length
      ? selected.map((r) => `${r.title}: ${r.why}`).join("\n")
      : `No ${domain} signal is supported by the available evidence. Review dependencies, capacity and missing telemetry before deciding.`)
  );
}
