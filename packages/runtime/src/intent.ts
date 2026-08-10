import type { ExecutionContext, InboundRequest, Intention, LlmRuntime } from "../../core/src/contracts/index.js";
import type { IntentInterpreter } from "./orchestrator.js";

export class LlmIntentInterpreter implements IntentInterpreter {
  constructor(private readonly llm: LlmRuntime) {}

  async interpret(request: InboundRequest, context: ExecutionContext): Promise<Intention> {
    const result = await this.llm.generateJson<unknown>([
      { role: "system", content: "Return an intention only. Never select a capability, tool, workflow, provider, or action." },
      { role: "user", content: JSON.stringify({ text: request.text ?? "", locale: context.locale ?? "fr" }) },
    ], { type: "oip.intention.v1" });
    return parseIntention(result, request.text ?? "");
  }
}

export class DirectIntentInterpreter implements IntentInterpreter {
  constructor(private readonly intention: Intention) {}
  async interpret(_request: InboundRequest, _context: ExecutionContext): Promise<Intention> { return this.intention; }
}

function parseIntention(value: unknown, rawText: string): Intention {
  if (!isObject(value) || typeof value.type !== "string" || typeof value.goal !== "string") {
    throw new Error("Intent interpreter returned an invalid intention.");
  }
  const entities = Array.isArray(value.entities)
    ? value.entities.filter(isEntity).map((entry) => ({ name: entry.name, value: entry.value }))
    : [];
  return {
    type: value.type,
    goal: value.goal,
    confidence: typeof value.confidence === "number" ? value.confidence : 0,
    entities,
    rawText,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEntity(value: unknown): value is { name: string; value: import("../../core/src/contracts/common.js").JsonValue } {
  return isObject(value) && typeof value.name === "string" && "value" in value;
}
