// Official public types for the OIP Runtime API.
// These types are the only surface exposed to external consumers.

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | readonly JsonValue[];

export interface RuntimeContext {
  readonly requestId: string;
  readonly channel: RuntimeChannel;
  readonly user: UserContext;
  readonly metadata?: JsonObject;
}

export type RuntimeChannel =
  | "api"
  | "web"
  | "mobile"
  | "cli"
  | "mcp"
  | "automation"
  | string;

export interface UserContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly workspaceId?: string;
  readonly roles: readonly string[];
  readonly locale?: string;
  readonly activeModule?: string;
  readonly activePage?: string;
}

export interface OipPublicRequest<TPayload = JsonObject> {
  readonly requestId: string;
  readonly operation: string;
  readonly payload: TPayload;
  readonly context?: RuntimeContext;
  readonly timeoutMs?: number;
  readonly correlationId?: string;
}

export interface OipPublicResponse<TResult = JsonObject> {
  readonly requestId: string;
  readonly operation: string;
  readonly status: "completed" | "rejected" | "pending" | "error";
  readonly result?: TResult;
  readonly error?: OipPublicError;
  readonly metadata: {
    readonly durationMs: number;
    readonly version: string;
    readonly warnings?: readonly string[];
  };
}

export interface OipPublicError {
  readonly code: string;
  readonly message: string;
  readonly details?: JsonObject;
  readonly retryable: boolean;
  readonly suggestedAction?: "retry" | "confirm" | "escalate" | "none";
}

export interface LlmMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LlmGenerateTextPayload {
  readonly messages: readonly LlmMessage[];
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface LlmGenerateTextResult {
  readonly text: string;
  readonly model?: string;
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
  };
}

export type PublicOperation =
  | "llm.generateText";

export interface OipPublicRuntimeApi {
  invoke<TResult = JsonObject>(
    request: OipPublicRequest<JsonObject>,
  ): Promise<OipPublicResponse<TResult>>;
}
