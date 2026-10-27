import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "../components/AsyncState";
import { useGovernor } from "../layouts/GovernorLayout";
import {
  questions,
  actionKinds,
  type Reasoning,
} from "../../../../portal-os/bemax";
type Evidence = {
  provider: string;
  providerError?: string;
  sampledAt: string;
  reasoning: Reasoning[];
  navigation: { label: string; href: string }[];
};
type Message = {
  sequence?: number;
  role: string;
  content: string;
  evidence?: string;
};
type Action = {
  id: string;
  kind: string;
  rationale: string;
  status: string;
  result: string | null;
  decision_note: string | null;
};
const conversations = (signal?: AbortSignal) =>
  api<{ id: string; title: string }[]>("/api/bemax/conversations", { signal });
const providers = (signal?: AbortSignal) =>
  api<{ id: string; configured: boolean }[]>("/api/bemax/providers", {
    signal,
  });
const actions = (signal?: AbortSignal) =>
  api<Action[]>("/api/bemax/actions", { signal });
const memories = (signal?: AbortSignal) =>
  api<{ id: string; kind: string; content: string; created_at: string }[]>(
    "/api/bemax/memory",
    { signal },
  );
export default function Bemax({ embedded = false }: { embedded?: boolean }) {
  const { role } = useGovernor(),
    threads = useApi(conversations),
    models = useApi(providers),
    proposals = useApi(actions),
    memory = useApi(memories);
  const [conversation, setConversation] = useState(""),
    [draft, setDraft] = useState(""),
    [provider, setProvider] = useState("evidence"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [retry, setRetry] = useState<{ id: string; message: string } | null>(null);
  const load = useCallback(
    (signal: AbortSignal) =>
      conversation
        ? api<{ messages: Message[]; nextBefore: number | null }>(
            `/api/bemax/conversations/${encodeURIComponent(conversation)}`,
            { signal },
          )
        : Promise.resolve({ messages: [] as Message[], nextBefore: null }),
    [conversation],
  );
  const history = useApi(load);
  const [older, setOlder] = useState<Message[]>([]),
    [before, setBefore] = useState<number | null>(null);
  async function ask(message: string) {
    if (busy || !message.trim()) return;
    setBusy(true);
    setError("");
    const requestId =
      retry?.message === message ? retry.id : crypto.randomUUID();
    setRetry({ id: requestId, message });
    try {
      const r = await api<{ conversationId: string }>("/api/bemax/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          provider,
          requestId,
          ...(conversation ? { conversationId: conversation } : {}),
        }),
      });
      setConversation(r.conversationId);
      setDraft("");
      setRetry(null);
      history.reload();
      threads.reload();
      memory.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function propose(
    kind: string,
    rationale: string,
    entityId: string | null = null,
  ) {
    setBusy(true);
    setError("");
    try {
      await api("/api/bemax/actions", {
        method: "POST",
        body: JSON.stringify({ kind, rationale, entityId }),
      });
      proposals.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function decide(id: string, decision: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/bemax/actions/${encodeURIComponent(id)}/${decision}`, {
        method: "POST",
        body: JSON.stringify({ reason: note }),
      });
      proposals.reload();
      memory.reload();
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const [actionKind, setActionKind] = useState<string>("Generate Report"),
    [entity, setEntity] = useState(""),
    [rationale, setRationale] = useState(""),
    [memoryDraft, setMemoryDraft] = useState("");
  const identities = useApi(
    useCallback(
      (signal: AbortSignal) =>
        api<{ nodes: { id: string; label: string }[] }>(
          "/api/universe/navigation",
          { signal },
        ),
      [],
    ),
  );
  const messages = [...older, ...(history.data?.messages ?? [])];
  return (
    <section className={`bemax ${embedded ? "bemax-embedded" : ""}`}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAX UNIVERSE · PERSONAL INTELLIGENCE</div>
          <h1>
            BEMAX<span className="title-dot">.</span>
          </h1>
          <p>Understand your universe. Decide what happens next.</p>
        </div>
        <Link className="button" to="/portal/universe">
          Explore Universe ↗
        </Link>
      </div>
      <div className="bemax-layout">
        <aside className="panel bemax-history">
          <h2>Your conversations</h2>
          <button
            disabled={busy}
            onClick={() => {
              setConversation("");
              setOlder([]);
              setBefore(null);
              setRetry(null);
            }}
          >
            ＋ New conversation
          </button>
          <AsyncState {...threads} retry={threads.reload} />
          {threads.data?.map((t) => (
            <button
              key={t.id}
              disabled={busy}
              aria-pressed={conversation === t.id}
              onClick={() => {
                setConversation(t.id);
                setOlder([]);
                setBefore(null);
                setRetry(null);
              }}
            >
              {t.title}
            </button>
          ))}
          <label>
            Response provider
            <select
              value={provider}
              disabled={busy}
              onChange={(e) => setProvider(e.target.value)}
            >
              {models.data?.map((p) => (
                <option key={p.id} disabled={!p.configured} value={p.id}>
                  {p.id}
                  {p.configured ? "" : " · not configured"}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            Evidence mode works from live records. Model answers are advisory.
            Decisions remain with the Governor.
          </p>
        </aside>
        <div className="panel bemax-conversation">
          <AsyncState {...history} retry={history.reload} />
          {!messages.length && (
            <div className="bemax-welcome">
              <span className="bemax-orb" aria-hidden="true">
                ✦
              </span>
              <h2>Where should we focus?</h2>
              <p>Your portfolio, decisions and history in one conversation.</p>
              <div className="bemax-prompts">
                {questions.map((q) => (
                  <button
                    key={q}
                    disabled={busy}
                    onClick={() => {
                      setDraft(q);
                      void ask(q);
                    }}
                  >
                    {q} ↗
                  </button>
                ))}
              </div>
            </div>
          )}
          {(before ?? history.data?.nextBefore) && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api<{
                    messages: Message[];
                    nextBefore: number | null;
                  }>(
                    `/api/bemax/conversations/${encodeURIComponent(conversation)}?before=${before ?? history.data?.nextBefore}`,
                  );
                  setOlder([...r.messages, ...older]);
                  setBefore(r.nextBefore ?? 0);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Load earlier messages
            </button>
          )}
          <div className="bemax-transcript" aria-live="polite">
            {messages.map((m, i) => {
              const evidence: Evidence | undefined =
                m.evidence && m.evidence !== "{}"
                  ? JSON.parse(m.evidence)
                  : undefined;
              return (
                <article
                  key={m.sequence ?? i}
                  className={`bemax-message ${m.role}`}
                >
                  <strong>{m.role === "user" ? "You" : "BEMAX"}</strong>
                  <p>{m.content}</p>
                  {evidence && (
                    <>
                      <small>
                        {evidence.provider} ·{" "}
                        {new Date(evidence.sampledAt).toLocaleString()}
                      </small>
                      {evidence.providerError && (
                        <p className="notice">{evidence.providerError}</p>
                      )}
                      <div className="universe-drilldowns">
                        {evidence.navigation.map((n) => (
                          <Link key={n.href} to={n.href}>
                            {n.label} ↗
                          </Link>
                        ))}
                      </div>
                      <details>
                        <summary>
                          Reasoning, evidence & tradeoffs (
                          {evidence.reasoning.length})
                        </summary>
                        {evidence.reasoning.map((r, j) => (
                          <section className="bemax-reason" key={j}>
                            <span className="eyebrow">{r.domain}</span>
                            <h3>{r.title}</h3>
                            <p>{r.why}</p>
                            <ul>
                              {r.evidence.map((e) => (
                                <li key={e}>{e}</li>
                              ))}
                            </ul>
                            <p>
                              <strong>Confidence:</strong> {r.confidence}
                            </p>
                            <p>
                              <strong>Tradeoff:</strong> {r.tradeoffs}
                            </p>
                            <small>Sources: {r.sources.join(", ")}</small>
                            {role === "Governor" && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  propose(
                                    r.domain === "portfolio"
                                      ? "Publish Product"
                                      : r.domain === "resource"
                                        ? "Increase Resources"
                                        : r.domain === "forecast"
                                          ? "Create Forecast"
                                          : "Generate Report",
                                    `${r.title}. ${r.why}\nEvidence: ${r.evidence.join("; ")}\nSources: ${r.sources.join(", ")}\nConfidence: ${r.confidence}\nTradeoffs: ${r.tradeoffs}`,
                                    r.entityId,
                                  )
                                }
                              >
                                Propose{" "}
                                {r.domain === "portfolio"
                                  ? "publication review"
                                  : r.domain === "resource"
                                    ? "resource review"
                                    : r.domain === "forecast"
                                      ? "forecast"
                                      : "report"}
                              </button>
                            )}
                          </section>
                        ))}
                      </details>
                    </>
                  )}
                </article>
              );
            })}
          </div>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <form
            className="bemax-compose"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(draft);
            }}
          >
            <label htmlFor={embedded ? "governor-message" : "bemax-message"}>
              Ask BEMAX
            </label>
            <textarea
              id={embedded ? "governor-message" : "bemax-message"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={4000}
              required
              placeholder="What needs my attention today?"
            />
            <button className="primary" disabled={busy || !draft.trim()}>
              {busy ? "Working…" : "Send message ↗"}
            </button>
          </form>
        </div>
      </div>
      {role === "Governor" && (
        <section className="panel">
          <h2>Governor action review</h2>
          <p>
            Proposals require your decision. Reports and scenarios are generated
            on approval. Operational proposals remain pending ICVS review;
            approval here does not publish or change lifecycle.
          </p>
          <details>
            <summary>Draft an action proposal</summary>
            <form
              className="bemax-compose"
              onSubmit={(e) => {
                e.preventDefault();
                void propose(actionKind, rationale, entity || null);
              }}
            >
              <label>
                Action
                <select
                  value={actionKind}
                  onChange={(e) => setActionKind(e.target.value)}
                >
                  {actionKinds.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                Entity
                <select
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                >
                  <option value="">Entire portfolio (report / forecast)</option>
                  {identities.data?.nodes
                    .filter((n) =>
                      /^(product|project|department|division|approval):/.test(
                        n.id,
                      ),
                    )
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Why, evidence and tradeoffs
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  required
                  maxLength={4000}
                />
              </label>
              <button disabled={busy || !rationale.trim()}>
                Submit proposal for review
              </button>
            </form>
          </details>
          <div className="universe-drilldowns">
            <button
              disabled={busy}
              onClick={() =>
                propose(
                  "Generate Report",
                  "Generate a current portfolio report for Governor review.",
                )
              }
            >
              Propose portfolio report
            </button>
            <button
              disabled={busy}
              onClick={() =>
                propose(
                  "Create Forecast",
                  "Create a three-month flat revenue scenario using current reported revenue.",
                )
              }
            >
              Propose forecast
            </button>
          </div>
          <label>
            Decision reason
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              placeholder="Explain your decision (10–1000 characters)"
            />
          </label>
          <AsyncState {...proposals} retry={proposals.reload} />
          {proposals.data?.map((a) => (
            <article className="bemax-action" key={a.id}>
              <h3>
                {a.kind} <span className="badge">{a.status}</span>
              </h3>
              <p>{a.rationale}</p>
              {a.status === "pending" ? (
                <div className="universe-drilldowns">
                  {["approve", "reject", "override"].map((d) => (
                    <button
                      key={d}
                      disabled={busy || note.trim().length < 10}
                      onClick={() => decide(a.id, d)}
                    >
                      {d[0].toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <p>{a.decision_note}</p>
                  {a.result && (
                    <details>
                      <summary>Outcome</summary>
                      <pre>{JSON.stringify(JSON.parse(a.result), null, 2)}</pre>
                    </details>
                  )}
                </>
              )}
            </article>
          ))}
          {!proposals.data?.length && (
            <p className="muted">
              No proposals yet. Start with a recommendation above.
            </p>
          )}
        </section>
      )}
      <section className="panel">
        <details>
          <summary>Persistent memory</summary>
          {role === "Governor" && (
            <form
              className="bemax-compose"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api("/api/bemax/memory", {
                    method: "POST",
                    body: JSON.stringify({
                      kind: "strategy",
                      content: memoryDraft,
                    }),
                  });
                  setMemoryDraft("");
                  memory.reload();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Remember a strategy or decision
                <textarea
                  required
                  maxLength={4000}
                  value={memoryDraft}
                  onChange={(e) => setMemoryDraft(e.target.value)}
                />
              </label>
              <button disabled={busy || !memoryDraft.trim()}>
                Save memory
              </button>
            </form>
          )}
          <AsyncState {...memory} retry={memory.reload} />
          {memory.data?.map((m) => (
            <article key={m.id}>
              <strong>
                {m.kind} · {m.created_at}
              </strong>
              <p className="bemax-memory">{m.content}</p>
            </article>
          ))}
          {!memory.data?.length && <p>No personal memories recorded yet.</p>}
        </details>
      </section>
    </section>
  );
}
