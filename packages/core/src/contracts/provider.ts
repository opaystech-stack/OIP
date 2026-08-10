export type ProviderCapability = "text" | "json" | "embedding" | "streaming" | "tool-calling";

/** Provider-neutral description; product code never depends on a vendor name. */
export interface ProviderDefinition {
  readonly id: string;
  readonly capabilities: readonly ProviderCapability[];
  readonly priority?: number;
}
