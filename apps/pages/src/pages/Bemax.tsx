import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "../components/AsyncState";
import { RefreshControl } from "../components/RefreshControl";
interface Brief {
  plan: {
    horizonMonths: number;
    mode: string;
    milestones: {
      entityId: string;
      priority: number;
      action: string;
      gates: string[];
    }[];
    assumptions: string[];
  };
  summary: string;
  questions: string[];
  recommendations: {
    entityId: string;
    label: string;
    action: string;
    evidence: Record<string, unknown>;
    sources: string[];
    confidence: string;
    tradeoffs: string[];
    impactScope: { divisionId: string; affectedEntities: string[] };
    dependencyAnalysis: {
      prerequisites: { id: string }[];
      affectedConsumers: { id: string }[];
    };
    navigateTo: string;
  }[];
  navigation: { id: string; label: string; kind: string; navigateTo: string }[];
  memory: {
    id: string;
    content: string;
    entity_id: string;
    source: string;
    created_at: string;
  }[];
  changes: {
    id: string;
    type: string;
    entity_id: string;
    source: string;
    observed_at: string;
  }[];
}
export default function Bemax() {
  const [question, setQuestion] = useState("What should I do next?");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(
    (signal: AbortSignal) =>
      api<Brief>(
        `/api/bemax?question=${encodeURIComponent(question)}&search=${encodeURIComponent(search)}`,
        { signal },
      ),
    [question, search],
  );
  const state = useApi(load, 15000),
    data = state.data;
  async function reason() {
    setWorking(true);
    setError("");
    setSummary("");
    try {
      const result = await api<{ model: { text?: string; reason?: string } }>(
        "/api/bemax/reason",
        { method: "POST", body: JSON.stringify({ question }) },
      );
      setSummary(
        result.model.text ??
          result.model.reason ??
          "No model summary available",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Summary unavailable");
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">STRATEGIC AI OPERATING SYSTEM</div>
          <h1>
            BEMAX<span className="title-dot">.</span>
          </h1>
          <p>
            Understand what changed. Find what matters. Govern the next action.
          </p>
        </div>
        <RefreshControl {...state} />
      </div>
      <div className="filter-toolbar">
        <label>
          Focus
          <select
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setSummary("");
            }}
          >
            {(data?.questions ?? [question]).map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
        </label>
        <label>
          Universe search
          <input
            value={search}
            maxLength={200}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities and relationships"
          />
        </label>
      </div>
      <AsyncState {...state} retry={state.reload} />
      {data && (
        <>
          <section className="panel">
            <h2>Executive brief</h2>
            <p>{data.summary}</p>
            <p className="muted">
              Recommendations use recorded operational evidence. Market
              opportunity remains uncertain without external measurements.
            </p>
            <div className="completion-actions">
              <Link to="/portal/autonomy">Governor decisions ↗</Link>
              <Link to="/portal/twin">Explore MANIFOLD ↗</Link>
              <button disabled={working} onClick={reason}>
                {working
                  ? "Preparing summary…"
                  : "Summarise with connected intelligence"}
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
            {summary && (
              <p className="notice" style={{ whiteSpace: "pre-wrap" }}>
                {summary}
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Long-horizon plan · {data.plan.horizonMonths} months</h2>
            <p>{data.plan.mode}</p>
            <ul>
              {data.plan.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            {data.plan.milestones.slice(0, 10).map((m) => (
              <p key={m.entityId}>
                <strong>
                  {m.priority}. {m.entityId}
                </strong>{" "}
                — {m.action} Gates: {m.gates.join("; ")}
              </p>
            ))}
          </section>
          <section
            aria-label="Recommended next actions"
            className="universe-divisions"
          >
            {data.recommendations.length ? (
              data.recommendations.map((r) => (
                <article key={r.entityId} className="panel">
                  <span className="eyebrow">NEXT BEST ACTION</span>
                  <h2>
                    <Link to={r.navigateTo}>{r.label} ↗</Link>
                  </h2>
                  <p>{r.action}</p>
                  <p>
                    <strong>Confidence:</strong> {r.confidence}
                  </p>
                  <details>
                    <summary>Evidence and tradeoffs</summary>
                    <dl>
                      {Object.entries(r.evidence).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>
                            {Array.isArray(value)
                              ? value.join(", ") || "None recorded"
                              : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <h3>Impact and dependencies</h3>
                    <p>Division: {r.impactScope.divisionId}</p>
                    <p>
                      Affected consumers:{" "}
                      {r.impactScope.affectedEntities.join(", ") ||
                        "None recorded"}
                    </p>
                    <p>
                      Prerequisites:{" "}
                      {r.dependencyAnalysis.prerequisites
                        .map((p) => p.id)
                        .join(", ") || "None recorded"}
                    </p>
                    <Link
                      to={`/portal/manifold?root=${encodeURIComponent(r.entityId)}`}
                    >
                      Explore dependency exposure ↗
                    </Link>
                    <h3>Tradeoffs</h3>
                    <ul>
                      {r.tradeoffs.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    <h3>Sources</h3>
                    <ul>
                      {r.sources.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </details>
                </article>
              ))
            ) : (
              <p className="notice">
                No actionable recommendations in this focus. Continue monitoring
                evidence.
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Ecosystem navigation</h2>
            <div className="completion-entities">
              {data.navigation.map((n) => (
                <Link key={n.id} to={n.navigateTo}>
                  <small>{n.kind}</small>
                  <strong>{n.label} ↗</strong>
                </Link>
              ))}
            </div>
            {!data.navigation.length && <p>No matching entities.</p>}
          </section>
          <div className="completion-columns">
            <section className="panel">
              <h2>What changed?</h2>
              {data.changes.length ? (
                data.changes.map((c) => (
                  <div className="completion-entry" key={c.id}>
                    <Link
                      to={`/portal/identity?entityId=${encodeURIComponent(c.entity_id)}`}
                    >
                      {c.entity_id}
                    </Link>
                    <p>
                      {c.type} · {c.source}
                    </p>
                    <small>{c.observed_at}</small>
                  </div>
                ))
              ) : (
                <p>No identity events recorded yet.</p>
              )}
            </section>
            <section className="panel">
              <h2>Your long-term memory</h2>
              {data.memory.length ? (
                data.memory.map((m) => (
                  <article className="completion-entry" key={m.id}>
                    <strong>{m.entity_id}</strong>
                    <p>{m.content}</p>
                    <small>
                      {m.source} · {m.created_at}
                    </small>
                  </article>
                ))
              ) : (
                <p>
                  No personal memory recorded. Evidence from connected workflows
                  remains available in identity history.
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
