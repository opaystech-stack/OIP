import type { AutomationAdapter, McpAdapter } from "../../adapters/src/index.js";
import type { JsonObject } from "../../core/src/index.js";

export interface AutomationTriggerRecord {
  readonly workflowId: string;
  readonly payload: JsonObject;
}

export class InMemoryAutomationAdapter implements AutomationAdapter {
  private readonly records: AutomationTriggerRecord[] = [];

  async trigger(workflowId: string, payload: JsonObject): Promise<void> {
    this.records.push({ workflowId, payload });
  }

  list(): readonly AutomationTriggerRecord[] {
    return [...this.records];
  }
}

export type McpToolHandler = (args: JsonObject) => JsonObject | Promise<JsonObject>;

export class InMemoryMcpAdapter implements McpAdapter {
  private readonly tools = new Map<string, McpToolHandler>();

  register(serverName: string, toolName: string, handler: McpToolHandler): void {
    this.tools.set(toKey(serverName, toolName), handler);
  }

  async callTool(serverName: string, toolName: string, args: JsonObject): Promise<JsonObject> {
    const handler = this.tools.get(toKey(serverName, toolName));

    if (!handler) {
      throw new Error(`MCP tool is not registered: ${serverName}.${toolName}`);
    }

    return handler(args);
  }
}

function toKey(serverName: string, toolName: string): string {
  return `${serverName}:${toolName}`;
}
