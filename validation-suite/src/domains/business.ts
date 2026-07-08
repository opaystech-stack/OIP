import { defineCapability, defineTool, success, type OipPlugin } from "@opaystech/oip";

const createCustomerCapability = defineCapability({
  id: "business.customer.create",
  description: "Creer une fiche client.",
  parameters: [
    { name: "name", type: "string", required: true, description: "Nom du client" },
    { name: "email", type: "string", required: true, description: "Email" },
  ],
  requiredRoles: ["sales.manager"],
  confirmationLevel: "low",
  sideEffects: ["customer_created"],
  emits: ["CustomerCreated"],
});

const scheduleTaskCapability = defineCapability({
  id: "business.task.schedule",
  description: "Planifier une tache.",
  parameters: [
    { name: "title", type: "string", required: true, description: "Titre" },
    { name: "dueDate", type: "string", required: true, description: "Date ISO d’echeance" },
  ],
  requiredRoles: ["manager"],
  confirmationLevel: "low",
  sideEffects: ["task_created"],
  emits: ["TaskScheduled"],
});

const generateReportCapability = defineCapability({
  id: "business.report.generate",
  description: "Generer un rapport d’activite.",
  parameters: [
    { name: "reportType", type: "string", required: true, description: "Type de rapport" },
    { name: "period", type: "string", required: true, description: "Periode couverte" },
  ],
  requiredRoles: ["manager", "analyst"],
  confirmationLevel: "none",
  sideEffects: [],
  emits: ["ReportGenerated"],
});

const createCustomerTool = defineTool(async (args) => {
  const name = String(args.name);
  const email = String(args.email);
  return success("business.customer.create", { customerId: `cust-${Date.now()}`, name, email }, [
    { type: "CustomerCreated", occurredAt: new Date().toISOString(), payload: { name, email } },
  ]);
});

const scheduleTaskTool = defineTool(async (args) => {
  const title = String(args.title);
  const dueDate = String(args.dueDate);
  return success("business.task.schedule", { taskId: `task-${Date.now()}`, title, dueDate }, [
    { type: "TaskScheduled", occurredAt: new Date().toISOString(), payload: { title, dueDate } },
  ]);
});

const generateReportTool = defineTool(async (args) => {
  const reportType = String(args.reportType);
  const period = String(args.period);
  return success("business.report.generate", { reportType, period, url: `https://reports.opays.test/${reportType}/${period}` }, [
    { type: "ReportGenerated", occurredAt: new Date().toISOString(), payload: { reportType, period } },
  ]);
});

export const businessPlugin: OipPlugin = {
  id: "business",
  name: "Opays Gestion d’entreprise IA",
  capabilities: [createCustomerCapability, scheduleTaskCapability, generateReportCapability],
  tools: new Map([
    ["business.customer.create", createCustomerTool],
    ["business.task.schedule", scheduleTaskTool],
    ["business.report.generate", generateReportTool],
  ]),
};
