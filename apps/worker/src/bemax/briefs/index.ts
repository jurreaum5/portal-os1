export interface BriefArtifact {
  id: string;
  title: string;
  kind: "risk" | "opportunity" | "portfolio" | "approval";
  summary: string;
  score?: number;
  confidence?: "low" | "medium" | "high";
}

export interface DailyBrief {
  type: "daily";
  generatedAt: string;
  summary: string;
  executiveStatus: string;
  highlights: BriefArtifact[];
  risks: string[];
  opportunities: string[];
  actions: string[];
}

export class BriefService {
  constructor(private readonly env: any) {}

  async getDailyBrief(): Promise<DailyBrief> {
    const { readUniverse } = await import("../universe-api");
    const universe = await readUniverse(this.env);

    const riskProducts = universe.products.filter((product: any) => product.risk > 0).slice(0, 3);
    const opportunityProducts = (universe.products.filter((product: any) => product.promotionCandidate) ?? []).slice(0, 3);

    return {
      type: "daily",
      generatedAt: new Date().toISOString(),
      summary: `Portfolio score ${universe.summary?.portfolioScore ?? 0} with ${universe.products.length} tracked products and ${universe.summary?.reportedMonthlyUsd ?? 0} USD monthly revenue in view.`,
      executiveStatus: riskProducts.length ? "Attention required on key execution risks" : "Portfolio is operating within expected tolerance",
      highlights: [
        ...riskProducts.map((product: any) => ({
          id: `risk-${product.id}`,
          title: `${product.name} risk review`,
          kind: "risk" as const,
          summary: `Current risk signal ${product.risk}. Review dependency and governance exposure before next decision.`,
          score: product.risk,
          confidence: "medium" as const,
        })),
        ...opportunityProducts.map((product: any) => ({
          id: `opp-${product.id}`,
          title: `${product.name} promotion candidate`,
          kind: "opportunity" as const,
          summary: `Strong score ${product.score}; prepare governance review and release plan.`,
          score: product.score,
          confidence: "high" as const,
        })),
      ].slice(0, 6),
      risks: riskProducts.map((product: any) => `${product.name} is trending at risk ${product.risk}.`),
      opportunities: opportunityProducts.map((product: any) => `${product.name} is ready for promotion review.`),
      actions: [
        "Review high-risk products before approval windows close.",
        "Route promotion candidates to governance with evidence pack.",
        "Keep provider health and deployment capacity visible to the operating team.",
      ],
    };
  }
}
