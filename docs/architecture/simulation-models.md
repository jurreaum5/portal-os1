# Provider Adapters

## Purpose

This document defines the production provider specification for all external model and inference integrations used by Portal-OS1.

## Supported adapters

### OpenAI Adapter

Purpose:
- production language model access
- structured completion and evaluation workflows
- cost-aware generation and fallback control

Required methods:
- `health()`
- `listModels()`
- `capabilities()`
- `complete()`
- `estimateCost()`

### Gemini Adapter

Purpose:
- multimodal and language model access
- integration parity with the same operational contract
- resilient failover and health monitoring

Required methods:
- `health()`
- `listModels()`
- `capabilities()`
- `complete()`
- `estimateCost()`

### Claude Adapter

Purpose:
- reasoning-heavy model workflows
- governance-safe generation patterns
- production traceability and fallback support

Required methods:
- `health()`
- `listModels()`
- `capabilities()`
- `complete()`
- `estimateCost()`

### Local Model Adapter

Purpose:
- deterministic local inference for constrained or offline environments
- support for local development, testing, and emergency fallback
- governed model execution without cloud dependency

Required methods:
- `health()`
- `listModels()`
- `capabilities()`
- `complete()`
- `estimateCost()`

## Shared provider contract

Every adapter must implement the following interface contract:

```ts
interface ProviderAdapter {
  health(): Promise<'CONNECTED' | 'DEGRADED' | 'STALE' | 'BLOCKED' | 'DISCONNECTED' | 'UNCONFIGURED'>;
  listModels(): Promise<string[]>;
  capabilities(): Promise<Record<string, unknown>>;
  complete(input: unknown): Promise<unknown>;
  estimateCost(input: unknown): Promise<number>;
}
```

## Provider states

- `CONNECTED` — healthy and operational
- `DEGRADED` — partially functional, degraded capacity or elevated latency
- `STALE` — no recent successful validation or too old to trust without check
- `BLOCKED` — explicitly access-blocked or policy-blocked
- `DISCONNECTED` — provider unreachable or connection absent
- `UNCONFIGURED` — required configuration missing or not initialized

## Production requirements

- Every provider must report state through `health()`.
- All adapters must expose a common capability profile.
- Cost estimation must be explicit and auditable.
- Failover behavior must be deterministic and tested.
- Unconfigured or blocked providers must not silently continue as active.
- Provider health and state transitions must be visible to monitoring and alerting systems.

## Operational governance

Provider actions must be aligned with the Institute policy set and must preserve:

- provenance
- approval tracking
- retry and failover semantics
- recovery documentation
- audit export coverage
