# D1 Validation Matrix

| Registry | Table Exists | Empty Safe | Schema Valid | Query Works |
| --- | --- | --- | --- | --- |
| Identity Registry | ✅ | ✅ | ✅ | ✅ |
| Event Registry | ✅ | ✅ | ✅ | ✅ |
| Relationship Registry | ✅ | ✅ | ✅ | ✅ |
| Research Registry | ✅ | ✅ | ✅ | ✅ |
| Framework Registry | ✅ | ✅ | ✅ | ✅ |
| Standards Registry | ✅ | ✅ | ✅ | ✅ |
| Protocol Registry | ✅ | ✅ | ✅ | ✅ |
| Policy Registry | ✅ | ✅ | ✅ | ✅ |
| Provider Registry | ✅ | ✅ | ✅ | ✅ |
| Simulation Registry | ✅ | ✅ | ✅ | ✅ |

## Empty-State Rules

For every D1-backed registry:

Valid empty response:

```json
{
  "records": [],
  "status": "EMPTY"
}
```

Invalid responses:
- 500
- null
- undefined
- HTML
- unhandled exception

## D1 Validation Tests

### DB-001: D1 binding exists

Verify the binding is available and the worker can access the D1 database handle.

### DB-002: Query executes

Verify a representative SELECT query runs successfully against the expected registry table.

### DB-003: Empty table does not fail

Verify a query against an empty table returns a valid empty response instead of a 500.

### DB-004: Schema mismatch detected

Verify schema errors are surfaced explicitly and do not silently fall through to a generic 500.

### DB-005: Migration history valid

Verify the database state matches the expected schema and migration history for the registry set.

## Production Gate

A D1-backed route is considered valid only when all of the following are true:
- binding exists
- query executes
- empty data is safe
- schema is valid
- migration history is valid
