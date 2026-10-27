import type { Env } from "./types";
import { staffIdentity } from "./access";
import { readObject } from "./customer-auth";
import { sportsDivisions, sportsModules } from "../../../portal-os/manifold";
import { readUniverse } from "./universe-api";
const valid = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
export async function sportsApi(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (
    !["/api/universe/sports", "/api/universe/sports/observations"].includes(
      url.pathname,
    )
  )
    return null;
  const actor = await staffIdentity(request, env);
  if (!actor)
    return Response.json({ error: "Staff sign-in required" }, { status: 401 });
  if (request.method === "GET") {
    const module = url.searchParams.get("module");
    if (module && !sportsModules.includes(module))
      return Response.json({ error: "Unknown Sports module" }, { status: 400 });
    const observations = (
      await env.DB.prepare(
        "SELECT id,subdivision,module,subject,summary,source,observed_at AS observedAt,product_id AS productId FROM sports_observations WHERE (? IS NULL OR module=?) ORDER BY observed_at DESC,id LIMIT 100",
      )
        .bind(module, module)
        .all()
    ).results;
    const u = await readUniverse(env);
    return Response.json({
      division: u.divisions.find((d) => d.id === "max-sports"),
      subdivisions: sportsDivisions,
      modules: sportsModules,
      observations,
      products: u.products.filter((p) => p.divisionId === "max-sports"),
      sampledAt: u.sampledAt,
      limit: 100,
    });
  }
  if (
    request.method !== "POST" ||
    url.pathname !== "/api/universe/sports/observations"
  )
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  if (actor.role !== "Governor")
    return Response.json(
      { error: "Governor permission required" },
      { status: 403 },
    );
  let b: Record<string, unknown>;
  try {
    b = await readObject(request);
  } catch {
    return Response.json({ error: "Invalid JSON object" }, { status: 400 });
  }
  if (
    !valid(b.id, 120) ||
    !sportsDivisions.includes(String(b.subdivision)) ||
    !sportsModules.includes(String(b.module)) ||
    !valid(b.subject, 200) ||
    !valid(b.summary, 4000) ||
    !valid(b.source, 1000) ||
    !valid(b.observedAt, 40)
  )
    return Response.json(
      {
        error:
          "Provide id, subdivision, module, subject, summary, source and observedAt",
      },
      { status: 400 },
    );
  const observed = Date.parse(b.observedAt);
  if (
    !Number.isFinite(observed) ||
    observed > Date.now() + 60000 ||
    observed < Date.now() - 90 * 86400000
  )
    return Response.json(
      {
        error:
          "Observation must be within 90 days and no more than one minute in the future",
      },
      { status: 400 },
    );
  const product = b.productId ?? null;
  if (
    product !== null &&
    (!valid(product, 120) ||
      !(await env.DB.prepare(
        "SELECT id FROM products WHERE id=? AND division_id='max-sports'",
      )
        .bind(product)
        .first()))
  )
    return Response.json(
      { error: "Linked product must belong to MAX Sports" },
      { status: 400 },
    );
  const values = [
    b.id,
    b.subdivision as string,
    b.module as string,
    b.subject,
    b.summary,
    b.source,
    new Date(observed).toISOString(),
    product as string | null,
    actor.id,
  ];
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO sports_observations(id,subdivision,module,subject,summary,source,observed_at,product_id,recorded_by) VALUES (?,?,?,?,?,?,?,?,?)",
  )
    .bind(...values)
    .run();
  if (!inserted.meta.changes) {
    const old = await env.DB.prepare(
      "SELECT * FROM sports_observations WHERE id=?",
    )
      .bind(b.id)
      .first<Record<string, unknown>>();
    const keys = [
      "id",
      "subdivision",
      "module",
      "subject",
      "summary",
      "source",
      "observed_at",
      "product_id",
      "recorded_by",
    ];
    if (!old || keys.some((k, i) => old[k] !== values[i]))
      return Response.json(
        { error: "Observation id already used; corrections require a new id" },
        { status: 409 },
      );
  }
  return Response.json(
    { id: b.id, reused: !inserted.meta.changes },
    { status: inserted.meta.changes ? 201 : 200 },
  );
}
