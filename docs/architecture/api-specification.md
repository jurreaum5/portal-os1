# API Standards

## Overview

This document defines the authoritative API contract for Portal-OS1, including authentication, response envelopes, operational states, pagination, and endpoint-level requirements. It is the source-of-truth companion to the architecture layer definitions in `docs/architecture/`.

## Authentication

All endpoints require authentication.

Header:

```http
Authorization: Bearer <token>
```

Required claims:

- userId
- role
- permissions

Supported roles:

```text
VIEWER
CONTRIBUTOR
REVIEWER
APPROVER
GOVERNOR
ADMIN
```

## Provider states

Provider lifecycle states must be explicit and must remain aligned with the platform governance model:

```text
CONNECTED
DEGRADED
STALE
BLOCKED
DISCONNECTED
UNCONFIGURED
```

## Standard success response

```json
{
  "requestId": "req-123",
  "timestamp": "2026-01-01T00:00:00Z",
  "data": {}
}
```

## Standard paginated response

```json
{
  "requestId": "req-123",
  "timestamp": "2026-01-01T00:00:00Z",
  "data": [],
  "page": 1,
  "pageSize": 50,
  "total": 1000,
  "hasNext": true
}
```

## Standard error response

```json
{
  "requestId": "req-123",
  "timestamp": "2026-01-01T00:00:00Z",
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": {}
  }
}
```

## Error codes

```text
NOT_FOUND
VALIDATION_FAILED
UNAUTHORIZED
FORBIDDEN
CONFLICT
RATE_LIMITED
APPROVAL_REQUIRED
DEPENDENCY_FAILURE
INTERNAL_ERROR
```

---

# Permissions

Roles:

```text
VIEWER
CONTRIBUTOR
REVIEWER
APPROVER
GOVERNOR
ADMIN
```

Use the pattern `<role>+` to denote access for that role and all higher-privilege roles.

---

# Common Pagination

Request:

```http
GET ?page=1&pageSize=50
```

Response:

```json
{
  "data": [],
  "page": 1,
  "pageSize": 50,
  "total": 1000,
  "hasNext": true
}
```

---

# Common Errors

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Record not found"
  }
}
```

Supported codes:

```text
NOT_FOUND
VALIDATION_FAILED
UNAUTHORIZED
FORBIDDEN
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

---

# GET /api/research

Purpose:

Return research records.

Permissions:

VIEWER+

Inputs:

```http
?page
&pageSize
&status
&researchArea
```

Outputs:

```json
{
  "data": [
    {
      "researchId": "...",
      "title": "...",
      "status": "APPROVED"
    }
  ]
}
```

Errors:

```text
UNAUTHORIZED
FORBIDDEN
```

---

# GET /api/frameworks

Permissions:

VIEWER+

Supports:

```text
Pagination
Tag Filtering
Research Filtering
```

---

# GET /api/standards

Permissions:

VIEWER+

Supports:

```text
Status Filtering
Pagination
```

---

# GET /api/protocols

Permissions:

VIEWER+

Supports:

```text
Dependency Queries
Pagination
```

---

# GET /api/providers

Permissions:

VIEWER+

Outputs:

```json
{
  "providerId": "openai",
  "state": "CONNECTED"
}
```

---

# GET /api/providers/health

Permissions:

VIEWER+

Outputs:

```json
{
  "provider": "openai",
  "state": "CONNECTED",
  "latencyMs": 230
}
```

---

# GET /api/uss/simulations

Permissions:

VIEWER+

Supports:

```text
Pagination
Simulation Type Filter
Owner Filter
```

---

# POST /api/uss/replay

Permissions:

CONTRIBUTOR+

Request:

```json
{
  "simulationId": "sim-123"
}
```

Response:

```json
{
  "replayId": "rep-456",
  "status": "QUEUED"
}
```

---

# POST /api/governance/approve

Permissions:

APPROVER+

Request:

```json
{
  "targetId": "item-123"
}
```

Response:

```json
{
  "approved": true
}
```

---

# ICV ENDPOINTS

## GET /api/icv

Permissions:

VIEWER+

Request:

```json
{
  "page": 1,
  "pageSize": 50,
  "entityType": "product",
  "owner": "ops"
}
```

Response:

```json
{
  "data": [
    {
      "identityId": "id-001",
      "entityType": "product",
      "owner": "ops"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1,
  "hasNext": false
}
```

Acceptance tests:

- ICV-001

---

## GET /api/icv/{identityId}

Permissions:

VIEWER+

Purpose:

Return the canonical identity record for the requested identity.

Response:

```json
{
  "data": {
    "identityId": "id-001",
    "entityType": "product",
    "owner": "ops",
    "status": "ACTIVE"
  }
}
```

Errors:

```text
NOT_FOUND
UNAUTHORIZED
FORBIDDEN
```

Acceptance tests:

- ICV-002

---

## Notes

- Identity, provenance, replay, governance, auditability, and recovery are first-class concerns.
- All ICV access must preserve lineage and traceability across provider, simulation, and governance events.
- This specification remains subordinate to the architecture authority in `docs/architecture/`.
