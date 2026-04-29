# Erevna

Autonomous research pipeline foundation for the hackathon build.

## What is implemented

- A single server-only LLM entrypoint for research agents, backed by TokenRouter
- A Literature Agent that retrieves arXiv papers and summarizes them through TokenRouter
- A development smoke route for checking TokenRouter credentials and dashboard usage
- A minimal Next.js app shell ready for the research-agent pipeline

## Local setup

```bash
npm install
npm run dev
```

## TokenRouter setup

Create a TokenRouter API key and add it to `.env.local`:

```bash
TOKENROUTER_API_KEY=tr_your_api_key_here
TOKENROUTER_BASE_URL=https://api.tokenrouter.com/v1
TOKENROUTER_MODEL=openai/gpt-4o-mini
```

Restart `npm run dev`, then verify the server-side TokenRouter connection:

```bash
curl "http://localhost:3000/api/tokenrouter-smoke"
```

The smoke route is available only in development. A successful response returns `ok: true` plus model, provider, and usage metadata when TokenRouter includes it. After the request, check the TokenRouter dashboard for the `SmokeTest` agent call.

## Agent LLM calls

All research agents should call `generateResearchAgentText()` or `generateResearchAgentJson()` from `lib/research-lab/agent-llm.ts`. That wrapper routes through TokenRouter using `TOKENROUTER_API_KEY`, `TOKENROUTER_BASE_URL`, and `TOKENROUTER_MODEL`.

Run the Literature Agent:

```bash
curl -X POST "http://localhost:3000/api/research/literature" \
  -H "Content-Type: application/json" \
  -d '{"researchQuestion":"Does sleep quality affect student academic performance?"}'
```

Run the Hypothesis Agent:

```bash
curl -X POST "http://localhost:3000/api/research/hypothesis" \
  -H "Content-Type: application/json" \
  -d '{
    "researchQuestion": "Does sleep quality affect student academic performance?",
    "literatureSummary": "Sleep patterns correlate with academic outcomes in student behavior studies.",
    "keyFindings": [
      "Sleep patterns are strongly correlated with academic performance."
    ]
  }'
```
