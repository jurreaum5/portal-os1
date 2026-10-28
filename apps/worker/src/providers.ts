import { readObject } from "./customer-auth";
import type { Env } from "./types";
import { canonical, object, text } from "../../../uss/contracts";
import { bounded, fail } from "./substrate";
export type ProviderState =
  | "CONNECTED"
  | "DEGRADED"
  | "STALE"
  | "BLOCKED"
  | "DISCONNECTED"
  | "UNCONFIGURED";
export interface ProviderConfig {
  id: string;
  name: string;
  type: "openai" | "gemini" | "claude" | "local";
  models: string[];
  capabilities: string[];
  credentialConfigured: boolean;
  enabled: boolean;
  budgetUsd: number;
  staleAfterMs: number;
}
interface Observation {
  sequence: number;
  provider_id: string;
  kind: string;
  status: ProviderState;
  operation_id: string;
  metadata: string;
  created_at: string;
}
export function providerConfig(env: Env): ProviderConfig[] {
  let configured: unknown;
  try {
    configured = JSON.parse(env.INTELLIGENCE_PROVIDERS ?? "[]");
  } catch {
    return fail("Provider configuration is invalid", 503);
  }
  if (!Array.isArray(configured) || configured.length > 32)
    fail("Provider configuration is invalid", 503);
  const ids = new Set<string>();
  for (const p of configured as ProviderConfig[]) {
    if (
      !object(p) ||
      !text(p.id, 80) ||
      !text(p.name) ||
      !["openai", "gemini", "claude", "local"].includes(p.type) ||
      !Array.isArray(p.models) ||
      !p.models.length ||
      p.models.length > 100 ||
      !p.models.every((v) => text(v)) ||
      !Array.isArray(p.capabilities) ||
      !p.capabilities.length ||
      p.capabilities.length > 100 ||
      !p.capabilities.every((v) => text(v)) ||
      typeof p.credentialConfigured !== "boolean" ||
      typeof p.enabled !== "boolean" ||
      typeof p.budgetUsd !== "number" ||
      !Number.isFinite(p.budgetUsd) ||
      p.budgetUsd < 0 ||
      !Number.isSafeInteger(p.staleAfterMs) ||
      p.staleAfterMs < 1000 ||
      p.staleAfterMs > 86400000 ||
      ids.has(p.id)
    )
      fail("Provider configuration is invalid", 503);
    ids.add(p.id);
  }
  return configured as ProviderConfig[];
}
function configurationKey(p: ProviderConfig) {
  return canonical({
    id: p.id,
    type: p.type,
    models: p.models,
    capabilities: p.capabilities,
    credentialConfigured: p.credentialConfigured,
    enabled: p.enabled,
    budgetUsd: p.budgetUsd,
    staleAfterMs: p.staleAfterMs,
  });
}
async function observe(
  env: Env,
  p: ProviderConfig,
  kind: string,
  status: ProviderState,
  operationId: string,
  metadata: unknown,
) {
  await env.DB.prepare(
    "INSERT INTO provider_observations(provider_id,kind,status,operation_id,metadata,created_at) VALUES (?,?,?,?,?,?)",
  )
    .bind(
      p.id,
      kind,
      status,
      operationId,
      JSON.stringify({
        ...(metadata as Record<string, unknown>),
        configurationKey: configurationKey(p),
      }),
      new Date().toISOString(),
    )
    .run();
}
export async function providers(env: Env) {
  const configurations = providerConfig(env);
  const statuses = await Promise.all(
    configurations.map(async (p) => {
      const latest = await env.DB.prepare(
        "SELECT * FROM provider_observations WHERE provider_id=? AND kind IN ('health','failure','recovery','success') ORDER BY sequence DESC LIMIT 1",
      )
        .bind(p.id)
        .first<Observation>();
      const success = await env.DB.prepare(
        "SELECT created_at FROM provider_observations WHERE provider_id=? AND status='CONNECTED' AND kind IN ('health','recovery','success') ORDER BY sequence DESC LIMIT 1",
      )
        .bind(p.id)
        .first("created_at");
      const failure = await env.DB.prepare(
        "SELECT created_at FROM provider_observations WHERE provider_id=? AND kind='failure' ORDER BY sequence DESC LIMIT 1",
      )
        .bind(p.id)
        .first("created_at");
      const spent = Number(
        (await env.DB.prepare(
          "SELECT COALESCE(SUM(json_extract(metadata,'$.costUsd')),0) AS spent FROM provider_observations WHERE provider_id=? AND kind='cost'",
        )
          .bind(p.id)
          .first("spent")) ?? 0,
      );
      const status: ProviderState = !p.credentialConfigured
        ? "UNCONFIGURED"
        : !p.enabled || spent >= p.budgetUsd
          ? "BLOCKED"
          : !env.INTELLIGENCE_GATEWAY
            ? "DISCONNECTED"
            : !latest ||
                JSON.parse(latest.metadata).configurationKey !==
                  configurationKey(p)
              ? "STALE"
              : Date.now() - Date.parse(latest.created_at) > p.staleAfterMs
                ? "STALE"
                : latest.status;
      return {
        ...p,
        status,
        credentialStatus: p.credentialConfigured ? "configured" : "missing",
        healthStatus: status,
        budgetStatus: spent >= p.budgetUsd ? "exhausted" : "available",
        spentUsd: spent,
        lastSuccess: success,
        lastFailure: failure,
        reason:
          status === "UNCONFIGURED"
            ? "Credentials are missing; no request will be sent."
            : status === "BLOCKED"
              ? "Disabled or budget exhausted."
              : status === "DISCONNECTED"
                ? "Provider adapter unavailable."
                : status === "STALE"
                  ? "A fresh health observation is required."
                  : status === "DEGRADED"
                    ? "Last adapter operation failed."
                    : "Last operation succeeded.",
        affectedCapabilities: status === "CONNECTED" ? [] : p.capabilities,
        fallbackProviders: [] as string[],
      };
    }),
  );
  return statuses.map((p) => ({
    ...p,
    fallbackProviders: statuses
      .filter(
        (q) =>
          q.id !== p.id &&
          q.status === "CONNECTED" &&
          q.capabilities.some((c) => p.capabilities.includes(c)),
      )
      .map((q) => q.id),
  }));
}
export async function providerHealth(
  env: Env,
  id: string,
  operationId = crypto.randomUUID(),
  recovery = false,
) {
  const p = (await providers(env)).find((p) => p.id === id);
  if (!p) return fail("Provider not configured", 404);
  if (
    ["UNCONFIGURED", "BLOCKED"].includes(p.status) ||
    !env.INTELLIGENCE_GATEWAY
  ) {
    await observe(env, p, "health", p.status, operationId, {
      reason: p.reason,
    });
    return p;
  }
  try {
    const response = await env.INTELLIGENCE_GATEWAY!.fetch(
      "https://intelligence.internal/health",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": operationId,
        },
        body: JSON.stringify({ providerId: id, operationId }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const result: unknown = await readObject(response);
    if (
      !response.ok ||
      !object(result) ||
      result.providerId !== id ||
      result.healthy !== true ||
      result.operationId !== operationId
    )
      throw new Error("Invalid health evidence");
    await observe(
      env,
      p,
      recovery ? "recovery" : "health",
      "CONNECTED",
      operationId,
      { validated: true },
    );
  } catch {
    await observe(env, p, "failure", "DEGRADED", operationId, {
      reason: "Adapter health check failed; inspect provider diagnostics.",
    });
  }
  return (await providers(env)).find((p) => p.id === id)!;
}
/** Trusted adapter routing. Caller must supply an approved operation ID. No provider URLs or secrets come from requests. */
export async function routeProvider(
  env: Env,
  capability: string,
  model: string,
  input: unknown,
  operationId: string,
) {
  const candidates = (await providers(env)).filter(
    (p) =>
      p.enabled &&
      p.credentialConfigured &&
      p.capabilities.includes(capability) &&
      p.models.includes(model) &&
      p.budgetStatus === "available",
  );
  for (const p of candidates) {
    if (!env.INTELLIGENCE_GATEWAY) break;
    await observe(env, p, "routing", p.status, operationId, {
      capability,
      model,
    });
    let result: Record<string, unknown>;
    try {
      const response = await env.INTELLIGENCE_GATEWAY.fetch(
        "https://intelligence.internal/infer",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `${operationId}:${p.id}`,
          },
          body: JSON.stringify({
            providerId: p.id,
            capability,
            model,
            input,
            operationId,
            budgetRemainingUsd: p.budgetUsd - p.spentUsd,
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      result = await readObject(response);
      if (
        !response.ok ||
        !object(result) ||
        result.providerId !== p.id ||
        result.operationId !== operationId ||
        typeof result.costUsd !== "number" ||
        !Number.isFinite(result.costUsd) ||
        result.costUsd < 0 ||
        !("output" in result)
      )
        throw new Error("Invalid execution evidence");
    } catch {
      await observe(env, p, "failure", "DEGRADED", operationId, {
        capability,
        model,
        reason: "Provider request failed; routing to next eligible adapter.",
      });
      continue;
    }
    // Persistence failures must not dispatch another provider after successful inference.
    // Adapter must enforce reservation, deduplicate billing, and never charge twice for an operation ID.
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO provider_observations(provider_id,kind,status,operation_id,metadata,created_at) SELECT ?,'cost','CONNECTED',?,?,? WHERE NOT EXISTS (SELECT 1 FROM provider_observations WHERE provider_id=? AND kind='cost' AND operation_id=?)",
      ).bind(
        p.id,
        operationId,
        JSON.stringify({ costUsd: result.costUsd }),
        new Date().toISOString(),
        p.id,
        operationId,
      ),
      env.DB.prepare(
        "INSERT INTO provider_observations(provider_id,kind,status,operation_id,metadata,created_at) VALUES (?,'success','CONNECTED',?,?,?)",
      ).bind(
        p.id,
        operationId,
        JSON.stringify({
          capability,
          model,
          configurationKey: configurationKey(p),
        }),
        new Date().toISOString(),
      ),
    ]);
    return {
      providerId: p.id,
      output: result.output,
      costUsd: result.costUsd,
    };
  }
  return fail("No available provider supports this model and capability", 503);
}
export async function providerHistory(env: Env, id: string) {
  return bounded<Observation>(
    env,
    "SELECT * FROM provider_observations WHERE provider_id=? ORDER BY sequence LIMIT 5001",
    id,
  );
}
