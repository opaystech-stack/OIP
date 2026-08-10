import type { LlmRuntime, ProviderCapability, ProviderDefinition } from "../../core/src/contracts/index.js";

export interface ProviderRegistration {
  readonly definition: ProviderDefinition;
  readonly runtime: LlmRuntime;
}

/** Maps required model capabilities to an implementation without exposing vendor names to OIP. */
export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderRegistration>();

  register(registration: ProviderRegistration): void {
    if (this.providers.has(registration.definition.id)) {
      throw new Error(`Provider already registered: ${registration.definition.id}`);
    }
    this.providers.set(registration.definition.id, registration);
  }

  resolve(required: readonly ProviderCapability[], preferredProviderId?: string): ProviderRegistration | undefined {
    const candidates = [...this.providers.values()]
      .filter((provider) => required.every((capability) => provider.definition.capabilities.includes(capability)))
      .sort((left, right) => (right.definition.priority ?? 0) - (left.definition.priority ?? 0));
    return candidates.find((provider) => provider.definition.id === preferredProviderId) ?? candidates[0];
  }

  list(): readonly ProviderDefinition[] {
    return [...this.providers.values()].map((registration) => registration.definition);
  }
}
