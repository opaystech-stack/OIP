import type { AgentCatalog, AgentDefinition, Intention } from "../../core/src/contracts/index.js";

/** First-class agent catalog. Agents are governed identities, never prompts. */
export class AgentRegistry implements AgentCatalog {
  private readonly agents = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition): void {
    if (this.agents.has(agent.id)) throw new Error(`Agent already registered: ${agent.id}`);
    this.agents.set(agent.id, agent);
  }

  select(intent: Intention): AgentDefinition | undefined {
    const query = words(`${intent.goal} ${intent.rawText}`);
    return [...this.agents.values()]
      .map((agent) => ({ agent, score: agent.capabilities.filter((capability) => query.has(capability.toLowerCase())).length }))
      .sort((left, right) => right.score - left.score)[0]?.agent;
  }

  list(): readonly AgentDefinition[] { return [...this.agents.values()]; }
}

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1));
}
