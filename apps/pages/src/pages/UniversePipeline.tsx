import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "../components/AsyncState";
import { UniverseNav } from "./Universe";
type Stage = {
  stage: string;
  queueDepth: number;
  blocked: number;
  running: number;
  risk: number | null;
  capacity: number | null;
  daysToClear: number | null;
  products: { id: string; name: string }[];
};
const load = (signal?: AbortSignal) =>
  api<{ stages: Stage[]; method: string }>("/api/universe/pipeline", {
    signal,
  });
export default function UniversePipeline() {
  const state = useApi(load, 15000);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAX UNIVERSE · DELIVERY</div>
          <h1>Pipeline universe.</h1>
          <p>Follow flow, inspect bottlenecks and review delivery capacity.</p>
        </div>
      </div>
      <UniverseNav />
      <AsyncState {...state} retry={state.reload} />
      {state.data && (
        <>
          <p className="notice">{state.data.method}</p>
          <div className="universe-pipeline">
            {state.data.stages.map((s) => (
              <section className="panel" key={s.stage}>
                <span className={`badge ${s.blocked ? "attention" : ""}`}>
                  {s.blocked ? "Bottleneck" : "Stage"}
                </span>
                <h2>{s.stage}</h2>
                <strong className="pipeline-count">{s.queueDepth}</strong>
                <p>
                  Queue depth · {s.running} running · {s.blocked} blocked
                </p>
                <dl>
                  <dt>Capacity</dt>
                  <dd>{s.capacity ?? "Not configured"}</dd>
                  <dt>Risk heuristic</dt>
                  <dd>{s.risk ?? "No observations"}</dd>
                  <dt>Queue clearance</dt>
                  <dd>
                    {s.daysToClear === null
                      ? "Insufficient history"
                      : `${s.daysToClear} days`}
                  </dd>
                </dl>
                {s.products.map((p) => (
                  <Link
                    className="stat-row"
                    key={p.id}
                    to={`/portal/products/${encodeURIComponent(p.id)}/twin`}
                  >
                    {p.name} ↗
                  </Link>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
