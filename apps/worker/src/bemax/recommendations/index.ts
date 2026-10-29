export interface RecommendationSignal {
  id: string;
  category: "risk" | "opportunity" | "investment" | "decision";
  title: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  score: number;
}

export class RecommendationService {
  constructor(private readonly env: any) {}

  async getRecommendations(): Promise<RecommendationSignal[]> {
    const { readUniverse } = await import("../../universe-api");
    const universe = await readUniverse(this.env);
    const products = universe.products ?? [];

    const sortedByRisk = [...products].sort((a: any, b: any) => (b.risk ?? 0) - (a.risk ?? 0));
    const sortedByScore = [...products].sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));

    const recommendations: RecommendationSignal[] = [];

    if (sortedByRisk[0]) {
      recommendations.push({
        id: `risk-${sortedByRisk[0].id}`,
        category: "risk",
        title: `Prioritize ${sortedByRisk[0].name}`,
        summary: `Elevated execution risk requires governance review and dependency checks before the next approval window.`,
        confidence: "medium",
        score: sortedByRisk[0].risk ?? 0,
      });
    }

    if (sortedByScore[0]) {
      recommendations.push({
        id: `opp-${sortedByScore[0].id}`,
        category: "opportunity",
        title: `Advance ${sortedByScore[0].name}`,
        summary: `Strong evidence and portfolio positioning indicate this product can move faster through the next stage gate.`,
        confidence: "high",
        score: sortedByScore[0].score ?? 0,
      });
    }

    if (universe.divisions?.length) {
      const dominantDivision = [...universe.divisions].sort((a: any, b: any) => (b.revenue ?? 0) - (a.revenue ?? 0))[0];
      if (dominantDivision) {
        recommendations.push({
          id: `division-${dominantDivision.id}`,
          category: "investment",
          title: `Reinforce ${dominantDivision.name}`,
          summary: `This division is carrying the largest revenue contribution; align capacity and support decisions here first.`,
          confidence: "medium",
          score: dominantDivision.revenue ?? 0,
        });
      }
    }

    return recommendations.slice(0, 6);
  }
}
