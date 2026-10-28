import { sha256 } from "../src/access";
import {
  env,
  applyD1Migrations,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Migration } from "@cloudflare/vitest-plugin";
import type { Env } from "../src/types";
import worker from "../src/index";
import { providers, providerHealth, routeProvider } from "../src/providers";
import type { Revision } from "../../../uss/contracts";
const bindings = env as unknown as Env & { TEST_MIGRATIONS: D1Migration[] };
beforeAll(async () => {
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
});
async function request(
  path: string,
  body?: unknown,
  custom: Env = bindings,
  token = "synthetic-test-token",
) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request(`https://portal.test/api/uss/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    custom,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}
const unknownConfidence = {
  confidence: null,
  probability: null,
  risk: "Unassessed",
  assumptions: [],
  range: null,
};
function proposal(
  registry = "research",
  overrides: Record<string, unknown> = {},
) {
  return {
    registry,
    title: "Evidence foundation",
    owner: "Institute",
    division: "substrate",
    lifecycle: "proposed",
    content: { statement: "Research evidence" },
    references: [],
    uncertainty: unknownConfidence,
    ...overrides,
  };
}
async function create(
  registry = "research",
  overrides: Record<string, unknown> = {},
) {
  const response = await request("records", proposal(registry, overrides));
  expect(response.status).toBe(201);
  return response.json() as Promise<Revision>;
}
async function approve(r: Revision) {
  expect(
    (
      await request(`records/${r.id}/review?version=${r.version}`, {
        reason: "Reviewed the evidence and dependencies",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`records/${r.id}/approve?version=${r.version}`, {
        reason: "Approved following evidence review",
      })
    ).status,
  ).toBe(200);
}
describe("USS acceptance and governance boundaries", () => {
  it("preserves lineage across revisions, stable identity, hashes and immutable snapshots", async () => {
    const research = await create();
    const framework = await create("framework", {
      references: [{ id: research.id, version: 1, relation: "derived_from" }],
    });
    const publication = await create("publication", {
      references: [{ id: framework.id, version: 1, relation: "derived_from" }],
    });
    const revised = await request(`records/${publication.id}`, {
      ...publication,
      title: "Revised publication",
      expectedVersion: 1,
    });
    expect(revised.status).toBe(201);
    const next = (await revised.json()) as Revision;
    expect(next.id).toBe(publication.id);
    expect(next.previousHash).toBe(publication.hash);
    const lineage = (await (
      await request(`records/${publication.id}/lineage`)
    ).json()) as { ancestors: Revision[] };
    expect(lineage.ancestors.map((r) => r.id)).toContain(research.id);
    expect(
      lineage.ancestors.filter((r) => r.id === publication.id),
    ).toHaveLength(2);
    expect(
      await (await request(`records/${publication.id}?version=1`)).json(),
    ).toEqual(publication);
    await expect(
      bindings.DB.prepare(
        "UPDATE uss_revisions SET snapshot=? WHERE identity_id=?",
      )
        .bind("{}", publication.id)
        .run(),
    ).rejects.toThrow("Immutable");
    await expect(
      bindings.DB.prepare("DELETE FROM uss_links WHERE source_id=?")
        .bind(publication.id)
        .run(),
    ).rejects.toThrow("Immutable");
  });
  it("rejects invalid references, malformed uncertainty and stale updates", async () => {
    expect(
      (
        await request(
          "records",
          proposal("framework", {
            references: [
              { id: "missing", version: 1, relation: "derived_from" },
            ],
          }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          "records",
          proposal("research", {
            uncertainty: { ...unknownConfidence, confidence: 2 },
          }),
        )
      ).status,
    ).toBe(400);
    const r = await create();
    expect(
      (await request(`records/${r.id}`, { ...r, expectedVersion: 0 })).status,
    ).toBe(409);
    const results = await Promise.all([
      request(`records/${r.id}`, { ...r, expectedVersion: 1 }),
      request(`records/${r.id}`, { ...r, expectedVersion: 1 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
  it("requires review, makes final decisions immutable and denies unauthenticated access", async () => {
    const r = await create();
    expect(
      (
        await request(`records/${r.id}/approve`, {
          reason: "Approval without review must fail",
        })
      ).status,
    ).toBe(409);
    await approve(r);
    expect(
      (
        await request(`records/${r.id}/reject`, {
          reason: "Cannot replace a final approval",
        })
      ).status,
    ).toBe(409);
    expect(
      (await request("overview", undefined, bindings, "invalid")).status,
    ).toBe(401);
    expect((await request("records", proposal("charter"))).status).toBe(400);
  });
  it("replays with matching provenance and stable entity references after revisions", async () => {
    const entity = await create("identity");
    const simulation = await create("simulation", {
      references: [{ id: entity.id, version: 1, relation: "simulates" }],
      content: {
        modelType: "forecast",
        modelVersion: "compound-growth-v1",
        inputs: { initial: 100, rate: 0.1, steps: 3 },
        source: "Synthetic acceptance fixture",
        confidence: {
          confidence: 0.6,
          probability: null,
          risk: "Scenario only",
          assumptions: ["Constant growth"],
          range: { lower: 90, upper: 150, unit: "units" },
        },
      },
    });
    expect(simulation.content).toMatchObject({
      runtime: "MAX-CORE Simulation",
      outputs: { ticks: 3 },
    });
    expect((await request(`records/${simulation.id}/replay`, {})).status).toBe(
      409,
    );
    await approve(simulation);
    expect(
      (
        await request(`records/${entity.id}`, {
          ...entity,
          expectedVersion: 1,
          lifecycle: "retired",
        })
      ).status,
    ).toBe(201);
    const first = (await (
      await request(`records/${simulation.id}/replay`, {})
    ).json()) as Record<string, unknown>;
    const second = (await (
      await request(`records/${simulation.id}/replay`, {})
    ).json()) as Record<string, unknown>;
    expect(first.reproducibilityHash).toBe(
      simulation.content.reproducibilityHash,
    );
    expect(second.reproducibilityHash).toBe(first.reproducibilityHash);
    expect(first.outputHash).toBe(second.outputHash);
    const graph = (await (await request("graph")).json()) as {
      edges: { target: string }[];
    };
    expect(graph.edges.some((e) => e.target === `uss:${entity.id}`)).toBe(true);
    expect(
      (await bindings.DB.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
  });
  it("blocks unapproved recovery and restores state through an auditable new revision", async () => {
    const original = await create();
    await approve(original);
    const changed = (await (
      await request(`records/${original.id}`, {
        ...original,
        expectedVersion: 1,
        content: { statement: "Incorrect later state" },
      })
    ).json()) as Revision;
    const rec = (await (
      await request(`records/${original.id}/recover`, {
        targetVersion: 1,
        reason: "Detected incorrect state in later revision",
      })
    ).json()) as { id: string };
    expect(
      (
        await request(`recoveries/${rec.id}/execute`, {
          reason: "Must not execute without approval",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(`recoveries/${rec.id}/approve`, {
          reason: "Must not approve without review",
        })
      ).status,
    ).toBe(409);
    for (const action of ["review", "approve", "execute"])
      expect(
        (
          await request(`recoveries/${rec.id}/${action}`, {
            reason: "Restore previously approved evidence",
          })
        ).status,
      ).toBe(200);
    const restored = (await (
      await request(`records/${original.id}`)
    ).json()) as Revision;
    expect(restored.id).toBe(original.id);
    expect(restored.version).toBe(3);
    expect(restored.content).toEqual(original.content);
    expect(restored.previousHash).toBe(changed.hash);
    expect(
      (
        await request(`recoveries/${rec.id}/execute`, {
          reason: "Cannot replay completed recovery",
        })
      ).status,
    ).toBe(409);
    const events = (await (
      await request(`records/${original.id}/events`)
    ).json()) as { kind: string }[];
    expect(events.map((e) => e.kind)).toEqual(
      expect.arrayContaining([
        "failure-detected",
        "recovery-recommended",
        "recovery-review",
        "recovery-approve",
        "compensation",
        "rollback-validated",
      ]),
    );
  });
  it("keeps proposed policies from executing and persists approved provider recovery validation", async () => {
    const config = providerEnv();
    const policy = await create("policy", {
      content: { operation: "provider-recovery", providerId: "primary" },
    });
    expect(
      (await request(`records/${policy.id}/execute`, {}, config)).status,
    ).toBe(409);
    await approve(policy);
    expect(
      (await request(`records/${policy.id}/execute`, {}, config)).status,
    ).toBe(200);
    const history = (await (
      await request("providers/primary/history", undefined, config)
    ).json()) as { kind: string }[];
    expect(history.map((h) => h.kind)).toContain("recovery");
  });
  it("requires evidence and exposes uncertainty and tradeoffs in strategic reviews", async () => {
    const r = await create();
    const result = (await (
      await request("reviews?type=risk-review")
    ).json()) as {
      recommendations: {
        identity: string;
        sources: string[];
        confidence: number | null;
        tradeoffs: string[];
      }[];
    };
    const review = result.recommendations.find((v) => v.identity === r.id)!;
    expect(review.sources[0]).toContain(r.id);
    expect(review.confidence).toBeNull();
    expect(review.tradeoffs.length).toBeGreaterThan(0);
  });
});
function providerEnv(
  options: { missing?: boolean; failure?: boolean } = {},
): Env {
  const config = ["primary", "fallback"].map((id, i) => ({
    id,
    name: id,
    type: i ? "local" : "openai",
    models: ["shared-model"],
    capabilities: ["reasoning"],
    credentialConfigured: !options.missing,
    enabled: true,
    budgetUsd: 10,
    staleAfterMs: 60000,
  }));
  return {
    ...bindings,
    INTELLIGENCE_PROVIDERS: JSON.stringify(config),
    INTELLIGENCE_GATEWAY: {
      fetch: async (_url: unknown, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        if (options.missing)
          throw new Error("Should not send missing credentials");
        if (options.failure && body.providerId === "primary")
          return Response.json({ error: "outage" }, { status: 503 });
        return Response.json({
          ...body,
          healthy: true,
          output: "Synthetic provider result",
          costUsd: 0.01,
        });
      },
    } as unknown as Fetcher,
  };
}
describe("Graph, event replay and role boundaries", () => {
  it("discovers directed dependencies and replays a verified timeline", async () => {
    const origin = await create();
    const framework = await create("framework", {
      references: [{ id: origin.id, version: 1, relation: "derived_from" }],
    });
    const analysis = (await (
      await request(
        `graph?root=uss:${framework.id}&analyse=true&target=uss:${origin.id}`,
      )
    ).json()) as { dependencies: string[]; shortestDependencyPath: string[] };
    expect(analysis.dependencies).toContain(`uss:${origin.id}`);
    expect(analysis.shortestDependencyPath).toEqual([
      `uss:${framework.id}`,
      `uss:${origin.id}`,
    ]);
    expect(
      await (await request(`records/${framework.id}/event-replay`)).json(),
    ).toMatchObject({ verifiedRevisions: 1, head: { id: framework.id } });
  });
  it("does not grant writes to staff readers or votes to non-members", async () => {
    const configured = {
      ...bindings,
      STAFF_CREDENTIALS: JSON.stringify([
        {
          id: "reader",
          role: "Read Only",
          tokenSha256: await sha256("reader-test"),
        },
      ]),
    };
    expect(
      (await request("overview", undefined, configured, "reader-test")).status,
    ).toBe(200);
    expect(
      (await request("records", proposal(), configured, "reader-test")).status,
    ).toBe(403);
    const r = await create();
    expect(
      (
        await request(`records/${r.id}/vote`, {
          vote: "for",
          council: "Research Council",
          reason: "Vote without membership must fail",
        })
      ).status,
    ).toBe(403);
    const membership = await create("membership", {
      lifecycle: "active",
      content: { member: "governor", council: "Research Council" },
    });
    await approve(membership);
    expect(
      (
        await request(`records/${r.id}/vote`, {
          vote: "for",
          council: "Research Council",
          reason: "Vote with approved membership",
        })
      ).status,
    ).toBe(200);
  });
});
describe("Provider acceptance", () => {
  it("does not fall back after a successful provider result when receipt storage fails", async () => {
    const configured = providerEnv();
    const gateway = configured.INTELLIGENCE_GATEWAY!;
    const send = vi.fn((...args: Parameters<Fetcher["fetch"]>) =>
      gateway.fetch(...args),
    );
    configured.INTELLIGENCE_GATEWAY = { fetch: send } as unknown as Fetcher;
    configured.DB = {
      prepare: bindings.DB.prepare.bind(bindings.DB),
      batch: async () => {
        throw new Error("Synthetic receipt storage outage");
      },
    } as unknown as D1Database;
    await expect(
      routeProvider(
        configured,
        "reasoning",
        "shared-model",
        {},
        "receipt-storage-failure",
      ),
    ).rejects.toThrow("Synthetic receipt storage outage");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("invalidates stale health evidence when configuration changes", async () => {
    const configured = providerEnv();
    await providerHealth(configured, "primary");
    const configs = JSON.parse(configured.INTELLIGENCE_PROVIDERS!);
    configs[0].models = ["changed-model"];
    configured.INTELLIGENCE_PROVIDERS = JSON.stringify(configs);
    expect((await providers(configured))[0].status).toBe("STALE");
    expect((await providerHealth(configured, "primary")).status).toBe(
      "CONNECTED",
    );
  });
  it("reports CONNECTED only after valid health evidence", async () => {
    const configured = providerEnv();
    expect((await providerHealth(configured, "primary")).status).toBe(
      "CONNECTED",
    );
  });
  it("reports UNCONFIGURED and does not send a request", async () => {
    const missing = providerEnv({ missing: true });
    const send = vi.fn(() => {
      throw new Error("Must not be called");
    });
    missing.INTELLIGENCE_GATEWAY = { fetch: send } as unknown as Fetcher;
    expect((await providerHealth(missing, "primary")).status).toBe(
      "UNCONFIGURED",
    );
    expect(send).not.toHaveBeenCalled();
    // Historical successes survive credential removal; only current status changes.
    expect((await providers(missing))[0].credentialStatus).toBe("missing");
  });
  it("falls back after failure and preserves outage, routing and cost history", async () => {
    const configured = providerEnv({ failure: true });
    const result = await routeProvider(
      configured,
      "reasoning",
      "shared-model",
      { prompt: "Synthetic" },
      "fallback-acceptance",
    );
    expect(result.providerId).toBe("fallback");
    const rows = await bindings.DB.prepare(
      "SELECT kind FROM provider_observations WHERE operation_id='fallback-acceptance'",
    ).all<{ kind: string }>();
    expect(rows.results.map((r) => r.kind)).toEqual(
      expect.arrayContaining(["failure", "routing", "cost", "success"]),
    );
  });
});
