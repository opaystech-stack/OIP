import type { ActionResult, DomainEvent, JsonObject, ValidationIssue } from "./types.js";

export function success(
  capabilityId: string,
  data?: JsonObject,
  events?: readonly DomainEvent[],
): ActionResult {
  return {
    capabilityId,
    status: "completed",
    ...(data ? { data } : {}),
    events: events ?? [],
  };
}

export function rejected(
  capabilityId: string,
  issues?: readonly ValidationIssue[],
): ActionResult {
  const fallback = [{ code: "execution_rejected", message: "Action execution was rejected." }];

  return {
    capabilityId,
    status: "rejected",
    data: {
      issues: [...(issues ?? fallback)],
    } as JsonObject,
    events: [],
  };
}
