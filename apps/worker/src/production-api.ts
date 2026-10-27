import type { Env } from "./types";
import { modelHealth } from "./model-router";
import { sportsConfig, sportsOverview, sportsHealth } from "./sports";
import { connectionStatus } from "../../../portal-os/production";
import { readUniverse } from "./universe-api";
import { listRows, identity } from "./universe-store";
export async function productionRead(
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (url.pathname === "/api/operations/status") {
    const providers = await modelHealth(env),
      config = sportsConfig(env);
    const feed = await sportsHealth(env);
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
    const universe = await readUniverse(env);
    const governance = await listRows<{ status: string; count: number }>(
      env,
      "SELECT status,COUNT(*) AS count FROM autonomy_proposals GROUP BY status",
    );
    const lifecycle = await listRows(
      env,
      "SELECT status,COUNT(*) AS count FROM approvals GROUP BY status",
    );
    const compensation = await listRows(
      env,
      "SELECT status,COUNT(*) AS count FROM compensation_jobs GROUP BY status",
    );
    const simulations = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM simulation_registry) AS registered,(SELECT COUNT(*) FROM simulation_runs) AS runs,(SELECT COUNT(*) FROM simulation_replays) AS replays,(SELECT COUNT(*) FROM simulation_replays WHERE matched=0) AS mismatches",
    ).first<{
      registered: number;
      runs: number;
      replays: number;
      mismatches: number;
    }>();
    const auditGaps =
      (await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM autonomy_proposals p WHERE p.status='applied' AND (NOT EXISTS(SELECT 1 FROM autonomy_effects e WHERE e.proposal_id=p.id) OR NOT EXISTS(SELECT 1 FROM universe_events e WHERE e.id='effect:'||p.id))",
      ).first<number>("count")) ?? 0;
    const root = await identity(env, "ecosystem:max");
    const recoveryRecords = root
      ? (JSON.parse(root.state).recoveryRecords ?? {})
      : {};
    const recoveryState = (kind: string) => {
      const record = recoveryRecords[kind];
      return {
        status: record
          ? connectionStatus(
              true,
              true,
              record.outcome === "passed" ? "observed" : "blocked",
              record.observedAt,
            )
          : "UNAVAILABLE",
        reason:
          record?.summary ?? "No Governor-approved recovery evidence recorded",
        evidence: record ?? null,
        verification:
          "Governor-approved evidence; not an automated restoration test",
      };
    };
    const monitors = [
      {
        id: "governance",
        status: auditGaps
          ? "BLOCKED"
          : governance.some((g) => g.status === "conflict" && g.count > 0)
            ? "DEGRADED"
            : "CONNECTED",
        action: `${auditGaps} missing effect/audit records; inspect conflicts and pending approvals.`,
      },
      {
        id: "simulations",
        status: simulations?.mismatches
          ? "BLOCKED"
          : simulations?.replays
            ? "CONNECTED"
            : "UNAVAILABLE",
        action:
          "Inspect retained replay evidence before relying on reproducibility.",
      },
      {
        id: "risk",
        status: universe.summary.riskProducts ? "DEGRADED" : "CONNECTED",
        action: `${universe.summary.riskProducts} products have recorded risk flags.`,
      },
    ];
    return Response.json({
      monitoring: {
        governance: {
          proposals: governance,
          lifecycle,
          compensation,
          auditGaps,
        },
        simulations,
        risks: universe.alerts,
        monitors,
        sources: ["/api/autonomy", "/api/substrate", "/api/intelligence"],
      },
      observedAt: new Date().toISOString(),
      integrations,
      alerts: [...integrations, ...monitors]
        .filter((i) => i.status !== "CONNECTED")
        .map((i) => ({
          ...i,
          action:
            "action" in i
              ? i.action
              : "Review configuration, credentials and latest observed outcome before relying on this integration.",
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
      recovery: recoveryState("restore"),
      backup: recoveryState("backup"),
      method:
        "CONNECTED requires a successful observed request within 24 hours. Configuration alone does not establish availability.",
    });
  }
  if (url.pathname === "/api/operations/recovery")
    return Response.json({
      records: await listRows(
        env,
        "SELECT e.* FROM universe_events e JOIN autonomy_proposals p ON e.id='effect:'||p.id WHERE p.action IN ('recovery-record','rollback') ORDER BY e.sequence DESC LIMIT 200",
      ),
      propose: "/api/autonomy/proposals",
      action: "recovery-record",
      decisions: "/api/autonomy",
      method:
        "Recorded through existing proposal, approval, policy, audit and compensation controls",
    });
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
    const type =
      url.searchParams.get("type") ??
      (url.pathname.endsWith("lab") ? "athlete" : "league");
    const categories: Record<string, string[] | null> = {
      team: ["team"],
      league: null,
      forecast: ["forecast"],
      prospect: ["draft", "scouting", "athlete"],
      business: ["business", "market"],
      injury: ["injury"],
      athlete: ["athlete", "injury", "scouting", "historical"],
      simulation: ["simulation"],
      market: ["market"],
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
          : records.some((r) => r.stale)
            ? "DEGRADED"
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
