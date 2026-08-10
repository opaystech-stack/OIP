import type {
  IdentityContext,
  IdentityRuntime,
  InboundRequest,
  Workspace,
} from "../../core/src/contracts/index.js";

/**
 * Development/test adapter. It validates only identities explicitly registered
 * by the host; it must never infer identity, tenant or roles from HTTP input.
 */
export class InMemoryIdentityRuntime implements IdentityRuntime {
  private readonly users = new Map<string, IdentityContext>();
  private readonly workspaces = new Map<string, Workspace>();

  registerUser(identity: IdentityContext): void {
    this.users.set(identity.userId, identity);
  }

  registerWorkspace(workspace: Workspace): void {
    this.workspaces.set(workspace.id, workspace);
  }

  async authenticate(request: InboundRequest): Promise<IdentityContext> {
    const token = request.headers?.authorization;
    if (!token) throw new Error("Unauthenticated request: authorization is required.");
    const userId = token.replace(/^Bearer\s+/i, "").trim();
    if (!userId) throw new Error("Unauthenticated request: bearer token is empty.");
    const cached = this.users.get(userId);
    if (!cached) throw new Error("Unauthenticated request: identity is not registered.");
    return cached;
  }

  async resolveWorkspace(identity: IdentityContext): Promise<Workspace> {
    const workspaceId = identity.organizationId;
    const cached = this.workspaces.get(workspaceId);

    return (
      cached ?? {
        id: workspaceId,
        name: workspaceId,
        plugins: [],
      }
    );
  }
}

export type { IdentityContext, IdentityRuntime, Workspace } from "../../core/src/contracts/index.js";
