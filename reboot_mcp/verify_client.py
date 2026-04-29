"""Smoke-test MCP (run `uv run rbt dev run` in reboot_mcp first)."""

from __future__ import annotations

import asyncio
import os

from reboot.mcp.client import connect

URL = os.environ.get("EREVNA_MCP_URL", "http://127.0.0.1:9991")


async def main() -> None:
    async with connect(URL + "/mcp") as (session, _sid, _pv):
        tools = await session.list_tools()
        print("tools:", [t.name for t in tools.tools])
        print(await session.call_tool("add", arguments={"a": 2, "b": 3}))


if __name__ == "__main__":
    asyncio.run(main())
