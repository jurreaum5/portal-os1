# MAX Institute and Unified Simulation Substrate

## Boundaries

Migration 0008 adds shared-reality persistence to the existing private Worker/D1.
MAX-CORE remains unchanged; `uss/simulation.ts` consumes its Simulation primitive.
ICVS owns recovery transitions; Portal Intelligence owns evidence reviews and graph
analysis. Existing product/factory identities, execution leases, publication,
compensation and marketplace contracts remain unchanged. No R2 binding or provider
URL is introduced. D1 is obtained through the existing Env binding.

Institute authorities are Research, Standards, Protocol and Governance. Its four
partitions are `substrate`, `protocol`, `identity-physics`, `quantum-manifold`.
The registry contains identity, charter, law, standard, protocol, research, framework,
publication, course, certification, policy, simulation, council, membership,
programme and emergence records. Events and relationships are derived immutable
registries. No charter, law, council membership or research finding is fabricated.
The console at `/portal/institute` displays the live registries and proposes records.
The console also registers compound-growth simulations and manages recovery reviews.
Specialised membership, emergence and operation-policy records, and revisions, use
the API described below.

## Identity and governance contracts

All routes are under `/api/uss/`, staff authenticated, private and no-store. Writes
require Governor credentials, preserving the existing role boundary. Named council
members must currently also have a Governor credential to vote; membership alone
never grants a role. These are explicit Institute administration capabilities,
not new controls for product lifecycle transitions.

`POST records` accepts:

```json
{"registry":"research","title":"Substrate study","owner":"MAX Institute",
 "division":"substrate","lifecycle":"proposed","content":{"statement":"Research abstract"},
 "references":[],"uncertainty":{"confidence":null,"probability":null,
 "risk":"Unassessed","assumptions":[],"range":null}}
```

The server assigns the identity, author, time, version and canonical SHA-256 hash.
`POST records/:id` takes the same fields and `expectedVersion` to append a revision.
The registry and identity cannot change. Unique version constraints reject concurrent
writers; all writes, references and events commit in an atomic D1 batch. Ownership,
lifecycle and content revisions preserve prior identity snapshots. SQL triggers
reject updates and deletes of snapshots, links, events, decisions and replay history.
Hashes detect changes during audit reconstruction; these are not externally signed
or independently witnessed tamper proofs against a database administrator.

References are `{id,version,relation}`; versions must already exist. Allowed relations:
`derived_from`, `depends_on`, `member_of`, `owned_by`, `governed_by`, `influences`,
`simulates`. Frameworks require originating research; publications require research
or frameworks; courses require research/frameworks/publications; standards require
research/frameworks/courses; protocols require standards; certifications require
courses/standards. References cannot silently point at a newer revision.

Charters require purpose, vision, mission, identityPrinciples, governancePrinciples,
researchPrinciples, simulationPrinciples, aiPrinciples, publicationPrinciples.
Laws require a statement and layer: constitutional, governance, identity, research,
protocol, simulation, ai, marketplace. Council content names one of Governor,
Executive Council, Research Council, Standards Council, Governance Council.
Membership content contains `member` (staff actor ID) and `council`; an approved
latest revision with lifecycle `active` is required for non-Governor council votes.
Emergence records require a `kind` (pattern, cluster, anomaly, behaviour-change,
system-effect), a method, uncertainty and optional pinned evidence. This supports
observations; it does not claim an automatic scientific discovery model.

- `GET records?registry=research`: latest proposals and their actual decision.
- `GET records/:id?version=N`: immutable snapshot (latest if version omitted).
- `GET records/:id/history`, `/events`, `/lineage`: full bounded history, ordered
  events, transitive pinned origins and immediate child records across revisions.
- `GET records/:id/event-replay`: verifies every snapshot hash and predecessor,
  reconstructs the recorded timeline without re-executing external side effects.
- `POST records/:id/review`, `/approve`, `/reject`, `/override`: require a reason
  of 10–2000 characters. Pass `?version=N` to target an exact revision. Review is
  mandatory; decisions are final. Override cannot bypass review or authentication.
- `POST records/:id/vote`: reason, council, vote (`for`, `against`, `abstain`).
  Votes are attributed evidence, not automatic quorum approval. Council quorum
  constitutions must be adopted before any autonomous vote-based approval.

Reads fail with 413 above 5,000 records instead of silently truncating evidence.
Bodies are limited to 16 KiB. Partition/archive planning is required at that scale.

## Simulation registry and reproducibility

Simulation content requires `modelType` (product, sports, forecast, scenario, market,
department), `modelVersion`, `inputs`, `source` and `confidence` (the uncertainty
structure). Confidence requires explicit assumptions and a lower/upper range with
units. Registration computes outputs and input/output/reproducibility hashes itself.
Never accept browser-computed outputs as execution evidence.

The initial executable model is **compound-growth-v1**, a deterministic scenario:
`inputs: {initial:100,rate:0.1,steps:3}`. It runs MAX-CORE with unit steps and
ECMAScript binary64 arithmetic. Rate is −1 through 10; steps are integers 0–120.
All six domains can register this scenario where applicable. Domain-specific sports,
market, ecosystem or learned forecast models are NOT implemented by assigning a
category. New executable models require versioned code and acceptance fixtures.

`POST records/:id/replay?version=N` requires approval for that exact simulation.
It recomputes through MAX-CORE, compares reproducibility and output hashes, records
an immutable replay and audit event, and retains the original simulation identity.
Pinned entity references and original provenance remain valid after entity revisions.
Simulation revisions have their own approval; approving v1 never approves v2.

