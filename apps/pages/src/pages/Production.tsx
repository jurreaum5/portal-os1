import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "../components/AsyncState";
import { RefreshControl } from "../components/RefreshControl";
interface Data {
  method?: string;
  confidence?: string;
  status?: string;
  integrations?: { id: string; kind: string; status: string }[];
  alerts?: { id: string; status: string; action: string }[];
  backup?: { status: string; reason: string };
  recovery?: { status: string; reason: string };
  nodes?: { id: string; label: string; kind: string }[];
  visits?: { id: string; depth: number; via: string | null }[];
  dependencyAnalysis?: {
    prerequisites: { id: string }[];
    affectedConsumers: { id: string }[];
    method: string;
  };
  records?: {
    id: string;
    label: string;
    category: string;
    source: string;
    observedAt: string;
    freshnessState: string;
    confidence: string;
    metrics: Record<string, number>;
  }[];
  models?: {
    id: string;
    version: string;
    model_class: string;
    assumptions: string;
    source: string;
  }[];
}
export default function Production({
  area,
}: {
  area: "operations" | "manifold" | "reports" | "registry";
}) {
  const [params] = useSearchParams();
  const [root, setRoot] = useState(params.get("root") ?? "ecosystem:max");
  const [type, setType] = useState("league");
  const path =
    area === "operations"
      ? "/api/operations/status"
      : area === "manifold"
        ? `/api/manifold/navigation?root=${encodeURIComponent(root)}`
        : area === "reports"
          ? `/api/sports/reports?type=${type}`
          : "/api/substrate/registry";
  const load = useCallback(
    (signal: AbortSignal) => api<Data>(path, { signal }),
    [path],
  );
  const state = useApi(load, 30000),
    data = state.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAX UNIVERSE</div>
          <h1>
            {
              {
                operations: "Production operations",
                manifold: "Manifold navigation",
                reports: "Sports reports",
                registry: "Simulation registry",
              }[area]
            }
          </h1>
        </div>
        <RefreshControl {...state} />
      </div>
      {area === "manifold" && (
        <label>
          Root identity
          <input
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            maxLength={200}
          />
        </label>
      )}
      {area === "reports" && (
        <label>
          Report focus
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {[
              "league",
              "team",
              "forecast",
              "prospect",
              "business",
              "injury",
              "athlete",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      )}
      <AsyncState {...state} retry={state.reload} />
      {data && (
        <>
          {data.method && <p className="notice">{data.method}</p>}
          {data.confidence && <p>{data.confidence}</p>}
          {data.status && <p role="status">{data.status}</p>}
          {data.integrations && (
            <section className="panel">
              <h2>Observed integrations</h2>
              {data.integrations.map((i) => (
                <p key={i.id}>
                  <strong>{i.id}</strong> · {i.kind} · {i.status}
                </p>
              ))}
              {!data.integrations.length && <p>No configured integrations.</p>}
              <Link to="/portal/models">Provider usage and controls ↗</Link>
            </section>
          )}
          {data.alerts && (
            <section className="panel">
              <h2>Alerts</h2>
              {data.alerts.map((a) => (
                <p key={a.id}>
                  <strong>
                    {a.id}: {a.status}
                  </strong>{" "}
                  — {a.action}
                </p>
              ))}
              {!data.alerts.length && (
                <p>No alerts from observed integrations.</p>
              )}
            </section>
          )}
          {data.backup && (
            <section className="panel">
              <h2>Recovery readiness</h2>
              <p>
                Backup: {data.backup.status} — {data.backup.reason}
              </p>
              <p>
                Recovery: {data.recovery?.status} — {data.recovery?.reason}
              </p>
            </section>
          )}
          {data.dependencyAnalysis && (
            <section className="panel">
              <h2>Dependency exposure</h2>
              <p>{data.dependencyAnalysis.method}</p>
              <p>
                Prerequisites:{" "}
                {data.dependencyAnalysis.prerequisites
                  .map((n) => n.id)
                  .join(", ") || "None recorded"}
              </p>
              <p>
                Affected consumers:{" "}
                {data.dependencyAnalysis.affectedConsumers
                  .map((n) => n.id)
                  .join(", ") || "None recorded"}
              </p>
            </section>
          )}
          {data.nodes && (
            <section className="panel">
              <h2>Relationship traversal</h2>
              <div className="completion-entities">
                {data.nodes.map((n) => (
                  <button key={n.id} onClick={() => setRoot(n.id)}>
                    <small>{n.kind}</small>
                    <strong>{n.label}</strong>
                  </button>
                ))}
              </div>
            </section>
          )}
          {data.records && (
            <section className="universe-divisions">
              {data.records.map((r) => (
                <article key={r.id} className="panel">
                  <h2>{r.label}</h2>
                  <p>
                    {r.category} · {r.freshnessState} · {r.observedAt}
                  </p>
                  <dl>
                    {Object.entries(r.metrics).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p>{r.confidence}</p>
                  <a href={r.source} target="_blank" rel="noreferrer">
                    Source evidence ↗
                  </a>
                </article>
              ))}
              {!data.records.length && (
                <p className="notice">
                  No provider observations support this report. Connect a
                  production feed and refresh observations.
                </p>
              )}
            </section>
          )}
          {data.models && (
            <section className="universe-divisions">
              {data.models.map((m) => (
                <article key={m.id} className="panel">
                  <h2>{m.id}</h2>
                  <p>
                    {m.model_class} · Version {m.version}
                  </p>
                  <p>{m.assumptions}</p>
                  <p>Source: {m.source}</p>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
