import { useState } from "react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "./AsyncState";
import { useGovernor } from "../layouts/GovernorLayout";
import type { Revision } from "../../../../uss/contracts";
interface Recovery {
  id: string;
  identity_id: string;
  version: number;
  target_version: number;
  status: string;
  reason: string;
}
const load = (signal?: AbortSignal) =>
  api<Recovery[]>("/api/uss/recoveries", { signal });
export function SubstrateRecovery({
  selected,
  onChange,
}: {
  selected: Revision | null;
  onChange: () => void;
}) {
  const state = useApi(load),
    governor = useGovernor().role === "Governor";
  const [target, setTarget] = useState(1),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      state.reload();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recovery failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Governed recovery</h2>
      <p>
        Restore a previously approved registry revision. Detection, review,
        approval, compensation and validation remain in history.
      </p>
      <AsyncState {...state} retry={state.reload} />
      {error && <p role="alert">{error}</p>}
      {governor && (
        <>
          <label htmlFor="recovery-reason">
            Recovery review / decision reason
          </label>
          <textarea
            id="recovery-reason"
            maxLength={2000}
            minLength={10}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {selected && selected.version > 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(
                  `/api/uss/records/${selected.id}/recover?version=${selected.version}`,
                  { targetVersion: target, reason },
                );
              }}
            >
              <p>
                Selected identity: {selected.title} · v{selected.version}
              </p>
              <label htmlFor="restore-version">
                Approved version to restore
              </label>
              <input
                id="restore-version"
                type="number"
                min={1}
                max={selected.version - 1}
                required
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
              <button disabled={busy || reason.trim().length < 10}>
                Recommend restoration
              </button>
            </form>
          )}
        </>
      )}
      {!state.data?.length && <p>No recovery recommendations recorded.</p>}
      {state.data?.map((r) => (
        <article key={r.id}>
          <h3>{r.identity_id}</h3>
          <p>
            v{r.version} → v{r.target_version} · <strong>{r.status}</strong>
          </p>
          <p>{r.reason}</p>
          {governor && (
            <div className="actions">
              {(r.status === "recommended"
                ? ["review"]
                : r.status === "reviewed"
                  ? ["approve", "reject", "override"]
                  : r.status === "approved"
                    ? ["execute"]
                    : []
              ).map((action) => (
                <button
                  key={action}
                  disabled={busy || reason.trim().length < 10}
                  onClick={() =>
                    void submit(`/api/uss/recoveries/${r.id}/${action}`, {
                      reason,
                    })
                  }
                >
                  {action === "execute"
                    ? "Execute approved restoration"
                    : action[0].toUpperCase() + action.slice(1)}
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
