import type { OipPlugin } from "../../core/src/index.js";
import { CapabilityRegistry, registerPlugin, ToolRegistry } from "../../core/src/index.js";
import type { WorkflowDefinition, WorkflowHandler, WorkflowRegistry } from "../../workflow-engine/src/index.js";

export interface PluginWorkflowRegistration {
  readonly definition: WorkflowDefinition;
  readonly handler: WorkflowHandler;
}

export interface OipPluginModule {
  readonly plugin: OipPlugin;
  readonly workflows?: readonly PluginWorkflowRegistration[];
}

export interface PluginInstallTarget {
  readonly capabilities: CapabilityRegistry;
  readonly tools: ToolRegistry;
  readonly workflows?: WorkflowRegistry;
}

export function definePlugin(plugin: OipPlugin): OipPlugin {
  return plugin;
}

export function definePluginModule(module: OipPluginModule): OipPluginModule {
  return module;
}

export function installPluginModule(module: OipPluginModule, target: PluginInstallTarget): void {
  registerPlugin(module.plugin, target.capabilities, target.tools);

  if (!module.workflows || module.workflows.length === 0) {
    return;
  }

  if (!target.workflows) {
    throw new Error(`Plugin ${module.plugin.id} declares workflows but no WorkflowRegistry was provided.`);
  }

  for (const workflow of module.workflows) {
    target.workflows.register(workflow.definition, workflow.handler);
  }
}
