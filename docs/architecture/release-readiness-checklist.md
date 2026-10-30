# Release Readiness Checklist

## Architecture
- [ ] Architecture authority present
- [ ] API specification complete
- [ ] Data models complete
- [ ] Traceability matrix complete
- [ ] Acceptance tests complete

## Worker Runtime
- [ ] Worker deploys
- [ ] Worker starts
- [ ] No startup errors
- [ ] Compatibility routes active
  - [ ] /api/bemax/summary
  - [ ] /api/providers/health
  - [ ] /api/governor/summary
  - [ ] /api/governor/approvals
  - [ ] /api/governor/risks
  - [ ] /api/uss/overview
  - [ ] /api/uss/records

## Authentication
- [ ] Governor access
- [ ] Admin access
- [ ] Operator access
- [ ] Readonly access
- [ ] Bootstrap users working
- [ ] Environment overrides working

## D1
- [ ] Binding exists
- [ ] Tables present
- [ ] Queries pass
- [ ] Empty-state safe
- [ ] No registry errors

## BEMAX
- [ ] Summary route working
- [ ] Risks route working
- [ ] Opportunities route working
- [ ] Recommendation rendering working

## Provider Operations
- [ ] OpenAI health
- [ ] Gemini health
- [ ] Claude health
- [ ] Local health
- [ ] Provider aggregation working

## Governor Mode
- [ ] Governor summary working
- [ ] Approvals working
- [ ] Risks working
- [ ] Authorization working

## Pages → Worker
- [ ] Dashboard loads
- [ ] BEMAX loads
- [ ] Institute loads
- [ ] Governor loads
- [ ] Ecosystem loads
- [ ] No 404s
- [ ] No 500s

## Contract Suite
- [ ] BEMAX-API-001
- [ ] BEMAX-API-002
- [ ] BEMAX-API-003
- [ ] PROVIDER-API-001
- [ ] PROVIDER-API-002
- [ ] PROVIDER-API-003
- [ ] GOV-API-001
- [ ] GOV-API-002
- [ ] GOV-API-003
- [ ] GOV-API-004
- [ ] USS-API-001
- [ ] USS-API-002
- [ ] DB-001
- [ ] DB-002
- [ ] DB-003
- [ ] DB-004
- [ ] DB-005

## Production Promotion Gates

### Release Candidate requires:
- [ ] Contract suite passing
- [ ] D1 validation passing
- [ ] Pages → Worker passing
- [ ] Authentication passing

### Production Ready requires:
- [ ] Release candidate
- [ ] Monitoring active
- [ ] Alerting active
- [ ] Backups verified
- [ ] Audit exports verified
- [ ] Recovery validation passing

## Final Verdict
- [ ] GO = all checklist items complete
- [ ] NO-GO = any contract, D1, auth, or Pages → Worker validation failure