## MANIFOLD and BEMAX

USS nodes extend the existing `/api/twin/graph` and topology/XR projections.
`GET graph` returns current declared relationships; historical links remain in lineage.
`?root=uss:ID&depth=4` gives a cycle-safe neighbourhood (depth 0–8).
`?root=uss:ID&analyse=true&target=uss:OTHER` returns directed dependencies, affected
records, influence, declared opportunities and shortest dependency path. Affected
records are not a probabilistic risk estimate or automatically discovered causal model.

`GET reviews?type=` accepts strategic-brief, executive-summary, opportunity-review,
risk-review, governed-review. These are evidence-completeness review templates,
with sources, snapshot hashes, authors, declared confidence and tradeoffs. They
reason over all registry types and pinned references without granting execution.
No trained strategic intelligence or calibrated confidence is claimed. Existing
revenue and department forecasts also expose explicit uncertainty metadata; unknown
calibration remains null. Legacy recommendation responses gain evidence, sources,
confidence and tradeoffs without changing their existing fields.

## Provider operations

Configure `INTELLIGENCE_PROVIDERS` as a JSON array (empty means no configured providers):

```json
[{"id":"primary","name":"Primary reasoning","type":"openai",
 "models":["deployment-selected-model"],"capabilities":["reasoning"],
 "credentialConfigured":true,"enabled":true,"budgetUsd":20,"staleAfterMs":60000}]
```

Types: openai, gemini, claude, local. No models, endpoints or credentials are hardcoded.
Credentials belong in the trusted adapter; the flag describes its configuration and
is not health evidence. Configure the optional `INTELLIGENCE_GATEWAY` service binding
to your provider adapter. Local models use the same interface and explicit credential
readiness policy. Never send real secrets in registry content or client configuration.

- `GET providers` exposes models/capabilities, budget, credential and health states,
  last success/failure, affected capabilities and healthy fallback candidates.
- `POST providers/:id/health` checks capability availability, not execution approval.
  Missing credentials are UNCONFIGURED and cause **no outbound request**.
  Missing binding is DISCONNECTED; disabled/exhausted is BLOCKED; old or changed
  configuration observations are STALE; failure is DEGRADED. Successful fresh
  evidence is CONNECTED. Merely configuring a provider cannot prove it is healthy.
- `GET providers/:id/history` returns append-only outages, health, routing, cost
  and validated recovery evidence. Removing credentials never erases prior success.

Adapter routes (internal service binding only):

- `POST https://intelligence.internal/health`, body `{providerId,operationId}`,
  response `{providerId,operationId,healthy:true}`. Timeout 10 seconds.
- `POST https://intelligence.internal/infer`, body `{providerId,operationId,
  capability,model,input,budgetRemainingUsd}`, response `{providerId,operationId,
  output,costUsd}`. Timeout 20 seconds. Output is limited to a 16 KiB JSON object.

Requests carry Idempotency-Key. The adapter MUST fence operations, enforce budget
reservations across concurrent callers, account for failed/partial billed calls,
redact errors, and deduplicate billing. Portal cost history is a receipt projection,
not an atomic provider billing ledger. Fallback candidates must support the requested
model AND capability. Failure records an outage before trying the next candidate.
Deployment-specific model aliases may map that shared model name across providers.

For governed inference create a policy with content
`{operation:"provider-inference",capability:"reasoning",model:"…",input:{…}}`.
For provider recovery use `{operation:"provider-recovery",providerId:"primary"}`.
Review and approve the policy, then `POST records/:id/execute?version=N`.
Recovery performs a fresh validation probe; credential repair and provider-side
service restart are adapter/operator responsibilities. It never fabricates a repair.
An atomic claim prevents duplicate dispatch for the same revision. A completed result
is returned on retry. Failed/interrupted operations remain blocked pending adapter
reconciliation and a new reviewed policy revision; they are not blindly re-executed.

## Governed recovery and compensation

`POST records/:id/recover` takes `targetVersion` (earlier, approved) and failure
`reason`. It records detection and recommendation. `GET recoveries` lists cases.
`POST recoveries/:caseId/review`, `/approve`, `/reject`, `/override`, `/execute`
each take a 10–2000 character reason. ICVS requires review → approval → execution.
Execution fails if the identity has advanced since the recommendation. Restoration
appends a new revision of the SAME identity, preserving the target content, owner,
references and lifecycle. Compensation and validation events commit atomically.
The incorrect snapshot and all decisions remain available. Concurrent restoration
cannot create competing versions.

This compensates **USS record state only**. It cannot undo customer downloads,
refunds, provider charges, publication or arbitrary MAX-CORE operations. Existing
factory execution/compensation contracts remain authoritative for those resources.
No general external rollback adapter or release policy is implied.

## Verification and production gates

Run repository typecheck, tests, build, both Worker dry runs, local migrations,
foreign-key checks and private browser journeys. `substrate.test.ts` exercises real
D1 constraints and synthetic adapter contracts including missing credentials, fallback,
lineage, revision conflicts, replay, approval denial and rollback history.

Production still requires deployment and migration on the intended account, named
staff credentials, actual provider gateway implementations and billing reconciliation,
provider health evidence, retention/backups/partition policies and adoption of real
charters, laws, council membership, research and model libraries. This foundation
provides governed interfaces; it is not a production readiness certificate.
