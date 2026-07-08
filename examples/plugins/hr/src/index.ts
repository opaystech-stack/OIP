import type { ActionResult, JsonObject, OipPlugin, RuntimeContext, ToolHandler } from "../../../../packages/core/src/index.js";
import { definePluginModule } from "../../../../packages/plugin-sdk/src/index.js";

export interface EmployeeRecord {
  readonly id: string;
  readonly fullName: string;
  readonly role: string;
}

const employees: EmployeeRecord[] = [];

class CreateEmployeeTool implements ToolHandler {
  async execute(args: JsonObject, _context: RuntimeContext): Promise<ActionResult> {
    const fullName = String(args.fullName);
    const role = String(args.role);
    const employee: EmployeeRecord = {
      id: `employee-${employees.length + 1}`,
      fullName,
      role,
    };

    employees.push(employee);

    return {
      capabilityId: "hr.employee.create",
      status: "completed",
      data: {
        id: employee.id,
        fullName: employee.fullName,
        role: employee.role,
      },
      events: [
        {
          type: "EmployeeCreated",
          occurredAt: new Date().toISOString(),
          payload: {
            id: employee.id,
            fullName: employee.fullName,
            role: employee.role,
          },
        },
      ],
    };
  }
}

export const hrPlugin: OipPlugin = {
  id: "hr",
  name: "Opays HR",
  capabilities: [
    {
      id: "hr.employee.create",
      description: "Create an employee in the HR module.",
      parameters: [
        {
          name: "fullName",
          type: "string",
          required: true,
          description: "Employee full name.",
        },
        {
          name: "role",
          type: "string",
          required: true,
          description: "Employee role or job title.",
        },
      ],
      requiredRoles: ["hr.manager"],
      confirmationLevel: "medium",
      sideEffects: ["employee_record_created"],
      emits: ["EmployeeCreated"],
    },
  ],
  tools: new Map([["hr.employee.create", new CreateEmployeeTool()]]),
};

export const hrPluginModule = definePluginModule({
  plugin: hrPlugin,
});

export function getEmployeesSnapshot(): readonly EmployeeRecord[] {
  return [...employees];
}
