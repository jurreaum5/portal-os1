import type { Env } from "./types";
import { staffIdentity, sha256 } from "./access";
import { readObject } from "./customer-auth";
import { readUniverse } from "./universe-api";
import { actionKinds, answer, reason } from "../../../portal-os/bemax";
import { revenueScenarios } from "../../../portal-os/universe";
import {
  generate,
  providerCatalog,
  providerNames,
  type ProviderName,
} from "./bemax-providers";
import { operationalApi } from "./operations";
const json = (data: unknown, status = 200) => Response.json(data, { status });
const str = (value: unknown, max = 4000): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
export async function bemaxApi(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url),
    path = url.pathname;
  if (!path.startsWith("/api/bemax")) return null;
  const actor = await staffIdentity(request, env);
  if (!actor) return json({ error: "Staff sign-in required" }, 401);
  try {
    if (request.method === "GET") {
      if (path === "/api/bemax/providers") return json(providerCatalog(env));
      if (path === "/api/bemax/conversations")
        return json(
          (
            await env.DB.prepare(
              "SELECT * FROM bemax_conversations WHERE owner=? ORDER BY created_at DESC,id DESC LIMIT 100",
            )
              .bind(actor.id)
              .all()
          ).results,
        );
      if (path === "/api/bemax/memory")
        return json(
          (
            await env.DB.prepare(
              "SELECT * FROM bemax_memory WHERE owner=? ORDER BY rowid DESC LIMIT 100",
            )
              .bind(actor.id)
              .all()
          ).results,
        );
      if (path === "/api/bemax/actions")
        return json(
          (
            await env.DB.prepare(
              "SELECT * FROM bemax_actions WHERE owner=? ORDER BY rowid DESC LIMIT 100",
            )
              .bind(actor.id)
              .all()
          ).results,
        );
      const conversation = path.match(/^\/api\/bemax\/conversations\/([^/]+)$/);
      if (conversation) {
        const id = decodeURIComponent(conversation[1]);
        if (
          !(await env.DB.prepare(
            "SELECT id FROM bemax_conversations WHERE id=? AND owner=?",
          )
            .bind(id, actor.id)
            .first())
        )
          return json({ error: "Conversation not found" }, 404);
        const before = Number(
          url.searchParams.get("before") ?? Number.MAX_SAFE_INTEGER,
        );
        if (!Number.isSafeInteger(before) || before < 1)
          return json({ error: "Invalid cursor" }, 400);
        const messages = (
          await env.DB.prepare(
            "SELECT * FROM bemax_messages WHERE conversation_id=? AND sequence<? ORDER BY sequence DESC LIMIT 100",
          )
            .bind(id, before)
            .all()
        ).results.reverse();
        return json({
          id,
          messages,
          nextBefore: messages.length === 100 ? messages[0].sequence : null,
        });
      }
      return json({ error: "BEMAX route not found" }, 404);
    }
    if (request.method !== "POST")
      return json({ error: "Method not allowed" }, 405);
    const b = await readObject(request).catch(() => {
      throw new SyntaxError("Invalid JSON object");
    });
    if (path === "/api/bemax/chat") {
      if (!str(b.message) || !str(b.requestId, 120))
        return json(
          { error: "message and stable requestId are required" },
          400,
        );
      const provider = (b.provider ?? "evidence") as ProviderName;
      if (
        !providerNames.includes(provider) ||
        !providerCatalog(env).find((p) => p.id === provider)?.configured
      )
        return json({ error: "Provider is not configured" }, 400);
      let id = b.conversationId;
      if (id !== undefined && !str(id, 120))
        return json({ error: "Invalid conversation id" }, 400);
      if (
        id &&
        !(await env.DB.prepare(
          "SELECT id FROM bemax_conversations WHERE id=? AND owner=?",
        )
          .bind(id, actor.id)
          .first())
      )
        return json({ error: "Conversation not found" }, 404);
      // Request IDs are namespaced by actor; retries never create a second turn.
      const turnId = await sha256(JSON.stringify([actor.id, b.requestId]));
      const existing = await env.DB.prepare(
        "SELECT m.conversation_id AS conversationId,m.content,m.evidence FROM bemax_messages m JOIN bemax_conversations c ON c.id=m.conversation_id WHERE m.id=? AND c.owner=?",
      )
        .bind(`${turnId}:assistant`, actor.id)
        .first<{ conversationId: string; content: string; evidence: string }>();
      if (existing) {
        const original = await env.DB.prepare(
          "SELECT content FROM bemax_messages WHERE id=?",
        )
          .bind(`${turnId}:user`)
          .first<string>("content");
        if (original !== b.message || (id && id !== existing.conversationId))
          return json({ error: "Request id already used" }, 409);
        return json({
          ...existing,
          evidence: JSON.parse(existing.evidence),
          reused: true,
        });
      }
      const u = await readUniverse(env),
        reasoning = reason(u);
      const depts = await operationalApi(
        new Request("https://portal.internal/api/departments"),
        env,
      );
      const departments = (await depts!.json()) as {
        id: string;
        backlog: number;
        capacity: number | null;
        workload: number;
        recommendations: string[];
      }[];
      for (const d of departments.filter((d) => d.backlog > 0))
        reasoning.push({
          domain: "resource",
          title: `Review ${d.id} capacity`,
          why:
            d.recommendations.join(" ") ||
            "Queued work warrants a capacity review.",
          evidence: [
            `Backlog: ${d.backlog}`,
            `Capacity: ${d.capacity ?? "unknown"}`,
            `Workload: ${d.workload}`,
          ],
          sources: ["/api/departments"],
          confidence:
            "Observed queue; capacity is configured, not measured throughput",
          tradeoffs: "Moving resources can reduce capacity elsewhere.",
          entityId: `department:${d.id}`,
        });
      const memory = (
        await env.DB.prepare(
          "SELECT kind,content FROM bemax_memory WHERE owner=? ORDER BY rowid DESC LIMIT 12",
        )
          .bind(actor.id)
          .all<{ kind: string; content: string }>()
      ).results;
      const history = id
        ? (
            await env.DB.prepare(
              "SELECT role,content FROM bemax_messages WHERE conversation_id=? ORDER BY sequence DESC LIMIT 12",
            )
              .bind(id)
              .all()
          ).results.reverse()
        : [];
      const changes =
        (await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM icv_history h JOIN icv_entities e ON e.id=h.entity_id WHERE h.recorded_at>=datetime('now','-1 day') AND (e.owner IS NULL OR e.owner=?)",
        )
          .bind(actor.id)
          .first<number>("count")) ?? 0;
      const approvals = (
        await env.DB.prepare(
          "SELECT action,status,decision_note AS note,decided_at AS decidedAt FROM approvals WHERE status!='pending' ORDER BY decided_at DESC LIMIT 8",
        ).all()
      ).results;
      const contextMemory = [
        ...memory,
        ...approvals.map((a) => ({
          kind: "approval",
          content: JSON.stringify(a),
        })),
        ...history
          .filter((m) => m.role === "user")
          .map((m) => ({ kind: "discussion", content: String(m.content) })),
      ];
      const boundedMemory = contextMemory.map((m) => ({
        ...m,
        content: m.content.slice(0, 1600),
      }));
      let content = answer(b.message, u, reasoning, changes, boundedMemory),
        providerError: string | null = null;
      if (provider !== "evidence") {
        try {
          content = await generate(
            env,
            provider,
            JSON.stringify({
              question: b.message,
              history: history.map((m) => ({
                ...m,
                content: String(m.content).slice(0, 2000),
              })),
              memory: boundedMemory,
              summary: u.summary,
              reasoning: reasoning.slice(0, 30),
              changes,
            }),
          );
        } catch {
          providerError =
            "Model unavailable. Showing the evidence-based response; no model output was used.";
        }
      }
      if (provider === "evidence" || providerError) {
        if (/yesterday|changed/i.test(b.message)) {
          const recent = (
            await env.DB.prepare(
              "SELECT e.label,e.kind,h.state,h.recorded_at AS recordedAt FROM icv_history h JOIN icv_entities e ON e.id=h.entity_id WHERE h.recorded_at>=datetime('now','-1 day') AND (e.owner IS NULL OR e.owner=?) ORDER BY h.sequence DESC LIMIT 8",
            )
              .bind(actor.id)
              .all<{
                label: string;
                kind: string;
                state: string;
                recordedAt: string;
              }>()
          ).results;
          content +=
            "\n" +
            recent
              .map(
                (e) =>
                  `${e.recordedAt} · ${e.kind} ${e.label}: ${e.state.slice(0, 500)}`,
              )
              .join("\n");
        }
      }
      const evidence = {
        provider: providerError ? "evidence" : provider,
        providerError,
        sampledAt: u.sampledAt,
        reasoning: reasoning.slice(0, 30),
        navigation: [
          { label: "Universe", href: "/portal/universe" },
          { label: "Products", href: "/portal/universe/products" },
          { label: "Pipeline", href: "/portal/universe/pipeline" },
          { label: "Departments", href: "/portal/universe/departments" },
          { label: "Approvals", href: "/portal/approvals" },
        ],
      };
      const statements = [];
      if (!id) {
        id = crypto.randomUUID();
        statements.push(
          env.DB.prepare(
            "INSERT INTO bemax_conversations(id,owner,title) VALUES (?,?,?)",
          ).bind(id, actor.id, b.message.slice(0, 100)),
        );
      }
      statements.push(
        env.DB.prepare(
          "INSERT INTO bemax_messages(id,conversation_id,role,content) VALUES (?,?,'user',?)",
        ).bind(`${turnId}:user`, id, b.message),
        env.DB.prepare(
          "INSERT INTO bemax_messages(id,conversation_id,role,content,evidence) VALUES (?,?,'assistant',?,?)",
        ).bind(`${turnId}:assistant`, id, content, JSON.stringify(evidence)),
        env.DB.prepare(
          "INSERT INTO bemax_memory(id,owner,kind,content) VALUES (?,?,'recommendation',?)",
        ).bind(crypto.randomUUID(), actor.id, content.slice(0, 4000)),
      );
      try {
        await env.DB.batch(statements);
      } catch (error) {
        const saved = await env.DB.prepare(
          "SELECT m.conversation_id AS conversationId,m.content,m.evidence FROM bemax_messages m JOIN bemax_conversations c ON c.id=m.conversation_id WHERE m.id=? AND c.owner=?",
        )
          .bind(`${turnId}:assistant`, actor.id)
          .first<{
            conversationId: string;
            content: string;
            evidence: string;
          }>();
        if (saved) {
          const original = await env.DB.prepare(
            "SELECT content FROM bemax_messages WHERE id=?",
          )
            .bind(`${turnId}:user`)
            .first<string>("content");
          if (
            original !== b.message ||
            (b.conversationId && b.conversationId !== saved.conversationId)
          )
            return json({ error: "Request id already used" }, 409);
          return json({
            ...saved,
            evidence: JSON.parse(saved.evidence),
            reused: true,
          });
        }
        throw error;
      }
      return json({ conversationId: id, content, evidence }, 201);
    }
    if (actor.role !== "Governor")
      return json({ error: "Governor permission required" }, 403);
    if (path === "/api/bemax/memory") {
      if (
        !["strategy", "decision", "context"].includes(String(b.kind)) ||
        !str(b.content)
      )
        return json({ error: "Provide a memory kind and content" }, 400);
      const id = crypto.randomUUID(),
        entityId = `${b.kind}:${id}`;
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO icv_entities(id,kind,source_id,label,state,owner) VALUES (?,?,?,?,?,?)",
        ).bind(
          entityId,
          b.kind as string,
          id,
          b.content.slice(0, 100),
          JSON.stringify({ content: b.content }),
          actor.id,
        ),
        env.DB.prepare(
          "INSERT INTO icv_history(entity_id,state) VALUES (?,?)",
        ).bind(entityId, JSON.stringify({ content: b.content })),
        env.DB.prepare(
          "INSERT INTO bemax_memory(id,owner,kind,entity_id,content) VALUES (?,?,?,?,?)",
        ).bind(id, actor.id, b.kind as string, entityId, b.content),
      ]);
      return json({ id, entityId }, 201);
    }
    if (path === "/api/bemax/actions") {
      if (
        !actionKinds.includes(b.kind as (typeof actionKinds)[number]) ||
        !str(b.rationale)
      )
        return json({ error: "Valid action kind and rationale required" }, 400);
      const entityId = b.entityId ?? null;
      if (
        entityId !== null &&
        (!str(entityId, 240) ||
          !(await env.DB.prepare(
            "SELECT id FROM icv_entities WHERE id=? AND (owner IS NULL OR owner=?)",
          )
            .bind(entityId, actor.id)
            .first()))
      )
        return json({ error: "Identity not found" }, 404);
      if (
        !["Generate Report", "Create Forecast"].includes(b.kind as string) &&
        !entityId
      )
        return json({ error: "Select an entity for this action" }, 400);
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO bemax_actions(id,owner,kind,entity_id,rationale) VALUES (?,?,?,?,?)",
      )
        .bind(id, actor.id, b.kind as string, entityId, b.rationale)
        .run();
      return json({ id, status: "pending" }, 201);
    }
    const decision = path.match(
      /^\/api\/bemax\/actions\/([^/]+)\/(approve|reject|override)$/,
    );
    if (decision) {
      if (!str(b.reason, 1000) || b.reason.trim().length < 10)
        return json(
          { error: "A decision reason of 10–1000 characters is required" },
          400,
        );
      const id = decodeURIComponent(decision[1]);
      const action = await env.DB.prepare(
        "SELECT * FROM bemax_actions WHERE id=? AND owner=?",
      )
        .bind(id, actor.id)
        .first<{ kind: string; status: string; entity_id: string | null }>();
      if (!action) return json({ error: "Action not found" }, 404);
      if (action.status !== "pending")
        return json({ error: "Decision is final" }, 409);
      const status =
        decision[2] === "approve"
          ? "approved"
          : decision[2] === "reject"
            ? "rejected"
            : "overridden";
      let result: unknown = { execution: "not-requested" };
      let rememberedResult: unknown = null;
      if (status !== "rejected") {
        if (action.kind === "Generate Report")
          result = { execution: "completed", report: await readUniverse(env) };
        else if (action.kind === "Create Forecast")
          result = {
            execution: "completed",
            forecast: revenueScenarios(await readUniverse(env), 3, 0),
          };
        else
          result = {
            execution: "requires-icvs-review",
            message:
              "Approved proposal retained. Lifecycle and resource changes require an authorised ICVS workflow. No execution has occurred.",
            href:
              action.kind === "Publish Product"
                ? "/portal/approvals"
                : "/portal/factory",
          };
      }
      if (status !== "rejected" && action.kind === "Create Forecast") {
        const forecast = (
          result as { forecast: ReturnType<typeof revenueScenarios> }
        ).forecast;
        rememberedResult = {
          months: forecast.months,
          monthlyGrowthPct: forecast.monthlyGrowthPct,
          method: forecast.method,
          totals: forecast.totals,
        };
      }
      if (status !== "rejected" && action.kind === "Generate Report")
        rememberedResult = (
          result as { report: Awaited<ReturnType<typeof readUniverse>> }
        ).report.summary;
      // Compare-and-set and memory insert are one transaction. Losing decisions insert no memory.
      const memoryId = crypto.randomUUID();
      const results = await env.DB.batch([
        env.DB.prepare(
          "UPDATE bemax_actions SET status=?,decision_note=?,decided_by=?,decided_at=CURRENT_TIMESTAMP,result=? WHERE id=? AND owner=? AND status='pending'",
        ).bind(
          status,
          b.reason,
          actor.id,
          JSON.stringify(result),
          id,
          actor.id,
        ),
        env.DB.prepare(
          "INSERT INTO bemax_memory(id,owner,kind,entity_id,content) SELECT ?,?,'governor-action',entity_id,? FROM bemax_actions WHERE id=? AND changes()=1",
        ).bind(
          memoryId,
          actor.id,
          JSON.stringify({
            actionId: id,
            kind: action.kind,
            status,
            reason: b.reason,
            outcome: (result as { execution: string }).execution,
            snapshot: rememberedResult,
          }),
          id,
        ),
      ]);
      if (!results[0].meta.changes)
        return json({ error: "Decision is final" }, 409);
      return json({ id, status, result });
    }
    return json({ error: "BEMAX route not found" }, 404);
  } catch (e) {
    if (e instanceof SyntaxError || e instanceof URIError)
      return json({ error: "Invalid request" }, 400);
    if (e instanceof RangeError) return json({ error: e.message }, 413);
    throw e;
  }
}
