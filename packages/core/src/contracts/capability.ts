import type { JsonObject } from "./common.js";

export type CapabilityParameterType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array";

export interface CapabilityParameter {
  readonly name: string;
  readonly type: CapabilityParameterType;
  readonly required: boolean;
  readonly description: string;
}

export type ConfirmationLevel = "none" | "low" | "medium" | "high" | "critical";

export interface Capability {
  readonly id: string;
  readonly description: string;
  readonly parameters: readonly CapabilityParameter[];
  readonly requiredRoles: readonly string[];
  readonly confirmationLevel: ConfirmationLevel;
  readonly sideEffects: readonly string[];
  readonly emits: readonly string[];
}
