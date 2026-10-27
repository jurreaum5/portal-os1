import { useCallback, useState } from "react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "../components/AsyncState";
import { useGovernor } from "../layouts/GovernorLayout";
import { sportsDivisions, sportsModules } from "../../../../portal-os/manifold";
type Observation = {
  id: string;
  subdivision: string;
  module: string;
  subject: string;
  summary: string;
  source: string;
  observedAt: string;
};
export default function SportsIntelligence() {
  const { role } = useGovernor(),
    [module, setModule] = useState(sportsModules[0]),
    [subdivision, setSubdivision] = useState(sportsDivisions[0]),
    [subject, setSubject] = useState(""),
    [summary, setSummary] = useState(""),
    [source, setSource] = useState(""),
    [observedAt, setObservedAt] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [id, setId] = useState(crypto.randomUUID());
  const load = useCallback(
    (signal: AbortSignal) =>
      api<{ observations: Observation[] }>(
        `/api/universe/sports?module=${encodeURIComponent(module)}`,
        { signal },
      ),
    [module],
  );
  const state = useApi(load, 15000);
  return (
    <>
      <section className="panel">
        <h2>Sports divisions</h2>
        <div className="sports-grid">
          {sportsDivisions.map((d) => (
            <article key={d}>
              <h3>{d}</h3>
              <p>
                Connected to the MAX Sports identity and relationship graph.
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Intelligence centers</h2>
        <div className="universe-tabs">
          {sportsModules.map((m) => (
            <button
              key={m}
              aria-pressed={module === m}
              onClick={() => setModule(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <h3>{module}</h3>
        <AsyncState {...state} retry={state.reload} />
        {state.data?.observations.map((o) => (
          <article className="bemax-reason" key={o.id}>
            <span className="eyebrow">
              {o.subdivision} · {new Date(o.observedAt).toLocaleString()}
            </span>
            <h3>{o.subject}</h3>
            <p>{o.summary}</p>
            <small>Source: {o.source}</small>
          </article>
        ))}
        {!state.data?.observations.length && (
          <p>No source observations recorded for this module.</p>
        )}
        <p className="muted">
          Latest 100 observations. Source-attributed records are evidence for
          review, not independently verified predictions or medical advice.
        </p>
        {role === "Governor" && (
          <details>
            <summary>Record a source observation</summary>
            <form
              className="bemax-compose"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api("/api/universe/sports/observations", {
                    method: "POST",
                    body: JSON.stringify({
                      id,
                      subdivision,
                      module,
                      subject,
                      summary,
                      source,
                      observedAt: new Date(observedAt).toISOString(),
                    }),
                  });
                  setId(crypto.randomUUID());
                  setSubject("");
                  setSummary("");
                  setSource("");
                  state.reload();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Subdivision
                <select
                  value={subdivision}
                  onChange={(e) => setSubdivision(e.target.value)}
                >
                  {sportsDivisions.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                Subject
                <input
                  required
                  maxLength={200}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </label>
              <label>
                Observation
                <textarea
                  required
                  maxLength={4000}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </label>
              <label>
                Source reference
                <input
                  required
                  maxLength={1000}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </label>
              <label>
                Observed at (local time)
                <input
                  type="datetime-local"
                  required
                  value={observedAt}
                  onChange={(e) => setObservedAt(e.target.value)}
                />
              </label>
              <button disabled={busy}>Record observation</button>
              {error && <p role="alert">{error}</p>}
            </form>
          </details>
        )}
      </section>
    </>
  );
}
