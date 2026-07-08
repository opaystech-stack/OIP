import type { JsonObject, JsonSchema, JsonValue } from "./common.js";

export type CapabilityParameterType =
  | "string"
  | "number"
  | "boolean"
  | "integer"
  | "object"
  | "array"
  | "date"
  | "datetime"
  | "currency"
  | "file"
  | "reference";

export interface CapabilityParameter {
  readonly name: string;
  readonly type: CapabilityParameterType;
  readonly required: boolean;
  readonly description: string;
  readonly defaultValue?: JsonValue;
  readonly examples?: readonly JsonValue[];
}

export type ConfirmationLevel = "none" | "low" | "medium" | "high" | "critical";

export interface CapabilityErrorCode {
  readonly code: string;
  readonly message: string;
  readonly severity: "warning" | "error" | "critical";
  readonly recoverable: boolean;
}

export interface Capability {
  readonly id: string;
  readonly pluginId: string;
  readonly workspaceId?: string;
  readonly version: string;
  readonly description: string;
  readonly examples: readonly string[];
  readonly parameters: readonly CapabilityParameter[];
  readonly requiredRoles: readonly string[];
  readonly requiredPermissions: readonly string[];
  readonly policies: readonly string[];
  readonly confirmationLevel: ConfirmationLevel;
  readonly sideEffects: readonly string[];
  readonly emits: readonly string[];
  readonly resultSchema: JsonSchema;
  readonly errorCodes: readonly CapabilityErrorCode[];
}
