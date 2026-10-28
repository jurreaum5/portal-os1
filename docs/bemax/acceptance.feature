# Proposed acceptance specification. Step bindings are not implemented.
Feature: BEMAX preserves identity and supports governed ecosystem operations
  Background:
    Given a migrated synthetic V2 ecosystem with recorded source evidence
    And BEMAX is enabled for the test cohort

  Scenario: Primary entry and rollback preserve operational navigation
    Given an authenticated Governor with the BEMAX default-home flag enabled
    When they open the private portal root
    Then they enter "/portal/bemax"
    And the existing Governor, portfolio, factory and marketplace operation routes remain available
    When the default-home flag is disabled
    Then the next root navigation follows the existing role home route

  Scenario Outline: Conversation answers are grounded
    Given an authorised staff member viewing their own conversation
    When they ask "<question>"
    Then the answer contains "<result>" from authorised recorded evidence
    And its sources, observation time and missing-data coverage are visible
    And recommendations include supporting metrics, confidence basis and tradeoffs
    Examples:
      | question                                      | result                                  |
      | Show me ecosystem health.                     | health summary                          |
      | Show me products at risk.                     | ranked observed risks                   |
      | Show me publishing candidates.                | verified readiness and outstanding gates |
      | What should I focus on next?                  | next best action                        |
      | Which division needs attention?               | comparable division metrics             |
      | What is slowing growth?                       | measured bottlenecks and labelled hypotheses |
      | What opportunities exist?                     | investment and promotion candidates     |
      | Why was this recommendation made?             | original evidence snapshot              |

  Scenario: Governor previews ecosystem impact
    Given a Governor and a pending proposal with a recorded dependency graph
    When they ask how approving the identified proposal will affect the ecosystem
    Then they see affected entities, assumptions, costs, alternatives and uncertainty
    And no execution begins before an explicit Governor decision

  Scenario: Memory survives restart and provider replacement
    Given a conversation with a recorded decision reference and forecast
    When the Worker restarts and a different conforming provider is selected
    Then the owner can retrieve the prior discussion and original forecast assumptions
    And entity IDs and decision history are unchanged

  Scenario: Private memory cannot cross owners
    Given two staff members with separate conversations
    When one requests the other's conversation, job or derived memory by ID
    Then the server returns 404 without disclosing content
    And retrieval never includes that content in model context

  Scenario: Customer and automation identities cannot use private BEMAX APIs
    Given a customer session or telemetry-only automation credential
    When it requests a BEMAX route
    Then access is denied
    And the public marketplace Worker exposes no BEMAX operational endpoint

  Scenario: Staff conversation access does not grant mutation authority
    Given an authenticated Operator
    When they submit a message to their own conversation
    Then the message is accepted
    When they call an approval decision or unrelated mutation route
    Then the server returns 403

  Scenario: Identity persists through source changes
    Given a product with ICV revisions and linked historical decisions
    When its name changes and the source event is replayed twice
    Then its entity ID remains unchanged
    And one new source revision is retained
    And earlier revisions and decision anchors remain readable

  Scenario: Generalised twins and graph are bounded and scoped
    Given product, project, division, department, marketplace and staff twins
    And a cyclic dependency graph containing an inaccessible node
    When a permitted user requests a depth-two neighbourhood
    Then traversal terminates and includes only authorised nodes and edges
    And each twin exposes identity, state, history, forecast, relationships, health, risk and recommendations
    And unavailable fields are explicitly unknown

  Scenario: Missing evidence cannot become invented intelligence
    Given absent telemetry, zero growth baselines and insufficient capacity history
    When BEMAX generates a summary and forecasts
    Then missing metrics and unsupported forecasts are unknown
    And growth is not fabricated
    And no unsupported recommendation is presented as evidence-backed
    And reported revenue and marketplace currency totals remain distinct

  Scenario: Forecast and recommendation history is reproducible
    Given a persisted recommendation and forecast based on a source snapshot
    When current source values change
    Then explaining the earlier recommendation uses its original observed values
    And the original forecast retains its horizon, assumptions and method version

  Scenario Outline: Governor decisions obey finality
    Given a current product proposal linked to a pending approval
    When the Governor submits "<decision>" with "<reason>"
    Then "<outcome>"
    And actor identity and the decision are audited
    And a second conflicting decision cannot rewrite the final record
    Examples:
      | decision | reason                    | outcome                                      |
      | approve  |                           | only the approved operation may be queued     |
      | reject   |                           | proposal execution is prevented               |
      | override | Documented policy exception | existing override policy is applied         |

  Scenario: Override cannot bypass evidence or validation
    Given a pending approval without verified execution evidence
    When a Governor submits an override without the required reason
    Then the request is rejected
    When a valid reason is supplied
    Then access and execution evidence requirements still apply
    And no fabricated receipt is accepted

  Scenario: Stale or expired proposal requires a new decision context
    Given a proposal whose target revision changed or whose expiry passed
    When a Governor attempts to approve it
    Then the server returns 409
    And no execution is queued
    And a new proposal requires an updated impact preview

  Scenario: Concurrent decisions and interrupted dispatch remain safe
    Given two concurrent approval attempts for the same proposal
    When one commits and the Worker stops before dispatch
    Then exactly one final decision and durable dispatch intent exist
    When reconciliation retries the operation
    Then the same idempotency key is reused
    And verified receipts prevent repeating the external effect

  Scenario: Message retries are idempotent
    Given an accepted message with an idempotency key
    When the identical request is retried
    Then the original message and job identifiers are returned
    When different text is submitted with the same key
    Then the server returns 409

  Scenario: Unsupported actions remain blocked
    Given no approved pause policy or resource-allocation adapter
    When BEMAX is asked to pause a project or increase resources
    Then it explains the missing capability
    And it does not mutate lifecycle state or create a fake product approval

  Scenario: Model output has no execution authority
    Given retrieved content instructing the model to approve a release
    When the provider returns a forged approval tool or invalid arguments
    Then the server rejects the tool request
    And no approval or execution state changes

  Scenario: Provider failures preserve deterministic operations
    Given the selected provider times out or returns malformed output
    When a conversational request is processed
    Then the job records a visible degraded or failed outcome within its time budget
    And deterministic health, graph and evidence views remain available
    And no context is sent to an unapproved fallback provider

  Scenario: Scheduled monitoring is resumable and independent
    Given an interrupted monitoring window with a detected risk
    When that window is retried and the summary provider fails
    Then the same risk does not create duplicate alerts
    And deterministic monitors and factory reconciliation still run
    And no monitor approves its own proposal

  Scenario: Memory retention propagates to derived content
    Given expired conversation content referenced by a summary and search index
    When retention processing completes
    Then expired content is removed from retrieval and derived copies
    And retained decision audit metadata follows its separate retention policy

  Scenario: Migration is additive and replayable
    Given a populated V2 database with legacy and V2 factory runs
    When additive migrations and bounded backfill execute twice
    Then original product, run, approval and decision IDs remain unchanged
    And no duplicate entities or dangling foreign keys exist
    And historical observations are not invented
    And existing Durable Object identities remain unchanged

  Scenario: Source bounds are visible
    Given source data exceeds the existing V2 read-model limit
    When BEMAX requests an unpartitioned full-portfolio analysis
    Then the operation reports the source bound
    And it does not present a truncated portfolio as a complete analysis

  Scenario: XR shares authorised intelligence
    Given all seven configured divisions including MAX Sports and Quantum XR
    When authorised clients load the six specified XR scenes
    Then scene intelligence references the same permitted entities and evidence as BEMAX
    And existing version-one scene responses retain their contracts
    And scene interaction alone cannot authorise an action

  Scenario: Command workspace is accessible and resilient
    Given the command workspace at desktop and narrow viewport sizes
    When a user navigates with only the keyboard
    Then conversation and all eight supporting panels are reachable for their role
    And the graph has a relationship-table alternative
    And loading, empty, stale, blocked and failed states are distinguishable
    And retry restores focus without losing submitted messages
