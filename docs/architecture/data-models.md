# Research Record

```ts
interface ResearchRecord {
  researchId: string;

  title: string;

  summary: string;

  researchArea: string;

  authors: string[];

  owner: string;

  status:
    | "DRAFT"
    | "REVIEW"
    | "APPROVED"
    | "PUBLISHED";

  frameworkIds: string[];

  publicationIds: string[];

  tags: string[];

  createdAt: string;

  updatedAt: string;

  version: string;
}
```

---

# Framework Record

```ts
interface FrameworkRecord {
  frameworkId: string;

  title: string;

  description: string;

  originatingResearch: string[];

  publicationIds: string[];

  standardIds: string[];

  owner: string;

  version: string;

  approvalHistory: string[];

  createdAt: string;

  updatedAt: string;
}
```

---

# Standard Record

```ts
interface StandardRecord {
  standardId: string;

  title: string;

  description: string;

  frameworkIds: string[];

  protocolIds: string[];

  owner: string;

  status:
    | "DRAFT"
    | "APPROVED"
    | "ACTIVE"
    | "DEPRECATED";

  version: string;

  approvalHistory: string[];

  createdAt: string;
}
```

---

# Protocol Record

```ts
interface ProtocolRecord {
  protocolId: string;

  title: string;

  description: string;

  standardIds: string[];

  dependencies: string[];

  owner: string;

  version: string;

  approvalHistory: string[];

  createdAt: string;

  updatedAt: string;
}
```

---

# Lineage Rules

```text
Research
↓
Framework
↓
Standard
↓
Protocol
```

Must be traceable in both directions.

All lineage records are immutable.
