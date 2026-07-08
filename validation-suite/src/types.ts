import type { JsonObject, PlannedAction, RuntimeContext } from "@opaystech/oip";

export type ScenarioResultStatus = "passed" | "failed" | "partial";

export interface Scenario {
  readonly id: string;
  readonly domain: string;
  readonly title: string;
  readonly intent: string;
  readonly userQuery: string;
  readonly roles: readonly string[];
  readonly expectedCapability: string;
  readonly expectedStatus: "completed" | "rejected";
  readonly expectedOutcome?: JsonObject;
  readonly requiredConfirmation?: string;
  readonly plannerOutput: JsonObject;
}

export interface ScenarioRun {
  readonly scenario: Scenario;
  readonly selectedCapability: string;
  readonly plan: PlannedAction;
  readonly actionStatus: "completed" | "rejected";
  readonly resultData: JsonObject | undefined;
  readonly events: string[];
  readonly issues: string[];
  readonly status: ScenarioResultStatus;
  readonly message: string;
}

export interface RuntimeFixture {
  readonly context: RuntimeContext;
}

export function createContext(
  requestId: string,
  roles: readonly string[],
  metadata?: JsonObject,
): RuntimeContext {
  return {
    requestId,
    channel: "web",
    user: {
      userId: "validation-user",
      organizationId: "opays-validation",
      roles,
      locale: "fr-CD",
    },
    metadata,
  };
}

export function evaluateScenario(scenario: Scenario, run: ScenarioRun): ScenarioResultStatus {
  if (run.actionStatus !== scenario.expectedStatus) {
    return "failed";
  }
  if (run.selectedCapability !== scenario.expectedCapability) {
    return "failed";
  }
  if (scenario.expectedOutcome) {
    for (const [key, value] of Object.entries(scenario.expectedOutcome)) {
      if (run.resultData?.[key] !== value) {
        return "partial";
      }
    }
  }
  return "passed";
}

export function formatReport(runs: readonly ScenarioRun[]): string {
  const totals = { passed: 0, failed: 0, partial: 0 };
  for (const run of runs) {
    totals[run.status]++;
  }

  const lines: string[] = [];
  lines.push("# OIP Validation Suite Report");
  lines.push("");
  lines.push(`Total: ${runs.length} scenarios`);
  lines.push(`- Passed: ${totals.passed}`);
  lines.push(`- Partial: ${totals.partial}`);
  lines.push(`- Failed: ${totals.failed}`);
  lines.push("");

  for (const run of runs) {
    lines.push(`## ${run.scenario.id} [${run.status.toUpperCase()}]`);
    lines.push(`Domain: ${run.scenario.domain}`);
    lines.push(`Intent: ${run.scenario.intent}`);
    lines.push(`Selected capability: ${run.selectedCapability}`);
    lines.push(`Expected capability: ${run.scenario.expectedCapability}`);
    lines.push(`Action status: ${run.actionStatus} (expected ${run.scenario.expectedStatus})`);
    lines.push(`Events: ${run.events.join(", ") || "none"}`);
    if (run.issues.length > 0) {
      lines.push(`Issues: ${run.issues.join("; ")}`);
    }
    if (run.resultData) {
      lines.push(`Result data: ${JSON.stringify(run.resultData)}`);
    }
    lines.push(`Message: ${run.message}`);
    lines.push("");
  }

  return lines.join("\n");
}
