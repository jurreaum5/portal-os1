# MAX Universe V3 runtime

## Scope and authority

V3 is additive to MAX-CORE, the existing Worker/D1/Durable Object architecture,
ICVS factory, marketplace and V2 read models. MAX-CORE source and interfaces are
unchanged. Apply migrations **0008 and 0009** before starting the private Worker.
The public marketplace does not expose these private APIs.

BEMAX is at `/portal/bemax` and embedded in `/portal/governor`. Existing routes and
approval controls remain. Staff may create their own advisory conversations; this
is an intentional addition to V2's Governor-only POST policy. Staff still cannot
make decisions, submit action proposals, record strategies or ingest Sports data.
Named credential IDs identify memory owners; keep those IDs stable when rotating
tokens. The legacy Governor credential retains owner `governor`.

## Runtime and reasoning

Evidence mode needs no external model. It supports attention, opportunity,
publication review, risks, recent changes, growth, forecasts, capacity, summary
and retained-context questions. Portfolio, growth, forecast, risk, dependency and
resource recommendations include why, evidence, source API paths, confidence and
tradeoffs. Opportunity ordering uses recorded score; risk ordering uses the V2
heuristic. Growth reasoning does not infer causation. Forecasts remain explicit
scenarios, not learned predictions. Unknown telemetry, capacity and completion
forecasts stay unknown.

Conversations are private to their staff owner. Turns have caller-supplied stable
`requestId`s, with actor-namespaced deduplication and atomic user/assistant/memory
writes. Model failure is recorded and visibly falls back to evidence mode. A
retry with a different message conflicts. Only the most recent 12 turns and
memories enter model context; context excerpts are bounded. This is bounded
context retrieval, not a semantic vector search engine. Older messages remain
available through cursor pagination. Conversation/memory/action lists return the
latest 100 records. Configure retention and backups before production use.

## ICV identity

`icv_entities` anchors entities to immutable kind-prefixed IDs. Updates append
`icv_history` and increment the same identity's revision; deletes retain a
historical tombstone. Triggers cover products, divisions, factory projects,
approvals, relationships, strategies, decisions, recommendations, Governor action
proposals and source-attributed Sports observations. Source identity is independent
of lifecycle, forecast, score or workflow changes. The registry is an identity and
revision trajectory; it does not claim a trained embedding or a mathematical
curvature model. Department/static scene IDs are deterministic. Current department
metrics are derived on read and daily history remains in the existing snapshots.

Private memory identities are owner-filtered in registry and twin APIs. Product
and division history starts at migration, and existing V2 histories remain intact.
Forecast/report action results retain the snapshot used for the decision.

## API surface

All endpoints require existing staff authentication and use the private Worker's
no-store policy. Only conversation POST is available to non-Governor staff.

| Endpoint | Contract |
| --- | --- |
| `GET /api/bemax/providers` | Configured provider names, never keys |
| `POST /api/bemax/chat` | `{message,requestId,conversationId?,provider?}`; returns persisted conversation ID, content, evidence and navigation |
| `GET /api/bemax/conversations` | Owner's latest 100 conversations |
| `GET /api/bemax/conversations/:id?before=N` | Up to 100 messages, ascending within page, `nextBefore` cursor |
| `GET /api/bemax/memory` | Owner's latest 100 memories |
| `POST /api/bemax/memory` | Governor: `{kind: strategy\|decision\|context,content}` |
| `GET /api/bemax/actions` | Owner's latest 100 proposals and results |
| `POST /api/bemax/actions` | Governor: `{kind,entityId?,rationale}` |
| `POST /api/bemax/actions/:id/approve\|reject\|override` | Governor: `{reason}` (10–1000 characters); final compare-and-set decision |
| `GET /api/universe` | Existing V2 consistent portfolio projection |
| `GET /api/universe/graph` | Spatial graph, stable node IDs and edges |
| `GET /api/universe/relationships` | Structural and recorded graph relationships |
| `GET /api/universe/dependencies` | Recorded dependency edges |
| `GET /api/universe/navigation` | Graph nodes with portal navigation targets |
| `GET /api/universe/topology?root=ID&depth=2` | Cycle-safe neighbourhood; root required, depth 0–4 |
| `GET /api/universe/spatial` | Same versioned coordinate contract as graph |
| `GET /api/universe/identities?offset=0` | Owner-visible registry, 100 records and next offset |
| `GET /api/universe/twins/:kind-prefixed-id` | Live projection, identity, latest 100 history events and relationships |
| `GET /api/universe/pipeline` | All requested stages, preserved legacy stages, queue depth, risk, capacity and evidence-based clearance estimates |
| `GET /api/universe/departments` | Existing live eight-department projection |
| `GET /api/universe/sports?module=Team%20Intelligence` | Sports products, taxonomy and latest 100 source observations |
| `POST /api/universe/sports/observations` | Governor-attributed immutable observation ingestion |

