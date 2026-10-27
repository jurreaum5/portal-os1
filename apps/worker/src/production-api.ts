import type { Env } from "./types";
import { modelHealth } from "./model-router";
import { sportsConfig, sportsOverview } from "./sports";
import { connectionStatus } from "../../../portal-os/production";
import { listRows } from "./universe-store";
export async function productionRead(
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (url.pathname === "/api/operations/status") {
    const providers = await modelHealth(env),
      config = sportsConfig(env);
    const feed = await env.DB.prepare(
      "SELECT * FROM integration_health WHERE id='sports-feed'",
    ).first<{ status: string; observed_at: string }>();
    const serviceBindings = [
      ["factory-executor", !!env.ICVS_EXECUTOR],
      ["factory-publisher", !!env.ICVS_PUBLISHER],
      ["factory-compensator", !!env.ICVS_COMPENSATOR],
      ["customer-identity", !!env.CUSTOMER_IDENTITY],
      ["payments", !!env.PAYMENTS],
      ["downloads", !!env.DOWNLOADS],
    ] as const;
    const integrations = [
      ...serviceBindings.map(([id, configured]) => ({
        id,
        kind: "service-binding",
        status: configured ? "UNAVAILABLE" : "DISCONNECTED",
      })),
      ...(!providers.providers.length
        ? [{ id: "model-routing", kind: "models", status: "DISCONNECTED" }]
        : []),
      ...providers.providers.map((p) => ({
        id: p.id,
        status: p.status,
        kind: p.kind,
      })),
      {
        id: "sports-feed",
        kind: "sports",
        status: connectionStatus(
          !!config.provider,
          !!env.SPORTS_FEED,
          feed?.status,
          feed?.observed_at,
        ),
      },
    ];
    return Response.json({
      observedAt: new Date().toISOString(),
      integrations,
      alerts: integrations
        .filter((i) => i.status !== "CONNECTED")
        .map((i) => ({
          ...i,
          action:
            "Review configuration, credentials and latest observed outcome before relying on this integration.",
        })),
      providers,
      secrets: {
        storage: "Worker secret bindings only; values never returned",
        configured: {
          modelCredentials: !!env.MODEL_CREDENTIALS,
          staffAccess: !!env.GOVERNOR_API_TOKEN || !!env.STAFF_CREDENTIALS,
        },
      },
      auditExport: "/api/operations/audit",
      recovery: {
        status: "UNAVAILABLE",
        reason:
          "No deployment recovery drill recorded. Follow docs/10_PRODUCTION_OPERATIONS.md.",
      },
      backup: {
        status: "UNAVAILABLE",
        reason:
          "No verified deployment backup or restoration evidence configured.",
      },
      method:
        "CONNECTED requires a successful observed request within 24 hours. Configuration alone does not establish availability.",
    });
  }
  if (url.pathname === "/api/operations/audit") {
    const after = Number(url.searchParams.get("after") ?? 0);
    if (!Number.isSafeInteger(after) || after < 0)
      return Response.json(
        { error: "Invalid sequence cursor" },
        { status: 400 },
      );
    const events = await listRows<{ sequence: number }>(
      env,
      "SELECT * FROM universe_events WHERE sequence>? ORDER BY sequence LIMIT 200",
      after,
    );
    return Response.json({
      events,
      nextAfter: events.length ? events[events.length - 1].sequence : after,
      limit: 200,
      scope:
        "Identity, proposal, decision and effect events; personal memory excluded",
    });
  }
  if (
    url.pathname === "/api/sports/reports" ||
    url.pathname === "/api/sports/lab"
  ) {
    const overview = await sportsOverview(env),
      league = url.searchParams.get("league"),
      entity = url.searchParams.get("entityId");
    const type = url.searchParams.get("type") ?? "league";
    const categories: Record<string, string[] | null> = {
      team: ["team"],
      league: null,
      forecast: ["forecast"],
      prospect: ["draft", "scouting", "athlete"],
      business: ["business", "market"],
      injury: ["injury"],
      athlete: ["athlete", "injury", "scouting", "historical"],
    };
    if (!Object.hasOwn(categories, type))
      return Response.json({ error: "Unknown report type" }, { status: 400 });
    const records = overview.records.filter(
      (r) =>
        (!league || r.league === league) &&
        (!entity || r.entityId === entity) &&
        (!categories[type] || categories[type]!.includes(r.category)),
    );
    return Response.json({
      type,
      league,
      entityId: entity,
      generatedAt: new Date().toISOString(),
      status: !records.length
        ? "UNAVAILABLE"
        : records.every((r) => r.stale)
          ? "STALE"
          : "CONNECTED",
      records,
      sources: [...new Set(records.map((r) => r.source))],
      confidence:
        "Descriptive provider evidence only; forecast reports require provider forecast observations",
      tradeoffs: [
        "Freshness and completeness vary by feed; missing evidence cannot support ranking",
      ],
      coverageLimit: 200,
      method: overview.method,
    });
  }
  return null;
}
