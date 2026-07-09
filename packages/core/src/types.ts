export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export type ConfirmationLevel = "none" | "low" | "medium" | "high" | "critical";

export interface UserContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly workspaceId?: string;
  readonly roles: readonly string[];
  readonly locale?: string;
  readonly activeModule?: string;
  readonly activePage?: string;
}

export interface RuntimeContext {
  readonly user: UserContext;
  readonly requestId: string;
  readonly channel: "web" | "mobile" | "whatsapp" | "telegram" | "api" | "voice";
  readonly metadata?: JsonObject;
}

export interface CapabilityParameter {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "object" | "array";
  readonly required: boolean;
  readonly description: string;
}

export interface CapabilityDefinition {
  readonly id: string;
  readonly description: string;
  readonly parameters: readonly CapabilityParameter[];
  readonly requiredRoles: readonly string[];
  readonly confirmationLevel: ConfirmationLevel;
  readonly sideEffects: readonly string[];
  readonly emits: readonly string[];
}

export interface PlannedAction {
  readonly capabilityId: string;
  readonly arguments: JsonObject;
  readonly confidence: number;
  readonly reason: string;
  readonly [key: string]: JsonValue;
}

export interface ValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export interface ValidationResult {
  readonly allowed: boolean;
  readonly requiresConfirmation: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface ActionResult {
  readonly capabilityId: string;
  readonly status: "completed" | "rejected";
  readonly data?: JsonObject;
  readonly events: readonly DomainEvent[];
}

export interface DomainEvent {
  readonly type: string;
  readonly payload: JsonObject;
  readonly occurredAt: string;
}

export interface EventPublisher {
  publish(event: DomainEvent, context: RuntimeContext): Promise<void>;
}

export interface AuditRecord {
  readonly requestId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly capabilityId: string;
  readonly status: "completed" | "rejected";
  readonly reason: string;
  readonly occurredAt: string;
  readonly metadata?: JsonObject;
}

export interface AuditLogger {
  record(entry: AuditRecord): Promise<void>;
}

export interface ToolHandler {
  execute(args: JsonObject, context: RuntimeContext): Promise<ActionResult>;
}

export interface OipPlugin {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly CapabilityDefinition[];
  readonly tools: ReadonlyMap<string, ToolHandler>;
}
