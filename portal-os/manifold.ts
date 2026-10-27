export const universeStages = [
  "Idea",
  "Discovery",
  "Research",
  "Specification",
  "Architecture",
  "Simulation",
  "Build",
  "QA",
  "Package",
  "Ready",
  "Published",
];
export const sportsDivisions = [
  "MAX NFL",
  "MAX NBA",
  "MAX MLB",
  "MAX NHL",
  "MAX Soccer",
  "MAX F1",
  "MAX Combat",
  "MAX Esports",
];
export const sportsModules = [
  "Athlete Intelligence",
  "Injury Intelligence",
  "Team Intelligence",
  "Draft Intelligence",
  "Scouting",
  "Sports Simulation",
  "Sports Media",
  "Sports Business",
  "Market Intelligence",
];
export function entityHref(id: string) {
  const [kind, ...parts] = id.split(":");
  const source = encodeURIComponent(parts.join(":"));
  if (kind === "product") return `/portal/products/${source}/twin`;
  if (kind === "division") return `/portal/divisions/${source}`;
  if (kind === "department") return "/portal/universe/departments";
  if (kind === "approval") return "/portal/approvals";
  if (kind === "marketplace") return "/portal/marketplace";
  if (kind === "project" || kind === "pipeline")
    return "/portal/universe/pipeline";
  if (kind === "sports" || kind === "sports-observation")
    return "/portal/universe/sports";
  return `/portal/twin?root=${encodeURIComponent(id)}`;
}
