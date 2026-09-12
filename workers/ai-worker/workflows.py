# Workflow 定义（Temporal Python 沙箱：此模块不得 import 网络/IO 库）。
from datetime import timedelta

from temporalio import workflow


@workflow.defn
class EchoAiWorkflow:
    @workflow.run
    async def run(self, message: str) -> str:
        echoed = await workflow.execute_activity(
            "echo_ai_activity",
            message,
            start_to_close_timeout=timedelta(seconds=10),
        )
        return f"{echoed} (via ai-worker)"
