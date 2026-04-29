import { XMLParser } from "fast-xml-parser";
import { generateResearchAgentJson } from "@/lib/research-lab/agent-llm";

const ARXIV_QUERY_URL = "https://export.arxiv.org/api/query";
const ARXIV_TIMEOUT_MS = 15_000;
const DEFAULT_PAPER_LIMIT = 5;
const ARXIV_STOP_WORDS = new Set([
  "about",
  "affect",
  "affects",
  "after",
  "among",
  "between",
  "does",
  "impact",
  "impacts",
  "influence",
  "influences",
  "into",
  "over",
  "relationship",
  "than",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "under",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
]);
const ARXIV_REDUCED_QUERY_TERMS = new Set([
  "effect",
  "effects",
  "quality",
  "student",
  "students",
]);

export type LiteraturePaper = {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  url: string;
  pdfUrl?: string;
  published?: string;
  updated?: string;
};

export type LiteratureAgentResult = {
  papers: LiteraturePaper[];
  summary: string;
  keyFindings: string[];
};

export type HypothesisAgentResult = {
  hypothesis: string;
  predictedTarget: string;
  suggestedFeatures: string[];
};

type ArxivFeed = {
  feed?: {
    entry?: ArxivEntry | ArxivEntry[];
  };
};

type ArxivEntry = {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  updated?: string;
  author?: ArxivAuthor | ArxivAuthor[];
  link?: ArxivLink | ArxivLink[];
};

type ArxivAuthor = {
  name?: string;
};

type ArxivLink = {
  "@_href"?: string;
  "@_rel"?: string;
  "@_title"?: string;
  "@_type"?: string;
};

type LiteratureSynthesis = {
  summary: string;
  keyFindings: string[];
};

type HypothesisSynthesis = {
  hypothesis: string;
  predictedTarget: string;
  suggestedFeatures: string[];
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

export async function runLiteratureAgent({
  researchQuestion,
  maxResults = DEFAULT_PAPER_LIMIT,
}: {
  researchQuestion: string;
  maxResults?: number;
}): Promise<LiteratureAgentResult> {
  const question = researchQuestion.trim();
  if (!question) {
    throw new Error("A research question is required.");
  }

  const papers = await fetchArxivPapers({
    query: question,
    maxResults,
  });

  if (papers.length === 0) {
    return {
      papers,
      summary: "No arXiv papers were found for this research question.",
      keyFindings: [],
    };
  }

  const synthesis = await generateResearchAgentJson<LiteratureSynthesis>({
    agent: "LiteratureAgent",
    messages: [
      {
        role: "system",
        content:
          "You are the Literature Agent for Research Lab AI. Read paper titles and abstracts, then synthesize only findings relevant to the research question. Return strict JSON with keys summary and keyFindings. keyFindings must be an array of concise strings.",
      },
      {
        role: "user",
        content: JSON.stringify({
          researchQuestion: question,
          papers: papers.map((paper) => ({
            title: paper.title,
            abstract: paper.abstract,
            authors: paper.authors,
            published: paper.published,
          })),
        }),
      },
    ],
    temperature: 0.2,
    maxTokens: 700,
  });

  return {
    papers,
    summary: normalizeWhitespace(synthesis.json.summary),
    keyFindings: normalizeKeyFindings(synthesis.json.keyFindings),
  };
}

export async function runHypothesisAgent({
  researchQuestion,
  literatureSummary,
  keyFindings = [],
}: {
  researchQuestion: string;
  literatureSummary: string;
  keyFindings?: string[];
}): Promise<HypothesisAgentResult> {
  const question = researchQuestion.trim();
  const summary = literatureSummary.trim();

  if (!question) {
    throw new Error("A research question is required.");
  }

  if (!summary) {
    throw new Error("A literature summary is required.");
  }

  const synthesis = await generateResearchAgentJson<HypothesisSynthesis>({
    agent: "HypothesisAgent",
    messages: [
      {
        role: "system",
        content:
          "You are the Hypothesis Agent for Research Lab AI. Use the research question and literature synthesis to form one testable empirical hypothesis. Return strict JSON with exactly these keys: hypothesis, predictedTarget, suggestedFeatures. predictedTarget must be a concise variable name. suggestedFeatures must be an array of concise feature names likely to exist in a dataset.",
      },
      {
        role: "user",
        content: JSON.stringify({
          researchQuestion: question,
          literatureSummary: summary,
          keyFindings: normalizeKeyFindings(keyFindings),
        }),
      },
    ],
    temperature: 0.2,
    maxTokens: 500,
  });

  return {
    hypothesis: normalizeWhitespace(synthesis.json.hypothesis),
    predictedTarget: normalizeVariableName(synthesis.json.predictedTarget),
    suggestedFeatures: normalizeSuggestedFeatures(synthesis.json.suggestedFeatures),
  };
}

export async function fetchArxivPapers({
  query,
  maxResults = DEFAULT_PAPER_LIMIT,
}: {
  query: string;
  maxResults?: number;
}): Promise<LiteraturePaper[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new Error("An arXiv query is required.");
  }

  for (const searchQuery of buildArxivSearchQueries(normalizedQuery)) {
    const papers = await requestArxivPapers(searchQuery, maxResults);

    if (papers.length > 0) {
      return papers;
    }
  }

  return [];
}

