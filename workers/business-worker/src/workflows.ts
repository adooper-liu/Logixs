// 确定性工作流定义（ADR-004：模型/DB/网络/随机一律放 Activity，工作流保持确定性）。
import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";
import type {
  PublishDueActivityResult,
  PublishDueWorkflowInput,
} from "./outbox-publish-due";
import type {
  PublishDueSystemActivityResult,
  PublishDueSystemWorkflowInput,
} from "./outbox-publish-due-system";

const { echoActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

const { publishDueOutboxActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 3 },
});

const { publishDueSystemOutboxActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
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

export async function outboxPublishDueWorkflow(
  input: PublishDueWorkflowInput,
): Promise<PublishDueActivityResult> {
  return publishDueOutboxActivity(input);
}

export async function outboxPublishDueSystemWorkflow(
  input: PublishDueSystemWorkflowInput,
): Promise<PublishDueSystemActivityResult> {
  return publishDueSystemOutboxActivity(input);
}
