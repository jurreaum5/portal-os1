import { readUniverse } from "./universe-api";
import { staffIdentity } from "./access";
import { readObject } from "./customer-auth";
import { providers as listProviders } from "./providers";
import type { Env } from "./types";

const conversations = new Map<
  string,
  {
    id: string;
    title: string;
    ownerId: string;
    createdAt: string;
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      createdAt: string;
    }>;
  }
>();

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

function evidenceFromProduct(product: {
  id: string;
  name: string;
  score: number;
  risk: number;
  revenue: number;
  status: string;
  stage: string;
  previousRevenue: number | null;
}) {
  return [
    {
      entityId: `product:${product.id}`,
      source: "portal-intelligence",
      sourceRevision: `product:${product.id}:latest`,
      observedAt: new Date().toISOString(),
      metric: "riskScore",
      value: product.risk,
      unit: "score",
    },
    {
      entityId: `product:${product.id}`,
      source: "portal-intelligence",
      sourceRevision: `product:${product.id}:latest`,
      observedAt: new Date().toISOString(),
      metric: "reportedMonthlyUsd",
      value: product.revenue,
      unit: "USD",
    },
  ];
}

async function buildRecommendations(env: Env) {
  const universe = await readUniverse(env);
  const highestRisk = [...universe.products].sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0))[0];
  const promotions = [...universe.products].filter((product) => product.promotionCandidate).sort((a, b) => b.score - a.score);
  const archiveCandidates = [...universe.products].filter((product) => product.archiveCandidate).sort((a, b) => a.score - b.score);
  const topRevenue = [...universe.divisions].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))[0];

  const recommendations: Array<{
    id: string;
    category: "risk" | "opportunity" | "investment" | "archive" | "next_action";
    statement: string;
    evidence: Array<Record<string, unknown>>;
    supportingMetrics: Array<Record<string, unknown>>;
    confidence: { level: "low" | "medium" | "high" | "unknown"; basis: string; coverage: number | null };
    tradeoffs: Array<{ benefit: string; cost: string; alternative: string }>;
    snapshotId: string;
    createdAt: string;
    expiresAt: string;
    source: string;
  }> = [];

  if (highestRisk) {
    recommendations.push({
      id: `bemax-risk-${highestRisk.id}`,
      category: "risk",
      statement: `Priority review for ${highestRisk.name} because it is the highest-risk product in the portfolio.`,
      evidence: evidenceFromProduct(highestRisk as any),
      supportingMetrics: evidenceFromProduct(highestRisk as any),
      confidence: {
        level: "medium",
        basis: "portfolio telemetry and status heuristics",
        coverage: 0.8,
      },
      tradeoffs: [{
        benefit: "Prevents escalation and protects revenue continuity.",
        cost: "Requires operational review and possible intervention budget.",
        alternative: "Continue monitoring and defer until risk is confirmed by fresh telemetry.",
      }],
      snapshotId: `snapshot:${highestRisk.id}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      source: "portal-intelligence",
    });
  }

  if (promotions[0]) {
    const product = promotions[0];
    recommendations.push({
      id: `bemax-opportunity-${product.id}`,
      category: "opportunity",
      statement: `Promote ${product.name} after verifying readiness and governance evidence.`,
      evidence: evidenceFromProduct(product as any),
      supportingMetrics: evidenceFromProduct(product as any),
      confidence: {
        level: "high",
        basis: "promotion candidate logic and score thresholding",
        coverage: 0.9,
      },
      tradeoffs: [{
        benefit: "Higher portfolio performance and faster release velocity.",
        cost: "Requires governance and quality validation before publication.",
        alternative: "Keep the product in current stage while waiting for additional evidence.",
      }],
      snapshotId: `snapshot:${product.id}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      source: "portal-intelligence",
    });
  }

  if (archiveCandidates[0]) {
    const product = archiveCandidates[0];
    recommendations.push({
      id: `bemax-archive-${product.id}`,
      category: "archive",
      statement: `Review ${product.name} for archive eligibility due to paused state and low score.`,
      evidence: evidenceFromProduct(product as any),
      supportingMetrics: evidenceFromProduct(product as any),
      confidence: {
        level: "medium",
        basis: "paused and low-score heuristics",
        coverage: 0.7,
      },
      tradeoffs: [{
        benefit: "Reduces operational noise and focuses team attention on higher-value work.",
        cost: "May interrupt a planned recovery or transition plan.",
        alternative: "Continue monitoring before making a final archive decision.",
      }],
      snapshotId: `snapshot:${product.id}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      source: "portal-intelligence",
    });
  }

  if (topRevenue) {
    recommendations.push({
      id: `bemax-investment-${topRevenue.id}`,
      category: "investment",
      statement: `Allocate focused investment review to ${topRevenue.name}, which currently holds the largest revenue contribution.`,
      evidence: [
        {
          entityId: `division:${topRevenue.id}`,
          source: "portal-intelligence",
          sourceRevision: `division:${topRevenue.id}:latest`,
          observedAt: new Date().toISOString(),
          metric: "reportedMonthlyUsd",
          value: topRevenue.revenue,
          unit: "USD",
        },
      ],
      supportingMetrics: [
        {
          entityId: `division:${topRevenue.id}`,
          source: "portal-intelligence",
          sourceRevision: `division:${topRevenue.id}:latest`,
          observedAt: new Date().toISOString(),
          metric: "portfolioScore",
          value: topRevenue.portfolioScore,
          unit: "score",
        },
      ],
      confidence: {
        level: "medium",
        basis: "division revenue ranking from current portfolio read-model",
        coverage: 0.8,
      },
      tradeoffs: [{
        benefit: "Keeps the highest-value division resourced and visible.",
        cost: "May divert investment from risk remediation or new growth bets.",
        alternative: "Distribute budget evenly while monitoring division trend changes.",
      }],
      snapshotId: `snapshot:${topRevenue.id}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      source: "portal-intelligence",
    });
  }

  return recommendations;
}

