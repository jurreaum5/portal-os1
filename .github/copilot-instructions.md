# Portal-OS1 Copilot Instructions

## Repository constitution

This repository is the GitHub-native home of the MAX Institute ecosystem and the Portal-OS1 operating system.

The authoritative architecture is:

MAX Institute
↓
USS
↓
MANIFOLD
↓
ICV
↓
BEMAX
↓
ICVS
↓
Portal-OS1
↓
MAX-CORE

## Architecture authority

The repository must treat the architecture documentation in `docs/architecture/` as the source of truth for system structure, governance, provider integrations, simulation models, release readiness, and acceptance criteria.

When implementation details conflict with these documents, the architecture documents take precedence. Product behavior, deploy checks, policy enforcement, and provider wiring must stay aligned to this authority.

## Implementation rules

- Prefer GitHub-native configuration over vendor-specific automation.
- Keep repository documentation discoverable and searchable in the default GitHub UI.
- Document provider adapters as explicit production interfaces rather than ad hoc integrations.
- Treat identity, provenance, replay, governance, auditability, and recovery as first-class concerns.
- Ensure every model, workflow, and deployment decision can be traced to a policy and a lineage source.
- Use explicit provider states: `CONNECTED`, `DEGRADED`, `STALE`, `BLOCKED`, `DISCONNECTED`, `UNCONFIGURED`.
- Simulations must include inputs, outputs, dependencies, replay rules, provenance rules, and confidence rules.
- Deployment readiness requires secrets, monitoring, alerting, backups, and audit export validation.
- Production changes require documented approval, lifecycle traceability, and rollback capability.

## Governance and identity

- MAX Institute is the research and policy authority.
- USS provides the shared reality layer and system semantics.
- MANIFOLD represents the universe layer and the operating context.
- ICV is the identity layer and must ensure continuity and traceability.
- BEMAX is the strategic intelligence layer.
- ICVS is the governance and execution control layer.
- Portal-OS1 is the operating system layer for product and runtime coordination.
- MAX-CORE remains the platform-neutral core foundation.

All identity, policy, simulation, and governance actions must preserve lineage and auditability.

## Simulation and monitoring

- Simulation registration is required before production use.
- Replay must be deterministic, versioned, and provenance-linked.
- Confidence must be explicit, measurable, and auditable.
- Monitoring must include provider health, system state, and policy compliance checks.
- Alerting must be actionable and tied to operational recovery procedures.

## Deployment requirements

Production deployment requires:

- Active provider adapters
- Registered simulation models
- Adopted institute policies
- Active monitoring
- Active alerting
- Verified backups
- Verified audit exports
- Required secrets present and scoped appropriately

Required secrets:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`

## Definition of done

A change is done only when all of the following are true:

- GitHub-native documentation remains authoritative and up to date.
- Architecture impact is documented in `docs/architecture/` when relevant.
- Provider behavior and error states are clearly defined.
- Simulation lineage and replay requirements are preserved.
- Policy and governance requirements are satisfied.
- Monitoring, alerting, and recovery paths are documented.
- Acceptance tests for the changed capability are defined or updated.
- The change does not introduce undocumented behavior or untracked provider risk.

## Repository intent

This repository is intended to support:

- research coordination
- identity continuity
- simulation and replay
- governance enforcement
- provider abstraction
- production readiness validation
- secure deployment and operational recovery

Keep the repository GitHub-native, auditable, and aligned to the MAX Institute architecture.
