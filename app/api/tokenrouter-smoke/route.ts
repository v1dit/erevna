import { NextResponse } from "next/server";
import {
  generateResearchAgentText,
  TokenRouterConfigError,
  TokenRouterRequestError,
} from "@/lib/research-lab/agent-llm";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        ok: false,
        error: "TokenRouter smoke test is only available in development.",
      },
      { status: 404 },
    );
  }

  try {
    const result = await generateResearchAgentText({
      agent: "SmokeTest",
      messages: [
        {
          role: "system",
          content: "You are a concise health check for Research Lab AI.",
        },
        {
          role: "user",
          content: "Reply with exactly: ok",
        },
      ],
      temperature: 0,
      maxTokens: 16,
    });

    return NextResponse.json({
      ok: true,
      text: result.text,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
    });
  } catch (error) {
    if (error instanceof TokenRouterConfigError) {
      return NextResponse.json(
        {
          ok: false,
          error: "TokenRouter is not configured.",
          details: error.message,
        },
        { status: 500 },
      );
    }

    if (error instanceof TokenRouterRequestError) {
      return NextResponse.json(
        {
          ok: false,
          error: "TokenRouter smoke test failed.",
          details: error.message,
          upstreamStatus: error.status,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "TokenRouter smoke test failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
