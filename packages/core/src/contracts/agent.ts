import type { Intention } from "./intention.js";
import type { ProviderCapability } from "./provider.js";

export interface AgentBudget {
  readonly maxTokens?: number;
  readonly maxCostUsd?: number;
  readonly maxSteps?: number;
}

export interface AgentDefinition {
  readonly id: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  readonly memoryScopes: readonly ("conversation" | "user" | "workspace" | "organization" | "episodic")[];
  readonly preferredProviderId?: string;
  readonly requiredProviderCapabilities?: readonly ProviderCapability[];
  readonly budget: AgentBudget;
  readonly permissions: readonly string[];
  readonly toolIds: readonly string[];
  readonly policyIds: readonly string[];
}

export interface AgentCatalog {
  select(intent: Intention): AgentDefinition | undefined;
  list(): readonly AgentDefinition[];
}
