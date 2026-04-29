import type {
  AgentStatus,
  ArtifactType,
  LabArtifact,
  LabPredictionResponse,
  LabRunResult,
  PlainEnglishSummary,
  PredictionInputField,
  SourceResolveResult,
  Visualization,
  VisualizationType,
} from "@/lib/erevna/types";

export type SourceMode = "upload" | "demo" | "kaggle";
export type ShellPhase =
  | "idle"
  | "resolving"
  | "resolved"
  | "running"
  | "complete"
  | "error";

export type ShellMessage = {
  id: string;
  agent: string;
  stageId: string;
  status: AgentStatus;
  message: string;
};

export type StageDefinition = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  x: number;
  y: number;
};

export type StageStatus = "idle" | "queued" | "running" | "complete" | "warning" | "failed";

export type CandidateFileOption = {
  path: string;
  label: string;
  meta: string;
  selected: boolean;
};

export type SummaryCard = {
  label: string;
  value: string;
  hint: string;
};

export type DownloadableArtifact = {
  id: string;
  filename: string;
  type: ArtifactType;
  content: string;
};

// The two leading stages are Erevna research stages. The remaining 12 entries
// are the existing Erevna pipeline preserved exactly as they shipped.
export const STAGES: StageDefinition[] = [
  {
    id: "literature-review",
    label: "Literature Review",
    shortLabel: "PAPERS",
    description: "Searches arXiv for relevant papers and synthesizes the key findings.",
    x: -2,
    y: 0,
  },
  {
    id: "hypothesis",
    label: "Hypothesis Formation",
    shortLabel: "HYPOTHESIS",
    description:
      "Forms a testable hypothesis from the literature and identifies the target variable.",
    x: -1,
    y: 0,
  },
  {
    id: "source-intake",
    label: "Source Intake",
    shortLabel: "INTAKE",
    description: "The lab captures the dataset source and prepares the first working copy.",
    x: 0,
    y: 0,
  },
  {
    id: "source-resolution",
    label: "Source Resolution",
    shortLabel: "RESOLVE",
    description:
      "The source is normalized into one concrete CSV table and connector details are abstracted away.",
    x: 1,
    y: 0,
  },
  {
    id: "schema-profiling",
    label: "Schema Profiling",
    shortLabel: "PROFILE",
    description:
      "Erevna scans column families, missingness, and structural relationships before modeling.",
    x: 2,
    y: 0,
  },
  {
    id: "target-framing",
    label: "Target Framing",
    shortLabel: "FRAME",
    description:
      "The system decides whether the task is regression or classification and locks the evaluation metric.",
    x: 3,
    y: 0,
  },
  {
    id: "preprocessing",
    label: "Preprocessing",
    shortLabel: "PIPELINE",
    description:
      "Numeric and categorical transforms are composed into one train-test-safe preprocessing pipeline.",
    x: 4,
    y: 0,
  },
  {
    id: "baseline",
    label: "Baseline",
    shortLabel: "BASELINE",
    description:
      "A simple baseline sets the minimum bar so every stronger model has a fair reference point.",
    x: -0.5,
    y: 1,
  },
  {
    id: "linear-model",
    label: "Linear Model",
    shortLabel: "LINEAR",
    description:
      "The linear family tests whether the problem can be explained with simpler relationships.",
    x: 0.75,
    y: 1,
  },
  {
    id: "tree-model",
    label: "Tree Model",
    shortLabel: "TREE",
    description: "Tree ensembles explore nonlinear splits and feature interactions.",
    x: 2,
    y: 1,
  },
  {
    id: "boosted-model",
    label: "Boosted Model",
    shortLabel: "BOOST",
    description:
      "Boosted trees attempt to recover incremental gains when simpler structures plateau.",
    x: 3.25,
    y: 1,
  },
  {
    id: "evaluation",
    label: "Evaluation",
    shortLabel: "EVAL",
    description:
      "The leaderboard, curves, and residual evidence determine the strongest model.",
    x: 0.2,
    y: 2,
  },
  {
    id: "critic",
    label: "Critic",
    shortLabel: "CRITIC",
    description:
      "The critic summarizes caveats, failure modes, and the next experiments worth running.",
    x: 1.6,
    y: 2,
  },
  {
    id: "export",
    label: "Export",
    shortLabel: "EXPORT",
    description: "Erevna packages the report, code artifacts, and human-readable summary for reuse.",
    x: 3,
    y: 2,
  },
];

