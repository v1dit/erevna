# Erevna

Autonomous research pipeline foundation for the hackathon build.

## What is implemented

- A server-only TokenRouter client for agent LLM calls
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
TOKENROUTER_BASE_URL=https://api.tokenrouter.io/v1
TOKENROUTER_MODEL=auto:balance
```

Restart `npm run dev`, then verify the server-side TokenRouter connection:

```bash
curl "http://localhost:3000/api/tokenrouter-smoke"
```

The smoke route is available only in development. A successful response returns `ok: true` plus model, provider, and usage metadata when TokenRouter includes it. After the request, check the TokenRouter dashboard for the `SmokeTest` agent call.
