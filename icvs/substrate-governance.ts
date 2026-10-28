/** Class-C recovery policy. Worker code supplies persistence and execution only. */
export function recoveryTransition(action: string) {
  switch (action) {
    case "review":
      return { from: "recommended", to: "reviewed" };
    case "approve":
    case "override":
      return { from: "reviewed", to: "approved" };
    case "reject":
      return { from: "reviewed", to: "rejected" };
    case "execute":
      return { from: "approved", to: "validated" };
    default:
      return null;
  }
}
