import { startOdooMcpServer } from "./server.js";

const application = await startOdooMcpServer();
console.log(JSON.stringify({
  service: "odoo-mcp",
  status: "listening",
  address: `0.0.0.0:${application.port}`,
  oipRelease: "0.1.0-alpha.1",
}));
