# Provider Adapters Specification

Version: 1.0

Status: Required For Production

Authority: USS + BEMAX + Provider Operations

---

# Purpose

Provider Adapters are the standardized integration layer between MAX Universe and external AI model providers.

Provider Adapters prevent:

- Vendor lock-in
- Provider-specific business logic
- Direct provider coupling
- Hardcoded model integrations

All model access must occur through Provider Adapters.

Direct calls to external model APIs are prohibited outside the adapter layer.

---

# Supported Providers

## OpenAI Adapter

Provider Id:

```text
openai
```

Primary Capabilities:

- General Reasoning
- Strategic Analysis
- Summarization
- Structured Outputs

---

## Gemini Adapter

Provider Id:

```text
gemini
```

Primary Capabilities:

- Multimodal Processing
- Research Assistance
- Long Context Analysis

---

## Claude Adapter

Provider Id:

```text
claude
```

Primary Capabilities:

- Long Context Reasoning
- Policy Analysis
- Documentation Review

---

## Local Model Adapter

Provider Id:

```text
local
```

Supported Platforms:

```text
Ollama

vLLM

LM Studio
```

Primary Capabilities:

- Offline Inference
- Experimental Models
- Private Processing

---

# Adapter Architecture

```text
BEMAX
     ↓

Provider Router
     ↓

Provider Adapter Layer
     ↓

Provider Runtime
```

Business logic must remain above the adapter layer.

Provider-specific implementation remains below the adapter layer.

---

# Standard Interface

```ts
export interface ProviderAdapter {
  providerId: string;

  providerName: string;

  health(): Promise<ProviderHealth>;

  listModels(): Promise<ModelDescriptor[]>;

  capabilities(): Promise<ProviderCapabilities>;

  complete(
    request: CompletionRequest
  ): Promise<CompletionResponse>;

  estimateCost(
    request: CostRequest
  ): Promise<CostEstimate>;
}
```

---

# Provider Health

All providers must implement:

```ts
interface ProviderHealth {
  state: ProviderState;

  latencyMs: number;

  lastSuccessfulRequest?: string;

  lastFailure?: string;

  uptimePct?: number;

  message?: string;
}
```

---

# Provider States

Mandatory states:

```text
CONNECTED

DEGRADED

STALE

BLOCKED

DISCONNECTED

UNCONFIGURED
```

---

## CONNECTED

Requirements:

```text
Credentials Valid

Requests Succeed

Health Checks Pass
```

---

## DEGRADED

Requirements:

```text
Provider Available

Performance Reduced

Latency Increased
```

---

## STALE

Requirements:

```text
Provider Reachable

Health Information Expired
```

---

## BLOCKED

Requirements:

```text
Policy Restriction

Budget Restriction

Administrative Restriction
```

---

## DISCONNECTED

Requirements:

```text
Provider Unreachable

Connection Failure
```

---

## UNCONFIGURED

Requirements:

```text
Missing Credentials

Missing Configuration
```

UNCONFIGURED is not equivalent to DISCONNECTED.

---

# Model Metadata

All models must expose:

```ts
interface ModelDescriptor {
  id: string;

  provider: string;

  displayName: string;

  version?: string;

  maxContext?: number;

  supportsTools?: boolean;

  supportsVision?: boolean;

  supportsReasoning?: boolean;
}
```

---

# Capability Discovery

All providers must expose capabilities.

```ts
interface ProviderCapabilities {
  chat: boolean;

  embeddings: boolean;

  streaming: boolean;

  vision: boolean;

  reasoning: boolean;

  toolCalling: boolean;
}
```

---

# Cost Tracking

Every request must support:

```ts
interface CostEstimate {
  provider: string;

  model: string;

  estimatedInputCost: number;

  estimatedOutputCost: number;

  estimatedTotalCost: number;
}
```

Store:

- Cost History
- Usage History
- Budget Impact

---

# Routing

Provider routing must support:

```text
Primary Provider

Fallback Provider

Capability Matching

Budget-Aware Routing

Health-Aware Routing
```

Example:

```text
OpenAI Failure
        ↓
Claude Fallback
        ↓
Request Completes
```

---

# Failover

Failover must occur when:

```text
Provider State = DISCONNECTED

Provider State = BLOCKED

Provider State = DEGRADED
```

when policy permits.

---

# Audit Requirements

All provider operations must be recorded.

Track:

```text
Provider

Model

Timestamp

Caller

Cost

Latency

Status

Failure Reason
```

Store in audit history.

---

# Security Requirements

Do not:

```text
Store API Keys in Source Code

Store Secrets in Repositories

Log Secrets
```

Use:

```text
Environment Variables

Secret Stores

Platform Secret Management
```

---

# Monitoring Requirements

Monitor:

```text
Latency

Failure Rate

Success Rate

Cost

Budget Consumption

Availability
```

---

# Acceptance Tests

## PA-001

Given valid credentials

When a health check executes

Then state = CONNECTED

---

## PA-002

Given missing credentials

When a health check executes

Then state = UNCONFIGURED

---

## PA-003

Given provider becomes unreachable

When health executes

Then state = DISCONNECTED

---

## PA-004

Given primary provider fails

And fallback provider exists

When a request executes

Then routing succeeds via fallback

---

## PA-005

Given capability discovery runs

When provider metadata is returned

Then available models are listed

---

## PA-006

Given a model request executes

When audit history is reviewed

Then provider, model, latency and cost are present

---

# Production Exit Criteria

All of the following must be true:

✅ OpenAI Adapter Implemented

✅ Gemini Adapter Implemented

✅ Claude Adapter Implemented

✅ Local Adapter Implemented

✅ Health Monitoring Active

✅ Routing Active

✅ Failover Active

✅ Capability Discovery Active

✅ Audit Logging Active

✅ Cost Tracking Active

✅ Acceptance Tests Passing

Provider Runtime is considered production ready only when every requirement above is satisfied.
