import type { Intention } from "../../core/src/contracts/intention.js";
import type { ExecutionContext } from "../../core/src/contracts/context.js";
import type { JsonObject, JsonValue } from "../../core/src/contracts/common.js";
import type { IdentityContext } from "../../core/src/contracts/identity.js";
import { SemanticDispatcher, type PageContext, type SemanticExecutionResult } from "./index.js";

/**
 * SemanticIntentRouter (ADR-012 + ADR-014).
 *
 * Bridges the existing OIP Intention contract to the universal semantic
 * dispatcher. It resolves a user's action request to the generic triplet
 * [Entity, Operation, Arguments] and then calls SemanticDispatcher.execute.
 *
 * Additionally, ADR-014 injects an optional `page_context` describing the
 * active page (route, entity_id, selection) so that ambiguous requests such as
 * "supprime-le" can be resolved to the object currently in context.
 *
 * No hard-coded tools or capability lists are used. All routing derives from
 * the product's Semantic Manifest at /api/oip/manifest.
 */

export interface SemanticRoutingOptions {
  readonly dispatcher: SemanticDispatcher;
  /**
   * Active page context (ADR-014). Passed to every execute call to enrich
   * payload with entity_id, selection, etc.
   */
  readonly pageContext?: PageContext;
  /**
   * Optional mapping from Intention.type/goal to a semantic entity and operation.
   * When absent, the router falls back to entity extraction from intent.entities.
   */
  readonly resolve?: (intent: Intention, pageContext?: PageContext) => { readonly entity: string; readonly operation: string } | undefined;
  /**
   * Optional threshold on confidence below which the request is rejected.
   * Default: 0.4
   */
  readonly confidenceThreshold?: number;
}

export class SemanticIntentRouter {
  constructor(private readonly options: SemanticRoutingOptions) {}

  async execute(
    intent: Intention,
    context: ExecutionContext,
  ): Promise<SemanticExecutionResult> {
    const threshold = this.options.confidenceThreshold ?? 0.4;
    if (intent.confidence < threshold) {
      return {
        status: "invalid",
        message: "Intention confidence too low to route semantically.",
      };
    }

    const identity = this.toIdentity(context);
    const { entity, operation, payload } = this.resolveTriplet(intent);

    if (!entity || !operation) {
      return {
        status: "invalid",
        message: "Could not resolve [Entity, Operation] from intention.",
        details: { entity: entity ?? null, operation: operation ?? null },
      };
    }

    return this.options.dispatcher.execute(entity, operation, payload, identity, this.options.pageContext);
  }

  private resolveTriplet(intent: Intention): {
    readonly entity: string | undefined;
    readonly operation: string | undefined;
    readonly payload: JsonObject;
  } {
    if (this.options.resolve) {
      const resolved = this.options.resolve(intent, this.options.pageContext);
      if (resolved) {
        return {
          entity: resolved.entity,
          operation: resolved.operation,
          payload: entitiesToPayload(intent.entities),
        };
      }
    }

    const entity = intent.entities.find((e) => e.name === "entity")?.value as string | undefined;
    const operation = intent.entities.find((e) => e.name === "operation")?.value as string | undefined;
    const payload = entitiesToPayload(
      intent.entities.filter((e) => e.name !== "entity" && e.name !== "operation"),
    );

    return { entity, operation, payload };
  }

  private toIdentity(context: ExecutionContext): IdentityContext {
    return {
      userId: context.identity.userId,
      organizationId: context.identity.organizationId,
      roles: context.identity.roles,
      locale: context.locale ?? "en",
    };
  }
}

function entitiesToPayload(entities: readonly { readonly name: string; readonly value: JsonValue }[]): JsonObject {
  const payload: Record<string, JsonValue> = {};
  for (const entity of entities) {
    payload[entity.name] = entity.value;
  }
  return payload as JsonObject;
}
