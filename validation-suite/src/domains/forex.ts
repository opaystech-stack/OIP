import { defineCapability, defineTool, success, type OipPlugin } from "@opaystech/oip";

const recordOperationCapability = defineCapability({
  id: "forex.operation.record",
  description: "Enregistrer une operation de change.",
  parameters: [
    { name: "pair", type: "string", required: true, description: "Paire de devises (ex. USD/CDF)" },
    { name: "amount", type: "number", required: true, description: "Montant" },
    { name: "rate", type: "number", required: true, description: "Taux applique" },
  ],
  requiredRoles: ["forex.trader"],
  confirmationLevel: "high",
  sideEffects: ["position_opened"],
  emits: ["ForexOperationRecorded"],
});

const checkPortfolioCapability = defineCapability({
  id: "forex.portfolio.check",
  description: "Consulter le portefeuille de devises.",
  parameters: [
    { name: "currency", type: "string", required: false, description: "Devise specifique a filtrer" },
  ],
  requiredRoles: ["user"],
  confirmationLevel: "none",
  sideEffects: [],
  emits: ["PortfolioQueried"],
});

const generatePerformanceReportCapability = defineCapability({
  id: "forex.report.performance",
  description: "Generer un rapport de performance Forex.",
  parameters: [
    { name: "period", type: "string", required: true, description: "Periode couverte" },
  ],
  requiredRoles: ["forex.manager"],
  confirmationLevel: "none",
  sideEffects: [],
  emits: ["ForexPerformanceReportGenerated"],
});

const recordOperationTool = defineTool(async (args) => {
  const pair = String(args.pair);
  const amount = Number(args.amount);
  const rate = Number(args.rate);
  return success("forex.operation.record", { operationId: `fx-${Date.now()}`, pair, amount, rate }, [
    { type: "ForexOperationRecorded", occurredAt: new Date().toISOString(), payload: { pair, amount, rate } },
  ]);
});

const checkPortfolioTool = defineTool(async (args) => {
  const currency = args.currency ? String(args.currency) : "all";
  return success("forex.portfolio.check", { currency, balance: 12500.5 }, [
    { type: "PortfolioQueried", occurredAt: new Date().toISOString(), payload: { currency, balance: 12500.5 } },
  ]);
});

const generatePerformanceReportTool = defineTool(async (args) => {
  const period = String(args.period);
  return success("forex.report.performance", { period, pnl: 3450.75 }, [
    { type: "ForexPerformanceReportGenerated", occurredAt: new Date().toISOString(), payload: { period, pnl: 3450.75 } },
  ]);
});

export const forexPlugin: OipPlugin = {
  id: "forex",
  name: "Opays Forex",
  capabilities: [recordOperationCapability, checkPortfolioCapability, generatePerformanceReportCapability],
  tools: new Map([
    ["forex.operation.record", recordOperationTool],
    ["forex.portfolio.check", checkPortfolioTool],
    ["forex.report.performance", generatePerformanceReportTool],
  ]),
};
