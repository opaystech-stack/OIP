import type {
  ExecutionContext,
  IdentityContext,
  PolicyDecision,
  PolicyDefinition,
  PolicyRequest,
  PolicyRuntime,
} from "../../core/src/contracts/index.js";

export class InMemoryPolicyRuntime implements PolicyRuntime {
  private readonly policies: PolicyDefinition[] = [];

  registerPolicy(policy: PolicyDefinition): Promise<void> {
    this.policies.push(policy);
    return Promise.resolve();
  }

  async evaluate(request: PolicyRequest, context: ExecutionContext): Promise<PolicyDecision> {
    const policy = this.policies.find((candidate) =>
      candidate.resource === request.resource && candidate.action === request.action,
    );
    if (!policy) return { effect: "deny", reasons: ["No policy is registered for this action."] };
    return evaluateRules(policy.rules, request, context.identity);
  }
}

function evaluateRules(
  rules: readonly import("../../core/src/contracts/common.js").JsonObject[],
  _request: PolicyRequest,
  identity: IdentityContext,
): PolicyDecision {
  for (const rule of rules) {
    const rolesAll = stringArray(rule["rolesAll"]);
    const rolesAny = stringArray(rule["rolesAny"]);
    const confirmationLevel = rule["confirmationLevel"];
    const effect = rule["effect"];

    if (rolesAll.some((role) => !identity.roles.includes(role))) {
      return { effect: "deny", reasons: ["The identity is missing a required role."] };
    }
    if (rolesAny.length > 0 && !rolesAny.some((role) => identity.roles.includes(role))) {
      return { effect: "deny", reasons: ["The identity is missing an eligible role."] };
    }
    if (isConfirmationLevel(confirmationLevel) && requiresTrustedConfirmation(confirmationLevel)) {
      return {
        effect: "confirm",
        reasons: ["The action requires a trusted confirmation."],
        requiredConfirmationLevel: confirmationLevel as Exclude<typeof confirmationLevel, "none">,
      };
    }
    if (effect === "deny" || effect === "confirm" || effect === "escalate") {
      return { effect, reasons: ["The registered policy rejected or escalated the action."] };
    }
  }
  return { effect: "allow", reasons: ["The registered policy allowed the action."] };
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isConfirmationLevel(value: unknown): value is "none" | "low" | "medium" | "high" | "critical" {
  return value === "none" || value === "low" || value === "medium" || value === "high" || value === "critical";
}

function requiresTrustedConfirmation(level: "none" | "low" | "medium" | "high" | "critical"): boolean {
  return level === "medium" || level === "high" || level === "critical";
}

export type { PolicyDecision, PolicyDefinition, PolicyRequest, PolicyRuntime } from "../../core/src/contracts/index.js";
