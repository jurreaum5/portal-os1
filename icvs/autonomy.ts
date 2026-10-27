export const operationalActions = [
  "resource-allocation",
  "capacity-change",
  "strategic-review",
  "recovery-record",
  "work-assignment",
  "publishing-schedule",
  "risk-escalation",
  "research-output",
  "rollback",
] as const;
export type OperationalAction = (typeof operationalActions)[number];
const str = (v: unknown, max = 200): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
/** Lifecycle promotion/archive remain owned by existing factory approval policy. */
export function operationalState(
  action: string,
  kind: string,
  current: Record<string, unknown>,
  input: Record<string, unknown>,
): Record<string, unknown> {
  switch (action) {
    case "recovery-record": {
      if (
        !["backup", "restore"].includes(String(input.kind)) ||
        !["passed", "failed"].includes(String(input.outcome)) ||
        !str(input.source, 1000) ||
        !str(input.observedAt) ||
        !Number.isFinite(Date.parse(input.observedAt)) ||
        Date.parse(input.observedAt) > Date.now() ||
        !str(input.summary, 2000)
      )
        throw new Error(
          "Recovery records require kind, outcome, source, observed time and summary",
        );
      const source = new URL(String(input.source));
      if (source.protocol !== "https:" || source.username || source.password)
        throw new Error("Recovery evidence requires credential-free HTTPS");
      const existing =
        current.recoveryRecords && typeof current.recoveryRecords === "object"
          ? current.recoveryRecords
          : {};
      return {
        ...current,
        recoveryRecords: {
          ...existing,
          [String(input.kind)]: {
            outcome: input.outcome,
            source: input.source,
            observedAt: new Date(String(input.observedAt)).toISOString(),
            summary: input.summary,
          },
        },
      };
    }
    case "strategic-review":
      if (
        !str(input.summary, 2000) ||
        !str(input.reviewedAt) ||
        !Number.isFinite(Date.parse(input.reviewedAt)) ||
        Date.parse(input.reviewedAt) > Date.now()
      )
        throw new Error(
          "A review summary and observed review time are required",
        );
      return {
        ...current,
        strategicReview: {
          summary: input.summary,
          reviewedAt: new Date(input.reviewedAt).toISOString(),
        },
      };
    case "capacity-change":
    case "resource-allocation":
      if (
        !["department", "resource-pool"].includes(kind) ||
        !Number.isInteger(input.capacity) ||
        Number(input.capacity) < 0 ||
        Number(input.capacity) > 10000
      )
        throw new Error(
          "A department or resource pool and capacity of 0–10000 are required",
        );
      return { ...current, capacity: input.capacity };
    case "work-assignment":
      if (!str(input.departmentId) || !str(input.workId))
        throw new Error("A department identity and work identity are required");
      return {
        ...current,
        assignment: { departmentId: input.departmentId, workId: input.workId },
      };
    case "publishing-schedule":
      if (
        kind !== "product" ||
        !str(input.notBefore) ||
        !Number.isFinite(Date.parse(input.notBefore)) ||
        Date.parse(input.notBefore) <= Date.now()
      )
        throw new Error("A product and future publication time are required");
      return {
        ...current,
        publishingNotBefore: new Date(input.notBefore).toISOString(),
      };
    case "risk-escalation":
      if (
        !str(input.reason, 2000) ||
        !["low", "medium", "high", "critical"].includes(String(input.severity))
      )
        throw new Error("Risk reason and severity are required");
      return {
        ...current,
        risk: { reason: input.reason, severity: input.severity },
      };
    case "research-output":
      if (
        kind !== "research-output" ||
        !["draft", "reviewed", "released", "withdrawn"].includes(
          String(input.status),
        )
      )
        throw new Error("A research output and valid status are required");
      if (input.status === "released" && current.status !== "reviewed")
        throw new Error("Research must be reviewed before release");
      return { ...current, status: input.status };
    default:
      throw new Error(
        "Unsupported operational action; promotion and archive use existing factory approvals",
      );
  }
}

export interface AutonomyRule {
  id: string;
  entityId: string;
  action: string;
  input: Record<string, unknown>;
  condition: {
    metric: string;
    operator: "gte" | "lte" | "eq";
    value: number | string;
  };
}
export function configuredRules(raw?: string): AutonomyRule[] {
  if (!raw) return [];
  const rules = JSON.parse(raw) as AutonomyRule[];
  if (!Array.isArray(rules) || rules.length > 50)
    throw new Error("At most 50 autonomy rules are permitted");
  const ids = new Set<string>();
  for (const r of rules) {
    if (
      !r ||
      !str(r.id, 100) ||
      ids.has(r.id) ||
      !str(r.entityId) ||
      !operationalActions.includes(r.action as OperationalAction) ||
      r.action === "rollback" ||
      !r.input ||
      typeof r.input !== "object" ||
      Array.isArray(r.input) ||
      !r.condition ||
      !str(r.condition.metric, 80) ||
      !["gte", "lte", "eq"].includes(r.condition.operator) ||
      !["string", "number"].includes(typeof r.condition.value) ||
      (typeof r.condition.value === "number" &&
        !Number.isFinite(r.condition.value))
    )
      throw new Error("Invalid autonomy rule");
    ids.add(r.id);
  }
  return rules;
}
export function matchesRule(
  rule: AutonomyRule,
  observed: Record<string, unknown>,
): boolean {
  const value = observed[rule.condition.metric],
    expected = rule.condition.value;
  if (rule.condition.operator === "eq") return value === expected;
  if (typeof value !== "number" || typeof expected !== "number") return false;
  return rule.condition.operator === "gte"
    ? value >= expected
    : value <= expected;
}
