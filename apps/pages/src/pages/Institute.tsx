import { SubstrateRecovery } from "../components/SubstrateRecovery";
import { SimulationRegistration } from "../components/SimulationRegistration";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "../components/AsyncState";
import { RefreshControl } from "../components/RefreshControl";
import { useGovernor } from "../layouts/GovernorLayout";
import {
  registries,
  divisions,
  charterSections,
  lawLayers,
  type Revision,
} from "../../../../uss/contracts";
interface Provider {
  id: string;
  name: string;
  type: string;
  status: string;
  reason: string;
  models: string[];
  capabilities: string[];
  fallbackProviders: string[];
  lastSuccess: string | null;
  lastFailure: string | null;
  spentUsd: number;
  budgetUsd: number;
}
interface Overview {
  counts: { registry: string; count: number }[];
  providers: Provider[];
  councils: string[];
  authority: string[];
}
interface Review {
  type: string;
  method: string;
  recommendations: {
    identity: string;
    version: number;
    title: string;
    recommendation: string;
    confidence: number | null;
    sources: string[];
    tradeoffs: string[];
    evidence: {
      hash: string;
      owner: string;
      author: string;
      createdAt: string;
      risk: string;
    }[];
  }[];
}
const loadOverview = (signal?: AbortSignal) =>
  api<Overview>("/api/uss/overview", { signal });