const STAGE_INDEX = new Map(STAGES.map((stage, index) => [stage.id, index]));

export const RESEARCH_STAGE_IDS = new Set(["literature-review", "hypothesis"]);

export function isResearchStage(stageId: string): boolean {
  return RESEARCH_STAGE_IDS.has(stageId);
}

export function normalizeResolveMessages(resolveResult: SourceResolveResult): ShellMessage[] {
  return resolveResult.messages.map((message, index) => ({
    id: `resolve-${message.stageId}-${index}`,
    agent: message.agent,
    stageId: message.stageId,
    status: message.status,
    message: message.message,
  }));
}

export function normalizeRunMessages(runResult: LabRunResult): ShellMessage[] {
  return runResult.agentTrace.map((message, index) => ({
    id: `run-${message.stageId}-${index}`,
    agent: message.agent,
    stageId: message.stageId,
    status: message.status,
    message: message.message,
  }));
}

export function buildCandidateOptions(resolveResult: SourceResolveResult): CandidateFileOption[] {
  return resolveResult.candidateFiles.map((candidate) => ({
    path: candidate.path,
    label: candidate.path,
    meta: [
      typeof candidate.columnCount === "number" ? `${candidate.columnCount} cols` : null,
      typeof candidate.rowCount === "number" ? `${candidate.rowCount}+ rows previewed` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    selected: Boolean(candidate.selected),
  }));
}

export function pickSuggestedTarget(resolveResult: SourceResolveResult): string {
  return resolveResult.targetSuggestions[0]?.column ?? resolveResult.headers[0] ?? "";
}

export function buildSummaryCards(runResult: LabRunResult): SummaryCard[] {
  const { datasetProfile, bestModel, problemFraming, predictionInputSchema } = runResult;

  return [
    {
      label: "Task",
      value: humanizeTaskSubtype(problemFraming.taskSubtype),
      hint: `Target: ${problemFraming.targetName}`,
    },
    {
      label: "Primary Metric",
      value: problemFraming.primaryMetric,
      hint: "Used to rank the winning model",
    },
    {
      label: "Baseline",
      value: `${bestModel.baselineScore.toFixed(3)}`,
      hint: "Reference score before stronger models",
    },
    {
      label: "Best Model",
      value: bestModel.modelName,
      hint: `${bestModel.metricName} ${bestModel.score.toFixed(3)}`,
    },
    {
      label: "Improvement",
      value: `${bestModel.absoluteImprovement >= 0 ? "+" : ""}${bestModel.absoluteImprovement.toFixed(3)}`,
      hint: `${bestModel.relativeImprovement.toFixed(1)}% over baseline`,
    },
    {
      label: "Dataset Shape",
      value: `${datasetProfile.rows.toLocaleString()} × ${datasetProfile.columns}`,
      hint: `${predictionInputSchema?.fields.length ?? 0} scored inputs ready`,
    },
  ];
}

export function getStageStatusMap(
  messages: ShellMessage[],
  phase: ShellPhase,
): Record<string, StageStatus> {
  const statuses: Record<string, StageStatus> = Object.fromEntries(
    STAGES.map((stage) => [stage.id, "idle"]),
  ) as Record<string, StageStatus>;

  messages.forEach((message) => {
    statuses[message.stageId] = mapAgentStatus(message.status);
  });

  if (phase === "running") {
    const nextStage = STAGES.find((stage) => statuses[stage.id] === "idle");
    if (nextStage) {
      statuses[nextStage.id] = "running";
    }
  }

  if (phase === "resolved" && statuses["schema-profiling"] === "idle") {
    statuses["schema-profiling"] = "queued";
  }

  return statuses;
}

export function stageIndex(stageId?: string): number {
  if (!stageId) {
    return -1;
  }

  return STAGE_INDEX.get(stageId) ?? -1;
}

export function buildStageIntel(
  stageId: string,
  runResult: LabRunResult | null,
  resolveResult: SourceResolveResult | null,
  messages: ShellMessage[],
): {
  title: string;
  description: string;
  callout: string;
  details: string[];
} {
  const definition = STAGES.find((stage) => stage.id === stageId) ?? STAGES[0];
  const lastMessage = [...messages].reverse().find((message) => message.stageId === stageId);
  const callout = lastMessage?.message ?? definition.description;
  const details = [
    resolveResult?.sourceLabel ? `Source: ${resolveResult.sourceLabel}` : null,
    runResult ? `Problem framing: ${humanizeTaskSubtype(runResult.problemFraming.taskSubtype)}` : null,
    runResult ? `Metric: ${runResult.problemFraming.primaryMetric}` : null,
    runResult?.bestModel.modelName && stageId === "evaluation"
      ? `Current winner: ${runResult.bestModel.modelName}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    title: definition.label,
    description: definition.description,
    callout,
    details,
  };
}

export function visibleVisualizations(
  runResult: LabRunResult | null,
  messages: ShellMessage[],
  selectedStageId: string,
): Visualization[] {
  if (!runResult) {
    return [];
  }

  const maxVisibleStage = messages.reduce(
    (current, message) => Math.max(current, stageIndex(message.stageId)),
    -1,
  );

  const unlocked = runResult.visualizations.filter(
    (visualization) => stageIndex(visualization.stageId) <= maxVisibleStage,
  );
  const focused = unlocked.filter((visualization) => visualization.stageId === selectedStageId);
  return focused.length ? focused : unlocked;
}

export function downloadableArtifacts(runResult: LabRunResult | null): DownloadableArtifact[] {
  if (!runResult) {
    return [];
  }

  return runResult.artifacts
    .filter((artifact): artifact is LabArtifact & { content: string } => typeof artifact.content === "string")
    .map((artifact) => ({
      id: artifact.filename,
      filename: artifact.filename,
      type: artifact.type,
      content: artifact.content,
    }));
}

export function preferredArtifactId(artifacts: DownloadableArtifact[]): string | null {
  const pythonArtifact = artifacts.find((artifact) => artifact.filename.endsWith(".py"));
  return pythonArtifact?.id ?? artifacts[0]?.id ?? null;
}

export function buildPredictionSeed(fields: PredictionInputField[]): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.example !== undefined ? String(field.example) : field.options?.[0] ?? "",
    ]),
  );
}

export function coercePredictionPayload(fields: PredictionInputField[], values: Record<string, string>) {
  const payload: Record<string, boolean | number | string> = {};
  fields.forEach((field) => {
    const rawValue = values[field.name];
    if (field.kind === "number") {
      payload[field.name] = Number(rawValue);
      return;
    }

    if (field.kind === "boolean") {
      payload[field.name] = rawValue === "true";
      return;
    }

    payload[field.name] = rawValue;
  });
  return payload;
}

export function predictionSummary(response: LabPredictionResponse | null): string {
  if (!response) {
    return "Run a prediction to inspect how the saved model scores one fresh example.";
  }

  if (response.problemType === "regression") {
    return `Predicted ${response.prediction}${response.unit ? ` ${response.unit}` : ""}.`;
  }

  return `Predicted ${response.prediction}${
    response.probability !== undefined ? ` with ${(response.probability * 100).toFixed(1)}% confidence` : ""
  }.`;
}

export function artifactBundleName(runResult: LabRunResult | null): string {
  return `${runResult?.runId ?? "erevna-run"}-bundle.zip`;
}

export function pythonBundleName(runResult: LabRunResult | null): string {
  return `${runResult?.runId ?? "erevna-run"}-python-scripts.zip`;
}

export function summaryArtifactName(runResult: LabRunResult | null): string {
  return `${runResult?.runId ?? "erevna-run"}-summary.txt`;
}

export function summaryToText(summary: PlainEnglishSummary): string {
  return [summary.headline, "", summary.shortExplanation, "", ...summary.takeaways.map((line) => `- ${line}`)].join(
    "\n",
  );
}

export function humanizeTaskSubtype(taskSubtype: string): string {
  return taskSubtype
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapAgentStatus(status: AgentStatus): StageStatus {
  if (status === "failed") {
    return "failed";
  }

  if (status === "warning") {
    return "warning";
  }

  if (status === "running") {
    return "running";
  }

  if (status === "queued") {
    return "queued";
  }

  return "complete";
}

export function visualizationVariant(type: VisualizationType): "bars" | "grid" | "line" | "graph" | "fallback" {
  switch (type) {
    case "class_balance":
    case "feature_importance":
    case "feature_type_breakdown":
    case "model_comparison":
    case "missingness_summary":
      return "bars";
    case "correlation_heatmap":
    case "confusion_matrix":
      return "grid";
    case "roc_curve":
    case "pr_curve":
    case "residual_plot":
    case "actual_vs_predicted":
      return "line";
    case "experiment_graph":
      return "graph";
    default:
      return "fallback";
  }
}
