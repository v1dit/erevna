import { NextResponse } from "next/server";
import {
  TokenRouterConfigError,
  TokenRouterRequestError,
} from "@/lib/research-lab/agent-llm";
import {
  type ResearchPipelineEvent,
  runResearchPipeline,
} from "@/lib/research-lab/research-pipeline";

type ResearchRunRequest = {
  researchQuestion?: unknown;
  maxResults?: unknown;
  stream?: unknown;
};

type NormalizedResearchRunRequest = {
  researchQuestion: string;
  maxResults?: number;
  stream: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResearchRunRequest;
    const normalized = normalizeRequest(body);

    if ("error" in normalized) {
      return NextResponse.json(
        {
          error: normalized.error,
        },
        { status: 400 },
      );
    }

    if (normalized.stream) {
      return streamResearchRun(normalized);
    }

    const result = await runResearchPipeline(normalized);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Request body must be valid JSON.",
        },
        { status: 400 },
      );
    }

    return buildJsonErrorResponse(error);
  }
}

function streamResearchRun(input: NormalizedResearchRunRequest): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await runResearchPipeline({
          ...input,
          onEvent: (event) => {
            controller.enqueue(encoder.encode(formatSseMessage("status", event)));
          },
        });

        controller.enqueue(encoder.encode(formatSseMessage("complete", result)));
      } catch (error) {
        controller.enqueue(encoder.encode(formatSseMessage("error", serializeError(error))));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}

function normalizeRequest(
  body: ResearchRunRequest,
): NormalizedResearchRunRequest | { error: string } {
  const researchQuestion =
    typeof body.researchQuestion === "string" ? body.researchQuestion.trim() : "";

  if (!researchQuestion) {
    return {
      error: "A non-empty researchQuestion field is required.",
    };
  }

  const maxResults =
    typeof body.maxResults === "number" && Number.isFinite(body.maxResults)
      ? body.maxResults
      : undefined;

  return {
    researchQuestion,
    maxResults,
    stream: body.stream === true,
  };
}

function formatSseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildJsonErrorResponse(error: unknown): NextResponse {
  const serialized = serializeError(error);

  return NextResponse.json(serialized, {
    status: serialized.status,
  });
}

function serializeError(error: unknown): {
  error: string;
  details?: string;
  upstreamStatus?: number;
  status: number;
  event?: ResearchPipelineEvent;
} {
  if (error instanceof TokenRouterConfigError) {
    return {
      error: "TokenRouter is not configured.",
      details: error.message,
      status: 500,
    };
  }

  if (error instanceof TokenRouterRequestError) {
    return {
      error: "Research run failed during an agent LLM call.",
      details: error.message,
      upstreamStatus: error.status,
      status: 502,
    };
  }

  return {
    error: "Research run failed.",
    details: error instanceof Error ? error.message : "Unknown error",
    status: 500,
  };
}