export default function Institute() {
  const governor = useGovernor().role === "Governor";
  const overview = useApi(loadOverview);
  const [registry, setRegistry] = useState<string>("research");
  const load = useCallback(
    (signal?: AbortSignal) =>
      api<(Revision & { decision: string })[]>(
        `/api/uss/records?registry=${registry}`,
        { signal },
      ),
    [registry],
  );
  const records = useApi(load);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [history, setHistory] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [title, setTitle] = useState(""),
    [owner, setOwner] = useState(""),
    [division, setDivision] = useState<string>(divisions[0]),
    [statement, setStatement] = useState("");
  const [charter, setCharter] = useState<Record<string, string>>({}),
    [lawLayer, setLawLayer] = useState<string>(lawLayers[0]);
  const [parent, setParent] = useState("");
  const refresh = () => {
    records.reload();
    overview.reload();
  };
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  async function action(record: Revision, action: string) {
    await perform(async () => {
      const result = await api(
        `/api/uss/records/${record.id}/${action}?version=${record.version}`,
        { method: "POST", body: JSON.stringify({ reason }) },
      );
      setHistory(result);
      refresh();
    });
  }
  return (
    <div className="institute-console">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAX INSTITUTE · USS</div>
          <h1>
            Authority with continuity<span className="title-dot">.</span>
          </h1>
          <p>
            Research, standards, protocols and governance anchored to immutable
            evidence.
          </p>
        </div>
        <RefreshControl {...overview} />
      </div>
      <AsyncState {...overview} retry={overview.reload} />
      <section className="universe-divisions">
        {overview.data?.authority.map((a) => (
          <article className="panel" key={a}>
            <div className="eyebrow">INSTITUTE AUTHORITY</div>
            <h2>{a}</h2>
            <p>Versioned records · accountable ownership · review history</p>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Institute divisions</h2>
        <div className="universe-divisions">
          {divisions.map((d) => (
            <div key={d}>
              <h3>{d.replaceAll("-", " ")}</h3>
              <p>
                Research libraries, programmes, publications, frameworks and
                standards share the registry below.
              </p>
            </div>
          ))}
        </div>
        <p>Councils: {overview.data?.councils.join(" · ")}</p>
        <Link to="/portal/twin">Explore MANIFOLD relationships →</Link>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="panel">
        <h2>Immutable registries</h2>
        <label htmlFor="registry">Registry</label>
        <select
          id="registry"
          value={registry}
          onChange={(e) => {
            setRegistry(e.target.value);
            setSelected(null);
            setHistory(null);
          }}
        >
          {registries.map((r) => (
            <option key={r} value={r}>
              {r} (
              {overview.data?.counts.find((c) => c.registry === r)?.count ?? 0})
            </option>
          ))}
        </select>
        <AsyncState {...records} retry={records.reload} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Owner</th>
                <th>Division</th>
                <th>Version</th>
                <th>Decision</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {records.data?.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{r.owner}</td>
                  <td>{r.division}</td>
                  <td>{r.version}</td>
                  <td>{r.decision}</td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          setSelected(r);
                          setHistory(
                            await api(`/api/uss/records/${r.id}/history`),
                          );
                        })
                      }
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records.data?.length === 0 && (
          <p>
            No {registry} records registered. Evidence appears here after
            registration.
          </p>
        )}
      </section>
      {selected && (
        <section className="panel">
          <h2>
            {selected.title} · version {selected.version}
          </h2>
          <p>Identity: {selected.id}</p>
          <p>
            Confidence: {selected.uncertainty.confidence ?? "Unknown"} ·{" "}
            {selected.uncertainty.risk}
          </p>
          <p>
            Snapshot hash: <code>{selected.hash}</code>
          </p>
          <div className="actions">
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () =>
                  setHistory(
                    await api(`/api/uss/records/${selected.id}/lineage`),
                  ),
                )
              }
            >
              Research lineage
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () =>
                  setHistory(
                    await api(`/api/uss/records/${selected.id}/events`),
                  ),
                )
              }
            >
              Audit events
            </button>
          </div>
          {governor && (
            <>
              <label htmlFor="review-reason">Review / decision reason</label>
              <textarea
                id="review-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={10}
                maxLength={2000}
              />
              <div className="actions">
                {[
                  "review",
                  "approve",
                  "reject",
                  "override",
                  ...(selected.registry === "simulation" ? ["replay"] : []),
                ].map((a) => (
                  <button
                    key={a}
                    disabled={busy || reason.trim().length < 10}
                    onClick={() => void action(selected, a)}
                  >
                    {a[0].toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
            </>
          )}
          {history !== null && (
            <details open>
              <summary>Preserved evidence</summary>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {JSON.stringify(history, null, 2)}
              </pre>
            </details>
          )}
        </section>
      )}
      {governor &&
        [
          "research",
          "framework",
          "publication",
          "course",
          "standard",
          "protocol",
          "policy",
          "charter",
          "law",
          "certification",
          "programme",
          "identity",
        ].includes(registry) && (
          <section className="panel">
            <h2>Register {registry}</h2>
            <p>
              Registration proposes a record. Review and approval are separate
              recorded decisions.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  const references = [];
                  if (parent) {
                    const p = await api<Revision>(
                      `/api/uss/records/${encodeURIComponent(parent)}`,
                    );
                    references.push({
                      id: p.id,
                      version: p.version,
                      relation: "derived_from",
                    });
                  }
                  const content =
                    registry === "charter"
                      ? charter
                      : {
                          statement,
                          ...(registry === "law" ? { layer: lawLayer } : {}),
                        };
                  await api("/api/uss/records", {
                    method: "POST",
                    body: JSON.stringify({
                      registry,
                      title,
                      owner,
                      division,
                      lifecycle: "proposed",
                      content,
                      references,
                      uncertainty: {
                        confidence: null,
                        probability: null,
                        risk: "Not yet assessed",
                        assumptions: [],
                        range: null,
                      },
                    }),
                  });
                  setTitle("");
                  setStatement("");
                  refresh();
                });
              }}
            >
              <label htmlFor="record-title">Title</label>
              <input
                id="record-title"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <label htmlFor="record-owner">Owner</label>
              <input
                id="record-owner"
                required
                maxLength={200}
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
              <label htmlFor="record-division">Division</label>
              <select
                id="record-division"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              >
                {divisions.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <label htmlFor="record-parent">
                Origin record identity (required for derived records)
              </label>
              <input
                id="record-parent"
                required={[
                  "framework",
                  "publication",
                  "course",
                  "standard",
                  "protocol",
                  "certification",
                ].includes(registry)}
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              />
              {registry === "law" && (
                <>
                  <label htmlFor="law-layer">Law layer</label>
                  <select
                    id="law-layer"
                    value={lawLayer}
                    onChange={(e) => setLawLayer(e.target.value)}
                  >
                    {lawLayers.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </>
              )}
              {registry === "charter" ? (
                charterSections.map((k) => (
                  <div key={k}>
                    <label htmlFor={`charter-${k}`}>
                      {k.replace(/([A-Z])/g, " $1")}
                    </label>
                    <textarea
                      id={`charter-${k}`}
                      required
                      maxLength={4000}
                      value={charter[k] ?? ""}
                      onChange={(e) =>
                        setCharter({ ...charter, [k]: e.target.value })
                      }
                    />
                  </div>
                ))
              ) : (
                <>
                  <label htmlFor="record-statement">
                    Statement / research abstract
                  </label>
                  <textarea
                    id="record-statement"
                    required
                    maxLength={8000}
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                  />
                </>
              )}
              <button disabled={busy} type="submit">
                Propose record
              </button>
            </form>
          </section>
        )}
      {governor && registry === "simulation" && (
        <SimulationRegistration onChange={refresh} />
      )}
      <SubstrateRecovery selected={selected} onChange={refresh} />
      <section className="panel">
        <h2>Provider operations</h2>
        {!overview.data?.providers.length && (
          <p>
            No intelligence providers configured. Add a trusted provider adapter
            to enable capability checks and governed operations.
          </p>
        )}
        <div className="universe-divisions">
          {overview.data?.providers.map((p) => (
            <article key={p.id}>
              <h3>{p.name}</h3>
              <span className="badge">{p.status}</span>
              <p>{p.reason}</p>
              <p>Capabilities: {p.capabilities.join(", ")}</p>
              <p>Models: {p.models.join(", ")}</p>
              <p>
                Budget: ${p.spentUsd} / ${p.budgetUsd}
              </p>
              <p>
                Last success: {p.lastSuccess ?? "None"} · Last failure:{" "}
                {p.lastFailure ?? "None"}
              </p>
              <p>
                Fallback candidates: {p.fallbackProviders.join(", ") || "None"}
              </p>
              {governor && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await api(
                        `/api/uss/providers/${encodeURIComponent(p.id)}/health`,
                        { method: "POST", body: "{}" },
                      );
                      overview.reload();
                    })
                  }
                >
                  Check health
                </button>
              )}
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () =>
                    setHistory(
                      await api(
                        `/api/uss/providers/${encodeURIComponent(p.id)}/history`,
                      ),
                    ),
                  )
                }
              >
                Provider history
              </button>
            </article>
          ))}
        </div>
      </section>
      {!selected && history !== null && (
        <section className="panel">
          <h2>Provider history</h2>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {JSON.stringify(history, null, 2)}
          </pre>
        </section>
      )}
      <section className="panel">
        <h2>BEMAX strategic reviews</h2>
        <div className="actions">
          {[
            "strategic-brief",
            "executive-summary",
            "opportunity-review",
            "risk-review",
            "governed-review",
          ].map((t) => (
            <button
              key={t}
              disabled={busy}
              onClick={() =>
                void perform(async () =>
                  setReview(await api(`/api/uss/reviews?type=${t}`)),
                )
              }
            >
              {t.replaceAll("-", " ")}
            </button>
          ))}
        </div>
        {review && (
          <>
            <p>{review.method}</p>
            {!review.recommendations.length && (
              <p>No evidence available for review.</p>
            )}
            {review.recommendations.map((r) => (
              <article key={r.identity}>
                <h3>
                  {r.title} · v{r.version}
                </h3>
                <p>{r.recommendation}</p>
                <p>Confidence: {r.confidence ?? "Unknown"}</p>
                <p>Tradeoffs: {r.tradeoffs.join(" ")}</p>
                <details>
                  <summary>Evidence and sources</summary>
                  <pre style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(
                      { evidence: r.evidence, sources: r.sources },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </article>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
