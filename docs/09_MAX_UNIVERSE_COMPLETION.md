# MAX Universe completion capabilities

This change extends the existing Worker, Portal Intelligence, ICVS policy and
MAX-CORE simulation. It does not replace the factory, marketplace, graph or twins.
Apply migration **0008_completion.sql** before deploying the upgraded Worker.
It is additive and preserves old product, approval and Durable Object identifiers.

## Capability map

| Phase        | Implementation                                                                                                                                              | Portal                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| BEMAX        | Evidence-backed portfolio briefs, opportunity triage, search/navigation, personal durable memory, historical changes, optional model reasoning              | `/portal/bemax` (new home)             |
| ICV          | Immutable origin/key/kind, versioned operational state, append-only events, identity relationships, decision history and lifecycle observations             | `/portal/identity`                     |
| Class-C      | Existing factory promotion/archive gates; governed capacity, assignment, publishing time, escalation and compensation; configured automatic proposals       | `/portal/autonomy`                     |
| Sports       | Production-feed adapter contract, configurable leagues, nine observation categories, source/freshness checks, shared scenario engine                        | `/portal/sports`                       |
| Institute    | Configurable research entities, four initial research divisions, five output types, review/release/withdrawal governance                                    | `/portal/institute`                    |
| XR           | Six live spatial scenes, shared graph/topology, shortest relationship paths, right-handed metre coordinates                                                 | `/portal/substrate` and `/portal/twin` |
| Substrate    | Shared identity/revision, geometry, relationships, timed events, uncertainty bounds, emergence thresholds; runs use MAX-CORE                                | `/portal/substrate`                    |
| Integrations | OpenAI Responses, Gemini GenerateContent, Claude Messages and OpenAI-compatible local models; ordered failover, atomic budget reservations, observed health | `/portal/models`                       |

BEMAX scores and recommendations describe operational evidence. They are not
claims of market demand or investment returns. Every BEMAX recommendation includes
evidence, source paths, qualitative confidence and tradeoffs. Model summaries are
advisory and never authorise execution. Personal memory is scoped to the verified
staff identity; other staff cannot retrieve it. Supersession preserves history.

## Private API contracts

Existing staff protection remains in force. Governors may write; other staff
may read. No public Marketplace route exposes these capabilities. Automation
credentials can receive only the new explicit scopes `identity:write`,
`autonomy:propose`, `research:write` and `sports:refresh`. Automation cannot approve,
reject or override. Identity administration means registering new domain identities
with immutable origin metadata; it does not create staff or customer accounts.
Native product/division/project/department identities come from authoritative
records and cannot be replaced through the identity registration API.

All POST bodies are bounded to 16 KiB. List responses are bounded. The existing
graph deployment limit is 5,000 identities/relationships; larger installations
must partition projections. Most list views return recent history, not complete
exports. Cron synchronises native identities and authoritative workflow events
once per minute; this projection is eventually consistent. Missing identities can
be reconciled immediately with Governor POST `/api/icv/synchronise` and `{}`.

- `GET /api/bemax?question=...&search=...`: brief, recommendations, graph navigation,
  personal current memory and latest 100 shared events.
- `POST /api/bemax/memory`: `{entityId,kind,content,source,supersedes?}`. Supersession
  requires ownership and the same identity; exactly one successor is allowed.
- `POST /api/bemax/reason`: `{question}`; optional grounded model summary.
  The resulting brief is automatically saved to the requesting staff identity's
  long-term memory, including its source. Model text is bounded to 4,000 characters
  in memory; the full validated response is returned to the caller.
- `GET /api/icv` and `/api/icv/history?entityId=...`: registry and history.
- `POST /api/icv/identities`: `{id,kind,label,invariants,source,metadata?}`. Use a distinct
  domain namespace, e.g. `market:exchange-name`; custom kinds are configurable.
- `POST /api/icv/relationships`: `{sourceId,targetId,relation,evidence}`.
- `GET /api/manifold/path?from=...&to=...`: shortest undirected navigation path;
  graph edges retain their original directions.
- `GET /api/autonomy`: proposals, effects, configured rules and existing lifecycle
  approval link. `POST /api/autonomy/proposals` takes
  `{entityId,action,input,evidence:{facts:[...],sources:[...]}}`.
- `POST /api/autonomy/:id/approve|reject|override`: `{reason?}`. Overrides require
  at least 10 characters and cannot bypass evidence, permissions or revision checks.

Operational actions and inputs:

