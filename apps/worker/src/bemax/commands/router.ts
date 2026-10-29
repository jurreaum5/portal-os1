export interface CommandRequest {
  command: string;
  payload?: Record<string, unknown>;
}

export interface CommandResult {
  accepted: boolean;
  route: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export class CommandRouter {
  route(command: string, payload: Record<string, unknown> = {}): CommandResult {
    const normalized = command.trim().toLowerCase();

    if (normalized === "daily-brief") {
      return {
        accepted: true,
        route: "briefs.daily",
        summary: "Generated the daily brief from current portfolio and risk signals.",
        payload,
      };
    }

    if (normalized === "risk-review") {
      return {
        accepted: true,
        route: "risks.review",
        summary: "Opened the active risk review queue.",
        payload,
      };
    }

    if (normalized === "opportunity-review") {
      return {
        accepted: true,
        route: "opportunities.review",
        summary: "Opened the opportunity review queue.",
        payload,
      };
    }

    return {
      accepted: false,
      route: "unknown",
      summary: "Command not recognized. Supported commands: daily-brief, risk-review, opportunity-review.",
      payload,
    };
  }
}
