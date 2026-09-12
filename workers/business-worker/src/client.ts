import { Client } from "@temporalio/client";

// 验证辅助：启动一个 echo 工作流并等待结果（骨架验证通路）。
async function run(): Promise<void> {
  const client = new Client({});
  const handle = await client.workflow.start("echoWorkflow", {
    taskQueue: "logix-business",
    workflowId: `echo-${Date.now()}`,
    args: [{ message: "hello temporal" }],
  });
  console.log("started workflow:", handle.workflowId);
  const result = await handle.result();
  console.log("result:", JSON.stringify(result));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
