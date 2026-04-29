import {
  generateTokenRouterText,
  TokenRouterConfigError,
  TokenRouterRequestError,
  type GenerateTokenRouterTextOptions,
  type TokenRouterMessage,
  type TokenRouterTextResult,
} from "@/lib/research-lab/token-router-client";

export { TokenRouterConfigError, TokenRouterRequestError };

export type ResearchAgentName =
  | "IntentAgent"
  | "LiteratureAgent"
  | "HypothesisAgent"
  | "DataSourcingAgent"
  | "DataAnalystAgent"
  | "ModelingAgent"
  | "OptimizationAgent"
  | "StatisticalAgent"
  | "VisualizationAgent"
  | "ResearchAgent"
  | "SmokeTest";

export type ResearchAgentLlmOptions = Omit<GenerateTokenRouterTextOptions, "agent"> & {
  agent: ResearchAgentName;
};

export type ResearchAgentLlmResult = TokenRouterTextResult;
export type ResearchAgentMessage = TokenRouterMessage;

export async function generateResearchAgentText(
  options: ResearchAgentLlmOptions,
): Promise<ResearchAgentLlmResult> {
  return generateTokenRouterText(options);
}

export async function generateResearchAgentJson<T>(
  options: ResearchAgentLlmOptions,
): Promise<ResearchAgentLlmResult & { json: T }> {
  const result = await generateResearchAgentText(options);

  try {
    return {
      ...result,
      json: JSON.parse(extractJsonObject(result.text)) as T,
    };
  } catch (error) {
    throw new Error(
      `Agent ${options.agent} returned invalid JSON: ${
        error instanceof Error ? error.message : "Unknown parse error"
      }`,
    );
  }
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

  if (candidate.startsWith("{") && candidate.endsWith("}")) {
    return candidate;
  }

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }

  return candidate;
}
