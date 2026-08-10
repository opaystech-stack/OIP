import { strict as assert } from "node:assert";
import { DocumentService } from "../../packages/document-service/src/index.js";
import { KnowledgeEngine, MutableKnowledgeSource } from "../../packages/knowledge-engine/src/index.js";
import { KnowledgeEngineRuntime } from "../../packages/knowledge-runtime/src/index.js";

const engine = new KnowledgeEngine();
const documents = new MutableKnowledgeSource("documents", "Documents");
engine.register(documents);
const runtime = new KnowledgeEngineRuntime(engine, new DocumentService(documents));
const ingested = await runtime.ingest("documents", {
  id: "doc-1",
  title: "Inventory policy",
  content: "Inventory replenishment requires a governed approval.",
});
assert.equal(ingested.status, "completed");
assert.equal(ingested.chunks, 1);
const results = await runtime.search({ query: "inventory approval", workspaceId: "org", limit: 5 });
assert.equal(results[0]?.sourceId, "documents");
assert.equal(results[0]?.title, "Inventory policy #1");
console.log("ok - knowledge runtime ingests documents and serves context search");