The graph includes marketplace releases, Sports subdivisions, modules and observed
signals. Existing `/api/twin/*` and `/api/xr/*` routes remain. New XR scene:
`/api/xr/max-sports-intelligence-center`. All six scenes expose deterministic 3D
coordinates in the existing right-handed metre frame; planar z=0 layout is
intentional. This is spatial data, not headset rendering or physical telemetry.
Graph source tables retain the V2 5,000-record safety bound.

## Governor actions

Supported proposal kinds: Publish Product, Pause Project, Increase Resources,
Archive Asset, Promote Product, Generate Report and Create Forecast. Every proposal
is durable and requires an explicit Governor decision. Override requires a reason
and accepts a pending proposal; it cannot overwrite a finalized decision.

Approve/Override of Generate Report records a current portfolio snapshot; Create
Forecast records a three-month, zero-growth baseline scenario. Other approved
proposals return **`requires-icvs-review`**, with a route to existing workflow
controls. They do not mutate lifecycle or resources. Actual publication continues
through existing ICVS verified-package Governor gates and the publishing adapter.
Pause/archive/promotion/resource proposals require an authorised execution policy
and adapter before autonomous execution can be enabled. Approval is not reported
as execution. This preserves V2's no-human-lifecycle-write contract.

## Model adapters

| Provider | Configuration |
| --- | --- |
| Evidence | Always available, no model call |
| OpenAI | `OPENAI_API_KEY` secret + `OPENAI_MODEL` |
| Gemini | `GEMINI_API_KEY` secret + `GEMINI_MODEL` |
| Anthropic | `ANTHROPIC_API_KEY` secret + `ANTHROPIC_MODEL` |
| Local | `BEMAX_LOCAL` Worker service binding |
| Future MAX | `BEMAX_MAX` Worker service binding |

Native adapters use Chat Completions, generateContent and Messages respectively.
Model IDs are explicit deployment configuration, avoiding hardcoded or stale model
choices. Local/MAX bindings accept `POST /generate` with `{system,prompt,maxOutputTokens}`
and return `{text}`. Bindings can proxy any replaceable model runtime. Provider
selection is per conversation turn. Responses are bounded to 64 KiB / 12,000 text
characters with a 20-second request timeout. No adapter receives tools or mutation
capabilities. Provider text is rendered as plain React text, never HTML.

Selecting a remote provider sends the displayed operational context and recent
personal history to that configured provider. Keys stay server-side. Production
provider credentials/model availability were not verified in this task. Native
request/response contracts and local bindings are tested with synthetic fixtures.
CodeRabbit emulate v0.0.1 catalog was inspected: it has no OpenAI/Gemini/Anthropic
model-generation emulators, so no unrelated service was substituted.

## MAX Sports

First-class division `max-sports` is added without changing existing divisions.
Eight subdivisions and nine modules match the V3 request. The Sports view supports
recording and browsing source observations by module, with stable identity and
relationships. No external Sports feed is configured automatically.

Observation payload: `{id,subdivision,module,subject,summary,source,observedAt,productId?}`.
Use exact displayed subdivision/module names. IDs are immutable and retry-safe;
corrections require a new ID. Observation dates must be within 90 days and at most
one minute in the future. Optional linked products must belong to MAX Sports.
Sources are attribution supplied by the recorder, not a claim of independent
verification. The modules organize recorded intelligence; they do not infer injury
diagnoses, scouting accuracy or market predictions without supporting systems.

## Views and verification

- `/portal/universe`: clickable division galaxy. Size: revenue, observed users,
  or explicitly labelled portfolio-score impact proxy; color: risk/data coverage.
- `/portal/universe/products`: products, dependencies, lifecycle, observed health,
  revenue, baseline forecasts, recommendations and relationship drill-downs.
- `/portal/universe/pipeline`: stage queues, bottlenecks, running/blocked work,
  configured capacity, risk and clearance estimates. Research is displayed without
  rewriting the existing factory stage machine.
- `/portal/universe/departments`: existing department KPIs, backlog, workload,
  capacity, forecasts and recommendations.
- `/portal/universe/sports`: source observations, modules and division products.

Run the existing mandatory checks: `npm run typecheck`, `npm test`, `npm run build`,
both Worker dry-run deploys, local migrations and foreign-key check, authenticated
browser journeys. The preview uses synthetic local seed data. No production
migration, deployment, external feed ingestion or model purchase was performed.

Remaining operational integration: live model credentials/bindings, verified
Sports/telemetry sources, existing build/package/publishing adapters, execution
policies for non-report BEMAX actions, and production deployment/retention setup.
V3 provides the runtime and integration contracts; it is not a claim that those
external systems are already connected or that autonomous operation is complete.
