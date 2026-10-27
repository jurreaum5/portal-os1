import {
  analyseSports,
  type SportsObservation,
} from "../../../portal-os/sports";
import type { Env } from "./types";
import { readObject } from "./customer-auth";
import { registerIdentity, eventStatement, listRows } from "./universe-store";
export const sportsCapabilities = [
  "league",
  "historical",
  "forecast",
  "athlete",
  "team",
  "injury",
  "draft",
  "scouting",
  "simulation",
  "market",
  "business",
  "media",
];
export function sportsConfig(env: Env): {
  leagues: string[];
  provider: string;
} {
  if (!env.SPORTS_CONFIG) return { leagues: [], provider: "" };
  const c = JSON.parse(env.SPORTS_CONFIG);
  if (
    !c ||
    typeof c.provider !== "string" ||
    !/^[a-z0-9_-]{1,60}$/.test(c.provider) ||
    !Array.isArray(c.leagues) ||
    c.leagues.length > 40 ||
    !c.leagues.every(
      (s: unknown) => typeof s === "string" && /^[a-zA-Z0-9_-]{1,50}$/.test(s),
    )
  )
    throw new Error("Invalid sports configuration");
  return c;
}
async function ingestSports(env: Env) {
  const config = sportsConfig(env);
  if (!env.SPORTS_FEED || !config.provider || !config.leagues.length)
    return {
      blocked: true,
      reason: "Sports feed binding and configured leagues are required",
    };
  const response = await env.SPORTS_FEED.fetch(
    "https://sports.internal/observations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagues: config.leagues,
        capabilities: sportsCapabilities,
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error("Sports feed is unavailable");
  const data = await readObject(
    new Request("https://sports.internal", {
      method: "POST",
      body: response.body,
    }),
  );
  if (
    data.provider !== config.provider ||
    data.production !== true ||
    !Array.isArray(data.records) ||
    data.records.length > 50
  )
    throw new Error("Expected bounded production feed observations");
  const records = data.records.map((r: Record<string, unknown>) => {
    if (
      !r ||
      typeof r.externalId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(r.externalId) ||
      typeof r.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id) ||
      !config.leagues.includes(String(r.league)) ||
      !sportsCapabilities.includes(String(r.category)) ||
      ![
        "athlete",
        "team",
        "league",
        "event",
        "market",
        "business",
        "media",
      ].includes(String(r.entityKind)) ||
      typeof r.label !== "string" ||
      !r.label.trim() ||
      r.label.length > 200 ||
      typeof r.source !== "string" ||
      r.source.length > 1000 ||
      typeof r.observedAt !== "string" ||
      !Number.isFinite(Date.parse(r.observedAt)) ||
      Date.parse(r.observedAt) > Date.now() + 60000 ||
      (r.category !== "historical" &&
        Date.parse(r.observedAt) < Date.now() - 7 * 86400000) ||
      Date.parse(r.observedAt) < Date.UTC(1900, 0, 1) ||
      !r.metrics ||
      typeof r.metrics !== "object" ||
      Array.isArray(r.metrics) ||
      Object.keys(r.metrics).length > 40 ||
      !Object.values(r.metrics).every(
        (v) => typeof v === "number" && Number.isFinite(v),
      )
    )
      throw new Error("Invalid Sports provenance, category or measurements");
    const url = new URL(r.source);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Invalid feed source");
    return {
      id: `${config.provider}:${r.id}`,
      entityId: `sports:${config.provider}:${r.externalId}`,
      label: r.label,
      league: String(r.league),
      category: String(r.category),
      entityKind: String(r.entityKind),
      source: r.source,
      observedAt: new Date(r.observedAt).toISOString(),
      metrics: r.metrics,
      externalId: r.externalId,
    };
  });
  for (const r of records) {
    await registerIdentity(
      env,
      {
        id: r.entityId,
        kind: `sports-${r.entityKind}`,
        label: r.label,
        invariants: { origin: config.provider, key: r.externalId },
      },
      "sports-adapter",
      r.source,
    );
    const existing = await env.DB.prepare(
      "SELECT data FROM sports_observations WHERE id=?",
    )
      .bind(r.id)
      .first<string>("data");
    if (existing && existing !== JSON.stringify(r))
      throw new Error("Sports observation identity reused with different data");
    if (existing) continue;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO sports_observations(id,entity_id,provider,league,category,source,observed_at,data) VALUES (?,?,?,?,?,?,?,?)",
      ).bind(
        r.id,
        r.entityId,
        config.provider,
        r.league,
        r.category,
        r.source,
        r.observedAt,
        JSON.stringify(r),
      ),
      eventStatement(
        env,
        r.entityId,
        "sports.observed",
        "sports-adapter",
        r.source,
        r,
        `sports:${r.id}`,
        r.observedAt,
      ),
      env.DB.prepare(
        "INSERT OR IGNORE INTO identity_relationships(id,source_id,target_id,relation,evidence) VALUES (?, 'ecosystem:max',?,'observes',?)",
      ).bind(
        `sports:${r.entityId}`,
        r.entityId,
        JSON.stringify({ source: r.source }),
      ),
    ]);
  }
  return { received: records.length };
}
export async function refreshSports(env: Env) {
  try {
    const result = await ingestSports(env);
    await env.DB.prepare(
      "INSERT INTO integration_health(id,status,message) VALUES ('sports-feed',?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,message=excluded.message,observed_at=CURRENT_TIMESTAMP",
    )
      .bind(
        "blocked" in result ? "blocked" : "observed",
        "blocked" in result
          ? result.reason
          : "Validated production observations received",
      )
      .run();
    return result;
  } catch (error) {
    await env.DB.prepare(
      "INSERT INTO integration_health(id,status,message) VALUES ('sports-feed','failed','Feed unavailable or observations failed validation') ON CONFLICT(id) DO UPDATE SET status=excluded.status,message=excluded.message,observed_at=CURRENT_TIMESTAMP",
    ).run();
    throw error;
  }
}
export async function sportsOverview(env: Env) {
  const config = sportsConfig(env);
  const records = await listRows<{ data: string; previousData: string | null }>(
    env,
    `SELECT o.data,(SELECT p.data FROM sports_observations p WHERE p.entity_id=o.entity_id AND p.category=o.category AND (p.observed_at<o.observed_at OR (p.observed_at=o.observed_at AND p.id<o.id)) ORDER BY p.observed_at DESC,p.id DESC LIMIT 1) AS previousData
    FROM sports_observations o WHERE o.id=(SELECT n.id FROM sports_observations n WHERE n.entity_id=o.entity_id AND n.category=o.category ORDER BY n.observed_at DESC,n.id DESC LIMIT 1) ORDER BY observed_at DESC LIMIT 200`,
  );
  const intelligence = analyseSports(
    records.map((r) => ({
      current: JSON.parse(r.data) as SportsObservation,
      previous: r.previousData
        ? (JSON.parse(r.previousData) as SportsObservation)
        : null,
    })),
  );
  return {
    health: await env.DB.prepare(
      "SELECT status,message,observed_at AS observedAt FROM integration_health WHERE id='sports-feed'",
    ).first(),
    leagues: config.leagues,
    capabilities: sportsCapabilities,
    configured: !!env.SPORTS_FEED && !!config.provider,
    ...intelligence,
    source:
      "Provider observations only. Older than 24 hours is stale; missing data remains unknown. Simulation uses /api/substrate/scenarios.",
  };
}
