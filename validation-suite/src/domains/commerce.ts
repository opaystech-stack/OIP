import { defineCapability, defineTool, success, type OipPlugin } from "@opaystech/oip";

const addProductCapability = defineCapability({
  id: "commerce.product.create",
  description: "Ajouter un nouveau produit au catalogue.",
  parameters: [
    { name: "name", type: "string", required: true, description: "Nom du produit" },
    { name: "price", type: "number", required: true, description: "Prix unitaire" },
    { name: "stock", type: "number", required: false, description: "Stock initial" },
  ],
  requiredRoles: ["inventory.manager"],
  confirmationLevel: "low",
  sideEffects: ["catalog_updated"],
  emits: ["ProductCreated"],
});

const createInvoiceCapability = defineCapability({
  id: "commerce.invoice.create",
  description: "Creer une facture client.",
  parameters: [
    { name: "customerName", type: "string", required: true, description: "Nom du client" },
    { name: "amount", type: "number", required: true, description: "Montant" },
  ],
  requiredRoles: ["cashier", "sales.manager"],
  confirmationLevel: "medium",
  sideEffects: ["receivable_created"],
  emits: ["InvoiceCreated"],
});

const recordPaymentCapability = defineCapability({
  id: "commerce.payment.record",
  description: "Enregistrer un paiement client.",
  parameters: [
    { name: "invoiceId", type: "string", required: true, description: "Identifiant de facture" },
    { name: "amount", type: "number", required: true, description: "Montant paye" },
  ],
  requiredRoles: ["cashier", "finance.manager"],
  confirmationLevel: "high",
  sideEffects: ["cash_impact"],
  emits: ["PaymentRecorded"],
});

const checkStockCapability = defineCapability({
  id: "commerce.inventory.check",
  description: "Consulter le stock disponible d’un produit.",
  parameters: [
    { name: "productName", type: "string", required: true, description: "Nom du produit" },
  ],
  requiredRoles: ["user"],
  confirmationLevel: "none",
  sideEffects: [],
  emits: ["StockQueried"],
});

const addProductTool = defineTool(async (args) => {
  const name = String(args.name);
  const price = Number(args.price);
  const stock = args.stock ? Number(args.stock) : 0;
  return success("commerce.product.create", { productId: `prod-${name.toLowerCase().replace(/\s+/g, "-")}`, name, price, stock }, [
    { type: "ProductCreated", occurredAt: new Date().toISOString(), payload: { name, price, stock } },
  ]);
});

const createInvoiceTool = defineTool(async (args) => {
  const customerName = String(args.customerName);
  const amount = Number(args.amount);
  return success("commerce.invoice.create", { invoiceId: `inv-${Date.now()}`, customerName, amount }, [
    { type: "InvoiceCreated", occurredAt: new Date().toISOString(), payload: { customerName, amount } },
  ]);
});

const recordPaymentTool = defineTool(async (args) => {
  const invoiceId = String(args.invoiceId);
  const amount = Number(args.amount);
  return success("commerce.payment.record", { invoiceId, amountPaid: amount }, [
    { type: "PaymentRecorded", occurredAt: new Date().toISOString(), payload: { invoiceId, amount } },
  ]);
});

const checkStockTool = defineTool(async (args) => {
  const productName = String(args.productName);
  return success("commerce.inventory.check", { productName, available: 42 }, [
    { type: "StockQueried", occurredAt: new Date().toISOString(), payload: { productName, available: 42 } },
  ]);
});

export const commercePlugin: OipPlugin = {
  id: "commerce",
  name: "Opays Commerce",
  capabilities: [addProductCapability, createInvoiceCapability, recordPaymentCapability, checkStockCapability],
  tools: new Map([
    ["commerce.product.create", addProductTool],
    ["commerce.invoice.create", createInvoiceTool],
    ["commerce.payment.record", recordPaymentTool],
    ["commerce.inventory.check", checkStockTool],
  ]),
};
