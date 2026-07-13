import type { JsonObject } from "../../core/src/index.js";
import { HqCapability, HqConnector } from "./index.js";

/**
 * HqActionRegistry — dynamic bridge between OIP's orchestration and Opays HQ.
 *
 * Responsibilities:
 * - Discover available HQ capabilities at runtime (GET /api/oip/capabilities).
 * - Keep a local, immutable snapshot of the capability contract.
 * - Resolve capabilityId → execution call (POST /api/oip/capabilities/:id).
 *
 * Governance boundary:
 * - This registry contains NO business logic. It does not know what a "lead"
 *   or a "task" is. It forwards structured JSON and HQ decides.
 * - If HQ returns 403, 422 or any other error, the registry surfaces the typed
 *   HqExecutionResult and lets the OIP orchestration layer formulate the user
 *   response.
 */

/** A discovered capability ready to be invoked by OIP agents. */
export interface HqAction {
  readonly id: string;
  readonly description?: string;
  readonly inputSchema?: JsonObject;
  readonly requiredRoles?: readonly string[];
  readonly discoveredAt: string;
}

/** Snapshot returned after a discovery round. */
export interface HqDiscoveryResult {
  readonly actions: readonly HqAction[];
  readonly source: "hq";
  readonly timestamp: string;
  readonly count: number;
}

export interface HqRegistryOptions {
  readonly connector: HqConnector;
  readonly lazy?: boolean;
}

export class HqActionRegistry {
  private snapshot: HqDiscoveryResult | undefined;
  private lastError: Error | undefined;

  constructor(private readonly options: HqRegistryOptions) {}

  /**
   * Discover HQ capabilities and materialise them as OIP actions.
   * Safe to call repeatedly: it refreshes the local snapshot every time.
   */
  async discover(): Promise<HqDiscoveryResult> {
    try {
      const capabilities = await this.options.connector.listCapabilities();
      const actions = capabilities.map(toHqAction);

      this.snapshot = {
        actions,
        source: "hq",
        timestamp: new Date().toISOString(),
        count: actions.length,
      };
      this.lastError = undefined;

      return this.snapshot;
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));
      throw this.lastError;
    }
  }

  /**
   * Return the last known snapshot without hitting HQ.
   * Use this for fast lookups during orchestration.
   */
  list(): readonly HqAction[] {
    return this.snapshot?.actions ?? [];
  }

  get(capabilityId: string): HqAction | undefined {
    return this.snapshot?.actions.find((action) => action.id === capabilityId);
  }

  has(capabilityId: string): boolean {
    return this.snapshot?.actions.some((action) => action.id === capabilityId) ?? false;
  }

  /**
   * Execute an HQ action on behalf of an OIP user.
   * - actorId is the HQ user identity that must be passed as x-oip-actor-id.
   * - args must conform to the capability's JSON-Schema (validated by HQ).
   */
  async execute(capabilityId: string, args: JsonObject, actorId: string) {
    if (!this.has(capabilityId)) {
      return {
        status: "unknown_capability" as const,
        capabilityId,
        message: `Capability '${capabilityId}' is not in the current HQ discovery snapshot. Run discover() first or check the capability registry.`,
      };
    }

    return this.options.connector.executeCapability(capabilityId, args, actorId);
  }

  /**
   * Convenience method that discovers, then executes.
   * Useful in orchestration flows where the latest contract must be used.
   */
  async discoverAndExecute(capabilityId: string, args: JsonObject, actorId: string): Promise<unknown> {
    await this.discover();
    return this.execute(capabilityId, args, actorId);
  }

  getLastError(): Error | undefined {
    return this.lastError;
  }
}

function toHqAction(capability: HqCapability, index: number): HqAction {
  return {
    id: capability.id || `unknown-${index}`,
    ...(capability.description ? { description: capability.description } : {}),
    ...(capability.inputSchema ? { inputSchema: capability.inputSchema } : {}),
    ...(capability.requiredRoles ? { requiredRoles: capability.requiredRoles } : {}),
    discoveredAt: new Date().toISOString(),
  };
}
