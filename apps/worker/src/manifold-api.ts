import { staffIdentity } from "./access";
import type { Env } from "./types";
import { graph, readUniverse } from "./universe-api";
import { spatialScene, topology } from "../../../portal-os/universe";
import { universeStages, entityHref } from "../../../portal-os/manifold";
import { departments, operationalApi } from "./operations";
import { configuredCapacity } from "../../../portal-os/intelligence";
export async function manifoldApi(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url),
    path = url.pathname;
  if (path !== "/api/universe" && !path.startsWith("/api/universe/"))
    return null;
  if (request.method !== "GET")
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  try {
    const actor = await staffIdentity(request, env);
    if (!actor)
      return Response.json(
        { error: "Staff sign-in required" },
        { status: 401 },
      );
    const u = await readUniverse(env);
    if (path === "/api/universe") return Response.json(u);
    if (
      path === "/api/universe/relationships" ||
      path === "/api/universe/dependencies"
    ) {
      const g = await graph(env);
      return Response.json({
        relationships: path.endsWith("/dependencies")
          ? g.edges.filter((e) => e.relation === "depends_on")
          : g.edges,
        sampledAt: g.sampledAt,
      });
    }
    if (path === "/api/universe/departments")
      return operationalApi(
        new Request("https://portal.internal/api/departments"),
        env,
      );
    if (path === "/api/universe/pipeline") {
      const exits = (
        await env.DB.prepare(
          "SELECT from_stage AS stage,COUNT(*) AS count FROM workflow_events WHERE from_stage!=to_stage AND julianday(created_at)>=julianday('now','-7 days') GROUP BY from_stage",
        ).all<{ stage: string; count: number }>()
      ).results;
      const stages = [
        ...universeStages,
        ...new Set(
          u.products
            .map((p) => p.stage)
            .filter((s) => !universeStages.includes(s)),
        ),
      ];
      return Response.json({
        stages: stages.map((stage) => {
          const products = u.products.filter((p) => p.stage === stage),
            runs = u.runs.filter(
              (r) => r.stage === stage && r.status !== "completed",
            ),
            completed = exits.find((e) => e.stage === stage)?.count ?? 0;
          const department = departments.find((d) => d.stages.includes(stage));
          return {
            stage,
            products,
            queueDepth: products.length,
            blocked: runs.filter((r) => r.status === "blocked").length,
            running: runs.filter((r) => r.status === "running").length,
            risk: products.length
              ? Math.max(...products.map((p) => p.risk))
              : null,
            capacity: department
              ? configuredCapacity(env.DEPARTMENT_CAPACITY, department.id)
              : null,
            daysToClear: completed
              ? Math.round((products.length / completed) * 7 * 10) / 10
              : null,
            completed7d: completed,
          };
        }),
        method:
          "Queue clearance uses stage exits in the last seven days; not a product delivery commitment. Research is an observational stage; existing ICVS workflows are preserved.",
        sampledAt: u.sampledAt,
      });
    }
    if (path === "/api/universe/identities") {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      if (!Number.isSafeInteger(offset) || offset < 0)
        return Response.json({ error: "Invalid offset" }, { status: 400 });
      const entities = (
        await env.DB.prepare(
          "SELECT * FROM icv_entities WHERE owner IS NULL OR owner=? ORDER BY id LIMIT 100 OFFSET ?",
        )
          .bind(actor.id, offset)
          .all()
      ).results;
      return Response.json({
        entities,
        nextOffset: entities.length === 100 ? offset + 100 : null,
      });
    }
    const twin = path.match(/^\/api\/universe\/twins\/(.+)$/);
    if (twin) {
      const id = decodeURIComponent(twin[1]),
        g = await graph(env),
        node = g.nodes.find((n) => n.id === id);
      const identity = await env.DB.prepare(
        "SELECT * FROM icv_entities WHERE id=? AND (owner IS NULL OR owner=?)",
      )
        .bind(id, actor.id)
        .first();
      if (!node && !identity)
        return Response.json({ error: "Entity not found" }, { status: 404 });
      const history = (
        await env.DB.prepare(
          "SELECT * FROM icv_history WHERE entity_id=? ORDER BY sequence DESC LIMIT 100",
        )
          .bind(id)
          .all()
      ).results;
      const kind = id.split(":")[0],
        source = id.slice(kind.length + 1);
      let live: unknown = node;
      if (kind === "product")
        live = u.products.find((p) => p.id === source) ?? identity;
      if (kind === "division")
        live = u.divisions.find((d) => d.id === source) ?? identity;
      if (kind === "project") {
        const run = u.runs.find((r) => r.id === source),
          p = u.products.find((p) => p.id === run?.productId);
        live = {
          ...run,
          progress: run?.status === "completed" ? 100 : null,
          forecast: null,
          forecastReason: "No project duration model available",
          dependencies: p?.dependencies ?? [],
          lifecycle: run?.stage,
        };
      }
      if (kind === "department") {
        const response = await operationalApi(
          new Request("https://portal.internal/api/departments"),
          env,
        );
        live = ((await response!.json()) as { id: string }[]).find(
          (d) => d.id === source,
        );
      }
      return Response.json({
        identity: identity ?? { id, kind, sourceId: source, derived: true },
        live,
        history,
        relationships: g.edges.filter(
          (e) => e.source === id || e.target === id,
        ),
        sampledAt: g.sampledAt,
      });
    }
    if (
      [
        "/api/universe/graph",
        "/api/universe/navigation",
        "/api/universe/topology",
        "/api/universe/spatial",
      ].includes(path)
    ) {
      const g = await graph(env),
        root = url.searchParams.get("root"),
        raw = url.searchParams.get("depth") ?? "2";
      if (!/^[0-4]$/.test(raw))
        return Response.json({ error: "depth must be 0–4" }, { status: 400 });
      if (root && !g.nodes.some((n) => n.id === root))
        return Response.json({ error: "Root not found" }, { status: 404 });
      if (path.endsWith("/topology") && !root)
        return Response.json({ error: "root required" }, { status: 400 });
      const selected = root ? topology(g.nodes, g.edges, root, Number(raw)) : g;
      if (path.endsWith("/navigation"))
        return Response.json({
          nodes: selected.nodes.map((n) => ({ ...n, href: entityHref(n.id) })),
          edges: selected.edges,
          sampledAt: g.sampledAt,
        });
      return Response.json({
        ...spatialScene("ecosystem-galaxy", selected.nodes, selected.edges),
        sampledAt: g.sampledAt,
      });
    }
    return Response.json(
      { error: "Universe route not found" },
      { status: 404 },
    );
  } catch (e) {
    if (e instanceof RangeError)
      return Response.json({ error: e.message }, { status: 413 });
    if (e instanceof URIError)
      return Response.json({ error: "Invalid identity" }, { status: 400 });
    throw e;
  }
}
