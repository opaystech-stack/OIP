import type { JsonObject } from "./common.js";
import type { IdentityContext } from "./identity.js";

export type PolicyEffect = "allow" | "deny" | "confirm" | "escalate";

export interface PolicyRequest {
  readonly subject: IdentityContext;
  readonly resource: string;
  readonly action: string;
  readonly arguments?: JsonObject;
}

export interface PolicyDecision {
  readonly effect: PolicyEffect;
  readonly reasons: readonly string[];
  readonly requiredConfirmationLevel?: "low" | "medium" | "high" | "critical";
}

export interface PolicyDefinition {
  readonly id: string;
  readonly description: string;
  readonly resource: string;
  readonly action: string;
  readonly rules: readonly JsonObject[];
}
