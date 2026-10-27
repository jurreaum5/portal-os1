import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "../components/AsyncState";
import { RefreshControl } from "../components/RefreshControl";
import { useGovernor } from "../layouts/GovernorLayout";
interface Identity {
  id: string;
  kind: string;
  label: string;
  revision: number;
  state: string;
  invariants: string;
}
interface Proposal {
  id: string;
  entity_id: string;
  action: string;
  status: string;
  evidence: string;
  expected_revision: number;
  decision_reason: string | null;
}
interface CompletionData {
  identities?: Identity[];
  identity?: Identity;
  events?: {
    id: string;
    type: string;
    actor: string;
    source: string;
    observed_at: string;
    evidence: string;
  }[];
  continuity?: string;
  proposals?: Proposal[];
  policy?: string;
  divisions?: Identity[];
  outputs?: Identity[];
  lineage?: {
    output_id: string;
    predecessor_id: string | null;
    version: number;
  }[];
  usage?: {
    providerId: string;
    day: string;
    requests: number;
    actualMicrousd: number | null;
    reservedMicrousd: number;
  }[];
  governance?: string;
  leagues?: string[];
  capabilities?: string[];
  configured?: boolean;
  health?: { status: string; message: string; observedAt: string } | null;
  records?: {
    id: string;
    entityId: string;
    label: string;
    league: string;
    category: string;
    observedAt: string;
    source: string;
    metrics: Record<string, number>;
    stale: boolean;
  }[];
  source?: string;
  recommendations?: {
    entityId: string;
    action: string;
    sources: string[];
    confidence: string;
    tradeoffs: string[];
  }[];
  providers?: {
    id: string;
    kind: string;
    model: string;
    status: string;
    capabilities: string[];
    health: string | { status: string; createdAt: string };
  }[];
  reservedMicrousd?: number;
  dailyBudgetMicrousd?: number;
  method?: string;
  models?: string[];
  domains?: string[];
  runs?: { id: string; actor: string; created_at: string }[];
}
const titles: Record<string, [string, string]> = {
  identity: [
    "Identity continuity",
    "What remains the same while the ecosystem changes.",
  ],
  autonomy: [
    "Governed autonomy",
    "Evidence, policy and reversible operational decisions.",
  ],
  sports: [
    "MAX Sports",
    "Connected observations across athlete, team and market intelligence.",
  ],
  institute: [
    "MAX Institute",
    "Research, protocols and governed publications.",
  ],
  substrate: [
    "Simulation and XR",
    "One shared foundation for future ecosystem simulations.",
  ],
  models: [
    "Intelligence providers",
    "Portable model routing, cost controls and observed health.",
  ],
};
const endpoints: Record<string, string> = {
  identity: "icv",
  autonomy: "autonomy",
  sports: "sports",
  institute: "institute",
  substrate: "substrate",
  models: "models",
};
export default function Completion({ area }: { area: string }) {
  const [params] = useSearchParams(),
    entityId = params.get("entityId") ?? "";
  const { role } = useGovernor();
  const load = useCallback(
    (signal: AbortSignal) =>
      api<CompletionData>(
        `/api/${endpoints[area]}${area === "identity" && entityId ? `/history?entityId=${encodeURIComponent(entityId)}` : ""}`,
        { signal },
      ),
    [area, entityId],
  );
  const state = useApi(load, 15000),
    data = state.data;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(id: string, decision: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/autonomy/${encodeURIComponent(id)}/${decision}`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || decision }),
      });
      setReason("");
      state.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }
  const cards = (items: Identity[]) =>
    items.map((i) => (
      <article key={i.id} className="panel">
        <span className="eyebrow">
          {i.kind} · REVISION {i.revision}
        </span>
        <h2>
          <Link to={`/portal/identity?entityId=${encodeURIComponent(i.id)}`}>
            {i.label} ↗
          </Link>
        </h2>
        <StateFields value={i.state} />
        <Link to={`/portal/twin?root=${encodeURIComponent(i.id)}`}>
          Relationships ↗
        </Link>
      </article>
    ));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAX UNIVERSE COMMAND CENTRE</div>
          <h1>
            {titles[area][0]}
            <span className="title-dot">.</span>
          </h1>
          <p>{titles[area][1]}</p>
        </div>
        <RefreshControl {...state} />
      </div>
      <AsyncState {...state} retry={state.reload} />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          {data.continuity && <p className="notice">{data.continuity}</p>}
          {data.identities && (
            <section className="universe-divisions">
              {cards(data.identities)}
            </section>
          )}
          {data.identity && (
            <>
              <section className="panel">
                <Link to="/portal/identity">All identities</Link>
                <h2>{data.identity.label}</h2>
                <p>
                  {data.identity.id} · Revision {data.identity.revision}
                </p>
                <h3>Invariants</h3>
                <StateFields value={data.identity.invariants} />
                <h3>Operational state</h3>
                <StateFields value={data.identity.state} />
              </section>
              <section className="panel">
                <h2>Continuity and decision memory</h2>
                {data.events?.map((e) => (
                  <article className="completion-entry" key={e.id}>
                    <strong>{e.type}</strong>
                    <p>
                      {e.actor} · {e.source} · {e.observed_at}
                    </p>
                    <StateFields value={e.evidence} />
                  </article>
                ))}
              </section>
            </>
          )}
          {data.proposals && (
            <>
              <section className="panel">
                <p>{data.policy}</p>
                <Link to="/portal/approvals">
                  Promotion and archive approvals ↗
                </Link>
                {role === "Governor" && (
                  <label className="completion-reason">
                    Decision reason
                    <input
                      value={reason}
                      maxLength={1000}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Required for an override"
                    />
                  </label>
                )}
              </section>
              <section className="universe-divisions">
                {data.proposals.length ? (
                  data.proposals.map((p) => (
                    <article className="panel" key={p.id}>
                      <span className="eyebrow">{p.status}</span>
                      <h2>{p.action}</h2>
                      <Link
                        to={`/portal/identity?entityId=${encodeURIComponent(p.entity_id)}`}
                      >
                        {p.entity_id} ↗
                      </Link>
                      <p>Expected identity revision {p.expected_revision}</p>
                      <StateFields value={p.evidence} />
                      {p.decision_reason && (
                        <p>Decision: {p.decision_reason}</p>
                      )}
                      {p.status === "pending" && role === "Governor" && (
                        <div className="completion-actions">
                          <button
                            disabled={busy}
                            onClick={() => decide(p.id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => decide(p.id, "reject")}
                          >
                            Reject
                          </button>
                          <button
                            disabled={busy || reason.trim().length < 10}
                            onClick={() => decide(p.id, "override")}
                          >
                            Override
                          </button>
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="notice">
                    No operational proposals awaiting review. Connected
                    automation submits evidence-backed proposals.
                  </p>
                )}
              </section>
            </>
          )}
          {area === "sports" && (
            <>
              <section className="panel">
                <h2>Feed status</h2>
                <p>
                  {data.configured
                    ? "Feed configured · observed data below"
                    : "Blocked · a production feed adapter has not been configured"}
                </p>
                <p>{data.source}</p>
                {data.health && (
                  <p>
                    {data.health.status} · {data.health.message} ·{" "}
                    {data.health.observedAt}
                  </p>
                )}
                <p>
                  Leagues:{" "}
                  {data.leagues?.join(", ") || "Awaiting configuration"}
                </p>
                <p>Capabilities: {data.capabilities?.join(", ")}</p>
                {data.recommendations?.map((r, i) => (
                  <article
                    className="completion-entry"
                    key={`${r.entityId}:${i}`}
                  >
                    <h3>{r.action}</h3>
                    <p>{r.confidence}</p>
                    <p>Sources: {r.sources.join(" · ")}</p>
                    <p>Tradeoffs: {r.tradeoffs.join(" · ")}</p>
                  </article>
                ))}
              </section>
              <section className="universe-divisions">
                {data.records?.length ? (
                  data.records.map((r) => (
                    <article className="panel" key={r.id}>
                      <span className="eyebrow">
                        {r.league} · {r.category} ·{" "}
                        {r.stale ? "STALE" : "OBSERVED"}
                      </span>
                      <h2>{r.label}</h2>
                      <dl>
                        {Object.entries(r.metrics).map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <a href={r.source} rel="noreferrer" target="_blank">
                        Provider source ↗
                      </a>
                      <p>{r.observedAt}</p>
                      <Link
                        to={`/portal/identity?entityId=${encodeURIComponent(r.entityId)}`}
                      >
                        Identity and history ↗
                      </Link>
                    </article>
                  ))
                ) : (
                  <p className="notice">
                    No production observations recorded. Missing intelligence
                    remains unknown.
                  </p>
                )}
              </section>
            </>
          )}
          {data.divisions && (
            <>
              <p className="notice">{data.governance}</p>
              <section className="universe-divisions">
                {cards(data.divisions)}
              </section>
              <section>
                <h2>Research outputs</h2>
                {data.lineage?.map((v) => (
                  <p key={v.output_id}>
                    <Link
                      to={`/portal/identity?entityId=${encodeURIComponent(v.output_id)}`}
                    >
                      {v.output_id}
                    </Link>{" "}
                    · Version {v.version}
                    {v.predecessor_id
                      ? ` · Supersedes ${v.predecessor_id}`
                      : ""}
                  </p>
                ))}
                {data.outputs?.length ? (
                  <div className="universe-divisions">
                    {cards(data.outputs)}
                  </div>
                ) : (
                  <p className="notice">
                    No research outputs submitted by connected research
                    workflows.
                  </p>
                )}
              </section>
            </>
          )}
          {data.providers && (
            <>
              <section className="panel">
                <h2>Daily cost controls</h2>
                <p>
                  Reserved: {data.reservedMicrousd} µUSD · Budget:{" "}
                  {data.dailyBudgetMicrousd} µUSD
                </p>
                <p>{data.method}</p>
                {data.usage?.map((u) => (
                  <p key={`${u.providerId}:${u.day}`}>
                    {u.providerId} · {u.day} · {u.requests} requests ·{" "}
                    {u.actualMicrousd ?? "Unknown"} µUSD observed ·{" "}
                    {u.reservedMicrousd} µUSD reserved
                  </p>
                ))}
              </section>
              <section className="universe-divisions">
                {data.providers.length ? (
                  data.providers.map((p) => (
                    <article className="panel" key={p.id}>
                      <h2>{p.id}</h2>
                      <p>
                        {p.kind} · {p.model} · {p.status}
                      </p>
                      <p>
                        {typeof p.health === "string"
                          ? p.health
                          : `${p.health.status} · ${p.health.createdAt}`}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="notice">
                    No model providers configured. BEMAX operational
                    intelligence remains available from recorded evidence.
                  </p>
                )}
              </section>
            </>
          )}
          {data.models && (
            <>
              <section className="panel">
                <h2>Unified Simulation Substrate</h2>
                <p>{data.method}</p>
                <p>Shared models: {data.models.join(", ")}</p>
                <p>Domains: {data.domains?.join(", ")}</p>
                <p>{data.runs?.length ?? 0} recorded scenario runs</p>
                <Link to="/portal/twin">Explore the live universe graph ↗</Link>
              </section>
              <section className="panel">
                <h2>XR-ready spatial views</h2>
                <p>
                  Live graph geometry, relationships and topology are available
                  for spatial clients. No XR rendering is included.
                </p>
                <p>
                  Ecosystem Galaxy · Product Constellation · Pipeline Universe ·
                  Department Operations Centre · Sports Intelligence Centre ·
                  Institute Research Centre · Quantum XR Command Room
                </p>
                <Link to="/portal/twin">Navigate live relationships ↗</Link>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
function StateFields({ value }: { value: string }) {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(value);
  } catch {
    return <p>Recorded details unavailable</p>;
  }
  return (
    <dl className="completion-fields">
      {Object.entries(data).map(([key, v]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>
            {Array.isArray(v)
              ? v.map(String).join(" · ")
              : typeof v === "object" && v !== null
                ? Object.entries(v)
                    .map(
                      ([k, x]) =>
                        `${k}: ${Array.isArray(x) ? x.join(", ") : String(x)}`,
                    )
                    .join(" · ")
                : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
