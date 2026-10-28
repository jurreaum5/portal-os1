/** USS describes shared reality. Execution primitives remain in MAX-CORE. */
export const registries = [
  "identity",
  "charter",
  "law",
  "standard",
  "protocol",
  "research",
  "framework",
  "publication",
  "course",
  "certification",
  "policy",
  "simulation",
  "council",
  "membership",
  "programme",
  "emergence",
] as const;
export type Registry = (typeof registries)[number];
export const divisions = [
  "substrate",
  "protocol",
  "identity-physics",
  "quantum-manifold",
] as const;
export const councils = [
  "Governor",
  "Executive Council",
  "Research Council",
  "Standards Council",
  "Governance Council",
] as const;
export const charterSections = [
  "purpose",
  "vision",
  "mission",
  "identityPrinciples",
  "governancePrinciples",
  "researchPrinciples",
  "simulationPrinciples",
  "aiPrinciples",
  "publicationPrinciples",
] as const;
export const lawLayers = [
  "constitutional",
  "governance",
  "identity",
  "research",
  "protocol",
  "simulation",
  "ai",
  "marketplace",
] as const;
export interface Reference {
  id: string;
  version: number;
  relation:
    | "derived_from"
    | "depends_on"
    | "member_of"
    | "owned_by"
    | "governed_by"
    | "influences"
    | "simulates";
}
export interface Uncertainty {
  confidence: number | null;
  probability: number | null;
  risk: string;
  assumptions: string[];
  range: { lower: number; upper: number; unit: string } | null;
}
export interface Revision {
  id: string;
  version: number;
  registry: Registry;
  title: string;
  owner: string;
  division: string;
  lifecycle: string;
  content: Record<string, unknown>;
  references: Reference[];
  uncertainty: Uncertainty;
  author: string;
  createdAt: string;
  hash: string;
  previousHash: string | null;
}
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
}
export function text(value: unknown, max = 200): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}
export function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function uncertainty(value: unknown): value is Uncertainty {
  if (!object(value)) return false;
  const probability = (v: unknown) =>
    v === null ||
    (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1);
  return (
    probability(value.confidence) &&
    probability(value.probability) &&
    text(value.risk, 2000) &&
    Array.isArray(value.assumptions) &&
    value.assumptions.length <= 50 &&
    value.assumptions.every((v) => text(v, 1000)) &&
    (value.range === null ||
      (object(value.range) &&
        typeof value.range.lower === "number" &&
        Number.isFinite(value.range.lower) &&
        typeof value.range.upper === "number" &&
        Number.isFinite(value.range.upper) &&
        value.range.lower <= value.range.upper &&
        text(value.range.unit)))
  );
}
