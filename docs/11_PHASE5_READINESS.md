# Phase 5 readiness contracts

Migration 0010 extends existing records. It does not replace MAX-CORE, factory
policies, identities, research lineage, model adapters or scenario execution.
Prior API fields and routes remain available. No R2 or new storage provider is
introduced; structured records continue through the existing D1 projection and
artifacts remain provider-independent source references.

## Provider operations

The Phase 5 status contract supersedes the failed-request status in Phase 4:

| State | Recorded evidence |
| --- | --- |
| CONNECTED | Latest successful request for the current configuration within 24 hours, no recent failures |
| DEGRADED | Latest successful request, but failures also occurred within 24 hours |
| DISCONNECTED | Latest fresh request failed, or provider is not configured |
| BLOCKED | Required credentials are missing |
| STALE | Latest outcome is older than 24 hours |
| UNAVAILABLE | No observation for the current configuration, or request outcome is unresolved |

Sports feed health is also matched to its current configuration, so changing a
provider or league configuration requires a fresh observed refresh.
Health observations are matched to a digest of the provider configuration and
credential. Changing model, endpoint, rates, limits or credential invalidates old
connection claims without deleting usage history. Neither credentials nor their
digests are returned in health responses or audit exports. Pre-migration attempts
remain billing history but do not prove current availability.

`POST /api/models/check` probes the requested provider using existing budget and
request controls. GET status is observational and does not incur provider charges.
BEMAX requests retain configured failover order and try the alternative after a
failed attempt; a failed route does not disable deterministic intelligence.
The existing OpenAI, Gemini, Claude and local adapters remain unchanged.

## Strategic planning and graph navigation

`GET /api/bemax?horizonMonths=12` accepts 1–60 months and returns conditional
milestones, evidence, prerequisites, impact scope, cross-division exposure,
approval gates and reassessment conditions. It does not invent durations, capacity,
ROI or future growth. Existing brief/recommendation fields remain intact;
`relatedDependencies` is added explicitly.

`/api/manifold/opportunity` aliases existing `/opportunities`. `q` on Manifold
navigation routes searches entity identity, kind and label, returning matching
nodes and incident edges (100 nodes/500 edges maximum). Traversal visits carry the
actual relationship record, including source, target and relation. Path responses
include the edges connecting consecutive nodes. Risk responses retain their brief
and add directed consumer exposure from recorded product risks. Reachability is
not a causal estimate or a probability. XR topology contracts remain unchanged.

## Research operations

`POST /api/institute/outputs` accepts `publication` and optional `derivesFrom`, an
array of up to 20 distinct existing research-output identities. A framework may
derive from research of another type or division. These derivations are separate
from same-type version succession; predecessor rules remain unchanged. Identity,
version, derivation edges and submission audit commit atomically.

`GET /api/institute/lineage?entityId=...` returns source research through
`derives_from`, `supersedes` and `depends_on` edges, bounded version records and
approved publication transitions. The Institute links to a lineage view in Portal.
Release still requires review and Governor approval. Sources remain attributed
artifacts; the system does not fabricate research content.

## Shared simulation provenance

Registry registration adds optional `domain`, `ownerId`, `predecessorId` and
`evidence`. Existing registration requests remain valid: omitted owner defaults to
the authenticated actor, domain to `unspecified`, and provenance to existing source
and assumptions. Explicit owners must be existing persistent identities. Domains
are descriptive configuration, not a hardcoded division list: products,
departments, sports, markets and forecasts can register through the same API.

A successor must use the same domain/model class, a distinct version, and a current
predecessor. Only one successor is permitted; branching requires a separate model
identity. Ownership, provenance and version links are immutable. Existing records
are backfilled from their actual registering actor/source, with unknown domain
explicitly recorded as `unspecified`.

Scenario responses include SHA-256 input/output digests, canonicalisation version
and executor version. Object key order is normalised; array order is preserved.
`POST /api/substrate/scenarios/:id/replay` uses retained inputs through MAX-CORE,
records expected and actual output hashes and appends an audit event. It does not
apply scenario results to production entities, nor require current entity revisions
to match historical inputs. Replay evidence is immutable. Governor-only replay
controls appear in the registry view. Forecast/operational models remain distinct
registrations and cannot execute through the scenario-only executor.

## Recovery and governance monitoring

`recovery-record` is an operational proposal action. Input:

```json
{
  "kind": "restore",
  "outcome": "passed",
  "source": "https://your-evidence-host.example/drill-report",
  "observedAt": "2026-10-27T00:00:00.000Z",
  "summary": "Describe the actual restoration verification performed"
}
```

This is a schema example, not evidence of an actual drill. `kind` is `backup` or
`restore`, outcome is `passed` or `failed`, and source must be credential-free
HTTPS. Propose against `ecosystem:max` for ecosystem dashboard tracking. Pending
proposals have no effect. Governor decisions, policy checks, matching revisions,
audit records and compensation apply exactly as for other operational effects.
Rollback restores prior displayed recovery evidence without deleting history.
`/api/operations/recovery` exposes retained effect records.

The operations centre displays proposal counts, lifecycle decisions, compensation
queues, missing effect/audit counts, replay/mismatch counts and observed product
risks. Governance CONNECTED means the queried records satisfy effect/audit
integrity, not that every future action is safe or all external services are live.
Recovery status is explicitly Governor-approved source evidence, not an automatic
restore probe. Failed recovery is BLOCKED and old evidence becomes STALE. Missing
evidence remains UNAVAILABLE. Existing cursor-based audit exports include new
model, research and simulation events, but exclude private memory and model text.

## Acceptance coverage and deployment limits

Worker tests cover unavailable-provider failover, changed-configuration health,
directed relationship metadata, framework-to-research derivation, registry
ownership/version/provenance, canonical replay evidence, pending-action blocking,
approved policy/audit execution, and compensation. Existing factory tests continue
to enforce promotion approval and verified QA/package/publishing evidence.

Live model/Sports activation requires the intended endpoints, models, billing
rates, secrets and production feed binding. Only the local Governor credential is
configured in this task sandbox. The prescribed emulator catalog has no matching
AI/Sports service; response fixtures verify contracts only. No external feed,
real backup restoration or production deployment is certified by local tests.
Sports reports include stored feed provider/receipt provenance and explicitly
unverified observation confidence; they do not invent numerical probabilities.
Sports simulation reports select actual feed simulation observations, and new
local simulations use the shared substrate. Alerts are visible in Portal;
external notification delivery still requires an authorised deployment destination.
