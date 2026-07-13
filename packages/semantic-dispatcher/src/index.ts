import type { JsonObject, JsonValue } from "../../core/src/index.js";
import type {
  ManifestClient,
  ManifestField,
  ManifestOperation,
  SemanticManifest,
} from "../../hq-connector/src/manifest.js";
import type { HqExecutionResult } from "../../hq-connector/src/index.js";
import type { IdentityContext } from "../../core/src/contracts/identity.js";

/**
 * SemanticDispatcher (ADR-012 — Hermes philosophy).
 *
 * OIP holds NO hard-coded tool prompts or capability lists. It only knows the
 * universal action function:
 *
 *   execute(entity, operation, payload, identity)
 *
 * On every call, the dispatcher:
 * 1. Loads the Semantic Manifest from the product (`/api/oip/manifest`).
 * 2. Extracts only the requested entity schema and operation metadata.
 * 3. Validates RBAC locally (identity roles vs operation.roles).
 * 4. Builds and validates the payload against declared fields.
 * 5. Sends the action to the product via the generic capability execution channel.
 *
 * Memory Routing: the manifest is fetched on-demand and never persisted as a
 * static tool registry inside OIP.
 */

export interface SemanticAction {
  readonly entity: string;
  readonly operation: string;
  readonly payload: JsonObject;
}

export interface SemanticExecutionResult {
  readonly status: "completed" | "forbidden" | "invalid" | "error" | "unauthorized";
  readonly httpStatus?: number;
  readonly data?: JsonObject;
  readonly message?: string;
  readonly details?: JsonObject | undefined;
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
   */
  async execute(
    entity: string,
    operation: string,
    payload: JsonObject,
    identity: IdentityContext,
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

    const validation = this.validatePayload(payload, entitySchema.fields, operation);
    if (!validation.ok) {
      return { status: "invalid", message: (validation as ValidationFail).reason, details: (validation as ValidationFail).details };
    }

    return this.sendToProduct(entity, operation, payload, identity.userId);
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
        errors[name] = "undeclared field";
        continue;
      }
      if (field.readonly) {
        errors[name] = "readonly field";
      }
      if (field.values && !(field.values as readonly unknown[]).includes(value)) {
        errors[name] = `expected one of ${JSON.stringify(field.values)}`;
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
}
