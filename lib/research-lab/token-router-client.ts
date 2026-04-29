const DEFAULT_TOKENROUTER_BASE_URL = "https://api.tokenrouter.io/v1";
const DEFAULT_TOKENROUTER_MODEL = "auto:balance";
const TOKENROUTER_TIMEOUT_MS = 30_000;

export type TokenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type TokenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  [key: string]: unknown;
};

export type TokenRouterTextResult = {
  text: string;
  model?: string;
  provider?: string;
  usage?: TokenRouterUsage;
  finishReason?: string;
};

export type GenerateTokenRouterTextOptions = {
  agent: string;
  messages: TokenRouterMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

type TokenRouterChatResponse = {
  model?: string;
  provider?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  usage?: TokenRouterUsage;
};

type TokenRouterErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    http_status?: number;
  };
};

export class TokenRouterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenRouterConfigError";
  }
}

export class TokenRouterRequestError extends Error {
  readonly status?: number;

  readonly details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "TokenRouterRequestError";
    this.status = status;
    this.details = details;
  }
}

export async function generateTokenRouterText({
  agent,
  messages,
  model,
  temperature = 0.2,
  maxTokens = 512,
}: GenerateTokenRouterTextOptions): Promise<TokenRouterTextResult> {
  const apiKey = process.env.TOKENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new TokenRouterConfigError(
      "TOKENROUTER_API_KEY is required. Add it to .env.local and restart the dev server.",
    );
  }

  const requestModel =
    model?.trim() || process.env.TOKENROUTER_MODEL?.trim() || DEFAULT_TOKENROUTER_MODEL;
  const baseURL =
    process.env.TOKENROUTER_BASE_URL?.trim().replace(/\/+$/, "") ||
    DEFAULT_TOKENROUTER_BASE_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: requestModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        user: JSON.stringify({
          app: "research-lab-ai",
          agent,
        }),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const responseBody = await readJsonResponse(response);

    if (!response.ok) {
      throw new TokenRouterRequestError(
        getTokenRouterErrorMessage(responseBody, response.statusText),
        response.status,
        responseBody,
      );
    }

    const chatResponse = responseBody as TokenRouterChatResponse;
    const choice = chatResponse.choices?.[0];
    const text = choice?.message?.content?.trim();

    if (!text) {
      throw new TokenRouterRequestError("TokenRouter returned an empty response.", response.status, responseBody);
    }

    return {
      text,
      model: chatResponse.model ?? requestModel,
      provider: chatResponse.provider,
      usage: chatResponse.usage,
      finishReason: choice?.finish_reason ?? undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TokenRouterRequestError("TokenRouter request timed out after 30 seconds.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function getTokenRouterErrorMessage(responseBody: unknown, fallback: string): string {
  const tokenRouterError = responseBody as TokenRouterErrorResponse;
  return tokenRouterError.error?.message ?? fallback ?? "TokenRouter request failed.";
}
