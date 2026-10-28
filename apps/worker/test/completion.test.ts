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

describe("Phase 4 production contracts", () => {
  it("enforces directed dependency traversal and bounded cycles", async () => {
    const { dependencyAnalysis } = await import("../../../portal-os/manifold");
    const g = {
      nodes: [],
      edges: [
        { id: "1", source: "a", target: "b", relation: "depends_on" },
        { id: "2", source: "b", target: "c", relation: "depends_on" },
        { id: "3", source: "c", target: "b", relation: "depends_on" },
        { id: "4", source: "x", target: "b", relation: "mentions" },
      ],
    };
    expect(dependencyAnalysis(g, "a").prerequisites.map((n) => n.id)).toEqual([
      "b",
      "c",
    ]);
    expect(
      dependencyAnalysis(g, "b").affectedConsumers.map((n) => n.id),
    ).toEqual(["a", "c"]);
    expect((await call("/api/manifold/navigation?depth=9")).status).toBe(400);
    for (const path of [
      "",
      "/navigation",
      "/influence",
      "/dependencies",
      "/opportunities",
      "/risk",
    ])
      expect((await call("/api/manifold" + path)).status).toBe(200);
  });
  it("requires a policy record before execution and retains compensation", async () => {
    const p = await proposal("resource:execution", "capacity-change", {
      capacity: 2,
    });
    await base.DB.prepare(
      "UPDATE autonomy_proposals SET status='approved',decided_by='governor',decision_reason='approved' WHERE id=?",
    )
      .bind(p.id)
      .run();
    await expect(
      base.DB.prepare(
        "UPDATE autonomy_proposals SET status='applied' WHERE id=?",
      )
        .bind(p.id)
        .run(),
    ).rejects.toThrow();
    await applyOperationalProposals(base);
    expect(
      (
        await base.DB.prepare(
          "SELECT result FROM policy_checks WHERE proposal_id=?",
        )
          .bind(p.id)
          .first<{ result: string }>()
      )?.result,
    ).toBe("passed");
    const rollback = await proposal("resource:execution", "rollback", {
      proposalId: p.id,
    });
    expect(
      (await call(`/api/autonomy/${rollback.id}/approve`, {})).status,
    ).toBe(200);
  });
  it("preserves research lineage while new versions require their own approvals", async () => {
    const body = {
      divisionId: "research:substrate",
      type: "standard",
      title: "Standard",
      source: "https://example.test/standard",
      evidence: proof,
    };
    const first = (await (
      await call("/api/institute/outputs", body)
    ).json()) as { id: string };
    const second = (await (
      await call("/api/institute/outputs", { ...body, predecessorId: first.id })
    ).json()) as { id: string; state: string };
    expect(JSON.parse(second.state).status).toBe("draft");
    const versions = await base.DB.prepare(
      "SELECT * FROM research_versions WHERE output_id=?",
    )
      .bind(second.id)
      .first<{ version: number; predecessor_id: string }>();
    expect(versions?.version).toBe(2);
    expect(versions?.predecessor_id).toBe(first.id);
    expect(
      (
        await call("/api/institute/outputs", {
          ...body,
          predecessorId: first.id,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call("/api/institute/outputs", {
          ...body,
          divisionId: "research:protocol",
          predecessorId: second.id,
        })
      ).status,
    ).toBe(400);
  });
  it("separates model classes and makes run evidence immutable", async () => {
    const id = "forecast:" + crypto.randomUUID();
    expect(
      (
        await call("/api/substrate/registry", {
          id,
          version: "1",
          modelClass: "forecast",
          source: "test",
          assumptions: "No trained model yet",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call("/api/substrate/scenarios", {
          modelId: id,
          entities: [],
          relationships: [],
          events: [],
          uncertainty: [],
          emergence: [],
          steps: 1,
        })
      ).status,
    ).toBe(400);
    const response = await call("/api/substrate/scenarios", {
      entities: [],
      relationships: [],
      events: [],
      uncertainty: [],
      emergence: [],
      steps: 1,
    });
    expect(response.status).toBe(201);
    const run = (await response.json()) as { id: string };
    await expect(
      base.DB.prepare("DELETE FROM simulation_runs WHERE id=?")
        .bind(run.id)
        .run(),
    ).rejects.toThrow();
    await expect(
      base.DB.prepare("UPDATE simulation_registry SET version='2' WHERE id=?")
        .bind(id)
        .run(),
    ).rejects.toThrow();
  });
  it("never equates configuration with observed availability", async () => {
    const { connectionStatus } = await import("../../../portal-os/production");
    const now = Date.now(),
      fresh = new Date(now).toISOString();
    expect(connectionStatus(false, false, undefined, undefined, now)).toBe(
      "DISCONNECTED",
    );
    expect(connectionStatus(true, false, "succeeded", fresh, now)).toBe(
      "BLOCKED",
    );
    expect(connectionStatus(true, true, undefined, undefined, now)).toBe(
      "UNAVAILABLE",
    );
    expect(connectionStatus(true, true, "failed", fresh, now)).toBe(
      "DISCONNECTED",
    );
    expect(connectionStatus(true, true, "succeeded", fresh, now)).toBe(
      "CONNECTED",
    );
    expect(
      connectionStatus(
        true,
        true,
        "succeeded",
        new Date(now - 90000000).toISOString(),
        now,
      ),
    ).toBe("STALE");
    const result = (await (await call("/api/operations/status")).json()) as {
      integrations: { status: string }[];
      backup: { status: string };
    };
    expect(result.integrations.every((i) => i.status !== "CONNECTED")).toBe(
      true,
    );
    expect(result.backup.status).toBe("UNAVAILABLE");
    const report = (await (
      await call("/api/sports/reports?type=forecast")
    ).json()) as { records: unknown[]; status: string };
    expect(report.records).toEqual([]);
    expect(report.status).toBe("UNAVAILABLE");
    expect(
      (await call("/api/operations/status", undefined, base, "invalid")).status,
    ).toBe(401);
    expect((await call("/api/operations/audit?after=-1")).status).toBe(400);
  });
  it("includes explainability and Institute XR navigation in existing contracts", async () => {
    const brief = (await (
      await call("/api/bemax?question=What%20should%20be%20funded%20next?")
    ).json()) as Record<string, unknown>;
    for (const k of [
      "evidence",
      "sources",
      "confidence",
      "tradeoffs",
      "impactScope",
      "dependencyAnalysis",
      "growthAnalysis",
    ])
      expect(brief[k]).toBeDefined();
    const xr = (await (
      await call("/api/xr/institute-research-center")
    ).json()) as { nodes: { kind: string }[]; navigation: unknown };
    expect(xr.nodes.some((n) => n.kind === "research-division")).toBe(true);
    expect(xr.navigation).toBeDefined();
  });
});

it("probes only the requested provider, respects cost controls and audits metadata", async () => {
  const config = {
    ...base,
    MODEL_CONFIG: JSON.stringify({
      dailyBudgetMicrousd: 1000000,
      providers: ["probe-a", "probe-b"].map((id) => ({
        id,
        kind: "local",
        baseUrl: `https://${id}.test/v1`,
        model: "fixture",
        inputMicrousdPerToken: 1,
        outputMicrousdPerToken: 1,
        maxInputBytes: 1000,
        maxOutputTokens: 20,
      })),
    }),
  };
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      choices: [{ message: { content: "OK" } }],
      usage: { prompt_tokens: 10, completion_tokens: 1 },
    }),
  );
  const response = await call(
    "/api/models/check",
    { providerId: "probe-b" },
    config,
  );
  expect(response.status).toBe(200);
  expect(((await response.json()) as { status: string }).status).toBe(
    "CONNECTED",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toContain("probe-b.test");
  const events = await base.DB.prepare(
    "SELECT evidence FROM universe_events WHERE source='probe-b' AND type='model.succeeded'",
  ).all<{ evidence: string }>();
  expect(events.results.length).toBeGreaterThan(0);
  expect(events.results[0].evidence).not.toContain("Reply with");
  expect(
    (await call("/api/models/check", { providerId: "unknown" }, config)).status,
  ).toBe(404);
});

it("accepts explicit historical Sports data without relabelling it as current", async () => {
  const record = {
    id: "history-1",
    externalId: "historical-athlete",
    entityKind: "athlete",
    label: "Historical athlete",
    league: "custom-league",
    category: "historical",
    source: "https://feed.test/history",
    observedAt: "2020-01-01T00:00:00.000Z",
    metrics: { games: 5 },
  };
  const custom = {
    ...base,
    SPORTS_CONFIG: JSON.stringify({
      provider: "history-test",
      leagues: ["custom-league"],
    }),
    SPORTS_FEED: {
      fetch: async () =>
        Response.json({
          provider: "history-test",
          production: true,
          records: [record],
        }),
    } as unknown as Fetcher,
  };
  expect(await refreshSports(custom)).toEqual({ received: 1 });
  const report = (await (
    await call(
      "/api/sports/reports?type=athlete&league=custom-league",
      undefined,
      custom,
    )
  ).json()) as {
    status: string;
    records: { freshnessState: string; source: string }[];
  };
  expect(report.status).toBe("STALE");
  expect(report.records[0].source).toBe(record.source);
  record.id = "current-invalid";
  record.category = "athlete";
  await expect(refreshSports(custom)).rejects.toThrow("Invalid Sports");
});

describe("Phase 5 acceptance contracts", () => {
  it("marks unavailable providers disconnected while failing over, and invalidates changed configuration", async () => {
    await base.DB.prepare("DELETE FROM model_attempts").run();
    const provider = (id: string) => ({
      id,
      kind: "local",
      baseUrl: `https://${id}.test/v1`,
      model: "fixture",
      inputMicrousdPerToken: 0,
      outputMicrousdPerToken: 0,
      maxInputBytes: 2000,
      maxOutputTokens: 100,
    });
    const custom = {
      ...base,
      MODEL_CONFIG: JSON.stringify({
        dailyBudgetMicrousd: 0,
        providers: [provider("unavailable"), provider("alternative")],
      }),
    };
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockImplementation(async () =>
        Response.json({
          choices: [{ message: { content: "Observed answer" } }],
          usage: { prompt_tokens: 10, completion_tokens: 3 },
        }),
      );
    expect(await routeModel(custom, "evidence")).toMatchObject({
      providerId: "alternative",
    });
    const { modelHealth } = await import("../src/model-router");
    expect((await modelHealth(custom)).providers.map((p) => p.status)).toEqual([
      "DISCONNECTED",
      "CONNECTED",
    ]);
    await routeModel(custom, "recheck", "unavailable");
    expect((await modelHealth(custom)).providers[0].status).toBe("DEGRADED");
    custom.MODEL_CONFIG = JSON.stringify({
      dailyBudgetMicrousd: 0,
      providers: [{ ...provider("alternative"), model: "replacement" }],
    });
    expect((await modelHealth(custom)).providers[0].status).toBe("UNAVAILABLE");
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    const probe = (await (
      await call("/api/models/check", { providerId: "alternative" }, custom)
    ).json()) as { status: string; completed: boolean };
    expect(probe.status).toBe("DISCONNECTED");
    expect(probe.completed).toBe(false);
  });
  it("returns dependency relationship metadata and graph-native opportunity/search/risk results", async () => {
    const a = await project(),
      b = await project();
    expect(
      (
        await call("/api/icv/relationships", {
          sourceId: a,
          targetId: b,
          relation: "depends_on",
          evidence: proof,
        })
      ).status,
    ).toBe(201);
    const traversal = (await (
      await call(`/api/manifold/dependencies?root=${encodeURIComponent(a)}`)
    ).json()) as {
      visits: {
        id: string;
        relationship: {
          source: string;
          target: string;
          relation: string;
        } | null;
      }[];
    };
    expect(
      traversal.visits.find((v) => v.id === b)?.relationship,
    ).toMatchObject({ source: a, target: b, relation: "depends_on" });
    expect((await call("/api/manifold/opportunity")).status).toBe(200);
    const search = (await (
      await call(`/api/manifold?q=${encodeURIComponent(a)}`)
    ).json()) as { nodes: { id: string }[] };
    expect(search.nodes.map((n) => n.id)).toContain(a);
    const { riskPropagation } = await import("../../../portal-os/manifold");
    const propagation = riskPropagation(
      {
        nodes: [],
        edges: [
          { id: "dependency", source: a, target: b, relation: "depends_on" },
        ],
      },
      [{ entityId: b, reasons: ["Observed risk"] }],
    );
    expect(
      propagation[0].exposure.visits.find((v) => v.id === a)?.relationship
        ?.relation,
    ).toBe("depends_on");
  });
  it("returns source research for derived frameworks and retains version history", async () => {
    const body = {
      divisionId: "research:substrate",
      type: "research-report",
      title: "Research source",
      source: "https://research.test/source",
      evidence: proof,
    };
    const source = (await (
      await call("/api/institute/outputs", body)
    ).json()) as { id: string };
    const framework = (await (
      await call("/api/institute/outputs", {
        ...body,
        type: "framework",
        title: "Derived framework",
        derivesFrom: [source.id],
      })
    ).json()) as { id: string };
    const lineage = (await (
      await call(`/api/institute/lineage?entityId=${framework.id}`)
    ).json()) as {
      nodes: { id: string }[];
      edges: { relation: string; target: string }[];
    };
    expect(lineage.nodes.map((n) => n.id)).toContain(source.id);
    expect(lineage.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: "derives_from",
          target: source.id,
        }),
      ]),
    );
    expect(
      (
        await call("/api/institute/outputs", {
          ...body,
          derivesFrom: ["ecosystem:max"],
        })
      ).status,
    ).toBe(400);
  });
  it("stores model identity, ownership, domain, provenance and distinct versions", async () => {
    const body = {
      id: "sports-model-v1",
      version: "1",
      modelClass: "scenario",
      domain: "sports",
      source: "https://models.test/v1",
      assumptions: "Caller supplied events",
      ownerId: "research:substrate",
      evidence: proof,
    };
    expect((await call("/api/substrate/registry", body)).status).toBe(201);
    const metadata = await base.DB.prepare(
      "SELECT * FROM simulation_provenance WHERE model_id=?",
    )
      .bind(body.id)
      .first<{ owner_id: string; domain: string; evidence: string }>();
    expect(metadata).toMatchObject({
      owner_id: body.ownerId,
      domain: "sports",
    });
    expect(JSON.parse(metadata!.evidence)).toEqual(proof);
    expect(await identity(base, `simulation-model:${body.id}`)).not.toBeNull();
    const next = {
      ...body,
      id: "sports-model-v2",
      version: "2",
      predecessorId: body.id,
    };
    expect((await call("/api/substrate/registry", next)).status).toBe(201);
    expect(
      (await call("/api/substrate/registry", { ...next, id: "forked-v2" }))
        .status,
    ).toBe(409);
  });
  it("replays retained inputs with immutable hashes and no production mutation", async () => {
    const scenario = {
      entities: [],
      relationships: [],
      events: [],
      uncertainty: [],
      emergence: [],
      steps: 2,
    };
    const first = (await (
      await call("/api/substrate/scenarios", scenario)
    ).json()) as {
      id: string;
      reproducibility: { inputHash: string; outputHash: string };
    };
    const second = (await (
      await call("/api/substrate/scenarios", {
        steps: 2,
        emergence: [],
        uncertainty: [],
        events: [],
        relationships: [],
        entities: [],
      })
    ).json()) as typeof first;
    expect(first.reproducibility).toEqual(second.reproducibility);
    const replay = (await (
      await call(`/api/substrate/scenarios/${first.id}/replay`, {})
    ).json()) as {
      matched: boolean;
      inputHash: string;
      actualOutputHash: string;
      id: string;
    };
    expect(replay.matched).toBe(true);
    expect(replay.inputHash).toBe(first.reproducibility.inputHash);
    expect(replay.actualOutputHash).toBe(first.reproducibility.outputHash);
    await expect(
      base.DB.prepare("DELETE FROM simulation_replays WHERE id=?")
        .bind(replay.id)
        .run(),
    ).rejects.toThrow();
    expect((await call("/api/operations/status")).status).toBe(200);
  });
  it("requires approval, policy and audit for recovery evidence and supports compensation", async () => {
    const before = await identity(base, "ecosystem:max");
    const p = await proposal("ecosystem:max", "recovery-record", {
      kind: "restore",
      outcome: "passed",
      source: "https://recovery.test/evidence",
      observedAt: new Date(Date.now() - 1000).toISOString(),
      summary: "Recorded restoration drill evidence",
    });
    await applyOperationalProposals(base);
    expect((await identity(base, "ecosystem:max"))?.state).toBe(before?.state);
    expect((await call(`/api/autonomy/${p.id}/approve`, {})).status).toBe(200);
    expect(
      await base.DB.prepare("SELECT id FROM universe_events WHERE id=?")
        .bind(`effect:${p.id}`)
        .first(),
    ).not.toBeNull();
    const operations = (await (
      await call("/api/operations/status")
    ).json()) as {
      recovery: { status: string; verification: string };
      monitoring: { governance: { auditGaps: number } };
    };
    expect(operations.recovery.status).toBe("CONNECTED");
    expect(operations.recovery.verification).toContain("Governor-approved");
    expect(operations.monitoring.governance.auditGaps).toBe(0);
    const rollback = await proposal("ecosystem:max", "rollback", {
      proposalId: p.id,
    });
    await call(`/api/autonomy/${rollback.id}/approve`, {});
    expect((await identity(base, "ecosystem:max"))?.state).toBe(before?.state);
    expect(
      (
        await call("/api/autonomy/proposals", {
          entityId: "product:completion",
          action: "promotion",
          input: {},
          evidence: proof,
        })
      ).status,
    ).toBe(422);
  });
  it("exposes conditional long-horizon plans and sourced Sports confidence without invented forecasts", async () => {
    const brief = (await (
      await call("/api/bemax?horizonMonths=24")
    ).json()) as {
      plan: { horizonMonths: number; mode: string };
      relatedDependencies: unknown;
    };
    expect(brief.plan.horizonMonths).toBe(24);
    expect(brief.plan.mode).toContain("not a revenue prediction");
    expect(brief.relatedDependencies).toBeDefined();
    expect((await call("/api/bemax?horizonMonths=0")).status).toBe(400);
    expect((await call("/api/sports/reports?type=simulation")).status).toBe(
      200,
    );
  });
});

