import {
  type HypothesisAgentResult,
  type LiteratureAgentResult,
  runHypothesisAgent,
  runLiteratureAgent,
} from "@/lib/research-lab/research-agents";

export type ResearchPipelineStatus = "running" | "complete" | "queued" | "failed";
export type ResearchPipelineAgent =
  | "IntentAgent"
  | "LiteratureAgent"
  | "HypothesisAgent"
  | "ModelingAgent";

export type ResearchPipelineEvent = {
  id: string;
  agent: ResearchPipelineAgent;
  stageId: string;
  status: ResearchPipelineStatus;
  message: string;
  timestamp: string;
  data?: unknown;
};

export type ResearchPipelineResult = {
  runId: string;
  researchQuestion: string;
  literature: LiteratureAgentResult;
  hypothesis: HypothesisAgentResult;
  intentPrompt: string;
  events: ResearchPipelineEvent[];
};

export type RunResearchPipelineOptions = {
  researchQuestion: string;
  maxResults?: number;
  onEvent?: (event: ResearchPipelineEvent) => void;
};

export async function runResearchPipeline({
  researchQuestion,
  maxResults,
  onEvent,
}: RunResearchPipelineOptions): Promise<ResearchPipelineResult> {
  const question = researchQuestion.trim();

  if (!question) {
    throw new Error("A research question is required.");
  }

  const runId = buildRunId();
  const events: ResearchPipelineEvent[] = [];
  const emit = (event: Omit<ResearchPipelineEvent, "id" | "timestamp">) => {
    const nextEvent: ResearchPipelineEvent = {
      ...event,
      id: `${runId}-${events.length + 1}`,
      timestamp: new Date().toISOString(),
    };

    events.push(nextEvent);
    onEvent?.(nextEvent);
    return nextEvent;
  };

  emit({
    agent: "IntentAgent",
    stageId: "question",
    status: "complete",
    message: "Parsed the research question and prepared the research objective.",
    data: {
      researchQuestion: question,
    },
  });

  emit({
    agent: "LiteratureAgent",
    stageId: "literature",
    status: "running",
    message: "Searching arXiv and synthesizing relevant abstracts.",
  });

  const literature = await runLiteratureAgent({
    researchQuestion: question,
    maxResults,
  });

  emit({
    agent: "LiteratureAgent",
    stageId: "literature",
    status: "complete",
    message: `Found ${literature.papers.length} papers and summarized the relevant evidence.`,
    data: {
      paperCount: literature.papers.length,
      keyFindings: literature.keyFindings,
    },
  });

  emit({
    agent: "HypothesisAgent",
    stageId: "hypothesis",
    status: "running",
    message: "Forming a testable hypothesis from the literature synthesis.",
  });

  const hypothesis = await runHypothesisAgent({
    researchQuestion: question,
    literatureSummary: literature.summary,
    keyFindings: literature.keyFindings,
  });

  emit({
    agent: "HypothesisAgent",
    stageId: "hypothesis",
    status: "complete",
    message: `Hypothesis formed with target "${hypothesis.predictedTarget}".`,
    data: hypothesis,
  });

  const intentPrompt = buildModelingIntentPrompt({
    researchQuestion: question,
    literature,
    hypothesis,
  });

  emit({
    agent: "ModelingAgent",
    stageId: "modeling",
    status: "queued",
    message: "Prepared the modeling handoff prompt for the next pipeline stage.",
    data: {
      intentPrompt,
      predictedTarget: hypothesis.predictedTarget,
      suggestedFeatures: hypothesis.suggestedFeatures,
    },
  });

  return {
    runId,
    researchQuestion: question,
    literature,
    hypothesis,
    intentPrompt,
    events,
  };
}

export function buildModelingIntentPrompt({
  researchQuestion,
  literature,
  hypothesis,
}: {
  researchQuestion: string;
  literature: LiteratureAgentResult;
  hypothesis: HypothesisAgentResult;
}): string {
  return [
    `Research question: ${researchQuestion}`,
    `Testable hypothesis: ${hypothesis.hypothesis}`,
    `Predicted target: ${hypothesis.predictedTarget}`,
    `Suggested features: ${hypothesis.suggestedFeatures.join(", ") || "none"}`,
    `Literature summary: ${literature.summary}`,
    `Key findings: ${literature.keyFindings.join("; ") || "none"}`,
  ].join("\n");
}

function buildRunId(): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);

  return `research-${timestamp}-${suffix}`;
}
