import type {
  CapabilityDefinition,
  JsonObject,
  RuntimeContext,
  ValidationIssue,
  ValidationResult,
} from "./types.js";

export class Validator {
  validate(
    capability: CapabilityDefinition,
    args: JsonObject,
    context: RuntimeContext,
  ): ValidationResult {
    const issues: ValidationIssue[] = [];

    for (const role of capability.requiredRoles) {
      if (!context.user.roles.includes(role)) {
        issues.push({
          code: "missing_role",
          message: `User is missing required role: ${role}`,
        });
      }
    }

    for (const parameter of capability.parameters) {
      const value = args[parameter.name];

      if (parameter.required && value === undefined) {
        issues.push({
          code: "missing_parameter",
          field: parameter.name,
          message: `Missing required parameter: ${parameter.name}`,
        });
        continue;
      }

      if (value !== undefined && !matchesType(value, parameter.type)) {
        issues.push({
          code: "invalid_parameter_type",
          field: parameter.name,
          message: `Invalid type for parameter: ${parameter.name}`,
        });
      }
    }

    return {
      allowed: issues.length === 0,
      requiresConfirmation: requiresExplicitConfirmation(capability.confirmationLevel),
      issues,
    };
  }
}

function requiresExplicitConfirmation(level: CapabilityDefinition["confirmationLevel"]): boolean {
  return level === "medium" || level === "high" || level === "critical";
}

function matchesType(value: unknown, type: CapabilityDefinition["parameters"][number]["type"]): boolean {
  if (type === "array") {
    return Array.isArray(value);
  }

  if (type === "object") {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  return typeof value === type;
}
