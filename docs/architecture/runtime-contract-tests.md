# Portal-OS1 Runtime Compatibility Contract Suite

## BEMAX Contract Tests

### BEMAX-API-001: Summary Route Exists

Given:
- Authenticated staff user

When:
- GET /api/bemax/summary

Then:
- HTTP status is 200
- Content-Type is application/json
- Response includes the following keys:
  - status
  - risks
  - opportunities
  - approvals
  - providerHealth
  - simulationActivity
  - recommendedActions

### BEMAX-API-002: Empty-State Safety

Given:
- No risks
- No opportunities
- No approvals

When:
- GET /api/bemax/summary

Then:
- Response is JSON
- The following fields are arrays:
  - risks
  - opportunities
  - approvals
- Empty state is returned as arrays, never as null or undefined

Example valid response:

```json
{
  "risks": [],
  "opportunities": [],
  "approvals": []
}
```

### BEMAX-API-003: Authentication Enforcement

Given:
- Anonymous user

When:
- GET /api/bemax/summary

Then:
- HTTP response is 401 or 403

## Provider Contract Tests

### PROVIDER-API-001: Provider Health Route Exists

When:
- GET /api/providers/health

Then:
- HTTP status is 200
- Response is JSON
- Response includes a providers array

Example valid response:

```json
{
  "providers": []
}
```

### PROVIDER-API-002: Provider State Validation

When:
- GET /api/providers/health

Then:
- Every provider state is one of the following values only:
  - CONNECTED
  - DEGRADED
  - STALE
  - BLOCKED
  - DISCONNECTED
  - UNCONFIGURED

### PROVIDER-API-003: Provider Empty State

Given:
- No provider records

When:
- GET /api/providers/health

Then:
- Response is JSON
- Response includes providers: []
- Response does not fail with 500

## Governor Contract Tests

### GOV-API-001: Governor Summary

When:
- GET /api/governor/summary

Then:
- HTTP status is 200
- Response contains:
  - criticalIssues
  - approvals
  - risks
  - opportunities
  - recommendations

### GOV-API-002: Governor Approvals

When:
- GET /api/governor/approvals

Then:
- HTTP status is 200
- Response contains an approvals array

Example valid response:

```json
{
  "approvals": []
}
```

### GOV-API-003: Governor Risks

When:
- GET /api/governor/risks

Then:
- HTTP status is 200
- Response contains a risks array

Example valid response:

```json
{
  "risks": []
}
```

### GOV-API-004: Governor Authorization

Given:
- Readonly user

When:
- GET /api/governor/summary

Then:
- Authorization is enforced
- User is denied access by 401 or 403

## USS Contract Tests

### USS-API-001: Overview

When:
- GET /api/uss/overview

Then:
- HTTP status is 200
- Response includes the following sections:
  - research
  - framework
  - standards
  - protocol
  - policy

### USS-API-002: Empty Records

Given:
- Empty registry data

When:
- GET /api/uss/records

Then:
- HTTP status is 200
- Response includes records: []

Example valid response:

```json
{
  "records": []
}
```

## Final Runtime Validation Rule

A route is considered certified only when all of the following are true:

- Route exists
- Authentication works
- Response is JSON
- Empty state is safe
- D1 access is validated
- Audit event is generated where applicable
- Pages consumer works
- Contract test passes
