import { ApplicationFailure } from "@temporalio/activity";
import {
  buildPublishDueRequest,
  classifyPublishDueHttpStatus,
  resolveLogixApiUrl,
  type PublishDueActivityResult,
  type PublishDueWorkflowInput,
} from "./outbox-publish-due";
import {
  buildPublishDueSystemRequest,
  resolveServiceCredentials,
  type PublishDueSystemActivityResult,
  type PublishDueSystemWorkflowInput,
} from "./outbox-publish-due-system";

// 业务 Activity（确定性业务步骤；AI/模型调用在 ai-worker，见 ADR-005）。
export async function echoActivity(message: string): Promise<string> {
  return `echo: ${message}`;
}

export async function publishDueOutboxActivity(
  input: PublishDueWorkflowInput,
): Promise<PublishDueActivityResult> {
  let request;
  try {
    request = buildPublishDueRequest(
      input,
      resolveLogixApiUrl(process.env.LOGIX_API_URL),
    );
  } catch (error) {
    throw ApplicationFailure.nonRetryable(
      error instanceof Error ? error.message : "VALIDATION_FORMAT",
    );
  }

  let response: Response;
  try {
    response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw ApplicationFailure.create({
      message: error instanceof Error ? error.message : "network_error",
      type: "network_error",
      nonRetryable: false,
    });
  }

  if (!response.ok) {
    const classification = classifyPublishDueHttpStatus(response.status);
    const message = `PUBLISH_DUE_HTTP_${response.status}`;
    if (classification === "non_retryable") {
      throw ApplicationFailure.nonRetryable(message, String(response.status));
    }
    throw ApplicationFailure.create({
      message,
      type: String(response.status),
      nonRetryable: false,
    });
  }

  return (await response.json()) as PublishDueActivityResult;
}

export async function publishDueSystemOutboxActivity(
  input: PublishDueSystemWorkflowInput,
): Promise<PublishDueSystemActivityResult> {
  let request;
  try {
    request = buildPublishDueSystemRequest(
      input,
      resolveLogixApiUrl(process.env.LOGIX_API_URL),
      resolveServiceCredentials(
        process.env.LOGIX_SERVICE_ID,
        process.env.LOGIX_SERVICE_KEY,
      ),
    );
  } catch (error) {
    throw ApplicationFailure.nonRetryable(
      error instanceof Error ? error.message : "VALIDATION_FORMAT",
    );
  }

  let response: Response;
  try {
    response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(240_000),
    });
  } catch (error) {
    throw ApplicationFailure.create({
      message: error instanceof Error ? error.message : "network_error",
      type: "network_error",
      nonRetryable: false,
    });
  }

  if (!response.ok) {
    const classification = classifyPublishDueHttpStatus(response.status);
    const message = `PUBLISH_DUE_SYSTEM_HTTP_${response.status}`;
    if (classification === "non_retryable") {
      throw ApplicationFailure.nonRetryable(message, String(response.status));
    }
    throw ApplicationFailure.create({
      message,
      type: String(response.status),
      nonRetryable: false,
    });
  }

  return (await response.json()) as PublishDueSystemActivityResult;
}
