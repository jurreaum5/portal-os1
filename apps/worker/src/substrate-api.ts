import { analyseSubstrateGraph } from "../../../portal-os/substrate-graph";
import type { Env } from "./types";
import { staffIdentity } from "./access";
import { readObject } from "./customer-auth";
import {
  registries,
  divisions,
  councils,
  object,
  text,
} from "../../../uss/contracts";
import { topology } from "../../../portal-os/universe";
import { strategicReview } from "../../../portal-os/substrate-intelligence";
import {
  approved,
  bounded,
  decide,
  event,
  fail,
  lineage,
  revision,
  saveRevision,
  substrateGraph,
  SubstrateError,
  replayEvents,
} from "./substrate";
import { simulationContent, replay } from "./substrate-simulation";
import { recommendRecovery, recoveryAction } from "./substrate-recovery";
import {
  providers,
  providerHealth,
  providerHistory,
  routeProvider,
} from "./providers";
export async function substrateApi(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url),
    path = url.pathname;
  if (!path.startsWith("/api/uss/")) return null;
  const identity = await staffIdentity(request, env);
  if (!identity)
    return Response.json({ error: "Staff sign-in required" }, { status: 401 });
  if (request.method !== "GET" && identity.role !== "Governor")
    return Response.json(
      { error: "Governor permission required" },
      { status: 403 },
    );
  try {
    const actor = identity.id;
    const get = request.method === "GET";
    if (!get && request.method !== "POST") fail("Method not allowed", 405);
    const input = get
      ? {}
      : await readObject(request).catch(() =>
          fail("Expected a JSON object up to 16 KiB"),
        );
    const versionParam = url.searchParams.get("version");
    const version = versionParam === null ? undefined : Number(versionParam);
    if (
      version !== undefined &&
      (!Number.isSafeInteger(version) || version < 1)
    )
      fail("Invalid revision");
    if (path === "/api/uss/overview" && get) {
      const counts = await bounded(
        env,
        "SELECT registry,COUNT(*) AS count FROM uss_identities GROUP BY registry LIMIT 5001",
      );
      return Response.json({
        registries,
        divisions,
        councils,
        counts,
        providers: await providers(env),
        authority: ["Research", "Standards", "Protocol", "Governance"],
        layers: {
          "MAX-CORE": "Execution",
          USS: "Shared Reality",
          MANIFOLD: "Universe Navigation",
          ICV: "Identity",
          BEMAX: "Intelligence",
          ICVS: "Governance",
          "Portal-OS1": "Operating System",
        },
      });
    }
    if (path === "/api/uss/providers" && get)
      return Response.json(await providers(env));
    const provider = path.match(
      /^\/api\/uss\/providers\/([^/]+)\/(health|history)$/,
    );
    if (provider) {
      const id = decodeURIComponent(provider[1]);
      if (provider[2] === "history" && get)
        return Response.json(await providerHistory(env, id));
      if (provider[2] === "health" && !get)
        return Response.json(await providerHealth(env, id));
      fail("Method not allowed", 405);
    }
    if (path === "/api/uss/graph" && get) {
      const graph = await substrateGraph(env),
        root = url.searchParams.get("root");
      const depth = Number(url.searchParams.get("depth") ?? 4);
      if (!Number.isInteger(depth) || depth < 0 || depth > 8)
        fail("Depth must be 0–8");
      if (root && !graph.nodes.some((n) => n.id === root))
        fail("Graph root not found", 404);
      if (root && url.searchParams.get("analyse") === "true")
        return Response.json(
          analyseSubstrateGraph(
            graph.edges,
            root,
            url.searchParams.get("target") ?? undefined,
          ),
        );
      return Response.json(
        root ? topology(graph.nodes, graph.edges, root, depth) : graph,
      );
    }
    if (path === "/api/uss/records") {
      if (get) {
        const registry = url.searchParams.get("registry");
        if (registry && !(registries as readonly string[]).includes(registry))
          fail("Unknown registry");
        const rows = await bounded<{
          snapshot: string;
          decision: string | null;
        }>(
          env,
          `SELECT r.snapshot,d.action AS decision FROM uss_revisions r JOIN uss_identities i ON i.id=r.identity_id LEFT JOIN uss_decisions d ON d.identity_id=r.identity_id AND d.version=r.version WHERE r.version=(SELECT MAX(version) FROM uss_revisions WHERE identity_id=r.identity_id) ${registry ? "AND i.registry=?" : ""} ORDER BY r.created_at DESC LIMIT 5001`,
          ...(registry ? [registry] : []),
        );
        return Response.json(
          rows.map((r) => ({
            ...JSON.parse(r.snapshot),
            decision: r.decision ?? "pending",
          })),
        );
      }
      if (input.registry === "simulation" && object(input.content))
        input.content = await simulationContent(input.content);
      return Response.json(await saveRevision(env, input, actor), {
        status: 201,
      });
    }
    const record = path.match(
      /^\/api\/uss\/records\/([^/]+)(?:\/(history|lineage|events|event-replay|review|vote|approve|reject|override|replay|recover|execute))?$/,
    );
    if (record) {
      const id = decodeURIComponent(record[1]),
        action = record[2];
      const current = await revision(env, id, version);
      if (!action && get) return Response.json(current);
      if (!action && !get) {
        if (version !== undefined)
          fail("Revisions must extend the current head");
        if (current.registry === "simulation" && object(input.content))
          input.content = await simulationContent(input.content);
        return Response.json(await saveRevision(env, input, actor, current), {
          status: 201,
        });
      }
      if (action === "event-replay" && get)
        return Response.json(await replayEvents(env, id));
      if (action === "history" && get)
        return Response.json(
          await bounded(
            env,
            "SELECT r.snapshot,d.action AS decision,d.actor AS decisionActor,d.reason AS decisionReason FROM uss_revisions r LEFT JOIN uss_decisions d ON d.identity_id=r.identity_id AND d.version=r.version WHERE r.identity_id=? ORDER BY r.version LIMIT 5001",
            id,
          ),
        );
      if (action === "lineage" && get)
        return Response.json(await lineage(env, id));
      if (action === "events" && get)
        return Response.json(
          await bounded(
            env,
            "SELECT * FROM uss_events WHERE identity_id=? ORDER BY sequence LIMIT 5001",
            id,
          ),
        );
      if (get) fail("Method not allowed", 405);
      if (["review", "vote"].includes(action)) {
        if (!text(input.reason, 2000) || input.reason.trim().length < 10)
          fail("A review reason of 10–2000 characters required");
        if (
          action === "vote" &&
          !["for", "against", "abstain"].includes(String(input.vote))
        )
          fail("Vote must be for, against or abstain");
        if (
          action === "vote" &&
          !(councils as readonly unknown[]).includes(input.council)
        )
          fail("Council required");
        if (action === "vote" && input.council !== "Governor") {
          const member = await env.DB.prepare(
            `SELECT r.identity_id FROM uss_revisions r JOIN uss_identities i ON i.id=r.identity_id JOIN uss_decisions d ON d.identity_id=r.identity_id AND d.version=r.version WHERE i.registry='membership' AND r.version=(SELECT MAX(version) FROM uss_revisions WHERE identity_id=r.identity_id) AND d.action IN ('approve','override') AND json_extract(r.snapshot,'$.content.member')=? AND json_extract(r.snapshot,'$.content.council')=? AND json_extract(r.snapshot,'$.lifecycle')='active' LIMIT 1`,
          )
            .bind(actor, input.council)
            .first();
          if (!member)
            fail("An approved active council membership is required", 403);
        }
        await event(env, id, current.version, action, actor, {
          reason: input.reason,
          ...(action === "vote"
            ? { vote: input.vote, council: input.council }
            : {}),
        }).run();
        return Response.json({ recorded: true });
      }
      if (["approve", "reject", "override"].includes(action))
        return Response.json(
          await decide(env, id, current.version, actor, action, input.reason),
        );
      if (action === "replay")
        return Response.json(await replay(env, current, actor));
      if (action === "recover")
        return Response.json(
          await recommendRecovery(
            env,
            id,
            current.version,
            input.targetVersion,
            input.reason,
            actor,
          ),
          { status: 201 },
        );
      if (action === "execute") {
        if (
          current.registry !== "policy" ||
          !(await approved(env, id, current.version))
        )
          fail("An approved operation policy is required", 409);
        const c = current.content;
        if (
          !["provider-recovery", "provider-inference"].includes(
            String(c.operation),
          )
        )
          fail("Unsupported operation policy");
        if (c.operation === "provider-recovery" && !text(c.providerId))
          fail("Provider ID required");
        if (
          c.operation === "provider-inference" &&
          (!text(c.capability) || !text(c.model) || !object(c.input))
        )
          fail("Capability, model and input required");
        const previous = await env.DB.prepare(
          "SELECT status,result FROM uss_operations WHERE identity_id=? AND version=?",
        )
          .bind(id, current.version)
          .first<{ status: string; result: string | null }>();
        if (previous) {
          if (previous.status === "validated")
            return Response.json(JSON.parse(previous.result!));
          fail(
            "Operation already attempted; inspect events and propose a new reviewed revision",
            409,
          );
        }
        try {
          await env.DB.batch([
            env.DB.prepare(
              "INSERT INTO uss_operations(identity_id,version,status,created_at) VALUES (?,?,'executing',?)",
            ).bind(id, current.version, new Date().toISOString()),
            event(env, id, current.version, "execution-started", actor, {
              operation: c.operation,
            }),
          ]);
        } catch (error) {
          if (String(error).includes("UNIQUE constraint"))
            fail("Operation already claimed", 409);
          throw error;
        }
        try {
          const operationId = `${id}:${current.version}`;
          const result =
            c.operation === "provider-recovery"
              ? await providerHealth(
                  env,
                  String(c.providerId),
                  operationId,
                  true,
                )
              : await routeProvider(
                  env,
                  String(c.capability),
                  String(c.model),
                  c.input,
                  operationId,
                );
          if ("status" in result && result.status !== "CONNECTED")
            fail("Provider recovery validation failed", 503);
          await env.DB.batch([
            env.DB.prepare(
              "UPDATE uss_operations SET status='validated',result=? WHERE identity_id=? AND version=?",
            ).bind(JSON.stringify(result), id, current.version),
            event(env, id, current.version, "execution-validated", actor, {
              operation: c.operation,
              operationId,
            }),
          ]);
          return Response.json(result);
        } catch (error) {
          await env.DB.batch([
            env.DB.prepare(
              "UPDATE uss_operations SET status='failed' WHERE identity_id=? AND version=?",
            ).bind(id, current.version),
            event(env, id, current.version, "execution-failed", actor, {
              reason:
                "Adapter or persistence failed; reconciliation required before another operation.",
            }),
          ]);
          throw error;
        }
      }
    }
    const recovery = path.match(
      /^\/api\/uss\/recoveries\/([^/]+)\/(review|approve|reject|override|execute)$/,
    );
    if (recovery && !get)
      return Response.json(
        await recoveryAction(
          env,
          decodeURIComponent(recovery[1]),
          recovery[2],
          actor,
          input.reason,
        ),
      );
    if (path === "/api/uss/recoveries" && get)
      return Response.json(
        await bounded(
          env,
          "SELECT * FROM uss_recoveries ORDER BY created_at DESC LIMIT 5001",
        ),
      );
    if (path === "/api/uss/reviews" && get) {
      const type = url.searchParams.get("type") ?? "strategic-brief";
      if (
        ![
          "strategic-brief",
          "executive-summary",
          "opportunity-review",
          "risk-review",
          "governed-review",
        ].includes(type)
      )
        fail("Unknown review type");
      const rows = await bounded<{ snapshot: string }>(
        env,
        "SELECT snapshot FROM uss_revisions r WHERE version=(SELECT MAX(version) FROM uss_revisions WHERE identity_id=r.identity_id) LIMIT 5001",
      );
      return Response.json(
        strategicReview(
          rows.map((r) => JSON.parse(r.snapshot)),
          type,
        ),
      );
    }
    return fail("USS route not found", 404);
  } catch (error) {
    if (error instanceof SubstrateError)
      return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
