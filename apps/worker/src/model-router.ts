import { sha256 } from "./access";
import { connectionStatus } from "../../../portal-os/production";
import type { Env } from "./types";
import { readObject } from "./customer-auth";
export interface ModelProvider {
  id: string;
  kind: "openai" | "gemini" | "claude" | "local";
  baseUrl: string;
  model: string;
  inputMicrousdPerToken: number;
  outputMicrousdPerToken: number;
  maxOutputTokens: number;
  maxInputBytes: number;
}
interface ModelConfig {
  dailyBudgetMicrousd: number;
  dailyRequestLimit?: number;
  providers: ModelProvider[];
}
export function modelConfig(env: Env): ModelConfig {
  if (!env.MODEL_CONFIG) return { dailyBudgetMicrousd: 0, providers: [] };
  const c = JSON.parse(env.MODEL_CONFIG) as ModelConfig;
  if (
    !c ||
    !Number.isSafeInteger(c.dailyBudgetMicrousd) ||
    c.dailyBudgetMicrousd < 0 ||
    !Array.isArray(c.providers) ||
    c.providers.length > 8
  )
    throw new Error("Invalid model routing configuration");
  c.dailyRequestLimit ??= 100;
  if (
    !Number.isSafeInteger(c.dailyRequestLimit) ||
    c.dailyRequestLimit < 1 ||
    c.dailyRequestLimit > 100000
  )
    throw new Error("Invalid daily model request limit");
  const ids = new Set<string>();
  for (const p of c.providers) {
    if (
      !p ||
      !/^[a-z0-9_-]{1,60}$/.test(p.id) ||
      ids.has(p.id) ||
      !["openai", "gemini", "claude", "local"].includes(p.kind) ||
      typeof p.model !== "string" ||
      !/^[a-zA-Z0-9._:/-]{1,150}$/.test(p.model)
    )
      throw new Error("Invalid model provider");
    ids.add(p.id);
    const url = new URL(p.baseUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Providers require a credential-free HTTPS endpoint");
    for (const value of [
      p.inputMicrousdPerToken,
      p.outputMicrousdPerToken,
      p.maxOutputTokens,
      p.maxInputBytes,
    ])
      if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000)
        throw new Error("Invalid model cost or token limit");
    if (!p.maxOutputTokens || !p.maxInputBytes)
      throw new Error("Positive model limits required");
  }
  return c;
}
async function callProvider(
  p: ModelProvider,
  key: string | undefined,
  prompt: string,
) {
  if (p.kind !== "local" && !key)
    throw new Error("Provider credential is not configured");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let path: string, body: unknown;
  if (p.kind === "claude") {
    path = "/messages";
    headers["x-api-key"] = key!;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: p.model,
      max_tokens: p.maxOutputTokens,
      messages: [{ role: "user", content: prompt }],
    };
  } else if (p.kind === "gemini") {
    path = `/models/${encodeURIComponent(p.model)}:generateContent`;
    headers["x-goog-api-key"] = key!;
    body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: p.maxOutputTokens },
    };
  } else if (p.kind === "openai") {
    path = "/responses";
    headers.Authorization = `Bearer ${key}`;
    body = {
      model: p.model,
      input: prompt,
      max_output_tokens: p.maxOutputTokens,
      store: false,
    };
  } else {
    path = "/chat/completions";
    if (key) headers.Authorization = `Bearer ${key}`;
    body = {
      model: p.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: p.maxOutputTokens,
    };
  }
  const response = await fetch(p.baseUrl.replace(/\/$/, "") + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Provider returned HTTP ${response.status}`);
  const data = (await readObject(
    new Request("https://model.internal", {
      method: "POST",
      body: response.body,
      duplex: "half",
    } as RequestInit),
  )) as Record<string, any>;
  let text: unknown, input: unknown, output: unknown;
  if (p.kind === "claude") {
    text = data.content
      ?.filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
    input = data.usage?.input_tokens;
    output = data.usage?.output_tokens;
  } else if (p.kind === "gemini") {
    text = data.candidates?.[0]?.content?.parts
      ?.map((c: any) => c.text ?? "")
      .join("\n");
    input = data.usageMetadata?.promptTokenCount;
    output = Number(data.usageMetadata?.totalTokenCount) - Number(input);
  } else if (p.kind === "openai") {
    text = data.output
      ?.filter((o: any) => o.type === "message")
      .flatMap((o: any) => o.content ?? [])
      .filter((c: any) => c.type === "output_text")
      .map((c: any) => c.text)
      .join("\n");
    input = data.usage?.input_tokens;
    output = data.usage?.output_tokens;
  } else {
    text = data.choices?.[0]?.message?.content;
    input = data.usage?.prompt_tokens;
    output = data.usage?.completion_tokens;
  }
  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 12000 ||
    !Number.isSafeInteger(input) ||
    !Number.isSafeInteger(output) ||
    Number(input) < 0 ||
    Number(output) < 0
  )
    throw new Error("Invalid provider result or missing usage");
  return { text, input: Number(input), output: Number(output) };
}
/** Reserve budget atomically before every attempt. Failed/unknown charges retain their reservation. */
export async function routeModel(
  env: Env,
  prompt: string,
  providerId?: string,
) {
  const config = modelConfig(env),
    day = new Date().toISOString().slice(0, 10);
  const credentials = JSON.parse(env.MODEL_CREDENTIALS ?? "{}") as Record<
    string,
    string
  >;
  const failures: { providerId: string; reason: string }[] = [];
  for (const p of config.providers.filter(
    (p) => !providerId || p.id === providerId,
  )) {
    const bytes = new TextEncoder().encode(prompt).length;
    if (bytes > p.maxInputBytes) {
      failures.push({
        providerId: p.id,
        reason: "Input exceeds configured provider limit",
      });
      continue;
    }
    // Byte count is a conservative token bound plus protocol overhead. Never infer prices.
    const reserve =
      (bytes + 2048) * p.inputMicrousdPerToken +
      p.maxOutputTokens * p.outputMicrousdPerToken;
    if (!Number.isSafeInteger(reserve))
      throw new Error("Cost reservation overflow");
    const id = crypto.randomUUID();
    const claimed = await env.DB.prepare(
      `INSERT INTO model_attempts(id,provider_id,day,reserved_microusd,status,config_fingerprint)
 SELECT ?,?,?,?,'reserved',? WHERE COALESCE((SELECT SUM(reserved_microusd) FROM model_attempts WHERE day=?),0)+?<=? AND (SELECT COUNT(*) FROM model_attempts WHERE day=?)<?`,
    )
      .bind(
        id,
        p.id,
        day,
        reserve,
        await sha256(
          JSON.stringify({
            provider: p,
            credential: credentials[p.id] ?? null,
          }),
        ),
        day,
        reserve,
        config.dailyBudgetMicrousd,
        day,
        config.dailyRequestLimit ?? 100,
      )
      .run();
    if (!claimed.meta.changes) {
      failures.push({
        providerId: p.id,
        reason: "Daily budget or request limit exhausted",
      });
      continue;
    }
    const started = Date.now();
    try {
      const result = await callProvider(p, credentials[p.id], prompt);
      const actual =
        result.input * p.inputMicrousdPerToken +
        result.output * p.outputMicrousdPerToken;
      await env.DB.prepare(
        "UPDATE model_attempts SET status='succeeded',actual_microusd=?,reserved_microusd=MAX(reserved_microusd,?),latency_ms=? WHERE id=?",
      )
        .bind(actual, actual, Date.now() - started, id)
        .run();
      return {
        providerId: p.id,
        text: result.text,
        usage: {
          inputTokens: result.input,
          outputTokens: result.output,
          actualMicrousd: actual,
        },
        failures,
      };
    } catch {
      await env.DB.prepare(
        "UPDATE model_attempts SET status='failed',latency_ms=? WHERE id=?",
      )
        .bind(Date.now() - started, id)
        .run();
      failures.push({
        providerId: p.id,
        reason:
          "Provider unavailable or response failed validation; reservation retained",
      });
    }
  }
  return {
    blocked: true,
    reason: config.providers.length
      ? "No provider could complete within configured controls"
      : "No model providers configured",
    failures,
  };
}
export async function modelHealth(env: Env) {
  const config = modelConfig(env);
  const credentials = JSON.parse(env.MODEL_CREDENTIALS ?? "{}");
  const observations = await Promise.all(
    config.providers.map(async (p) => {
      const fingerprint = await sha256(
        JSON.stringify({ provider: p, credential: credentials[p.id] ?? null }),
      );
      const latest = await env.DB.prepare(
        "SELECT provider_id AS providerId,status,latency_ms AS latencyMs,created_at AS createdAt FROM model_attempts WHERE provider_id=? AND config_fingerprint=? ORDER BY rowid DESC LIMIT 1",
      )
        .bind(p.id, fingerprint)
        .first<{
          providerId: string;
          status: string;
          latencyMs: number | null;
          createdAt: string;
        }>();
      const recentFailures = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM model_attempts WHERE provider_id=? AND config_fingerprint=? AND status='failed' AND created_at>=datetime('now','-24 hours')",
      )
        .bind(p.id, fingerprint)
        .first<number>("count");
      return { id: p.id, latest, recentFailures: recentFailures ?? 0 };
    }),
  );
  const results = {
    results: observations.flatMap((o) => (o.latest ? [o.latest] : [])),
  };
  const spent = await env.DB.prepare(
    "SELECT COALESCE(SUM(reserved_microusd),0) AS reserved FROM model_attempts WHERE day=?",
  )
    .bind(new Date().toISOString().slice(0, 10))
    .first<number>("reserved");
  return {
    providers: config.providers.map((p) => {
      const observation = observations.find((o) => o.id === p.id)!;
      const status = connectionStatus(
        true,
        p.kind === "local" || !!credentials[p.id],
        observation.latest?.status,
        observation.latest?.createdAt,
      );
      return {
        id: p.id,
        kind: p.kind,
        model: p.model,
        capabilities: ["text-generation"],
        limits: {
          maxInputBytes: p.maxInputBytes,
          maxOutputTokens: p.maxOutputTokens,
        },
        credentialConfigured: p.kind === "local" || !!credentials[p.id],
        status:
          status === "CONNECTED" && observation.recentFailures > 0
            ? "DEGRADED"
            : status,
        recentFailures: observation.recentFailures,
        health:
          results.results.find((r) => r.providerId === p.id) ??
          "No request samples",
      };
    }),
    usage: (
      await env.DB.prepare(
        "SELECT provider_id AS providerId,day,COUNT(*) AS requests,SUM(actual_microusd) AS actualMicrousd,SUM(reserved_microusd) AS reservedMicrousd FROM model_attempts GROUP BY provider_id,day ORDER BY day DESC LIMIT 200",
      ).all()
    ).results,
    attempts: results.results,
    reservedMicrousd: spent,
    dailyBudgetMicrousd: config.dailyBudgetMicrousd,
    dailyRequestLimit: config.dailyRequestLimit ?? 100,
    method:
      "Observed request outcomes, not an external uptime guarantee. Failed attempts retain reservations.",
  };
}
