import type {
  ActionResult,
  CapabilityDefinition,
  ConfirmationLevel,
  JsonObject,
} from "../../core/src/index.js";
import type {
  ActionRuntime,
  ExecutionContext,
  PolicyDecision,
  PolicyRuntime,
} from "../../core/src/contracts/index.js";

export type CapabilityAvailability = "available" | "needs_setup" | "unavailable";

export interface CapabilityProcedure {
  readonly id: string;
  readonly type: "setup" | "repair" | "manual";
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly string[];
  readonly prerequisites?: readonly string[];
}

export interface CapabilityTenantScope {
  /** When present, execution is limited to these organization/tenant ids. */
  readonly organizationIds?: readonly string[];
}

export interface CapabilityVerification {
  readonly verified: boolean;
  readonly summary: string;
  readonly evidence: JsonObject;
}

export type CapabilityVerifier = (
  result: ActionResult,
  context: ExecutionContext,
) => Promise<CapabilityVerification>;

export interface CapabilityDescriptor extends CapabilityDefinition {
  readonly keywords: readonly string[];
  readonly aliases: readonly string[];
  readonly source: string;
  readonly availability: CapabilityAvailability;
  readonly setupProcedure?: CapabilityProcedure;
  readonly fallbackProcedure?: CapabilityProcedure;
  readonly tenantScope?: CapabilityTenantScope;
  /** No successful result is returned without this verifier passing. */
  readonly verification: CapabilityVerifier;
}

export interface CapabilityQuery {
  readonly query?: string;
  readonly capabilityId?: string;
}

export interface CapabilityMatch {
  readonly id: string;
  readonly description: string;
  readonly score: number;
  readonly availability: CapabilityAvailability;
}

export type CapabilityResolution =
  | {
      readonly status: "executable";
      readonly descriptor: CapabilityDescriptor;
      readonly score: number;
    }
  | {
      readonly status: "procedure_available";
      readonly descriptor: CapabilityDescriptor;
      readonly procedure: CapabilityProcedure;
      readonly score: number;
    }
  | {
      readonly status: "unsupported";
      readonly descriptor: CapabilityDescriptor;
      readonly score: number;
    }
  | {
      readonly status: "ambiguous";
      readonly query: string;
      readonly candidates: readonly CapabilityMatch[];
    }
  | {
      readonly status: "not_found";
      readonly query: string;
      readonly candidates: readonly CapabilityMatch[];
    };

export interface CapabilityInvocationRequest extends CapabilityQuery {
  readonly arguments: JsonObject;
}

export type CapabilityGatewayStatus =
  | "completed"
  | "confirmation_required"
  | "procedure_available"
  | "unsupported"
  | "ambiguous"
  | "rejected"
  | "verification_failed";

export interface CapabilityGatewayResult {
  readonly status: CapabilityGatewayStatus;
  readonly query: string;
  readonly capabilityId?: string;
  readonly message: string;
  readonly result?: ActionResult;
  readonly evidence?: CapabilityVerification;
  readonly procedure?: CapabilityProcedure;
  readonly candidates?: readonly CapabilityMatch[];
  readonly policy?: PolicyDecision;
}

export interface CapabilityGatewayAuditRecord {
  readonly requestId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly query: string;
  readonly capabilityId?: string;
  readonly outcome: CapabilityGatewayStatus;
  readonly reason: string;
  readonly occurredAt: string;
  readonly metadata?: JsonObject;
}

export interface CapabilityGatewayAudit {
  record(entry: CapabilityGatewayAuditRecord): Promise<void>;
}

export interface CapabilityGatewayDependencies {
  readonly action: ActionRuntime;
  readonly policy: PolicyRuntime;
  readonly descriptors?: readonly CapabilityDescriptor[];
  readonly audit?: CapabilityGatewayAudit;
}

export interface FunctionPropertySchema {
  readonly type: string;
  readonly description: string;
}

export interface FunctionToolDefinition {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: {
      readonly type: "object";
      readonly properties: Readonly<Record<string, FunctionPropertySchema>>;
      readonly required: readonly string[];
      readonly additionalProperties: false;
    };
  };
}

export class CapabilityResolver {
  private readonly descriptors = new Map<string, CapabilityDescriptor>();

  constructor(descriptors: readonly CapabilityDescriptor[] = []) {
    for (const descriptor of descriptors) {
      this.register(descriptor);
    }
  }

  register(descriptor: CapabilityDescriptor): void {
    if (this.descriptors.has(descriptor.id)) {
      throw new Error(`Capability descriptor already registered: ${descriptor.id}`);
    }
    this.descriptors.set(descriptor.id, descriptor);
  }

