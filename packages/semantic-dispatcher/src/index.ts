import type { JsonObject, JsonValue } from "../../core/src/index.js";
import type {
  ManifestClient,
  ManifestField,
  ManifestOperation,
  SemanticManifest,
} from "../../hq-connector/src/manifest.js";
import type { HqExecutionResult } from "../../hq-connector/src/index.js";
import type { IdentityContext } from "../../core/src/contracts/identity.js";
import { manifestToFunctionTools, type FunctionTool } from "./function-calling.js";

/**
 * Active Page Context (ADR-014 §2.1).
 *
 * Pushed by the product at each copilot interaction. Derived from the Semantic
 * Manifest (ADR-012). OIP/PX only READ this context; the product remains the
 * decision-maker.
 */
export interface PageContext {
  readonly product: string;
  readonly manifestVersion: string;
  readonly route: string;
  readonly entity?: string;
  readonly entityId?: string;
  readonly view?: string;
  readonly visibleFields?: readonly string[];
  readonly availableOperations?: readonly string[];
  readonly selection?: JsonObject;
  readonly locale?: string;
  readonly userRole?: string;
}

/**
 * SemanticDispatcher (ADR-012 + ADR-014).
 *
 * OIP holds NO hard-coded tool prompts or capability lists. It only knows the
 * universal action function:
 *
 *   execute(entity, operation, payload, identity, pageContext?)
 *
 * On every call, the dispatcher:
 * 1. Loads the Semantic Manifest from the product (`/api/oip/manifest`).
 * 2. Extracts only the requested entity schema and operation metadata.
 * 3. Validates RBAC locally (identity roles vs operation.roles).
 * 4. Builds and validates the payload against declared fields, optionally
 *    enriched by page_context (active entity, selection, prefill).
 * 5. Sends the action to the product via the generic capability execution channel
 *    OR returns a `render_ui` directive when the operation is of type `render_ui`.
 *
 * Memory Routing: the manifest is fetched on-demand and never persisted as a
 * static tool registry inside OIP.
 */

export interface SemanticAction {
  readonly entity: string;
  readonly operation: string;
  readonly payload: JsonObject;
}

export interface RenderUiDirective {
  readonly action: "render_ui";
  readonly component: string;
  readonly entity: string;
  readonly mode: "create" | "edit" | "list" | "kanban" | "detail";
  readonly prefill: JsonObject;
  readonly onSubmit: string;
}

export interface SemanticExecutionResult {
  readonly status: "completed" | "forbidden" | "invalid" | "error" | "unauthorized" | "render_ui";
  readonly httpStatus?: number;
  readonly data?: JsonObject;
  readonly message?: string;
  readonly details?: JsonObject | undefined;
  readonly render?: RenderUiDirective;
}

export interface HqConnectorLike {
  executeCapability(capabilityId: string, actorId: string, args: JsonObject): Promise<HqExecutionResult>;
}

export interface SemanticDispatcherOptions {
  readonly manifestClient: ManifestClient;
  readonly connector: HqConnectorLike;
  readonly product: string;
  /**
   * Optional cache TTL in milliseconds. ADR-012 encourages on-demand loading, but
   * a short TTL is acceptable for repeated calls inside the same request window.
   * Default: 0 (no caching).
   */
  readonly manifestCacheMs?: number;
  /**
   * Optional catalogue of components PX can render per entity (ADR-014 §2.2).
   * Example: { Task: ["TaskForm", "TaskKanban"], Invoice: ["InvoiceTable"] }.
   * If omitted, render_ui is disabled.
   */
  readonly renderCatalogue?: Readonly<Record<string, readonly string[]>>;
}

interface CacheEntry {
  readonly manifest: SemanticManifest;
  readonly fetchedAt: number;
}

interface RbacOk {
  readonly ok: true;
}
interface RbacFail {
  readonly ok: false;
  readonly reason: string;
}
type RbacResult = RbacOk | RbacFail;

