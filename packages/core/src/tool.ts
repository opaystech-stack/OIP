import type { ActionResult, JsonObject, RuntimeContext, ToolHandler } from "./types.js";

export function defineTool(
  execute: (args: JsonObject, context: RuntimeContext) => Promise<ActionResult>,
): ToolHandler {
  return { execute };
}
