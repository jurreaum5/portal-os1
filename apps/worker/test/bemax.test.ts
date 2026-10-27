import { env, SELF, applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import type { D1Migration } from "@cloudflare/vitest-plugin";
import type { Env } from "../src/types";
import { bemaxApi } from "../src/bemax-api";
import { manifoldApi } from "../src/manifold-api";
import { sha256 } from "../src/access";
import { generate } from "../src/bemax-providers";
const bindings = env as unknown as Env & { TEST_MIGRATIONS: D1Migration[] };
const headers = {
  Authorization: "Bearer synthetic-test-token",
  "Content-Type": "application/json",
};
const get = (path: string) =>
  SELF.fetch(`https://portal.test${path}`, { headers });
const post = (path: string, body: unknown) =>
  SELF.fetch(`https://portal.test${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
beforeAll(async () => {
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
  await bindings.DB.prepare(
    "INSERT INTO products(id,name,description,stage,score) VALUES ('bemax-product','BEMAX fixture','Synthetic test product','Ready',91)",
  ).run();
});
describe("BEMAX runtime contracts", () => {
  it("preserves identity and appends history across lifecycle and revenue updates", async () => {
    const before = await bindings.DB.prepare(
      "SELECT * FROM icv_entities WHERE id='product:bemax-product'",
    ).first<any>();
    await bindings.DB.prepare(
      "UPDATE products SET stage='Published',revenue=120 WHERE id='bemax-product'",
    ).run();
    const after = await bindings.DB.prepare(
      "SELECT * FROM icv_entities WHERE id='product:bemax-product'",
    ).first<any>();
    expect(after.id).toBe(before.id);
    expect(after.created_at).toBe(before.created_at);
    expect(after.revision).toBe(before.revision + 1);
    const twin = await (
      await get("/api/universe/twins/product%3Abemax-product")
    ).json<any>();
    expect(twin.history.length).toBeGreaterThanOrEqual(2);
    expect(twin.live.revenue).toBe(120);
  });
  it("persists conversation and idempotent retries and rejects changed retry payloads", async () => {
    const body = {
      message: "What needs attention?",
      requestId: "conversation-retry",
    };
    const first = await post("/api/bemax/chat", body);
    expect(first.status).toBe(201);
    const a = await first.json<any>();
    const retry = await post("/api/bemax/chat", body);
    expect(retry.status).toBe(200);
    expect((await retry.json<any>()).conversationId).toBe(a.conversationId);
    expect(
      (await post("/api/bemax/chat", { ...body, message: "Different" })).status,
    ).toBe(409);
    const history = await (
      await get(`/api/bemax/conversations/${a.conversationId}`)
    ).json<any>();
    expect(history.messages).toHaveLength(2);
    expect(a.evidence.reasoning[0]).toHaveProperty("tradeoffs");
    expect(
      (await (await get("/api/bemax/memory")).json<any[]>()).length,
    ).toBeGreaterThan(0);
  });
  it("isolates conversations, private memories and identities by named staff actor", async () => {
    const a = await (
      await post("/api/bemax/chat", {
        message: "Summarize",
        requestId: "private-chat",
      })
    ).json<any>();
    const mem = await (
      await post("/api/bemax/memory", {
        kind: "strategy",
        content: "A private strategic choice",
      })
    ).json<any>();
    const other = {
      ...bindings,
      STAFF_CREDENTIALS: JSON.stringify([
        {
          id: "other",
          role: "Governor",
          tokenSha256: await sha256("other-secret"),
        },
      ]),
    };
    const request = (path: string) =>
      new Request(`https://portal.test${path}`, {
        headers: { Authorization: "Bearer other-secret" },
      });
    expect(
      (await bemaxApi(
        request(`/api/bemax/conversations/${a.conversationId}`),
        other,
      ))!.status,
    ).toBe(404);
    expect(
      await (await bemaxApi(request("/api/bemax/memory"), other))!.json(),
    ).toEqual([]);
    expect(
      (await manifoldApi(
        request(`/api/universe/twins/${encodeURIComponent(mem.entityId)}`),
        other,
      ))!.status,
    ).toBe(404);
    const identities = await (await manifoldApi(
      request("/api/universe/identities"),
      other,
    ))!.json<any>();
    expect(identities.entities.some((e: any) => e.id === mem.entityId)).toBe(
      false,
    );
  });
  it("enforces Governor decisions and records report results without changing products", async () => {
    const proposal = await (
      await post("/api/bemax/actions", {
        kind: "Generate Report",
        rationale: "Review current portfolio evidence",
      })
    ).json<any>();
    expect(
      (
        await SELF.fetch(
          `https://portal.test/api/bemax/actions/${proposal.id}/approve`,
          { method: "POST", body: "{}" },
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await post(`/api/bemax/actions/${proposal.id}/override`, {
          reason: "short",
        })
      ).status,
    ).toBe(400);
    const decision = await post(`/api/bemax/actions/${proposal.id}/approve`, {
      reason: "Approved for portfolio review",
    });
    expect(decision.status).toBe(200);
    expect((await decision.json<any>()).result.execution).toBe("completed");
    expect(
      (
        await post(`/api/bemax/actions/${proposal.id}/reject`, {
          reason: "Trying to change final decision",
        })
      ).status,
    ).toBe(409);
    const m = await bindings.DB.prepare(
      "SELECT COUNT(*) AS n FROM bemax_memory WHERE kind='governor-action' AND content LIKE ?",
    )
      .bind(`%${proposal.id}%`)
      .first<number>("n");
    expect(m).toBe(1);
  });
  it("does not bypass ICVS publishing evidence when approving a proposed action", async () => {
    const proposal = await (
      await post("/api/bemax/actions", {
        kind: "Publish Product",
        entityId: "product:bemax-product",
        rationale: "Review verified publishing evidence",
      })
    ).json<any>();
    const decision = await (
      await post(`/api/bemax/actions/${proposal.id}/approve`, {
        reason: "Review this through the ICVS gate",
      })
    ).json<any>();
    expect(decision.result.execution).toBe("requires-icvs-review");
  });
  it("rejects malformed input and unknown providers", async () => {
    expect((await post("/api/bemax/chat", [])).status).toBe(400);
    expect(
      (
        await post("/api/bemax/chat", {
          message: "Hi",
          requestId: "invalid",
          provider: "unknown",
        })
      ).status,
    ).toBe(400);
    expect(
      (await post("/api/bemax/chat", { message: "x".repeat(17000) })).status,
    ).toBe(400);
  });
  it("exposes all stages, sports, valid graph edges and spatial contracts", async () => {
    const g = await (await get("/api/universe/graph")).json<any>();
    const ids = new Set(g.nodes.map((n: any) => n.id));
    expect(ids.has("division:max-sports")).toBe(true);
    expect(ids.has("pipeline:Research")).toBe(true);
    expect(
      g.edges.every((e: any) => ids.has(e.source) && ids.has(e.target)),
    ).toBe(true);
    expect(g.nodes.every((n: any) => Number.isFinite(n.position.x))).toBe(true);
    expect((await get("/api/universe/topology?root=bad")).status).toBe(404);
    expect((await get("/api/universe/graph?depth=5")).status).toBe(400);
    const pipeline = await (await get("/api/universe/pipeline")).json<any>();
    expect(
      pipeline.stages.find((s: any) => s.stage === "Research").daysToClear,
    ).toBeNull();
    const sports = await (
      await get("/api/xr/max-sports-intelligence-center")
    ).json<any>();
    expect(sports.nodes.some((n: any) => n.label === "MAX NFL")).toBe(true);
    expect(
      (await bindings.DB.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
  });
  it("accepts replaceable local model bindings and fails closed on malformed output", async () => {
    let received: any;
    const local = {
      fetch: async (_url: string, init: RequestInit) => {
        received = JSON.parse(init.body as string);
        return Response.json({ text: "Evidence-based advice" });
      },
    } as unknown as Fetcher;
    expect(
      await generate(
        { ...bindings, BEMAX_LOCAL: local },
        "local",
        "Synthetic context",
      ),
    ).toBe("Evidence-based advice");
    expect(received.system).toContain("Governor controls decisions");
    const bad = {
      fetch: async () => Response.json({ tool: "publish" }),
    } as unknown as Fetcher;
    await expect(
      generate({ ...bindings, BEMAX_MAX: bad }, "max", "context"),
    ).rejects.toThrow("Invalid provider response");
  });
});

describe("BEMAX concurrency and roles", () => {
  it("commits only one decision under concurrent approval/rejection", async () => {
    const p = await (
      await post("/api/bemax/actions", {
        kind: "Create Forecast",
        rationale: "Compare current baseline forecast",
      })
    ).json<any>();
    const results = await Promise.all(
      ["approve", "reject"].map((d) =>
        post(`/api/bemax/actions/${p.id}/${d}`, {
          reason: "Concurrent Governor review decision",
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await bindings.DB.prepare(
        "SELECT COUNT(*) AS n FROM bemax_memory WHERE kind='governor-action' AND content LIKE ?",
      )
        .bind(`%${p.id}%`)
        .first<number>("n"),
    ).toBe(1);
  });
  it("deduplicates simultaneous chat retries", async () => {
    const results = await Promise.all(
      [1, 2].map(() =>
        post("/api/bemax/chat", {
          message: "What should be published?",
          requestId: "concurrent-retry",
        }),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    const bodies = await Promise.all(results.map((r) => r.json<any>()));
    expect(bodies[0].conversationId).toBe(bodies[1].conversationId);
  });
  it("allows staff conversation but refuses staff decisions", async () => {
    const config = {
      ...bindings,
      STAFF_CREDENTIALS: JSON.stringify([
        {
          id: "reader",
          role: "Read Only",
          tokenSha256: await sha256("reader-secret"),
        },
      ]),
    };
    const req = (path: string, body: unknown) =>
      new Request(`https://portal.test${path}`, {
        method: "POST",
        headers: { Authorization: "Bearer reader-secret" },
        body: JSON.stringify(body),
      });
    const response = await bemaxApi(
      req("/api/bemax/chat", { message: "Summarize", requestId: "staff-chat" }),
      config,
    );
    expect(response!.status).toBe(201);
    expect(
      (await bemaxApi(
        req("/api/bemax/actions", {
          kind: "Generate Report",
          rationale: "Reader request",
        }),
        config,
      ))!.status,
    ).toBe(403);
  });
});

describe("Native model protocol adapters", () => {
  it.each([
    [
      "openai",
      "api.openai.com",
      { choices: [{ message: { content: "OpenAI fixture" } }] },
      "OpenAI fixture",
    ],
    [
      "gemini",
      "generativelanguage.googleapis.com",
      { candidates: [{ content: { parts: [{ text: "Gemini fixture" }] } }] },
      "Gemini fixture",
    ],
    [
      "anthropic",
      "api.anthropic.com",
      { content: [{ type: "text", text: "Claude fixture" }] },
      "Claude fixture",
    ],
  ] as const)(
    "normalizes %s without granting execution authority",
    async (provider, host, body, expected) => {
      let sent: any;
      let endpoint = "";
      const transport = (async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        endpoint = String(input);
        sent = JSON.parse(init!.body as string);
        return Response.json(body);
      }) as typeof fetch;
      const config = {
        ...bindings,
        OPENAI_API_KEY: "synthetic",
        OPENAI_MODEL: "fixture",
        GEMINI_API_KEY: "synthetic",
        GEMINI_MODEL: "fixture",
        ANTHROPIC_API_KEY: "synthetic",
        ANTHROPIC_MODEL: "fixture",
      };
      expect(
        await generate(config, provider, "Supplied evidence", transport),
      ).toBe(expected);
      expect(new URL(endpoint).host).toBe(host);
      expect(sent.tools).toBeUndefined();
      expect(JSON.stringify(sent)).toContain("Supplied evidence");
    },
  );
  it("falls back to evidence when the configured model fails", async () => {
    const config = {
      ...bindings,
      BEMAX_MAX: {
        fetch: async () => new Response("unavailable", { status: 503 }),
      } as unknown as Fetcher,
    };
    const request = new Request("https://portal.test/api/bemax/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "What needs attention?",
        requestId: "failed-model",
        provider: "max",
      }),
    });
    const result = await (await bemaxApi(request, config))!.json<any>();
    expect(result.evidence.provider).toBe("evidence");
    expect(result.evidence.providerError).toContain("unavailable");
  });
});
describe("Sports intelligence source ingestion", () => {
  it("persists immutable source observations and exposes them in the manifold", async () => {
    const body = {
      id: "sports-fixture",
      subdivision: "MAX NFL",
      module: "Team Intelligence",
      subject: "Synthetic team",
      summary: "Synthetic scouting observation for contract testing.",
      source: "Synthetic test fixture",
      observedAt: new Date().toISOString(),
    };
    expect((await post("/api/universe/sports/observations", body)).status).toBe(
      201,
    );
    expect((await post("/api/universe/sports/observations", body)).status).toBe(
      200,
    );
    expect(
      (
        await post("/api/universe/sports/observations", {
          ...body,
          summary: "Changed observation",
        })
      ).status,
    ).toBe(409);
    const data = await (
      await get("/api/universe/sports?module=Team%20Intelligence")
    ).json<any>();
    expect(data.observations.some((o: any) => o.id === body.id)).toBe(true);
    const g = await (
      await get("/api/xr/max-sports-intelligence-center")
    ).json<any>();
    expect(
      g.nodes.some((n: any) => n.id === "sports-observation:sports-fixture"),
    ).toBe(true);
    const twin = await (
      await get("/api/universe/twins/sports-observation%3Asports-fixture")
    ).json<any>();
    expect(twin.identity.kind).toBe("sports-observation");
  });
});
