/** Descriptive intelligence over sourced measurements. Never infers diagnoses or draft quality. */
export interface SportsObservation {
  id: string;
  entityId: string;
  label: string;
  league: string;
  category: string;
  source: string;
  observedAt: string;
  metrics: Record<string, number>;
}
export function analyseSports(
  observations: {
    current: SportsObservation;
    previous: SportsObservation | null;
  }[],
  now = Date.now(),
) {
  const entities = observations.map(({ current, previous }) => {
    const changes = Object.fromEntries(
      Object.entries(current.metrics).map(([metric, value]) => [
        metric,
        previous && Object.hasOwn(previous.metrics, metric)
          ? value - previous.metrics[metric]
          : null,
      ]),
    );
    return {
      ...current,
      freshnessState:
        Date.parse(current.observedAt) < now - 86400000 ? "STALE" : "CONNECTED",
      evidenceLinks: [current.source],
      confidence:
        "Attributed provider observation; accuracy has not been independently verified",
      previousObservedAt: previous?.observedAt ?? null,
      changes,
      stale: Date.parse(current.observedAt) < now - 86400000,
    };
  });
  return {
    records: entities,
    coverage: [...new Set(entities.map((e) => e.league))].map((league) => ({
      league,
      categories: [
        ...new Set(
          entities.filter((e) => e.league === league).map((e) => e.category),
        ),
      ],
      stale: entities.filter((e) => e.league === league && e.stale).length,
    })),
    recommendations: entities
      .filter(
        (e) =>
          e.stale ||
          Object.values(e.changes).some((v) => v !== null && v !== 0),
      )
      .map((e) => ({
        entityId: e.entityId,
        action: e.stale
          ? `Refresh ${e.label} ${e.category} observations before operational decisions.`
          : `Review changed ${e.label} ${e.category} measurements.`,
        evidence: {
          observationId: e.id,
          observedAt: e.observedAt,
          previousObservedAt: e.previousObservedAt,
          changes: e.changes,
          stale: e.stale,
        },
        sources: [e.source],
        confidence:
          "Descriptive provider observations; no causal, clinical or performance prediction",
        tradeoffs: [
          "Waiting for verified observations delays decisions",
          "Metric changes alone do not establish their cause or future outcome",
        ],
      })),
    method:
      "Differences between the two latest measurements per entity and category. Missing baselines remain unknown; metrics with different units are not ranked together.",
  };
}
