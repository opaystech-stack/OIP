import type { CapabilityDefinition, JsonObject, PlannedAction } from "../../core/src/index.js";
import type { LlmAdapter } from "../../llm-adapter/src/index.js";

export class LlmPlanner {
  constructor(
    private readonly llm: LlmAdapter,
    private readonly capabilities: readonly CapabilityDefinition[],
  ) {}

  async plan(input: string): Promise<PlannedAction> {
    const response = await this.llm.generateJson({
      schemaName: "oip.planned_action.v1",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            "You are the Opays Intelligence Platform planner.",
            "Return only a JSON object matching PlannedAction.",
            "You choose a capability but never execute it.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            input,
            capabilities: this.capabilities.map((capability) => ({
              id: capability.id,
              description: capability.description,
              parameters: capability.parameters,
            })),
          }),
        },
      ],
    });

    return parsePlannedAction(response);
  }
}

function parsePlannedAction(value: JsonObject): PlannedAction {
  const capabilityId = value.capabilityId;
  const args = value.arguments;
  const confidence = value.confidence;
  const reason = value.reason;

  if (typeof capabilityId !== "string") {
    throw new Error("LLM plan is missing string capabilityId.");
  }

  if (!isJsonObject(args)) {
    throw new Error("LLM plan is missing object arguments.");
  }

  if (typeof confidence !== "number") {
    throw new Error("LLM plan is missing number confidence.");
  }

  if (typeof reason !== "string") {
    throw new Error("LLM plan is missing string reason.");
  }

  return {
    capabilityId,
    arguments: args,
    confidence,
    reason,
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
