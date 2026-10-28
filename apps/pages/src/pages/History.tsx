import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "../components/AsyncState";
interface HistoryData {
  method: string;
  revisions?: {
    revision: number;
    kind: string;
    label: string;
    state: string;
    source_version: string;
    capture: string;
    captured_at: string;
  }[];
  nextAfterRevision?: number | null;
  coverage?: { startsAtRevision: number };
  researchRecords?: {
    id: string;
    label: string;
    version: number;
    predecessor_id: string | null;
    source: string;
    status: string;
  }[];
  edges?: { id: string; source: string; target: string; relation: string }[];
  publicationHistory?: {
    id: string;
    entity_id: string;
    type: string;
    actor: string;
    evidence: string;
    observed_at: string;
  }[];
  pagination?: { page: number; nextPage: number | null; complete: boolean };
}
export default function History({ kind }: { kind: "identity" | "research" }) {
  const [params] = useSearchParams(),
    entityId = params.get("entityId") ?? "";
  return (
    <HistoryContent
      key={`${kind}:${entityId}`}
      kind={kind}
      entityId={entityId}
    />
  );
}
function HistoryContent({
  kind,
  entityId,
}: {
  kind: "identity" | "research";
  entityId: string;
}) {
  const [cursors, setCursors] = useState([0]);
  const cursor = cursors[cursors.length - 1];
  const load = useCallback(
    (signal: AbortSignal) =>
      api<HistoryData>(
        kind === "identity"
          ? `/api/icv/revisions?entityId=${encodeURIComponent(entityId)}&afterRevision=${cursor}`
          : `/api/institute/history?entityId=${encodeURIComponent(entityId)}&page=${cursor}`,
        { signal },
      ),
    [kind, entityId, cursor],
  );
  const state = useApi(load),
    data = state.data;
  const next = data
    ? kind === "identity"
      ? data.nextAfterRevision
      : data.pagination?.nextPage
    : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONTINUITY AND LINEAGE</div>
          <h1>
            {kind === "identity"
              ? "Identity revision snapshots"
              : "Complete research history"}
          </h1>
          <p>{entityId}</p>
        </div>
      </div>
      <AsyncState {...state} retry={state.reload} />
      {data && (
        <>
          <p className="notice">{data.method}</p>
          {data.coverage && (
            <p>
              Snapshot coverage begins at revision{" "}
              {data.coverage.startsAtRevision}. Earlier recorded events remain
              in identity history.
            </p>
          )}
          <div className="filter-toolbar">
            <button
              disabled={cursors.length === 1}
              onClick={() => setCursors(cursors.slice(0, -1))}
            >
              Previous page
            </button>
            <span>Page {cursors.length}</span>
            <button
              disabled={next == null}
              onClick={() => next != null && setCursors([...cursors, next])}
            >
              Next page
            </button>
          </div>
          {data.revisions?.map((r) => (
            <article className="panel" key={r.revision}>
              <h2>
                {r.label} · Revision {r.revision}
              </h2>
              <p>
                {r.kind} · {r.capture} · {r.captured_at}
              </p>
              <p>Source version: {r.source_version || "Not supplied"}</p>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {JSON.stringify(JSON.parse(r.state), null, 2)}
              </pre>
            </article>
          ))}
          {data.researchRecords?.map((r) => (
            <article className="panel" key={r.id}>
              <h2>
                {r.label} · Version {r.version}
              </h2>
              <p>
                {r.id} · {r.status}
              </p>
              {r.predecessor_id && <p>Previous version: {r.predecessor_id}</p>}
              <a href={r.source} target="_blank" rel="noreferrer">
                Source artifact ↗
              </a>
            </article>
          ))}
          {data.edges && (
            <section className="panel">
              <h2>Lineage relationships</h2>
              {data.edges.map((e) => (
                <p key={e.id}>
                  {e.source} — {e.relation} → {e.target}
                </p>
              ))}
            </section>
          )}
          {data.publicationHistory && (
            <section className="panel">
              <h2>Versioned governance and events</h2>
              {data.publicationHistory.map((e) => (
                <article className="completion-entry" key={e.id}>
                  <strong>
                    {e.entity_id} · {e.type}
                  </strong>
                  <p>
                    {e.actor} · {e.observed_at}
                  </p>
                  <pre
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {e.evidence}
                  </pre>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
