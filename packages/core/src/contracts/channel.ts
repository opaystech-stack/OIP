import type { JsonObject, JsonValue } from "./common.js";

export type ChannelType = "web" | "mobile" | "whatsapp" | "telegram" | "api" | "voice";

export interface Attachment {
  readonly id: string;
  readonly mimeType: string;
  readonly content: Uint8Array;
  readonly metadata?: JsonObject;
}

export interface InboundRequest {
  readonly channel: ChannelType;
  readonly rawPayload: JsonValue;
  readonly text?: string;
  readonly attachments?: readonly Attachment[];
  readonly headers?: { readonly [key: string]: string };
  readonly metadata?: JsonObject;
}

export interface ResponseMessage {
  readonly type: "text" | "structured" | "confirmation" | "error";
  readonly content: string;
  readonly data?: JsonObject;
}

export interface SuggestedAction {
  readonly capabilityId?: string;
  readonly workflowId?: string;
  readonly skillId?: string;
  readonly label: string;
  readonly arguments?: JsonObject;
}

export interface OutboundResponse {
  readonly channel: ChannelType;
  readonly targetId: string;
  readonly messages: readonly ResponseMessage[];
  readonly actions?: readonly SuggestedAction[];
}
