export interface RiskSignal {
  id: string;
  name: string;
  stage: string;
  status: string;
  risk: number;
  score: number;
  summary: string;
}

export class RiskService {
  constructor(private readonly env: any) {}

  async getRisks(): Promise<RiskSignal[]> {
    const { readUniverse } = await import("../../universe-api");
    const universe = await readUniverse(this.env);

    return universe.products
      .filter((product: any) => product.risk > 0 || /attention|paused|blocked/i.test(product.status ?? ""))
      .map((product: any) => ({
        id: product.id,
        name: product.name,
        stage: product.stage,
        status: product.status,
        risk: product.risk ?? 0,
        score: product.score ?? 0,
        summary: `${product.name} is showing elevated execution risk in stage ${product.stage}.`,
      }))
      .slice(0, 8);
  }
}
