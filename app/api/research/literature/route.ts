import { NextResponse } from "next/server";
import {
  TokenRouterConfigError,
  TokenRouterRequestError,
} from "@/lib/research-lab/agent-llm";
import { runLiteratureAgent } from "@/lib/research-lab/research-agents";

type LiteratureRequest = {
  researchQuestion?: unknown;
  maxResults?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LiteratureRequest;
    const researchQuestion =
      typeof body.researchQuestion === "string" ? body.researchQuestion.trim() : "";

    if (!researchQuestion) {
      return NextResponse.json(
        {
          error: "A non-empty researchQuestion field is required.",
        },
        { status: 400 },
      );
    }

    const result = await runLiteratureAgent({
      researchQuestion,
      maxResults: typeof body.maxResults === "number" ? body.maxResults : undefined,
    });

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

    if (error instanceof TokenRouterConfigError) {
      return NextResponse.json(
        {
          error: "TokenRouter is not configured.",
          details: error.message,
        },
        { status: 500 },
      );
    }

    if (error instanceof TokenRouterRequestError) {
      return NextResponse.json(
        {
          error: "Literature Agent could not synthesize the papers.",
          details: error.message,
          upstreamStatus: error.status,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error: "Literature Agent failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
