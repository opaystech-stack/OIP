import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { JsonFileAuditLog, JsonFileEventBus, JsonFileMemoryStore } from "../../file-store/src/index.js";
import { OipRuntime } from "./index.js";

export interface RuntimeEnv {
  readonly OIP_DATA_DIR?: string;
}

export function createRuntimeFromEnv(env: RuntimeEnv = process.env): OipRuntime {
  if (!env.OIP_DATA_DIR) {
    return new OipRuntime();
  }

  mkdirSync(env.OIP_DATA_DIR, { recursive: true });

  return new OipRuntime({
    memory: new JsonFileMemoryStore(join(env.OIP_DATA_DIR, "memory.json")),
    audit: new JsonFileAuditLog(join(env.OIP_DATA_DIR, "audit.json")),
    events: new JsonFileEventBus(join(env.OIP_DATA_DIR, "events.json")),
  });
}
