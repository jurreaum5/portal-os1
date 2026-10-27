import {
  evaluateAutonomyRules,
  applyOperationalProposals,
} from "../src/completion-api";
import { sha256 } from "../src/access";
import {
  env,
  applyD1Migrations,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import type { D1Migration } from "@cloudflare/vitest-plugin";
import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";
import {
  registerIdentity,
  synchroniseIdentities,
  identity,
} from "../src/universe-store";
import { routeModel } from "../src/model-router";
import { refreshSports } from "../src/sports";
import { simulateScenario } from "../../../portal-os/substrate";
const bindings = env as unknown as Env & { TEST_MIGRATIONS: D1Migration[] };
const base = { ...bindings, GOVERNOR_API_TOKEN: "synthetic-test-token" };
async function call(
  path: string,
  body?: unknown,
  custom: Env = base,
  token = "synthetic-test-token",
) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request(`https://portal.test${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    custom,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}
const proof = {
  facts: ["Observed operational evidence"],
  sources: ["/api/intelligence"],
};
beforeAll(async () => {
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
  await bindings.DB.prepare(
    "INSERT INTO products(id,name,stage,score) VALUES ('completion','Completion product','Ready',90)",
  ).run();
  await synchroniseIdentities(base);
});
afterEach(() => vi.restoreAllMocks());
async function project() {
  const id = `project-test:${crypto.randomUUID()}`;
  await registerIdentity(
    base,
    {
      id,
      kind: "project",
      label: "Work",
      invariants: { origin: "test", key: id },
    },
    "test",
    "test",
  );
  return id;
}
async function proposal(entityId: string, action: string, input: unknown) {
  const response = await call("/api/autonomy/proposals", {
    entityId,
    action,
    input,
    evidence: proof,
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}
describe("MAX completion contracts", () => {
  it("keeps identities, native lifecycle, relationships and invariants continuous", async () => {
    expect(
      (await call("/api/icv/history?entityId=product:completion")).status,
    ).toBe(200);
    const original = await identity(base, "product:completion");
    await expect(
      bindings.DB.prepare(
        "UPDATE universe_identities SET invariants='{}' WHERE id='product:completion'",
      ).run(),
    ).rejects.toThrow();
    await expect(
      bindings.DB.prepare(
        "DELETE FROM universe_identities WHERE id='product:completion'",
      ).run(),
    ).rejects.toThrow();
    await synchroniseIdentities(base);
    expect(await identity(base, "product:completion")).toEqual(original);
    const graph = (await (await call("/api/twin/graph")).json()) as {
      nodes: { id: string }[];
      edges: { source: string; target: string }[];
    };
    expect(graph.nodes.some((n) => n.id === "research:substrate")).toBe(true);
    expect(
      graph.edges.some(
        (e) =>
          e.source === "division:max-institute" &&
          e.target === "research:substrate",
      ),
    ).toBe(true);
    const path = await call(
      "/api/manifold/path?from=ecosystem:max&to=research:substrate",
    );
    expect(((await path.json()) as { path: string[] }).path).toEqual([
      "ecosystem:max",
      "division:max-institute",
      "research:substrate",
    ]);
  });
  it("preserves memory ownership and append-only supersession", async () => {
    const id = await project();
    const response = await call("/api/bemax/memory", {
      entityId: id,
      kind: "decision",
      content: "Personal private history",
      source: "Governor",
    });
    const memory = (await response.json()) as { id: string };
    expect(response.status).toBe(201);
    const config = {
      ...base,
      STAFF_CREDENTIALS: JSON.stringify([
        {
          id: "reader",
          role: "Read Only",
          tokenSha256: await (
            await import("../src/access")
          ).sha256("reader-token"),
        },
      ]),
    };
    const mine = (await (await call("/api/bemax")).json()) as {
      memory: { id: string }[];
    };
    expect(mine.memory.some((m) => m.id === memory.id)).toBe(true);
    const theirs = (await (
      await call("/api/bemax", undefined, config, "reader-token")
    ).json()) as { memory: unknown[] };
    expect(theirs.memory).toEqual([]);
    expect(
      (
        await call("/api/bemax/memory", {
          entityId: id,
          kind: "decision",
          content: "Correction",
          source: "Governor",
          supersedes: memory.id,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call("/api/bemax/memory", {
          entityId: id,
          kind: "decision",
          content: "Second correction",
          source: "Governor",
          supersedes: memory.id,
        })
      ).status,
    ).toBe(409);
    await expect(
      bindings.DB.prepare("UPDATE bemax_memory SET content='erased' WHERE id=?")
        .bind(memory.id)
        .run(),
    ).rejects.toThrow();
  });
  it("requires Governor approval, audits atomically and compensates without rewriting history", async () => {
    const id = await project(),
      p = await proposal(id, "risk-escalation", {
        reason: "Operational risk",
        severity: "high",
      });
    expect(JSON.parse((await identity(base, id))!.state)).toEqual({});
    const rejectedAuth = await call(
      `/api/autonomy/${p.id}/approve`,
      {},
      { ...base, GOVERNOR_API_TOKEN: undefined },
      "customer-token",
    );
    expect(rejectedAuth.status).toBe(503);
    const approved = await call(`/api/autonomy/${p.id}/approve`, {});
    expect(approved.status).toBe(200);
    expect(((await approved.json()) as { status: string }).status).toBe(
      "applied",
    );
    expect(JSON.parse((await identity(base, id))!.state).risk.severity).toBe(
      "high",
    );
    expect((await call(`/api/autonomy/${p.id}/reject`, {})).status).toBe(409);
    const rollback = await proposal(id, "rollback", { proposalId: p.id });
    expect(
      (
        await call(`/api/autonomy/${rollback.id}/override`, {
          reason: "Restore previous recorded state",
        })
      ).status,
    ).toBe(200);
    expect(JSON.parse((await identity(base, id))!.state)).toEqual({});
    const history = (await (
      await call(`/api/icv/history?entityId=${encodeURIComponent(id)}`)
    ).json()) as { events: { type: string }[] };
    expect(history.events.some((e) => e.type === "decision.approved")).toBe(
      true,
    );
    expect(history.events.some((e) => e.type === "autonomy.rollback")).toBe(
      true,
    );
    await expect(
      bindings.DB.prepare("DELETE FROM universe_events WHERE entity_id=?")
        .bind(id)
        .run(),
    ).rejects.toThrow();
  });
  it("rejects stale proposals, insufficient evidence, lifecycle bypasses and weak overrides", async () => {
    const id = await project(),
      a = await proposal(id, "risk-escalation", {
        reason: "A",
        severity: "high",
      }),
      b = await proposal(id, "risk-escalation", {
        reason: "B",
        severity: "low",
      });
    await call(`/api/autonomy/${a.id}/approve`, {});
    const stale = await call(`/api/autonomy/${b.id}/approve`, {});
    expect(((await stale.json()) as { status: string }).status).toBe(
      "conflict",
    );
    expect(JSON.parse((await identity(base, id))!.state).risk.reason).toBe("A");
    expect(
      (
        await call("/api/autonomy/proposals", {
          entityId: id,
          action: "archive",
          input: {},
          evidence: proof,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call("/api/autonomy/proposals", {
          entityId: id,
          action: "risk-escalation",
          input: {},
          evidence: { sources: [] },
        })
      ).status,
    ).toBe(400);
    const c = await proposal(id, "risk-escalation", {
      reason: "C",
      severity: "low",
    });
    expect(
      (await call(`/api/autonomy/${c.id}/override`, { reason: "short" }))
        .status,
    ).toBe(400);
  });
  it("connects capacity and scheduling policy to persisted operational state", async () => {
    const capacity = await proposal("department:BUILD", "resource-allocation", {
      capacity: 7,
    });
    await call(`/api/autonomy/${capacity.id}/approve`, {});
    const departments = (await (await call("/api/departments")).json()) as {
      id: string;
      capacity: number;
    }[];
    expect(departments.find((d) => d.id === "BUILD")?.capacity).toBe(7);
    const schedule = await proposal(
      "product:completion",
      "publishing-schedule",
      { notBefore: new Date(Date.now() + 3600000).toISOString() },
    );
    await call(`/api/autonomy/${schedule.id}/approve`, {});
    expect(
      JSON.parse((await identity(base, "product:completion"))!.state)
        .publishingNotBefore,
    ).toBeDefined();
  });
  it("applies resource limits to real factory admission and assignments to queues", async () => {
    const p = await proposal("resource:execution", "resource-allocation", {
      capacity: 0,
    });
    await call(`/api/autonomy/${p.id}/approve`, {});
    const allocator = bindings.FACTORY_ACTOR!.get(
      bindings.FACTORY_ACTOR!.idFromName("icvs:resource-allocation"),
    );
    expect(
      (
        await allocator.fetch("https://factory.internal/allocate", {
          method: "POST",
          body: JSON.stringify({ owner: "completion-capacity-test" }),
        })
      ).status,
    ).toBe(429);
    const rollback = await proposal("resource:execution", "rollback", {
      proposalId: p.id,
    });
    await call(`/api/autonomy/${rollback.id}/approve`, {});
    expect(
      (
        await allocator.fetch("https://factory.internal/allocate", {
          method: "POST",
          body: JSON.stringify({ owner: "completion-capacity-test" }),
        })
      ).status,
    ).toBe(200);
    await allocator.fetch("https://factory.internal/release", {
      method: "POST",
      body: JSON.stringify({ owner: "completion-capacity-test" }),
    });
    const assigned = await proposal("product:completion", "work-assignment", {
      departmentId: "department:BUILD",
      workId: "product:completion",
    });
    await call(`/api/autonomy/${assigned.id}/approve`, {});
    const departments = (await (await call("/api/departments")).json()) as {
      id: string;
      queue: { id: string }[];
    }[];
    expect(
      departments
        .find((d) => d.id === "BUILD")
        ?.queue.some((p) => p.id === "completion"),
    ).toBe(true);
    const graph = (await (await call("/api/twin/graph")).json()) as {
      edges: { source: string; target: string; relation: string }[];
    };
    expect(
      graph.edges.some(
        (e) =>
          e.source === "product:completion" &&
          e.target === "department:BUILD" &&
          e.relation === "assigned_to",
      ),
    ).toBe(true);
  });
  it("governs research review before release", async () => {
    const output = await call("/api/institute/outputs", {
      divisionId: "research:substrate",
      type: "whitepaper",
      title: "Substrate research",
      source: "https://research.test/paper",
      evidence: proof,
    });
    expect(output.status).toBe(201);
    const row = (await output.json()) as { id: string };
    expect(
      (
        await call("/api/autonomy/proposals", {
          entityId: row.id,
          action: "research-output",
          input: { status: "released" },
          evidence: proof,
        })
      ).status,
    ).toBe(422);
    const review = await proposal(row.id, "research-output", {
      status: "reviewed",
    });
    await call(`/api/autonomy/${review.id}/approve`, {});
    const release = await proposal(row.id, "research-output", {
      status: "released",
    });
    await call(`/api/autonomy/${release.id}/approve`, {});
    expect(JSON.parse((await identity(base, row.id))!.state).status).toBe(
      "released",
    );
  });
  it("returns sourced BEMAX recommendations and six live spatial scenes", async () => {
    const data = (await (
      await call("/api/bemax?question=What%20should%20be%20published%3F")
    ).json()) as {
      recommendations: {
        sources: string[];
        confidence: string;
        tradeoffs: string[];
        evidence: unknown;
      }[];
    };
    expect(data.recommendations.length).toBeGreaterThan(0);
    for (const r of data.recommendations) {
      expect(r.sources.length).toBeGreaterThan(0);
      expect(r.confidence).toBeTruthy();
      expect(r.tradeoffs.length).toBeGreaterThan(0);
      expect(r.evidence).toBeTruthy();
    }
    for (const scene of [
      "ecosystem-galaxy",
      "product-constellation",
      "pipeline-universe",
      "department-operations-center",
      "sports-intelligence-center",
      "quantum-xr-command-room",
    ]) {
      const response = await call(`/api/xr/${scene}`);
      expect(response.status).toBe(200);
      expect(
        ((await response.json()) as { coordinateSystem: unknown })
          .coordinateSystem,
      ).toBeDefined();
    }
    const reasoned = await call("/api/bemax/reason", {
      question: "What matters?",
    });
    expect(reasoned.status).toBe(200);
    const recorded = (await reasoned.json()) as { memoryId: string };
    expect(
      await bindings.DB.prepare("SELECT owner_id FROM bemax_memory WHERE id=?")
        .bind(recorded.memoryId)
        .first("owner_id"),
    ).toBe("governor");
  });
  it("shares identity, events, uncertainty and emergence through MAX-CORE scenarios", async () => {
    const id = await project(),
      scenario = {
        entities: [
          {
            id,
            kind: "project",
            revision: 1,
            position: { x: 0, y: 0, z: 0 },
            values: { progress: 1 },
          },
        ],
        relationships: [],
        events: [
          {
            id: "event",
            entityId: id,
            metric: "progress",
            delta: 2,
            tick: 0,
            source: "Scenario assumption",
          },
        ],
        uncertainty: [
          {
            entityId: id,
            metric: "progress",
            lower: 0,
            upper: 5,
            source: "Uncalibrated assumption",
          },
        ],
        emergence: [
          {
            id: "threshold",
            entityId: id,
            metric: "progress",
            threshold: 2,
            source: "Scenario rule",
          },
        ],
        steps: 2,
      };
    const one = simulateScenario(scenario);
    expect(simulateScenario(scenario)).toEqual(one);
    const evaluated = await call("/api/substrate/scenarios", scenario);
    expect(evaluated.status).toBe(201);
    const run = (await evaluated.json()) as { id: string };
    const replay = await call(`/api/substrate/scenarios/${run.id}`);
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as { input: unknown }).input).toEqual(
      scenario,
    );
    expect(JSON.parse((await identity(base, id))!.state)).toEqual({});
    expect(
      (
        await call("/api/substrate/scenarios", {
          ...scenario,
          entities: [{ ...scenario.entities[0], revision: 99 }],
        })
      ).status,
    ).toBe(409);
    expect(() =>
      simulateScenario({
        ...scenario,
        events: [{ ...scenario.events[0], entityId: "missing" }],
      }),
    ).toThrow();
  });
});
describe("autonomy recovery and scope boundaries", () => {
  it("evaluates configured rules once per identity revision and never auto-approves", async () => {
    const id = await project();
    const custom = {
      ...base,
      AUTONOMY_RULES: JSON.stringify([
        {
          id: "rule-v1",
          entityId: id,
          action: "risk-escalation",
          input: { reason: "Recorded threshold", severity: "high" },
          condition: { metric: "revision", operator: "gte", value: 1 },
        },
      ]),
    };
    // Non-product rules observe explicit identity state, not invented measurements.
    custom.AUTONOMY_RULES = JSON.stringify([
      {
        id: "rule-v1",
        entityId: "product:completion",
        action: "risk-escalation",
        input: {
          reason: "Lifecycle evidence score reached policy threshold",
          severity: "medium",
        },
        condition: { metric: "score", operator: "gte", value: 80 },
      },
    ]);
    await evaluateAutonomyRules(custom);
    await evaluateAutonomyRules(custom);
    const proposals = (
      await bindings.DB.prepare(
        "SELECT id,status FROM autonomy_proposals WHERE rule_id='rule-v1'",
      ).all()
    ).results;
    expect(proposals).toHaveLength(1);
    expect(proposals[0].status).toBe("pending");
    expect(JSON.parse((await identity(base, id))!.state)).toEqual({});
  });
  it("enforces automation propose scope and prevents kind impersonation", async () => {
    const id = await project();
    const custom = {
      ...base,
      AUTOMATION_CREDENTIALS: JSON.stringify([
        {
          id: "automation",
          tokenSha256: await sha256("automation-token"),
          scopes: ["autonomy:propose"],
        },
      ]),
    };
    const proposed = await call(
      "/api/autonomy/proposals",
      {
        entityId: id,
        action: "risk-escalation",
        input: { severity: "high", reason: "Connected observation" },
        evidence: proof,
      },
      custom,
      "automation-token",
    );
    expect(proposed.status).toBe(201);
    const row = (await proposed.json()) as { id: string };
    expect(
      (
        await call(
          `/api/autonomy/${row.id}/approve`,
          {},
          custom,
          "automation-token",
        )
      ).status,
    ).toBe(403);
    expect(
      (await call("/api/bemax", undefined, custom, "automation-token")).status,
    ).toBe(403);
    expect(
      (
        await call("/api/icv/identities", {
          id: "custom:forged",
          kind: "research-output",
          label: "Fake released paper",
          invariants: { key: "fake" },
          source: "test",
        })
      ).status,
    ).toBe(400);
  });
  it("recovers interrupted approved effects without losing audit events", async () => {
    const id = await project(),
      p = await proposal(id, "risk-escalation", {
        severity: "high",
        reason: "Recovery check",
      });
    await bindings.DB.exec(
      "CREATE TRIGGER reject_effect BEFORE INSERT ON universe_events WHEN NEW.type='autonomy.risk-escalation' BEGIN SELECT RAISE(ABORT,'test audit unavailable'); END;",
    );
    const response = await call(`/api/autonomy/${p.id}/approve`, {});
    expect(response.status).toBe(500);
    expect(JSON.parse((await identity(base, id))!.state)).toEqual({});
    expect(
      await bindings.DB.prepare(
        "SELECT status FROM autonomy_proposals WHERE id=?",
      )
        .bind(p.id)
        .first("status"),
    ).toBe("approved");
    await bindings.DB.exec("DROP TRIGGER reject_effect;");
    await applyOperationalProposals(base);
    await applyOperationalProposals(base);
    expect(JSON.parse((await identity(base, id))!.state).risk.severity).toBe(
      "high",
    );
    expect(
      await bindings.DB.prepare(
        "SELECT COUNT(*) AS n FROM universe_events WHERE id=?",
      )
        .bind(`effect:${p.id}`)
        .first("n"),
    ).toBe(1);
  });
  it("invalidates pending product proposals after a native lifecycle change", async () => {
    const p = await proposal("product:completion", "risk-escalation", {
      severity: "high",
      reason: "Previous lifecycle evidence",
    });
    await bindings.DB.prepare(
      "UPDATE products SET stage='Published' WHERE id='completion'",
    ).run();
    await synchroniseIdentities(base);
    const response = await call(`/api/autonomy/${p.id}/approve`, {});
    expect(((await response.json()) as { status: string }).status).toBe(
      "conflict",
    );
  });
});
describe("production adapters", () => {
  it("rejects fabricated Sports observations and retains correlated production provenance", async () => {
    expect(await refreshSports(base)).toMatchObject({ blocked: true });
    const record = {
      id: "game-1",
      externalId: "athlete-1",
      entityKind: "athlete",
      label: "Athlete",
      league: "NFL",
      category: "athlete",
      source: "https://provider.test/athletes/1",
      observedAt: new Date().toISOString(),
      metrics: { games: 10 },
    };
    let production = false;
    const custom = {
      ...base,
      SPORTS_CONFIG: JSON.stringify({
        provider: "connected",
        leagues: [
          "NFL",
          "NBA",
          "MLB",
          "NHL",
          "Soccer",
          "F1",
          "Combat",
          "Esports",
        ],
      }),
      SPORTS_FEED: {
        fetch: async () =>
          Response.json({
            provider: "connected",
            production,
            records: [record],
          }),
      } as unknown as Fetcher,
    };
    await expect(refreshSports(custom)).rejects.toThrow();
    production = true;
    expect(await refreshSports(custom)).toEqual({ received: 1 });
    expect(await refreshSports(custom)).toEqual({ received: 1 });
    const data = (await (
      await call("/api/sports", undefined, custom)
    ).json()) as { records: unknown[] };
    expect(data.records).toHaveLength(1);
    record.metrics.games = 11;
    await expect(refreshSports(custom)).rejects.toThrow("identity reused");
    record.id = "game-2";
    record.observedAt = new Date(Date.now() + 1).toISOString();
    await refreshSports(custom);
    const intelligence = (await (
      await call("/api/sports", undefined, custom)
    ).json()) as {
      records: { changes: { games: number } }[];
      recommendations: {
        sources: string[];
        confidence: string;
        tradeoffs: string[];
      }[];
    };
    expect(intelligence.records[0].changes.games).toBe(1);
    expect(intelligence.recommendations[0].sources).toEqual([record.source]);
    expect(intelligence.recommendations[0].confidence).toBeTruthy();
    expect(intelligence.recommendations[0].tradeoffs.length).toBeGreaterThan(0);
  });
  it.each([
    [
      "openai",
      {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Grounded summary" }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 4 },
      },
      "/responses",
    ],
    [
      "claude",
      {
        content: [{ type: "text", text: "Grounded summary" }],
        usage: { input_tokens: 10, output_tokens: 4 },
      },
      "/messages",
    ],
    [
      "gemini",
      {
        candidates: [{ content: { parts: [{ text: "Grounded summary" }] } }],
        usageMetadata: {
          promptTokenCount: 10,
          totalTokenCount: 14,
          candidatesTokenCount: 4,
        },
      },
      ":generateContent",
    ],
    [
      "local",
      {
        choices: [{ message: { content: "Grounded summary" } }],
        usage: { prompt_tokens: 10, completion_tokens: 4 },
      },
      "/chat/completions",
    ],
  ])(
    "normalises %s responses and records costs",
    async (kind, response, path) => {
      const fetcher = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(Response.json(response));
      const id = `provider-${kind}`;
      const custom = {
        ...base,
        MODEL_CONFIG: JSON.stringify({
          dailyBudgetMicrousd: 1000000,
          providers: [
            {
              id,
              kind,
              baseUrl: "https://provider.test/v1",
              model: "configured-model",
              inputMicrousdPerToken: 1,
              outputMicrousdPerToken: 2,
              maxInputBytes: 10000,
              maxOutputTokens: 100,
            },
          ],
        }),
        MODEL_CREDENTIALS: JSON.stringify({ [id]: "synthetic-provider-key" }),
      };
      const result = await routeModel(custom, "Recorded evidence");
      expect(result).toMatchObject({
        text: "Grounded summary",
        usage: { actualMicrousd: 18 },
      });
      expect(String(fetcher.mock.calls[0][0])).toContain(path);
    },
  );
  it("caps zero-cost local model requests and rejects unusable configuration", async () => {
    await bindings.DB.prepare("DELETE FROM model_attempts").run();
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        choices: [{ message: { content: "Recorded summary" } }],
        usage: { prompt_tokens: 4, completion_tokens: 2 },
      }),
    );
    const custom = {
      ...base,
      MODEL_CONFIG: JSON.stringify({
        dailyBudgetMicrousd: 0,
        dailyRequestLimit: 1,
        providers: [
          {
            id: "free-local",
            kind: "local",
            baseUrl: "https://provider.test/v1",
            model: "local",
            inputMicrousdPerToken: 0,
            outputMicrousdPerToken: 0,
            maxInputBytes: 100,
            maxOutputTokens: 100,
          },
        ],
      }),
    };
    expect(await routeModel(custom, "evidence")).toMatchObject({
      text: "Recorded summary",
    });
    expect(await routeModel(custom, "evidence")).toMatchObject({
      blocked: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("fails over with budget reservations and denies concurrent over-budget attempts", async () => {
    await bindings.DB.prepare("DELETE FROM model_attempts").run();
    const p = (id: string) => ({
      id,
      kind: "local",
      baseUrl: "https://provider.test/v1",
      model: "local",
      inputMicrousdPerToken: 1,
      outputMicrousdPerToken: 1,
      maxInputBytes: 100,
      maxOutputTokens: 100,
    });
    const custom = {
      ...base,
      MODEL_CONFIG: JSON.stringify({
        dailyBudgetMicrousd: 100000,
        providers: [p("first"), p("second")],
      }),
    };
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockImplementation(async () =>
        Response.json({
          choices: [{ message: { content: "Evidence summary" } }],
          usage: { prompt_tokens: 10, completion_tokens: 4 },
        }),
      );
    expect(await routeModel(custom, "evidence")).toMatchObject({
      providerId: "second",
      failures: [{ providerId: "first" }],
    });
    await bindings.DB.prepare("DELETE FROM model_attempts").run();
    fetcher.mockClear();
    custom.MODEL_CONFIG = JSON.stringify({
      dailyBudgetMicrousd: 2156,
      providers: [p("first")],
    });
    const results = await Promise.all([
      routeModel(custom, "evidence"),
      routeModel(custom, "evidence"),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => "blocked" in r)).toHaveLength(1);
  });
});