interface ValidationOk {
  readonly ok: true;
}
interface ValidationFail {
  readonly ok: false;
  readonly reason: string;
  readonly details: JsonObject;
}
type ValidationResult = ValidationOk | ValidationFail;

export class SemanticDispatcher {
  private cache: CacheEntry | undefined;

  constructor(private readonly options: SemanticDispatcherOptions) {}

  /**
   * Universal action entry-point.
   * No hard-coded prompts. All routing derives from the product manifest.
   * When pageContext is provided, the payload can be enriched by the active page
   * state (selection, entity_id) and render_ui operations are resolved against
   * the render catalogue.
   */
  async execute(
    entity: string,
    operation: string,
    payload: JsonObject,
    identity: IdentityContext,
    pageContext?: PageContext,
  ): Promise<SemanticExecutionResult> {
    const manifest = await this.loadManifest();
    const entitySchema = manifest.entities[entity];
    if (!entitySchema) {
      return {
        status: "invalid",
        message: `Entity "${entity}" is not declared in the ${this.options.product} manifest.`,
      };
    }

    const op = entitySchema.operations[operation];
    if (!op) {
      return {
        status: "invalid",
        message: `Operation "${operation}" is not declared for entity "${entity}".`,
      };
    }

    const rbac = this.checkRbac(identity, op);
    if (!rbac.ok) {
      return { status: "forbidden", message: (rbac as RbacFail).reason };
    }

    const enrichedPayload = mergePageContext(payload, pageContext);

    const validation = this.validatePayload(enrichedPayload, entitySchema.fields, operation);
    if (!validation.ok) {
      return { status: "invalid", message: (validation as ValidationFail).reason, details: (validation as ValidationFail).details };
    }

    if (operation === "render_ui") {
      return this.buildRenderUi(entity, enrichedPayload, identity.userId, pageContext);
    }

    return this.sendToProduct(entity, operation, enrichedPayload, identity.userId);
  }

  private async loadManifest(): Promise<SemanticManifest> {
    const now = Date.now();
    const ttl = this.options.manifestCacheMs ?? 0;
    if (this.cache && now - this.cache.fetchedAt < ttl) {
      return this.cache.manifest;
    }
    const manifest = await this.options.manifestClient.loadManifest({
      product: this.options.product,
    });
    this.cache = { manifest, fetchedAt: now };
    return manifest;
  }

  /**
   * Public, on-demand manifest accessor (ADR-012). Used by the multi-app
   * catalogue to aggregate function-calling tools without any static registry.
   */
  async getManifest(): Promise<SemanticManifest> {
    return this.loadManifest();
  }

  /**
   * Generate the OpenAI/DeepSeek function-calling tools for THIS product,
   * derived live from its manifest. No hard-coded tools.
   */
  async listFunctionTools(): Promise<readonly FunctionTool[]> {
    return manifestToFunctionTools(await this.loadManifest());
  }

  private checkRbac(
    identity: IdentityContext,
    op: ManifestOperation,
  ): RbacResult {
    const allowed = new Set<string>(op.roles);
    if (allowed.size === 0) return { ok: true };
    const hasRole = identity.roles.some((role) => allowed.has(role));
    if (!hasRole) {
      return {
        ok: false,
        reason: `Operation requires one of roles [${Array.from(allowed).join(", ")}], user has [${identity.roles.join(", ")}].`,
      };
    }
    return { ok: true };
  }

