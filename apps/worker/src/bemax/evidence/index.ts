export interface EvidenceItem {
  entityId: string;
  source: string;
  metric: string;
  value: number | string;
  observedAt: string;
}

export class EvidenceService {
  collect(entityId: string, source: string, metric: string, value: number | string): EvidenceItem {
    return {
      entityId,
      source,
      metric,
      value,
      observedAt: new Date().toISOString(),
    };
  }
}
