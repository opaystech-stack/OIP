import {
  ActionEngine,
  CapabilityRegistry,
  registerPlugin,
  RuleBasedPlanner,
  ToolRegistry,
  Validator,
  type RuntimeContext,
} from "../packages/core/src/index.js";
import { commercePlugin, getInventorySnapshot } from "./plugins/commerce/src/index.js";

const capabilities = new CapabilityRegistry();
const tools = new ToolRegistry();
const validator = new Validator();
const planner = new RuleBasedPlanner();

registerPlugin(commercePlugin, capabilities, tools);

const actionEngine = new ActionEngine(capabilities, tools, validator);

const context: RuntimeContext = {
  requestId: "demo-request-001",
  channel: "web",
  user: {
    userId: "user-001",
    organizationId: "opays-demo",
    roles: ["inventory.manager"],
    locale: "fr-CD",
    activeModule: "commerce",
    activePage: "inventory",
  },
};

const plan = await planner.plan("Ajoute 20 sacs de ciment au stock");
const result = await actionEngine.execute(plan, context);

console.log(JSON.stringify({ plan, result, inventory: getInventorySnapshot() }, null, 2));
