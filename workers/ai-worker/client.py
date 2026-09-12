# 验证辅助：启动 ai-worker 的 echo 工作流并等待结果（需 ai-service 在 8001 运行）。
import asyncio
import time

from temporalio.client import Client


async def main() -> None:
    client = await Client.connect("localhost:7233")
    handle = await client.start_workflow(
        "EchoAiWorkflow",
        "hello from ai-worker",
        id=f"echo-ai-{int(time.time() * 1000)}",
        task_queue="logix-ai",
    )
    print("started workflow:", handle.id)
    result = await handle.result()
    print("result:", result)


if __name__ == "__main__":
    asyncio.run(main())