  private validatePayload(
    payload: JsonObject,
    fields: Readonly<Record<string, ManifestField>>,
    operation: string,
  ): ValidationResult {
    // render_ui is a meta-operation (ADR-014 §2.2). Only component/mode are
    // meaningful to OIP; prefill values are validated by the product later.
    if (operation === "render_ui") return { ok: true };

    const required = Object.entries(fields)
      .filter(([, f]) => f.required && !f.readonly)
      .map(([name]) => name);

    const missing = required.filter((name) => !(name in payload) || payload[name] === undefined || payload[name] === null);
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `Missing required fields for "${operation}": ${missing.join(", ")}.`,
        details: { missing },
      };
    }

    const errors: Record<string, string> = {};
    for (const [name, value] of Object.entries(payload)) {
      const field = fields[name];
      if (!field) {
        // ADR-014: context fields not declared in the manifest are forwarded to
        // the product as contextual metadata; OIP only validates declared fields.
        continue;
      }
      if (field.readonly) {
        errors[name] = "readonly field";
      }
      if (field.values && !(field.values as readonly unknown[]).includes(value)) {
        errors[name] = `expected one of ${JSON.stringify(field.values)}`;
      }
      if (typeof value === "number") {
        if (field.min !== undefined && value < field.min) {
          errors[name] = `must be >= ${field.min}`;
        }
        if (field.max !== undefined && value > field.max) {
          errors[name] = `must be <= ${field.max}`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, reason: "Payload validation failed.", details: errors as JsonObject };
    }
    return { ok: true };
  }

  private async sendToProduct(
    entity: string,
    operation: string,
    payload: JsonObject,
    actorId: string,
  ): Promise<SemanticExecutionResult> {
    try {
      const result = await this.options.connector.executeCapability(
        `semantic/${entity}/${operation}`,
        actorId,
        payload,
      );
      switch (result.status) {
        case "completed":
          return { status: "completed", httpStatus: result.httpStatus, data: result.data };
        case "forbidden":
          return { status: "forbidden", httpStatus: result.httpStatus, message: result.message };
        case "invalid":
          return { status: "invalid", httpStatus: result.httpStatus, message: result.message, details: result.details };
        case "error":
          return { status: "error", httpStatus: result.httpStatus, message: result.message };
      }
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildRenderUi(
    entity: string,
    payload: JsonObject,
    _actorId: string,
    pageContext?: PageContext,
  ): SemanticExecutionResult {
    const catalogue = this.options.renderCatalogue?.[entity];
    if (!catalogue || catalogue.length === 0) {
      return {
        status: "invalid",
        message: `render_ui is not available for entity "${entity}" (no render catalogue).`,
      };
    }

    const component = (payload.component as string | undefined) ?? catalogue[0];
    if (component === undefined || !catalogue.includes(component)) {
      return {
        status: "invalid",
        message: `Component "${component ?? ""}" is not in the render catalogue for entity "${entity}".`,
      };
    }

    const mode = (payload.mode as RenderUiDirective["mode"] | undefined) ?? "create";
    const prefill: Record<string, JsonValue> = { ...(pageContext?.selection ?? {}), ...payload };
    delete prefill.component;
    delete prefill.mode;

    const render: RenderUiDirective = {
      action: "render_ui",
      component,
      entity,
      mode,
      prefill,
      onSubmit: `execute(entity=${entity}, operation=create, payload=$form)`,
    };

    return { status: "render_ui", render };
  }
}

function mergePageContext(payload: JsonObject, pageContext?: PageContext): JsonObject {
  if (!pageContext) return payload;
  const merged: Record<string, JsonValue> = { ...payload };
  if (pageContext.entityId) {
    merged[`${pageContext.entity?.toLowerCase() ?? "entity"}_id`] = pageContext.entityId;
  }
  if (pageContext.selection) {
    for (const [key, value] of Object.entries(pageContext.selection)) {
      if (!(key in merged)) {
        merged[key] = value;
      }
    }
  }
  return merged as JsonObject;
}

export { ManifestClient, type SemanticManifest, type ManifestEntity, type ManifestField, type ManifestOperation, type ManifestQuery } from "../../hq-connector/src/manifest.js";
export { SemanticIntentRouter, type SemanticRoutingOptions } from "./router.js";
export {
  manifestToFunctionTools,
  toFunctionName,
  parseFunctionName,
  FUNCTION_NAME_SEPARATOR,
  type FunctionTool,
  type FunctionDefinition,
  type JsonSchema,
} from "./function-calling.js";
export {
  MultiAppCatalogue,
  PRODUCT_NAMESPACE_SEPARATOR,
  type RegisteredProduct,
  type NamespacedFunctionTool,
} from "./catalogue.js";
