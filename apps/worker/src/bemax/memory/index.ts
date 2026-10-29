export interface MemoryEntry {
  id: string;
  type: "brief" | "risk" | "opportunity" | "recommendation";
  createdAt: string;
  payload: Record<string, unknown>;
}

export class MemoryStore {
  private readonly entries: MemoryEntry[] = [];

  add(type: MemoryEntry["type"], payload: Record<string, unknown>): MemoryEntry {
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      payload,
    };
    this.entries.push(entry);
    return entry;
  }

  list(): MemoryEntry[] {
    return [...this.entries].slice(-20);
  }
}
