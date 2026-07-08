import type { CapabilityDefinition, OipPlugin, ToolHandler } from "./types.js";

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityDefinition>();

  register(capability: CapabilityDefinition): void {
    if (this.capabilities.has(capability.id)) {
      throw new Error(`Capability already registered: ${capability.id}`);
    }

    this.capabilities.set(capability.id, capability);
  }

  get(capabilityId: string): CapabilityDefinition | undefined {
    return this.capabilities.get(capabilityId);
  }

  list(): readonly CapabilityDefinition[] {
    return [...this.capabilities.values()];
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolHandler>();

  register(capabilityId: string, handler: ToolHandler): void {
    if (this.tools.has(capabilityId)) {
      throw new Error(`Tool already registered for capability: ${capabilityId}`);
    }

    this.tools.set(capabilityId, handler);
  }

  get(capabilityId: string): ToolHandler | undefined {
    return this.tools.get(capabilityId);
  }
}

export function registerPlugin(
  plugin: OipPlugin,
  capabilities: CapabilityRegistry,
  tools: ToolRegistry,
): void {
  for (const capability of plugin.capabilities) {
    capabilities.register(capability);
  }

  for (const [capabilityId, handler] of plugin.tools) {
    tools.register(capabilityId, handler);
  }
}
