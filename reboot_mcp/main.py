"""Minimal Reboot DurableMCP for Erevna (MCP tools without DurableContext in signatures).

See README.txt for run instructions (Docker + rbt dev run).
"""

from __future__ import annotations

import asyncio

from reboot.mcp.server import DurableMCP

mcp = DurableMCP(path="/mcp")


@mcp.tool()
async def add(a: int, b: int) -> int:
    """Add two integers (smoke tool proving MCP is live)."""
    return a + b


async def main() -> None:
    await mcp.application().run()


if __name__ == "__main__":
    asyncio.run(main())
