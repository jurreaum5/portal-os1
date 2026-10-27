export type ConnectionStatus =
  | "CONNECTED"
  | "DEGRADED"
  | "DISCONNECTED"
  | "BLOCKED"
  | "UNAVAILABLE"
  | "STALE";
export function connectionStatus(
  configured: boolean,
  credential: boolean,
  outcome: string | undefined,
  observedAt: string | undefined,
  now = Date.now(),
): ConnectionStatus {
  if (!configured) return "DISCONNECTED";
  if (!credential) return "BLOCKED";
  if (!outcome || !observedAt) return "UNAVAILABLE";
  const timestamp = Date.parse(
    observedAt.includes("T") ? observedAt : observedAt.replace(" ", "T") + "Z",
  );
  if (
    !Number.isFinite(timestamp) ||
    timestamp > now + 60000 ||
    timestamp < now - 86400000
  )
    return "STALE";
  if (outcome === "blocked") return "BLOCKED";
  if (outcome === "failed") return "DISCONNECTED";
  return outcome === "succeeded" || outcome === "observed"
    ? "CONNECTED"
    : "UNAVAILABLE";
}
