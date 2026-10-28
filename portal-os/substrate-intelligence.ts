import type { Revision } from "../uss/contracts";
/** Evidence-based review templates; no trained-model or calibrated-risk claim. */
export function strategicReview(records: Revision[], type: string) {
  const kinds = [
    "strategic-brief",
    "executive-summary",
    "opportunity-review",
    "risk-review",
    "governed-review",
  ];
  if (!kinds.includes(type)) throw new Error("Unknown review type");
  return {
    type,
    method:
      "Evidence completeness and declared uncertainty; human review required",
    recommendations: records.map((r) => ({
      identity: r.id,
      version: r.version,
      title: r.title,
      recommendation:
        r.uncertainty.confidence === null
          ? "Obtain confidence evidence before operational use."
          : !r.references.length
            ? "Review missing dependency and origin evidence."
            : "Review the pinned evidence and approval history before use.",
      evidence: [
        {
          hash: r.hash,
          owner: r.owner,
          author: r.author,
          createdAt: r.createdAt,
          risk: r.uncertainty.risk,
        },
      ],
      sources: [
        `/api/uss/records/${r.id}?version=${r.version}`,
        ...r.references.map(
          (ref) => `/api/uss/records/${ref.id}?version=${ref.version}`,
        ),
      ],
      confidence: r.uncertainty.confidence,
      tradeoffs: [
        "Further review delays execution.",
        "Acting with incomplete evidence increases uncertainty.",
      ],
      assumptions: r.uncertainty.assumptions,
    })),
  };
}
