import { OipRuntime, definePluginModule, MockLlmAdapter } from "@opaystech/oip";
import { commercePlugin } from "./domains/commerce.js";
import { businessPlugin } from "./domains/business.js";
import { forexPlugin } from "./domains/forex.js";
import { scenarios } from "./scenarios.js";
import { createContext, evaluateScenario, formatReport, type ScenarioRun } from "./types.js";

const runtime = new OipRuntime()
  .use(definePluginModule({ plugin: commercePlugin }))
  .use(definePluginModule({ plugin: businessPlugin }))
  .use(definePluginModule({ plugin: forexPlugin }));

async function runScenario(scenario: (typeof scenarios)[number]): Promise<ScenarioRun> {
  const planner = runtime.createPlanner(
    new MockLlmAdapter(() => scenario.plannerOutput),
  );

  const plan = await planner.plan(scenario.userQuery);
  const context = scenario.requiredConfirmation
    ? createContext(`req-${scenario.id}`, scenario.roles, {
        confirmedCapabilities: [scenario.expectedCapability],
      })
    : createContext(`req-${scenario.id}`, scenario.roles);

  const actionResult = await runtime.execute(plan, context);

  const issues: string[] = [];
  if (actionResult.status === "rejected" && actionResult.data?.issues) {
    for (const issue of actionResult.data.issues as Array<{ readonly message?: string }>) {
      if (issue.message) issues.push(issue.message);
    }
  }

  const run: Mutable<ScenarioRun> = {
    scenario,
    selectedCapability: plan.capabilityId,
    plan,
    actionStatus: actionResult.status,
    resultData: actionResult.data,
    events: actionResult.events.map((e) => e.type),
    issues,
    status: "failed",
    message: "",
  };

  run.status = evaluateScenario(scenario, run);
  run.message = buildMessage(run);
  return run;
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

function buildMessage(run: ScenarioRun): string {
  if (run.status === "passed") return "Scenario executed as expected.";
  if (run.status === "partial") return "Capability and status matched, but outcome differs.";
  if (run.selectedCapability !== run.scenario.expectedCapability) {
    return `Wrong capability: got ${run.selectedCapability}, expected ${run.scenario.expectedCapability}.`;
  }
  return `Wrong status: got ${run.actionStatus}, expected ${run.scenario.expectedStatus}.`;
}

async function main() {
  const runs: ScenarioRun[] = [];
  for (const scenario of scenarios) {
    try {
      runs.push(await runScenario(scenario));
    } catch (error) {
      runs.push({
        scenario,
        selectedCapability: "error",
        plan: scenario.plannerOutput as unknown as import("@opaystech/oip").PlannedAction,
        actionStatus: "rejected",
        resultData: undefined,
        events: [],
        issues: [String(error)],
        status: "failed",
        message: `Runtime error: ${String(error)}`,
      });
    }
  }

  const report = formatReport(runs);
  console.log(report);

  const failed = runs.filter((r) => r.status === "failed").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Validation suite failed:", error);
  process.exit(1);
});
