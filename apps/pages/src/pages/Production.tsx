import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "../components/AsyncState";
import { useGovernor } from "../layouts/GovernorLayout";
import { RefreshControl } from "../components/RefreshControl";
interface Data {
  monitoring?: {
    monitors: { id: string; status: string; action: string }[];
    governance: {
      auditGaps: number;
      proposals: { status: string; count: number }[];
    };
    simulations: {
      registered: number;
      runs: number;
      replays: number;
      mismatches: number;
    };
  };
  edges?: { id: string; source: string; target: string; relation: string }[];
  publicationHistory?: { id: string; observed_at: string; evidence: string }[];
  runs?: { id: string; actor: string; model_id: string; created_at: string }[];

  method?: string;
  confidence?: string;
  status?: string;
  integrations?: { id: string; kind: string; status: string }[];
  alerts?: { id: string; status: string; action: string }[];
  backup?: { status: string; reason: string };
  recovery?: { status: string; reason: string; verification: string };
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
    feedProvenance?: { provider: string; receivedAt: string };
    confidenceRating?: string;
    metrics: Record<string, number>;
  }[];
  models?: {
    id: string;
    version: string;
    model_class: string;
    owner_id: string;
    domain: string;
    predecessor_id: string | null;
    assumptions: string;
    source: string;
  }[];
}
export default function Production({
  area,
}: {
  area: "operations" | "manifold" | "reports" | "registry" | "lineage";
}) {
  const [params] = useSearchParams();
  const { role } = useGovernor();
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("both");
  const [replayMessage, setReplayMessage] = useState("");
  const [replaying, setReplaying] = useState(false);
  async function replay(id: string) {
    setReplaying(true);
    setReplayMessage("");
    try {
      const result = await api<{
        matched: boolean;
        inputHash: string;
        actualOutputHash: string;
      }>(`/api/substrate/scenarios/${encodeURIComponent(id)}/replay`, {
        method: "POST",
        body: "{}",
      });
      setReplayMessage(
        `${result.matched ? "Replay matched" : "Replay mismatch"} · Input ${result.inputHash} · Output ${result.actualOutputHash}`,
      );
    } catch (e) {
      setReplayMessage(e instanceof Error ? e.message : "Replay unavailable");
    } finally {
      setReplaying(false);
    }
  }
  const [root, setRoot] = useState(params.get("root") ?? "ecosystem:max");
  const [type, setType] = useState("league");
  const path =
    area === "operations"
      ? "/api/operations/status"
      : area === "lineage"
        ? `/api/institute/lineage?entityId=${encodeURIComponent(root)}`
        : area === "manifold"
          ? query
            ? `/api/manifold?q=${encodeURIComponent(query)}`
            : `/api/manifold/navigation?root=${encodeURIComponent(root)}&direction=${direction}`
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
                lineage: "Research lineage",
              }[area]
            }
          </h1>
        </div>
        <RefreshControl {...state} />
      </div>
      {area === "manifold" && (
        <div className="filter-toolbar">
          <label>
            Ecosystem search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            Direction
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="both">All relationships</option>
              <option value="outgoing">Outgoing</option>
              <option value="incoming">Incoming</option>
            </select>
          </label>
          <label>
            Root identity
            <input
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              maxLength={200}
            />
          </label>
        </div>
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
              "simulation",
              "market",
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
          {data.monitoring && (
            <section className="panel">
              <h2>Governance and simulation monitoring</h2>
              {data.monitoring.monitors.map((m) => (
                <p key={m.id}>
                  <strong>
                    {m.id} · {m.status}
                  </strong>{" "}
                  — {m.action}
                </p>
              ))}
              <p>
                Registered models: {data.monitoring.simulations.registered} ·
                Runs: {data.monitoring.simulations.runs} · Replays:{" "}
                {data.monitoring.simulations.replays} · Mismatches:{" "}
                {data.monitoring.simulations.mismatches}
              </p>
              <p>
                Missing effect or audit records:{" "}
                {data.monitoring.governance.auditGaps}
              </p>
              {data.monitoring.governance.proposals.map((p) => (
                <p key={p.status}>
                  {p.status}: {p.count}
                </p>
              ))}
              <Link to="/portal/autonomy">Review Governor proposals ↗</Link>
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
              <p>{data.recovery?.verification}</p>
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
          {data.publicationHistory && (
            <section className="panel">
              <h2>Publication history</h2>
              {data.publicationHistory.map((h) => (
                <p key={h.id}>
                  {h.observed_at} · {h.evidence}
                </p>
              ))}
              {!data.publicationHistory.length && (
                <p>No approved publication transitions recorded.</p>
              )}
            </section>
          )}
          {data.edges && (
            <section className="panel">
              <h2>Relationship evidence</h2>
              {data.edges.map((e) => (
                <p key={e.id}>
                  {e.source} — {e.relation} → {e.target}
                </p>
              ))}
            </section>
          )}
          {data.nodes && (
            <section className="panel">
              <h2>Relationship traversal</h2>
              <div className="completion-entities">
                {data.nodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setRoot(n.id);
                      setQuery("");
                    }}
                  >
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
                  <p>
                    Confidence rating: {r.confidenceRating ?? "Not rated"} ·
                    Feed: {r.feedProvenance?.provider ?? "Unknown"}
                  </p>
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
          {data.runs && (
            <section className="panel">
              <h2>Reproducibility evidence</h2>
              {data.runs.map((r) => (
                <div className="completion-entry" key={r.id}>
                  <strong>{r.id}</strong>
                  <p>
                    {r.model_id} · {r.actor} · {r.created_at}
                  </p>
                  {role === "Governor" && (
                    <button disabled={replaying} onClick={() => replay(r.id)}>
                      Replay retained inputs
                    </button>
                  )}
                </div>
              ))}
              {!data.runs.length && <p>No simulation runs recorded.</p>}
              {replayMessage && (
                <p role="status" style={{ overflowWrap: "anywhere" }}>
                  {replayMessage}
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
                  <p>
                    Owner: {m.owner_id} · Domain: {m.domain}
                  </p>
                  {m.predecessor_id && (
                    <p>Previous version: {m.predecessor_id}</p>
                  )}
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
