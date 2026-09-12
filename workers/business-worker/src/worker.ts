import { Worker } from "@temporalio/worker";
import * as activities from "./activities";

// TS 业务 Worker（ADR-004/005）：执行确定性 Activity，订阅 logix-business 任务队列。
async function run(): Promise<void> {
  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows"),
    activities,
    taskQueue: "logix-business",
  });
  console.log("business-worker listening on task queue: logix-business");
  await worker.run();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