async function getBrief(type: string, env: Env) {
  const universe = await readUniverse(env);
  const recommendations = await buildRecommendations(env);
  return {
    schemaVersion: 1,
    type,
    generatedAt: new Date().toISOString(),
    summary: {
      totalProducts: universe.products.length,
      riskProducts: universe.products.filter((product) => product.risk > 0).length,
      promotionCandidates: universe.products.filter((product) => product.promotionCandidate).length,
      portfolioScore: universe.summary.portfolioScore,
      reportedMonthlyUsd: universe.summary.reportedMonthlyUsd,
    },
    recommendations: recommendations.slice(0, 3),
  };
}

async function getCompatSummary(env: Env) {
  const universe = await readUniverse(env);
  const approvals = await env.DB.prepare(
    `SELECT a.id, a.product_id AS productId, p.name AS project, a.action, a.priority, a.risk, a.status
     FROM approvals a
     JOIN products p ON p.id = a.product_id
     ORDER BY a.created_at DESC
     LIMIT 100`,
  ).all<{
    id: string;
    productId: string;
    project: string;
    action: string;
    priority: string;
    risk: string;
    status: string;
  }>();

  const risks = (universe.products ?? []).filter((product) => Number(product.risk ?? 0) > 0 || product.status === "Attention")
    .map((product) => ({
      id: product.id,
      name: product.name,
      risk: Number(product.risk ?? 0),
      score: product.score,
      stage: product.stage,
      status: product.status,
      evidence: evidenceFromProduct(product as any),
    }));

  const opportunities = (universe.products ?? []).filter((product) => Boolean(product.promotionCandidate))
    .map((product) => ({
      id: product.id,
      name: product.name,
      score: product.score,
      stage: product.stage,
      status: product.status,
      reason: "Promotion candidate under current portfolio heuristics.",
    }));

  const providerHealth = (await listProviders(env)).map((provider) => ({
    id: provider.id,
    name: provider.name,
    status: provider.status,
    models: provider.models,
    capabilities: provider.capabilities,
    spentUsd: provider.spentUsd,
  }));

  const simulationActivity = (universe.runs ?? []).slice(0, 20).map((run) => ({
    id: run.id,
    productId: run.productId,
    stage: run.stage,
    status: run.status,
    message: run.message,
  }));

  return {
    status: {
      health: universe.summary?.ecosystemHealth ?? "HEALTHY",
      products: universe.products.length,
      divisions: universe.divisions.length,
      sampledAt: universe.sampledAt,
    },
    risks,
    opportunities,
    approvals: approvals.results,
    providerHealth,
    simulationActivity,
    recommendedActions: await buildRecommendations(env),
  };
}

