import type {
  ExecutionContext,
  IdentityContext,
  InboundRequest,
  KnowledgeQuery,
  KnowledgeRuntime,
  MemoryQuery,
  MemoryRuntime,
  ContextRuntime,
} from "../../core/src/contracts/index.js";

export class InMemoryContextRuntime implements ContextRuntime {
  constructor(
    private readonly memory?: MemoryRuntime,
    private readonly knowledge?: KnowledgeRuntime,
  ) {}

  async build(request: InboundRequest, identity: IdentityContext): Promise<ExecutionContext> {
    const requestId = request.metadata?.["requestId"]?.toString() ?? crypto.randomUUID();
    const workspaceId = identity.organizationId;

    const [memory, knowledge] = await Promise.all([
      this.memory?.recall({
        content: request.text ?? "",
        workspaceId,
        userId: identity.userId,
        limit: 5,
      }) ?? [],
      this.knowledge?.search({
        query: request.text ?? "",
        workspaceId,
        limit: 5,
      }) ?? [],
    ]);

    return {
      requestId,
      identity,
      channel: request.channel,
      locale: identity.locale ?? "fr",
      memory,
      knowledge,
      metadata: request.metadata ?? {},
    };
  }
}

export type { ContextRuntime, ExecutionContext } from "../../core/src/contracts/index.js";
