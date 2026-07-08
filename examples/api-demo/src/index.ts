import { startApiServer } from "./server.js";

const port = Number(process.env.PORT ?? 3333);

startApiServer({ port });