it("does not reuse Sports connection evidence after feed configuration changes", async () => {
  const custom = {
    ...base,
    SPORTS_CONFIG: JSON.stringify({
      provider: "feed-config-a",
      leagues: ["NFL"],
    }),
    SPORTS_FEED: {
      fetch: async () =>
        Response.json({
          provider: "feed-config-a",
          production: true,
          records: [],
        }),
    } as unknown as Fetcher,
  };
  await refreshSports(custom);
  const { sportsHealth } = await import("../src/sports");
  expect((await sportsHealth(custom))?.status).toBe("observed");
  custom.SPORTS_CONFIG = JSON.stringify({
    provider: "feed-config-b",
    leagues: ["NFL"],
  });
  expect(await sportsHealth(custom)).toBeNull();
});

describe("Final completion acceptance contracts", () => {
  it("reports unconfigured credentials without a network request or cost reservation", async () => {
    await base.DB.prepare("DELETE FROM model_attempts").run();
    const custom = {
      ...base,
      MODEL_CONFIG: JSON.stringify({
        dailyBudgetMicrousd: 1000000,
        providers: [
          {
            id: "missing-key",
            kind: "openai",
            baseUrl: "https://model.test/v1",
            model: "fixture",
            inputMicrousdPerToken: 1,
            outputMicrousdPerToken: 1,
            maxInputBytes: 1000,
            maxOutputTokens: 100,
          },
        ],
      }),
    };
    const fetcher = vi.spyOn(globalThis, "fetch");
    const probe = (await (
      await call("/api/models/check", { providerId: "missing-key" }, custom)
    ).json()) as { status: string; completed: boolean };
    expect(probe).toMatchObject({ status: "UNCONFIGURED", completed: false });
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      await base.DB.prepare(
        "SELECT COUNT(*) AS count FROM model_attempts",
      ).first<number>("count"),
    ).toBe(0);
    expect(
      await base.DB.prepare(
        "SELECT id FROM universe_events WHERE type='model.unconfigured' AND source='missing-key'",
      ).first(),
    ).not.toBeNull();
    const capabilities = (await (
      await call("/api/models/capabilities", undefined, custom)
    ).json()) as { providers: { status: string; capabilities: string[] }[] };
    expect(capabilities.providers[0]).toMatchObject({
      status: "UNCONFIGURED",
      capabilities: ["text-generation"],
    });
    const operations = (await (
      await call("/api/operations/status", undefined, custom)
    ).json()) as { integrations: { id: string; status: string }[] };
    expect(
      operations.integrations.find((p) => p.id === "missing-key")?.status,
    ).toBe("BLOCKED");
  });
  it("exposes the search route and generates a review awaiting policy approval", async () => {
    expect((await call("/api/manifold/search?q=ecosystem")).status).toBe(200);
    const before = await identity(base, "ecosystem:max");
    const proposed = await call("/api/bemax/reviews", {
      question: "What matters most?",
    });
    expect(proposed.status).toBe(201);
    const p = (await proposed.json()) as { id: string };
    expect((await identity(base, "ecosystem:max"))?.state).toBe(before?.state);
    expect((await call(`/api/autonomy/${p.id}/approve`, {})).status).toBe(200);
    const after = await identity(base, "ecosystem:max");
    expect(JSON.parse(after!.state).strategicReview.summary).toContain(
      "What matters most?",
    );
    expect(
      await base.DB.prepare(
        "SELECT result FROM policy_checks WHERE proposal_id=?",
      )
        .bind(p.id)
        .first(),
    ).toMatchObject({ result: "passed" });
  });
  it("allows scoped review generation but never automation approval", async () => {
    const token = "synthetic-final-review-token",
      custom = {
        ...base,
        AUTOMATION_CREDENTIALS: JSON.stringify([
          {
            id: "strategic-review-generator",
            tokenSha256: await sha256(token),
            scopes: ["autonomy:propose"],
          },
        ]),
      };
    const response = await call("/api/bemax/reviews", {}, custom, token);
    expect(response.status).toBe(201);
    const p = (await response.json()) as { id: string };
    expect(
      (await call(`/api/autonomy/${p.id}/approve`, {}, custom, token)).status,
    ).toBe(403);
  });
  it("retains identity snapshots across effects and compensation while historical scenarios replay", async () => {
    const id = await project(),
      initial = await identity(base, id);
    const input = {
      entities: [
        {
          id,
          kind: "project",
          revision: initial!.revision,
          position: { x: 0, y: 0, z: 0 },
          values: { progress: 0 },
        },
      ],
      relationships: [],
      events: [],
      uncertainty: [],
      emergence: [],
      steps: 1,
    };
    const run = (await (
      await call("/api/substrate/scenarios", input)
    ).json()) as { id: string };
    const p = await proposal(id, "risk-escalation", {
      severity: "high",
      reason: "Observed dependency risk",
    });
    await call(`/api/autonomy/${p.id}/approve`, {});
    expect((await call("/api/substrate/scenarios", input)).status).toBe(409);
    const replay = (await (
      await call(`/api/substrate/scenarios/${run.id}/replay`, {})
    ).json()) as { matched: boolean };
    expect(replay.matched).toBe(true);
    const rollback = await proposal(id, "rollback", { proposalId: p.id });
    await call(`/api/autonomy/${rollback.id}/approve`, {});
    const history = (await (
      await call(`/api/icv/revisions?entityId=${id}`)
    ).json()) as { revisions: { revision: number; state: string }[] };
    expect(history.revisions.map((r) => r.revision)).toEqual([1, 2, 3]);
    expect(history.revisions[0].state).toBe(history.revisions[2].state);
    expect(JSON.parse(history.revisions[1].state).risk.severity).toBe("high");
    await expect(
      base.DB.prepare("DELETE FROM identity_revisions WHERE entity_id=?")
        .bind(id)
        .run(),
    ).rejects.toThrow();
    await expect(
      base.DB.prepare("UPDATE universe_identities SET state='{}' WHERE id=?")
        .bind(id)
        .run(),
    ).resolves.toBeDefined(); // exact no-op leaves revision unchanged
    await expect(
      base.DB.prepare(
        "UPDATE universe_identities SET state='{\"altered\":true}' WHERE id=?",
      )
        .bind(id)
        .run(),
    ).rejects.toThrow();
  });
  it("returns complete publication families beyond navigation depth and page limits", async () => {
    const body = {
      divisionId: "research:protocol",
      type: "publication",
      title: "Publication",
      source: "https://research.test/publication",
      evidence: proof,
    };
    let first = "",
      last = "";
    for (let i = 0; i < 105; i++) {
      const response = await call("/api/institute/outputs", {
        ...body,
        title: `Publication version ${i + 1}`,
        ...(last ? { predecessorId: last } : {}),
      });
      expect(response.status).toBe(201);
      last = ((await response.json()) as { id: string }).id;
      if (!first) first = last;
    }
    const found = new Set<string>();
    let page = 0,
      pages = 0;
    for (;;) {
      const response = await call(
        `/api/institute/history?entityId=${first}&page=${page}`,
      );
      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        researchRecords: { id: string; version: number }[];
        pagination: { nextPage: number | null };
      };
      for (const r of result.researchRecords) {
        expect(found.has(r.id)).toBe(false);
        found.add(r.id);
      }
      pages++;
      if (result.pagination.nextPage === null) break;
      page = result.pagination.nextPage;
      expect(pages).toBeLessThan(10);
    }
    expect(found.size).toBe(105);
    expect(found.has(last)).toBe(true);
    expect(pages).toBeGreaterThan(1);
    const spec = await call("/api/institute/outputs", {
      ...body,
      type: "specification",
      derivesFrom: [first],
    });
    expect(spec.status).toBe(201);
    const specId = ((await spec.json()) as { id: string }).id;
    const history = (await (
      await call(`/api/institute/history?entityId=${specId}`)
    ).json()) as { researchRecords: { id: string }[] };
    expect(history.researchRecords.map((r) => r.id)).toContain(first);
  });
});
