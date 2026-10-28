# Final completion contracts

This extension preserves the existing execution, approval and graph systems.
Migration 0011 adds immutable identity snapshots and lineage indexes.

## Intelligence and governance

`POST /api/bemax/reviews` generates a strategic brief and creates a **pending**
strategic-review proposal through the existing policy workflow. Its response
includes the brief's evidence, sources, confidence, tradeoffs, dependencies and
impact scope. Governor approval is still required before state changes.
Automation with `autonomy:propose` may generate reviews but cannot approve them.

## Identity and research history

`GET /api/icv/revisions?entityId=...&afterRevision=0` returns up to 100 immutable
snapshots and a next-revision cursor. Existing identities begin snapshot coverage
at their migration baseline; earlier events remain available through identity
history. Historical state is not reconstructed without evidence. Subsequent
state changes require sequential revisions, including compensation.

`GET /api/institute/history?entityId=...&page=0` returns version family records,
exact source ancestry, relationships and governance events in pages of up to 100
per collection. Follow `pagination.nextPage` until null. Unlike bounded graph
navigation, history has no depth cap. Pages reflect the current dataset; restart
at page zero after concurrent additions. Existing `/api/institute/lineage` remains
available. Institute outputs now also accept `specification`.

Portal identity and research views link to these histories. Simulation replay
continues to reference retained identities/revisions after current identity state
changes; new registrations still require valid current references.

## Provider and navigation contracts

Missing model credentials now report **UNCONFIGURED**, superseding the Phase 5
model API's BLOCKED state. The operations dashboard maps this to BLOCKED within
its existing status vocabulary. Missing credentials do not reserve budget or
make network calls; attempted routing records a redacted audit event.
Configuration alone never proves connectivity: CONNECTED requires an observed
successful request for the current configuration. `/api/models/capabilities`
exposes the existing adapter capability registry.

`/api/manifold/search?q=...` adds an explicit graph search route, preserving
existing navigation and search contracts.

## Production activation boundary

Local acceptance checks use isolated fixtures. They do not establish live model
or Sports connectivity. Deployment needs intended model endpoints, model names,
rates, budgets and credentials, plus a real Sports feed service binding and
provenance configuration. External alert delivery, backup restoration drills and
remote deployment remain operational work; recorded recovery evidence does not
itself execute an external restoration. No synthetic production status is added.
