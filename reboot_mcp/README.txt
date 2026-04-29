Erevna — minimal Reboot Durable MCP (Model Context Protocol)

Purpose: expose a standard /mcp HTTP endpoint so LLM agents can call typed tools
alongside the Erevna Next.js app (literature, hypothesis, pipeline routes in
lib/research-lab). This package is the smallest working Reboot MCP surface.

Run (requires Docker + Python >= 3.12.11 + uv):

  cd reboot_mcp
  uv sync
  uv run rbt dev run

Endpoint: http://127.0.0.1:9991/mcp

Smoke test (second terminal):

  cd reboot_mcp
  uv run python verify_client.py

Tools omit DurableContext in signatures to avoid known FastMCP/Pydantic schema
issues with forward refs in current durable-mcp + mcp stacks.

Repo: https://github.com/v1dit/erevna
