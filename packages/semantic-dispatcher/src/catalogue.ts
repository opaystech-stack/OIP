import type { JsonObject } from "../../core/src/index.js";
import type { IdentityContext } from "../../core/src/contracts/identity.js";
import { SemanticDispatcher, type PageContext, type SemanticExecutionResult } from "./index.js";
import {
  manifestToFunctionTools,
  parseFunctionName,
  toFunctionName,
  type FunctionTool,
} from "./function-calling.js";

/**
 * Multi-Application Catalogue (ADR-012, Point #2 réconcilié).
 *
 * OIP is a PURE dispatcher. It connects to N products (Opays HQ, Opays Biz,
 * Opays FOX, …), each exposing its own Semantic Manifest and its own
 * SemanticDispatcher. The catalogue:
 *
 * 1. Aggregates every product's manifest into a single flat list of
 *    function-calling tools the LLM can choose from.
 * 2. Given the function name the LLM selected, resolves WHICH product published
 *    that entity/operation and forwards the call to that product's dispatcher.
 *
 * GOVERNANCE:
 * - No hard-coded domains ("retail", "forex"). Routing is derived entirely from
 *   which product's manifest declared the entity. Adding a new product is a
 *   registration, not a code change.
 * - To keep function names globally unique across products, the tool name is
 *   prefixed with the product id: `<product>::<entity>__<operation>`.
 * - No business logic. The catalogue only maps names → dispatchers.
 */

/** Separator between the product id and the intra-product function name. */
export const PRODUCT_NAMESPACE_SEPARATOR = "::";

export interface RegisteredProduct {
  /** Stable product identifier, e.g. "opays-hq", "opays-biz", "opays-fox". */
  readonly id: string;
  /** The product's own semantic dispatcher (already wired to its connector). */
  readonly dispatcher: SemanticDispatcher;
}

/** A namespaced tool: same JSON-Schema as FunctionTool, product-prefixed name. */
export type NamespacedFunctionTool = FunctionTool;

function toNamespacedName(productId: string, functionName: string): string {
  return `${productId}${PRODUCT_NAMESPACE_SEPARATOR}${functionName}`;
}

function parseNamespacedName(name: string):
  | { readonly product: string; readonly entity: string; readonly operation: string }
  | undefined {
  const idx = name.indexOf(PRODUCT_NAMESPACE_SEPARATOR);
  if (idx <= 0) return undefined;
  const product = name.slice(0, idx);
  const rest = name.slice(idx + PRODUCT_NAMESPACE_SEPARATOR.length);
  const parsed = parseFunctionName(rest);
  if (!product || !parsed) return undefined;
  return { product, entity: parsed.entity, operation: parsed.operation };
}

export class MultiAppCatalogue {
  private readonly products = new Map<string, SemanticDispatcher>();

  constructor(products: readonly RegisteredProduct[] = []) {
    for (const product of products) {
      this.register(product);
    }
  }

  /** Register (or replace) a product and its dispatcher. */
  register(product: RegisteredProduct): void {
    this.products.set(product.id, product.dispatcher);
  }

  /** List the currently registered product ids. */
  listProducts(): readonly string[] {
    return [...this.products.keys()];
  }

  /**
   * Aggregate the function-calling tools from every registered product.
   * Each product's manifest is loaded on-demand via its dispatcher, then its
   * tools are namespaced with the product id so names stay globally unique.
   *
   * Products that fail to load are skipped (their error is reported in
   * `errors`) so a single unreachable product never breaks the whole catalogue.
   */
  async listTools(): Promise<{
    readonly tools: readonly NamespacedFunctionTool[];
    readonly errors: Readonly<Record<string, string>>;
  }> {
    const tools: NamespacedFunctionTool[] = [];
    const errors: Record<string, string> = {};

    await Promise.all(
      [...this.products.entries()].map(async ([productId, dispatcher]) => {
        try {
          const manifest = await dispatcher.getManifest();
          for (const tool of manifestToFunctionTools(manifest)) {
            tools.push({
              type: "function",
              function: {
                ...tool.function,
                name: toNamespacedName(productId, tool.function.name),
              },
            });
          }
        } catch (error) {
          errors[productId] = error instanceof Error ? error.message : String(error);
        }
      }),
    );

    return { tools, errors };
  }

  /**
   * Route a function call the LLM produced back to the owning product.
   * `functionName` must be the namespaced name from listTools().
   */
  async dispatch(
    functionName: string,
    payload: JsonObject,
    identity: IdentityContext,
    pageContext?: PageContext,
  ): Promise<SemanticExecutionResult> {
    const parsed = parseNamespacedName(functionName);
    if (!parsed) {
      return {
        status: "invalid",
        message: `Malformed function name "${functionName}". Expected "<product>${PRODUCT_NAMESPACE_SEPARATOR}<entity>__<operation>".`,
      };
    }

    const dispatcher = this.products.get(parsed.product);
    if (!dispatcher) {
      return {
        status: "invalid",
        message: `No product registered under id "${parsed.product}".`,
        details: { availableProducts: [...this.listProducts()] },
      };
    }

    return dispatcher.execute(parsed.entity, parsed.operation, payload, identity, pageContext);
  }
}

export { toFunctionName };