| Action                | Input                   | Effect                                                                                   |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `resource-allocation` | `{capacity:0..10000}`   | Department capacity feeds metrics; `resource:execution` caps real shared execution slots |
| `work-assignment`     | `{departmentId,workId}` | Target identity must equal workId; product queue ownership follows the assignment        |
| `publishing-schedule` | `{notBefore:ISO-date}`  | Existing factory waits until the approved time before publishing                         |
| `risk-escalation`     | `{severity,reason}`     | Persistent escalation and auditable decision memory                                      |
| `research-output`     | `{status}`              | Draft, reviewed, released or withdrawn; release requires review                          |
| `rollback`            | `{proposalId}`          | New approved compensation restores the prior operational state                           |

Promotion and archive continue through `/api/approvals/:id/...` and the existing
factory's package, QA and compensation contracts. This preserves the original
release guarantees. Each operational decision and each effect commits atomically with its
append-only audit event. Approved effects are retried after interruptions. Stale proposals become `conflict`; create a fresh
proposal against current evidence. Compensation applies only to the latest
revision, is linked to its original effect, and preserves all history. It restores
controllable operational state; it cannot unpublish an external download or erase
already completed work. Work assignment affects operational queues, not the
factory's versioned stage evidence requirements. `resource:execution` is the
existing factory's shared lease pool represented as a graph identity. Governed
capacity can reduce new admissions (including zero); `ICVS_EXECUTION_SLOTS` remains
the deployment's hard upper bound. Existing in-flight leases finish or expire.

### Automatic proposals

Set server configuration `AUTONOMY_RULES` to an array of rules. Each has `id`,
`entityId`, `action`, `input` and `condition:{metric,operator,value}`. Operators are
`gte`, `lte`, `eq`. Conditions inspect current identity state and, for products,
the existing product twin. For example, a deployment-specific rule may propose a
`risk-escalation` when an observed product `risk` reaches a configured threshold.
No divisions, workflows or resource policies are embedded in the rule evaluator.
At most one proposal is generated per rule, identity and revision. Matching rules
create pending proposals; each still requires a Governor decision. Deployments
without configured rules do not invent resource policies. Cron retries approved
effects after interrupted requests.

## Sports integration

Configure `SPORTS_CONFIG` as JSON:
`{"provider":"your-adapter-id","leagues":["NFL","NBA","MLB","NHL","Soccer","F1","Combat","Esports"]}`.
Leagues are configuration, not an enum in application logic. Bind a trusted
`SPORTS_FEED` service. Cron polls it when configured. Scoped automation can also
POST `/api/sports/refresh` with `{}`.

Adapter operation: `POST /observations`, with JSON `{leagues,capabilities}`.
Return `{provider,production:true,records:[...]}`. Each record requires:

- Stable provider-local `id` for the observation and `externalId` for the entity.
- `entityKind`: athlete, team, league, event, market, business or media.
- `category`: athlete, team, injury, draft, scouting, simulation, market, business or media.
- `league`, `label`, credential-free HTTPS `source`, ISO `observedAt` and numeric
  `metrics`. Maximum 50 records/response, 40 metrics/record and 16 KiB/response.

The adapter owns vendor authentication, entitlement/licensing and schema mapping.
A single athlete identity can have injury, scouting and draft observations. Old
observations remain append-only; replay is idempotent and changed data with a reused
observation ID is rejected. Observations older than seven days are rejected at
intake; older than 24 hours are marked stale in the UI. The production flag and
provenance are assertions by a trusted connected adapter, not independent truth
verification. No synthetic production intelligence or forecasts are generated.
Descriptive Sports intelligence compares the two latest observations per entity
and category, reports metric deltas and coverage, and recommends refreshing stale
measurements or reviewing recorded changes with sources, confidence and tradeoffs.
Missing baselines remain unknown; no diagnoses or athlete-quality claims are inferred.
There is no configured real feed in this checkout. Supply a vendor adapter and
credentials to obtain live athlete/team/injury/draft/scouting/market/business/media
measurements; missing categories remain visibly empty.

## Institute

Research divisions are registry records, not fixed UI navigation. The migration
registers Substrate, Protocol, Identity Physics and Quantum-Manifold with their
requested research topics. Additional divisions use the identity API and graph
relationships. `POST /api/institute/outputs` takes
`{divisionId,type,title,source,evidence}` and registers a draft with an HTTPS source
for the actual research artifact. Types: whitepaper, course, framework, standard,
research-report. Submit review and release through governed proposals. Actual
research content must be supplied by research workflows; no placeholder papers
are represented as completed research.

## Shared simulation and XR

