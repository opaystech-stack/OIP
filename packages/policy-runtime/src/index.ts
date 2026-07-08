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
    const reasons: string[] = [];

    for (const policy of this.policies) {
      if (policy.resource !== request.resource || policy.action !== request.action) continue;

      const decision = evaluateRules(policy.rules, request, context.identity);
      reasons.push(...decision.reasons);

      if (decision.effect !== "allow") {
        return decision;
      }
    }

    return { effect: "allow", reasons };
  }
}

function evaluateRules(
  rules: readonly import("../../core/src/contracts/common.js").JsonObject[],
  _request: PolicyRequest,
  _identity: IdentityContext,
): PolicyDecision {
  return { effect: "allow", reasons: ["Rule-based policy evaluation stub."] };
}

export type { PolicyDecision, PolicyDefinition, PolicyRequest, PolicyRuntime } from "../../core/src/contracts/index.js";