  get(capabilityId: string): CapabilityDescriptor | undefined {
    return this.descriptors.get(capabilityId);
  }

  list(): readonly CapabilityDescriptor[] {
    return [...this.descriptors.values()];
  }

  resolve(request: CapabilityQuery): CapabilityResolution {
    const requestedId = request.capabilityId?.trim();
    const query = request.query?.trim() || requestedId || "";

    if (requestedId) {
      const descriptor = this.descriptors.get(requestedId);
      if (!descriptor) {
        return { status: "not_found", query, candidates: [] };
      }
      return this.toResolution(descriptor, query, Number.MAX_SAFE_INTEGER);
    }

    if (!query) {
      return { status: "not_found", query: "", candidates: [] };
    }

    const matches = this.list()
      .map((descriptor) => ({ descriptor, score: scoreDescriptor(descriptor, query) }))
      .filter((match) => match.score > 0)
      .sort((left, right) => right.score - left.score || left.descriptor.id.localeCompare(right.descriptor.id));
    const candidates = matches.map(({ descriptor, score }) => toMatch(descriptor, score));

    if (matches.length === 0) {
      return { status: "not_found", query, candidates: [] };
    }

    const best = matches[0]!;
    const second = matches[1];
    if (second && second.score === best.score) {
      return { status: "ambiguous", query, candidates };
    }

    return this.toResolution(best.descriptor, query, best.score);
  }

  private toResolution(
    descriptor: CapabilityDescriptor,
    query: string,
    score: number,
  ): CapabilityResolution {
    if (descriptor.availability === "available") {
      return { status: "executable", descriptor, score };
    }

    const procedure = descriptor.setupProcedure ?? descriptor.fallbackProcedure;
    if (procedure) {
      return { status: "procedure_available", descriptor, procedure, score };
    }

    return { status: "unsupported", descriptor, score };
  }
}

export class CapabilityGateway {
  readonly resolver: CapabilityResolver;
  private readonly action: ActionRuntime;
  private readonly policy: PolicyRuntime;
  private readonly audit: CapabilityGatewayAudit | undefined;

  constructor(dependencies: CapabilityGatewayDependencies) {
    this.resolver = new CapabilityResolver(dependencies.descriptors);
    this.action = dependencies.action;
    this.policy = dependencies.policy;
    this.audit = dependencies.audit;
  }

  register(descriptor: CapabilityDescriptor): void {
    this.resolver.register(descriptor);
  }

  discover(request: CapabilityQuery): CapabilityResolution {
    return this.resolver.resolve(request);
  }

  /**
   * Agent-facing entry point: resolve first, then enforce tenant and policy,
   * execute through the existing ActionRuntime, and verify the real result.
   */
  async invoke(
    request: CapabilityInvocationRequest,
    context: ExecutionContext,
  ): Promise<CapabilityGatewayResult> {
    const query = request.query?.trim() || request.capabilityId?.trim() || "";
    const resolution = this.resolver.resolve(request);

    if (resolution.status === "ambiguous") {
      return this.finalize(context, {
        status: "ambiguous",
        query,
        message: "Several capabilities match the request; clarification is required.",
        candidates: resolution.candidates,
      });
    }

    if (resolution.status === "not_found") {
      return this.finalize(context, {
        status: "unsupported",
        query,
        message: "No registered capability or procedure matches the request.",
      });
    }

    if (resolution.status === "procedure_available") {
      return this.finalize(context, {
        status: "procedure_available",
        query,
        capabilityId: resolution.descriptor.id,
        message: resolution.procedure.summary,
        procedure: resolution.procedure,
      });
    }

    if (resolution.status === "unsupported") {
      return this.finalize(context, {
        status: "unsupported",
        query,
        capabilityId: resolution.descriptor.id,
        message: `Capability ${resolution.descriptor.id} is not executable and has no repair procedure.`,
      });
    }

    const descriptor = resolution.descriptor;
    if (!isTenantAllowed(descriptor, context)) {
      return this.finalize(context, {
        status: "rejected",
        query,
        capabilityId: descriptor.id,
        message: "The capability is not available for this tenant.",
      });
    }

    const policy = await this.policy.evaluate(
      {
        subject: context.identity,
        resource: descriptor.id,
        action: "execute",
        arguments: request.arguments,
      },
      context,
    );

    if (policy.effect === "confirm") {
      return this.finalize(context, {
        status: "confirmation_required",
        query,
        capabilityId: descriptor.id,
        message: policy.reasons.join(" ") || "Trusted confirmation is required before execution.",
        policy,
      });
    }

    if (policy.effect !== "allow") {
      return this.finalize(context, {
        status: "rejected",
        query,
        capabilityId: descriptor.id,
        message: policy.reasons.join(" ") || "The capability was rejected by policy.",
        policy,
      });
    }

    const result = await this.action.execute(
      {
        capabilityId: descriptor.id,
        arguments: request.arguments,
        confidence: 1,
        reason: `Resolved from agent request: ${query}`,
      },
      context,
    );

    if (result.status !== "completed") {
      if (hasConfirmationIssue(result)) {
        return this.finalize(context, {
          status: "confirmation_required",
          query,
          capabilityId: descriptor.id,
          message: "The capability requires trusted confirmation before execution.",
          result,
          policy,
        });
      }
      return this.finalize(context, {
        status: "rejected",
        query,
        capabilityId: descriptor.id,
        message: "The capability was rejected during validation or execution.",
        result,
        policy,
      });
    }

    let evidence: CapabilityVerification;
    try {
      evidence = await descriptor.verification(result, context);
    } catch (error) {
      evidence = {
        verified: false,
        summary: "The post-execution verification procedure failed.",
        evidence: { error: error instanceof Error ? error.message : String(error) },
      };
    }

    if (!evidence.verified) {
      return this.finalize(context, {
        status: "verification_failed",
        query,
        capabilityId: descriptor.id,
        message: evidence.summary,
        result,
        evidence,
        policy,
      });
    }

    return this.finalize(context, {
      status: "completed",
      query,
      capabilityId: descriptor.id,
      message: evidence.summary,
      result,
      evidence,
      policy,
    });
  }