`POST /api/substrate/scenarios` takes arrays `entities`, `relationships`, `events`,
`uncertainty`, `emergence` and `steps` (1–100). Each entity has persisted `id`,
`kind`, current `revision`, `position:{x,y,z}`, and numeric `values`. Events have
`id,entityId,metric,delta,tick,source`. Uncertainty specifies
`entityId,metric,lower,upper,source`. Emergence rules specify
`id,entityId,metric,threshold,source`. Relationship endpoints must be in the scenario.
Each array is bounded to 200 entries. The existing MAX-CORE engine advances the
supplied events; first threshold crossings are recorded. Unknown or stale identity
revisions are rejected. Inputs/outputs are persisted for replay without mutating
production entities. Bounds are assumptions, not calibrated confidence intervals.
Future product, Sports, market and business simulations should use this schema.
`GET /api/substrate/scenarios/:id` returns stored inputs and outputs for replay.
Scenario runs also have graph identities. Custom domain `metadata.xrScenes` can
select additional spatial scene roots without hardcoding divisions.

XR consumers use existing `/api/twin/graph`, `/api/twin/topology?root=...&depth=0..4`
and `/api/xr/:scene` endpoints. Scenes:
`ecosystem-galaxy`, `product-constellation`, `pipeline-universe`,
`department-operations-center` (legacy `department-operations` retained),
`sports-intelligence-center`, `quantum-xr-command-room`. An identity's `xrScenes`
metadata selects configurable scene roots; Sports observations select Sports
entities. Geometry is illustrative graph layout, not measured physical location.
No WebXR/OpenXR/Quest/Vision Pro renderer is introduced.

## Model configuration

Use server-only `MODEL_CONFIG` JSON:

```json
{
  "dailyBudgetMicrousd": 1000000,
  "dailyRequestLimit": 100,
  "providers": [
    {
      "id": "local-model",
      "kind": "local",
      "baseUrl": "https://your-private-model-gateway.example/v1",
      "model": "your-served-model",
      "inputMicrousdPerToken": 0,
      "outputMicrousdPerToken": 0,
      "maxInputBytes": 12000,
      "maxOutputTokens": 1000
    }
  ]
}
```

This example is a configuration template, not a working provider. Supply real
model IDs and billing rates; the application does not infer prices. Rates are
integer micro-US dollars per token. Round upwards if a rate is fractional. Supply
`MODEL_CREDENTIALS` as a secret JSON map from configured provider IDs to API keys.
Never put these secrets in Vite variables, frontend code or committed files.
Provider order is failover order. A daily request limit (default 100) also bounds
zero-cost local routes and failed attempts. All endpoints require HTTPS and reject credential
URLs, query strings and redirects. `baseUrl` includes the API prefix:

| Kind     | Operation appended to baseUrl    | Authentication               |
| -------- | -------------------------------- | ---------------------------- |
| `openai` | `/responses`                     | Bearer key                   |
| `claude` | `/messages`                      | x-api-key; anthropic-version |
| `gemini` | `/models/:model:generateContent` | x-goog-api-key               |
| `local`  | `/chat/completions`              | Optional Bearer key          |

Requests have timeouts, bounded input/output and usage validation. Each attempt
atomically reserves the worst-case configured input/output cost before contacting
a provider. Failed/ambiguous requests retain reservations; actual usage and latency
are recorded. Reservations are intentionally conservative and not a billing ledger.
Incorrect configured rates or a provider exceeding declared token limits can
invalidate a financial cap; use provider-side billing limits as well. Health is
observed request outcomes, not a speculative availability claim.

Official contracts consulted: [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create),
[Gemini GenerateContent](https://ai.google.dev/api/generate-content),
[Anthropic TypeScript Messages definitions](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/messages/messages.ts).

## Deployment and remaining external work

Run `npm run db:migrate:local`, `npm run typecheck`, `npm test`, `npm run build`
and `npx wrangler deploy --dry-run`. Remote deployment requires applying the same
migration to the intended database, configuring staff/automation secrets, model
routes/rates and production service bindings, then exercising real provider flows.
The model request formats are contract-tested with synthetic HTTP responses. The
prescribed CodeRabbit emulate v0.0.1 catalog contains no matching model or Sports
service, so it cannot establish live provider readiness.

Existing Build/QA/Package, publishing, compensation, payments, customer identity
and download integrations still require their documented real service bindings.
This change does not certify those external deployments or bypass missing bindings.
It does not deploy remotely. No Cloudflare R2 binding or provider lock-in is added;
structured records use the existing D1 projection boundary and MAX-CORE's existing
portable contracts remain unchanged. Research artifacts stay behind HTTPS source
references and existing storage/download adapters rather than hardcoded blob storage.
