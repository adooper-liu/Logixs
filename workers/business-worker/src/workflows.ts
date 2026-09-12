// 确定性工作流定义（ADR-004：模型/DB/网络/随机一律放 Activity，工作流保持确定性）。
import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";

const { echoActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export interface EchoInput {
  message: string;
}

export interface EchoResult {
  message: string;
  echoedBy: string;
}

export async function echoWorkflow(input: EchoInput): Promise<EchoResult> {
  const echoed = await echoActivity(input.message);
  return { message: echoed, echoedBy: "business-worker" };
}
