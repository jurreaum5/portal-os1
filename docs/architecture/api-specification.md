# API Standards

## Permissions

Roles:

```text
VIEWER
CONTRIBUTOR
REVIEWER
APPROVER
GOVERNOR
ADMIN
```

---

## Common Pagination

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
  "total": 1000
}
```

---

## Common Errors

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