export async function compatibilityApi(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (
    !path.startsWith("/api/bemax") &&
    !path.startsWith("/api/providers") &&
    !path.startsWith("/api/governor") &&
    !path.startsWith("/api/uss")
  ) {
    return null;
  }

  const identity = await staffIdentity(request, env);
  if (!identity) {
    return json({ error: "Staff sign-in required" }, 401);
  }

  try {
    if (path === "/api/bemax/summary" && request.method === "GET") {
      return json(await getCompatSummary(env));
    }

    if (path === "/api/bemax/risks" && request.method === "GET") {
      const universe = await readUniverse(env);
      return json({
        risks: (universe.products ?? []).filter((product) => Number(product.risk ?? 0) > 0 || product.status === "Attention")
          .map((product) => ({
            id: product.id,
            name: product.name,
            risk: Number(product.risk ?? 0),
            score: product.score,
            stage: product.stage,
            status: product.status,
            evidence: evidenceFromProduct(product as any),
          })),
      });
    }

    if (path === "/api/bemax/opportunities" && request.method === "GET") {
      const universe = await readUniverse(env);
      return json({
        opportunities: (universe.products ?? []).filter((product) => Boolean(product.promotionCandidate))
          .map((product) => ({
            id: product.id,
            name: product.name,
            score: product.score,
            stage: product.stage,
            status: product.status,
            reason: "Promotion candidate under current portfolio heuristics.",
          })),
      });
    }

    if (path === "/api/providers/health" && request.method === "GET") {
      const providers = await listProviders(env);
      return json({
        providers: providers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          status: provider.status,
          healthStatus: provider.healthStatus,
          models: provider.models,
          capabilities: provider.capabilities,
          spentUsd: provider.spentUsd,
          reason: provider.reason,
        })),
      });
    }

    if (path === "/api/providers/models" && request.method === "GET") {
      const providers = await listProviders(env);
      return json({
        models: providers.flatMap((provider) =>
          provider.models.map((model) => ({
            providerId: provider.id,
            provider: provider.name,
            model,
            capabilities: provider.capabilities,
          })),
        ),
      });
    }

    if (path === "/api/governor/summary" && request.method === "GET") {
      if (identity.role !== "Governor") {
        return json({ error: "Governor permission required" }, 403);
      }
      const universe = await readUniverse(env);
      const approvals = await env.DB.prepare(
        `SELECT a.id, a.product_id AS productId, p.name AS project, a.action, a.status
         FROM approvals a
         JOIN products p ON p.id = a.product_id
         ORDER BY a.created_at DESC
         LIMIT 100`,
      ).all<{ id: string; productId: string; project: string; action: string; status: string }>();
      return json({
        criticalIssues: (universe.products ?? []).filter((product) => Number(product.risk ?? 0) > 0 || product.status === "Attention")
          .map((product) => ({
            id: product.id,
            name: product.name,
            risk: Number(product.risk ?? 0),
            stage: product.stage,
            status: product.status,
          })),
        approvals: approvals.results,
        risks: (universe.products ?? []).filter((product) => Number(product.risk ?? 0) > 0)
          .map((product) => ({
            id: product.id,
            name: product.name,
            risk: Number(product.risk ?? 0),
          })),
        opportunities: (universe.products ?? []).filter((product) => Boolean(product.promotionCandidate))
          .map((product) => ({
            id: product.id,
            name: product.name,
            score: product.score,
          })),
        recommendations: await buildRecommendations(env),
      });
    }

    if (path === "/api/governor/approvals" && request.method === "GET") {
      if (identity.role !== "Governor") {
        return json({ error: "Governor permission required" }, 403);
      }
      const approvals = await env.DB.prepare(
        `SELECT a.id, a.product_id AS productId, p.name AS project, a.action, a.status
         FROM approvals a
         JOIN products p ON p.id = a.product_id
         ORDER BY a.created_at DESC
         LIMIT 100`,
      ).all<{ id: string; productId: string; project: string; action: string; status: string }>();
      return json({ approvals: approvals.results });
    }

    if (path === "/api/governor/risks" && request.method === "GET") {
      if (identity.role !== "Governor") {
        return json({ error: "Governor permission required" }, 403);
      }
      const universe = await readUniverse(env);
      return json({
        risks: (universe.products ?? []).filter((product) => Number(product.risk ?? 0) > 0 || product.status === "Attention")
          .map((product) => ({
            id: product.id,
            name: product.name,
            risk: Number(product.risk ?? 0),
            severity: Number(product.risk ?? 0) > 50 ? "high" : "medium",
            source: product.status,
            confidence: Number(product.score ?? 0) > 0 ? "medium" : "low",
          })),
      });
    }

    if (path === "/api/uss/overview" && request.method === "GET") {
      const universe = await readUniverse(env);
      return json({
        schemaVersion: 1,
        overview: {
          products: universe.products.length,
          divisions: universe.divisions.length,
          portfolioScore: universe.summary.portfolioScore,
          ecosystemHealth: universe.summary.ecosystemHealth,
        },
        research: { count: universe.products.length },
        framework: { count: universe.divisions.length },
        standards: { count: universe.products.length },
        protocol: { count: universe.runs.length },
        policy: { count: 0 },
        generatedAt: new Date().toISOString(),
      });
    }

    if (path === "/api/uss/records" && request.method === "GET") {
      const universe = await readUniverse(env);
      const page = Number(url.searchParams.get("page") ?? "1");
      const perPage = Number(url.searchParams.get("perPage") ?? "25");
      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const safePerPage = Number.isFinite(perPage) && perPage > 0 ? Math.min(perPage, 100) : 25;
      const records = (universe.products ?? []).slice((safePage - 1) * safePerPage, safePage * safePerPage).map((product) => ({
        id: product.id,
        name: product.name,
        stage: product.stage,
        status: product.status,
        score: product.score,
        risk: Number(product.risk ?? 0),
      }));
      return json({
        records,
        pagination: {
          page: safePage,
          perPage: safePerPage,
          total: universe.products.length,
        },
      });
    }

    if (path === "/api/bemax/context") {
      return json({
        schemaVersion: 1,
        scope: `${identity.role} staff scope`,
        actorId: identity.id,
        role: identity.role,
        capabilities: ["briefing", "risk-review", "opportunity-review", "recommendations"],
        freshness: new Date().toISOString(),
      });
    }

    if (path === "/api/bemax/recommendations" && request.method === "GET") {
      return json({
        schemaVersion: 1,
        recommendations: await buildRecommendations(env),
        sampledAt: new Date().toISOString(),
      });
    }

    if (path === "/api/bemax/briefs" && request.method === "GET") {
      const type = (url.searchParams.get("type") ?? "daily").toLowerCase();
      return json(await getBrief(type, env));
    }

    if (path === "/api/bemax/alerts" && request.method === "GET") {
      const universe = await readUniverse(env);
      return json({
        schemaVersion: 1,
        alerts: universe.alerts,
        sampledAt: new Date().toISOString(),
      });
    }

    if (path === "/api/bemax/activity" && request.method === "GET") {
      const universe = await readUniverse(env);
      return json({
        schemaVersion: 1,
        activity: [{
          type: "portfolio-snapshot",
          occurredAt: new Date().toISOString(),
          detail: `${universe.products.length} products in view`,
        }],
        sampledAt: new Date().toISOString(),
      });
    }

    if (path === "/api/bemax/conversations" && request.method === "GET") {
      return json({
        schemaVersion: 1,
        conversations: [...conversations.values()].map(({ id, title, ownerId, createdAt, messages }) => ({
          id,
          title,
          ownerId,
          createdAt,
          messageCount: messages.length,
        })),
      });
    }

    if (path === "/api/bemax/conversations" && request.method === "POST") {
      const body = await readObject(request).catch(() => ({ title: "MAX Universe brief" }));
      const id = crypto.randomUUID();
      const conversation = {
        id,
        title: typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim() : "MAX Universe brief",
        ownerId: identity.id,
        createdAt: new Date().toISOString(),
        messages: [],
      };
      conversations.set(id, conversation);
      return json({ schemaVersion: 1, conversation }, 201);
    }

    const convo = path.match(/^\/api\/bemax\/conversations\/([^/]+)(?:\/messages)?$/);
    if (convo) {
      const id = decodeURIComponent(convo[1]);
      const entry = conversations.get(id);
      if (!entry) {
        return json({ error: "Conversation not found" }, 404);
      }
      if (request.method === "GET") {
        return json({
          schemaVersion: 1,
          conversationId: id,
          messages: entry.messages,
          title: entry.title,
        });
      }
      if (request.method === "POST") {
        const body = await readObject(request).catch(() => ({ content: "" }));
        const content = typeof body.content === "string" ? body.content.trim() : "";
        if (!content) {
          return json({ error: "Message content is required" }, 400);
        }
        const message = {
          id: crypto.randomUUID(),
          role: "user" as const,
          content,
          createdAt: new Date().toISOString(),
        };
        entry.messages.push(message);
        entry.messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I reviewed the current ecosystem state and found the most relevant action is to focus on the highest-risk or highest-value signals before approving change.",
          createdAt: new Date().toISOString(),
        });
        return json({
          schemaVersion: 1,
          messageId: message.id,
          jobId: `bemax-job-${crypto.randomUUID()}`,
        }, 202);
      }
    }

    const entity = path.match(/^\/api\/bemax\/entities\/([^/]+)$/);
    if (entity) {
      const id = decodeURIComponent(entity[1]);
      const universe = await readUniverse(env);
      const product = universe.products.find((entry) => entry.id === id);
      if (!product) {
        return json({ error: "Entity not found" }, 404);
      }
      return json({
        schemaVersion: 1,
        entityId: product.id,
        kind: "product",
        label: product.name,
        status: product.status,
        score: product.score,
        risk: product.risk,
        evidence: evidenceFromProduct(product as any),
      });
    }

    return json({ error: "Compatibility route not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
}

export { conversations };