  private async finalize(
    context: ExecutionContext,
    result: CapabilityGatewayResult,
  ): Promise<CapabilityGatewayResult> {
    await this.audit?.record({
      requestId: context.requestId,
      organizationId: context.identity.organizationId,
      userId: context.identity.userId,
      query: result.query,
      ...(result.capabilityId !== undefined ? { capabilityId: result.capabilityId } : {}),
      outcome: result.status,
      reason: result.message,
      occurredAt: new Date().toISOString(),
      ...(result.evidence !== undefined
        ? { metadata: { verificationVerified: result.evidence.verified } }
        : {}),
    });
    return result;
  }

  listTools(): readonly FunctionToolDefinition[] {
    return this.resolver.list().map(toFunctionTool);
  }
}

function scoreDescriptor(descriptor: CapabilityDescriptor, query: string): number {
  const queryTokens = tokenize(query);
  const searchable = new Set(
    tokenize([
      descriptor.id,
      descriptor.description,
      ...descriptor.keywords,
      ...descriptor.aliases,
    ].join(" ")),
  );

  return queryTokens.reduce((score, token) => score + (searchable.has(token) ? 2 : 0), 0);
}

function tokenize(value: string): readonly string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

const STOP_WORDS = new Set([
  "a", "à", "au", "aux", "avec", "ce", "cette", "dans", "de", "des", "du",
  "en", "et", "la", "le", "les", "ma", "mes", "mon", "pour", "son", "sur",
  "the", "un", "une", "your",
]);

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
}

function toMatch(descriptor: CapabilityDescriptor, score: number): CapabilityMatch {
  return {
    id: descriptor.id,
    description: descriptor.description,
    score,
    availability: descriptor.availability,
  };
}

function isTenantAllowed(descriptor: CapabilityDescriptor, context: ExecutionContext): boolean {
  const organizationIds = descriptor.tenantScope?.organizationIds;
  return organizationIds === undefined || organizationIds.includes(context.identity.organizationId);
}

function hasConfirmationIssue(result: ActionResult): boolean {
  const issues = result.data?.issues;
  if (!Array.isArray(issues)) return false;
  return issues.some((issue) => {
    if (typeof issue !== "object" || issue === null || Array.isArray(issue)) return false;
    return issue.code === "confirmation_required";
  });
}

function toFunctionTool(descriptor: CapabilityDescriptor): FunctionToolDefinition {
  const properties: Record<string, FunctionPropertySchema> = {};
  const required: string[] = [];

  for (const parameter of descriptor.parameters) {
    properties[parameter.name] = {
      type: parameter.type,
      description: parameter.description,
    };
    if (parameter.required) required.push(parameter.name);
  }

  return {
    type: "function",
    function: {
      name: `oip_${descriptor.id.replace(/[^A-Za-z0-9_]/gu, "_")}`,
      description: `${descriptor.description} Availability: ${descriptor.availability}.`,
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

export type { ConfirmationLevel };