async function requestArxivPapers(
  searchQuery: string,
  maxResults: number,
): Promise<LiteraturePaper[]> {
  const url = new URL(ARXIV_QUERY_URL);
  url.searchParams.set("search_query", searchQuery);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", String(clampPaperLimit(maxResults)));
  url.searchParams.set("sortBy", "relevance");
  url.searchParams.set("sortOrder", "descending");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARXIV_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`arXiv request failed with status ${response.status}.`);
    }

    return parseArxivFeed(await response.text());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("arXiv request timed out after 15 seconds.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildArxivSearchQueries(query: string): string[] {
  const terms = extractSearchTerms(query);

  if (terms.length === 0) {
    return [`all:${query}`];
  }

  const exactTerms = terms.map((term) => `all:${term}`).join(" AND ");
  const reducedTerms = terms.filter((term) => !ARXIV_REDUCED_QUERY_TERMS.has(term));
  const reducedQuery =
    reducedTerms.length >= 2 ? reducedTerms.map((term) => `all:${term}`).join(" AND ") : "";
  const broadQuery = terms.map((term) => `all:${term}`).join(" OR ");

  return [exactTerms, reducedQuery, broadQuery].filter(
    (candidate, index, candidates) => candidate && candidates.indexOf(candidate) === index,
  );
}

function extractSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !ARXIV_STOP_WORDS.has(term))
    .slice(0, 8);
}

export function parseArxivFeed(xml: string): LiteraturePaper[] {
  const parsed = xmlParser.parse(xml) as ArxivFeed;
  const entries = toArray(parsed.feed?.entry);

  return entries
    .map(normalizeArxivEntry)
    .filter((paper): paper is LiteraturePaper => Boolean(paper));
}

function normalizeArxivEntry(entry: ArxivEntry): LiteraturePaper | null {
  const id = normalizeWhitespace(entry.id);
  const title = normalizeWhitespace(entry.title);
  const abstract = normalizeWhitespace(entry.summary);

  if (!id || !title || !abstract) {
    return null;
  }

  const links = toArray(entry.link);
  const canonicalUrl = links.find((link) => link["@_rel"] === "alternate")?.["@_href"] ?? id;
  const pdfUrl =
    links.find((link) => link["@_title"] === "pdf" || link["@_type"] === "application/pdf")?.[
      "@_href"
    ];

  return {
    id,
    title,
    abstract,
    authors: toArray(entry.author)
      .map((author) => normalizeWhitespace(author.name))
      .filter(Boolean),
    url: canonicalUrl,
    pdfUrl,
    published: normalizeWhitespace(entry.published) || undefined,
    updated: normalizeWhitespace(entry.updated) || undefined,
  };
}

function normalizeKeyFindings(findings: unknown): string[] {
  if (!Array.isArray(findings)) {
    return [];
  }

  return findings
    .map((finding) => normalizeWhitespace(String(finding)))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeSuggestedFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) {
    return [];
  }

  return features
    .map((feature) => normalizeVariableName(feature))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeVariableName(value: unknown): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function clampPaperLimit(maxResults: number): number {
  if (!Number.isFinite(maxResults)) {
    return DEFAULT_PAPER_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(maxResults), 1), 10);
}

function normalizeWhitespace(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
