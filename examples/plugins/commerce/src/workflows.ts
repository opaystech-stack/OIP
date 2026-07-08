import type { ActionEngine, JsonObject, RuntimeContext } from "../../../../packages/core/src/index.js";
import type { WorkflowDefinition, WorkflowHandler, WorkflowResult } from "../../../../packages/workflow-engine/src/index.js";

export const commerceRestockWorkflowDefinition: WorkflowDefinition = {
  id: "commerce.workflow.restock",
  description: "Restock an inventory item through the Commerce plugin.",
  requiredRoles: ["inventory.manager"],
};

export class CommerceRestockWorkflow implements WorkflowHandler {
  async execute(args: JsonObject, context: RuntimeContext, actions: ActionEngine): Promise<WorkflowResult> {
    const result = await actions.execute(
      {
        capabilityId: "commerce.inventory.add",
        arguments: args,
        confidence: 1,
        reason: "Workflow step: restock inventory.",
      },
      context,
    );

    return {
      workflowId: commerceRestockWorkflowDefinition.id,
      status: result.status,
      ...(result.data ? { data: result.data } : {}),
      steps: [
        {
          id: "add-inventory",
          status: result.status,
          capabilityId: result.capabilityId,
          ...(result.data ? { data: result.data } : {}),
        },
      ],
    };
  }
}
