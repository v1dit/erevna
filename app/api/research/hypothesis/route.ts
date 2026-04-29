import { NextResponse } from "next/server";
import {
  TokenRouterConfigError,
  TokenRouterRequestError,
} from "@/lib/research-lab/agent-llm";
import { runHypothesisAgent } from "@/lib/research-lab/research-agents";

type HypothesisRequest = {
  researchQuestion?: unknown;
  literatureSummary?: unknown;
  keyFindings?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HypothesisRequest;
    const researchQuestion =
      typeof body.researchQuestion === "string" ? body.researchQuestion.trim() : "";
    const literatureSummary =
      typeof body.literatureSummary === "string" ? body.literatureSummary.trim() : "";

    if (!researchQuestion) {
      return NextResponse.json(
        {
          error: "A non-empty researchQuestion field is required.",
        },
        { status: 400 },
      );
    }

    if (!literatureSummary) {
      return NextResponse.json(
        {
          error: "A non-empty literatureSummary field is required.",
        },
        { status: 400 },
      );
    }

    const result = await runHypothesisAgent({
      researchQuestion,
      literatureSummary,
      keyFindings: Array.isArray(body.keyFindings)
        ? body.keyFindings.filter((finding): finding is string => typeof finding === "string")
        : undefined,
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
          error: "Hypothesis Agent could not form a hypothesis.",
          details: error.message,
          upstreamStatus: error.status,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error: "Hypothesis Agent failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
