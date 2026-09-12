# AI Activity（不在沙箱内，可 import 网络库，调用 ai-service 能力）。
import httpx
from temporalio import activity

AI_SERVICE_URL = "http://localhost:8001"


@activity.defn
async def echo_ai_activity(message: str) -> str:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AI_SERVICE_URL}/capabilities/echo",
            json={"message": message},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()["message"]
