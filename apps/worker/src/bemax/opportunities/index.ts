export interface OpportunitySignal {
  id: string;
  name: string;
  stage: string;
  score: number;
  revenue: number;
  summary: string;
}

export class OpportunityService {
  constructor(private readonly env: any) {}

  async getOpportunities(): Promise<OpportunitySignal[]> {
    const { readUniverse } = await import("../../universe-api");
    const universe = await readUniverse(this.env);

    return universe.products
      .filter((product: any) => product.promotionCandidate || product.score >= 80)
      .map((product: any) => ({
        id: product.id,
        name: product.name,
        stage: product.stage,
        score: product.score ?? 0,
        revenue: product.revenue ?? 0,
        summary: `${product.name} is a strong promotion candidate with score ${product.score}.`,
      }))
      .slice(0, 8);
  }
}
