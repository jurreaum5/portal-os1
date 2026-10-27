# Phase 4 production intelligence and operations

This extension preserves existing factory lifecycle approvals, identities and
MAX-CORE runtime contracts. Apply migration 0009 after 0008. No R2 binding is used.

## Intelligence and navigation

BEMAX supports quarter focus, dependency exposure, funding/archive review, growth
constraints and changes since the requesting Governor's last saved executive brief.
Rankings are deterministic operational heuristics, not ROI or causal forecasts.
Each recommendation includes evidence, sources, confidence limitations, tradeoffs,
impact scope and directed dependency analysis. Missing graph links remain unknown.
History includes the review timestamp second to avoid losing simultaneous events
and is bounded to 100 events; use the cursor export for a complete event history.

Manifold endpoints (staff authentication required):

- `/api/manifold` and `/api/manifold/navigation`: `root`, `direction`
  (`incoming`, `outgoing`, `both`), optional `relation`, `depth` (0–8).
- `/api/manifold/dependencies`: outgoing `depends_on` prerequisites.
- `/api/manifold/influence`: incoming `depends_on` consumer exposure.
- `/api/manifold/opportunities` and `/api/manifold/risk`: evidence-backed triage.
- Existing `/api/manifold/path?from=...&to=...` remains undirected shortest path.

Dependency reachability is capped at eight hops and terminates on cycles. It does
not estimate probability or invent influence weights. XR scene responses add
navigation metadata and neighbours, retaining coordinate and topology contracts.
`/api/xr/institute-research-center` includes recorded research entities.

## Governed execution

`capacity-change` uses the existing resource allocation consumer and compensation
mechanism. `strategic-review` records `{summary, reviewedAt}` through the same
Governor decision flow. All operational execution now requires an immutable
`policy_checks` record. Checks validate evidence structure, approval history,
current identity revision and schedule validity. Evidence attribution is not
independent verification of assertions. Expired schedules become conflicts and
require a new proposal. Promotion/archive retain existing factory policy and
verified execution evidence; this extension adds no alternate execution route.

## Research operations

`POST /api/institute/outputs` accepts optional `predecessorId`. Versions must share
a division and type; a predecessor has at most one successor. Each successor is a
new draft requiring its own review/release approvals. Library, lineage and
governance records are exposed by `/api/institute`; source artifacts remain at
attributed HTTPS locations. No whitepapers or standards are fabricated.

## Shared simulation registry

`GET/POST /api/substrate/registry` lists/registers immutable model versions.
Registration fields: `id`, `version`, `modelClass` (`scenario`, `forecast`,
`operational`), `source`, `assumptions`. Use a new ID for a new version.
Existing runs reference `max-core:scenario-v1`. New scenario requests may supply
`modelId`; default behaviour is preserved. Only registered scenario models run
through the supplied-event executor. Forecast and operational registrations are
metadata until a validated executor is connected; they cannot impersonate scenario
results. Inputs, outputs and model reference are immutable and reproducible.

## Providers and Sports

Use the existing provider adapters and secret bindings documented in
[completion integration contracts](09_MAX_UNIVERSE_COMPLETION.md).
Provider capability registry currently advertises only supported text generation.
`POST /api/models/check` with `{providerId}` performs a real, budget-controlled
text generation probe of one configured provider, without failover masking its
result. It requires Governor access and uses the same cost reservations as BEMAX.
Observed request results, daily usage, conservative reservations and redacted audit
events are recorded. BEMAX's deterministic operational brief remains available
without a model. Failover order and prices come from deployment configuration.

Sports adapters additionally accept `league`, `historical` and `forecast`
observations. Explicit historical observations may predate the existing seven-day
current-feed window, with dates no earlier than 1900. They remain marked stale;
this is intentional historical intake, not relaxation of current-data freshness.
`/api/sports/reports?type=league|team|forecast|prospect|business|injury|athlete`
and `/api/sports/lab` support optional `league` and `entityId`. Reports select
attributed observations, preserve freshness and confidence limitations, and return
UNAVAILABLE when no evidence exists. Forecasts require actual provider forecast
observations. Data is bounded to 200 latest entity/category observations.

## Production status and alerts

`/portal/operations` displays `/api/operations/status`. CONNECTED means a successful
observed request within 24 hours; DISCONNECTED means no configuration, BLOCKED means
missing required credentials/binding, UNAVAILABLE means no successful observation
or a failed attempt, and STALE means the observation is older than 24 hours.
These are passive observations, not external uptime guarantees. Alerts are visible
in the dashboard; external notification delivery is not configured.

Configure secrets using the deployment secret store, never Vite variables, source
files or chat. Rotate by installing replacement credentials, verifying a governed
request and then revoking the prior credential. Preserve named staff identities
and automation scopes. Do not expose tokens through logs or audit exports.

## Backup and recovery plan

Before deployment, export the intended database with the deployment platform's
D1 export mechanism and preserve the exact migration revision. Store encrypted
exports through an approved portable storage adapter (B2/S3/Spaces/MinIO or an
existing configured provider), with retention and access controls defined by the
operator. This repository does not configure a backup destination or claim a
backup has occurred. The dashboard reports UNAVAILABLE until deployment evidence
is integrated.

Restore into an isolated database, apply the matching migration set, run foreign
key checks and the governance/identity/compensation tests, and compare immutable
history counts and identifiers before switching application bindings. Retain the
old database for recovery. Never restore by deleting identity or decision history.
For provider outages, keep deterministic briefs active and fail over through the
configured model list. For failed effects, inspect policy conflicts and issue a
new Governor-approved compensation; do not rewrite decisions. External published
or downloaded artifacts cannot be erased by local compensation.

`/api/operations/audit?after=0` exports 200 identity-domain events in ascending
sequence; continue using `nextAfter` until the page is empty. It excludes private
BEMAX memory and model prompt/text. Existing factory/access audit APIs remain
separate authorities; this is not a full database backup.

## Deployment gates still requiring external configuration

Actual model credentials/endpoints/rates, production Sports adapters, factory
executors/publishers/compensators, backup storage and alert delivery destinations
must be supplied and exercised in the intended environment. Local contract tests
and dashboard status do not certify live production readiness. No production
provider was activated or remote deployment performed by this change.
