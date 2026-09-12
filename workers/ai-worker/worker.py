# Python AI Worker（ADR-005）：执行 AI Activity，调用 ai-service 能力。
# 骨架阶段：echo 工作流 + echo AI Activity；真实 AI 能力在 P6/P7 由业务工作流跨队列调用。
import asyncio

from temporalio.client import Client
from temporalio.worker import Worker

import activities
import workflows


async def main() -> None:
    client = await Client.connect("localhost:7233")
    worker = Worker(
        client,
        task_queue="logix-ai",
        workflows=[workflows.EchoAiWorkflow],
        activities=[activities.echo_ai_activity],
    )
    print("ai-worker listening on task queue: logix-ai")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
