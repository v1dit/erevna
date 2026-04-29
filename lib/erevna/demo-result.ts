import classificationSnapshot from "@/lib/erevna/demo-assets/classification-run.json";
import regressionSnapshot from "@/lib/erevna/demo-assets/regression-run.json";
import { buildLabRunFromRunnerResult } from "@/lib/erevna/lab-runner";
import type { LabRunResult, ProblemType, PythonRunnerResult } from "@/lib/erevna/types";

export const DEMO_RUN_IDS = {
  classification: "demo-classification-churn-001",
  regression: "demo-regression-insurance-001",
} as const;

const DEMO_INTENTS: Record<ProblemType, string> = {
  classification:
    "Create a model that predicts churn risk from customer tenure, pricing, and engagement signals.",
  regression:
    "Create a model that predicts insurance charges from patient and policy attributes.",
};

export function getDemoLabRunResult(
  scenario: ProblemType = "classification",
  intentPrompt?: string,
): LabRunResult {
  const runnerResult = getDemoRunnerSnapshot(scenario);

  return buildLabRunFromRunnerResult(runnerResult, {
    runId: DEMO_RUN_IDS[scenario],
    scenario,
    intentPrompt: intentPrompt ?? DEMO_INTENTS[scenario],
  });
}

export function getDemoScenarioForRunId(runId: string): ProblemType | null {
  if (runId === DEMO_RUN_IDS.classification) {
    return "classification";
  }

  if (runId === DEMO_RUN_IDS.regression) {
    return "regression";
  }

  return null;
}

export function isDemoRunId(runId: string): boolean {
  return getDemoScenarioForRunId(runId) !== null;
}

function getDemoRunnerSnapshot(scenario: ProblemType): PythonRunnerResult {
  return (
    scenario === "classification" ? classificationSnapshot : regressionSnapshot
  ) as unknown as PythonRunnerResult;
}
