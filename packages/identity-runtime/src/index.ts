import type {
  IdentityContext,
  IdentityRuntime,
  InboundRequest,
  Workspace,
} from "../../core/src/contracts/index.js";

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
    const token = request.headers?.authorization ?? "anonymous";
    const userId = token.replace(/^Bearer\s+/i, "").trim() || "anonymous";
    const cached = this.users.get(userId);

    return (
      cached ?? {
        userId,
        organizationId: request.headers?.["x-organization-id"]?.toString() ?? "default",
        roles: [],
      }
    );
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
