import type {
  ConfirmTaskActionCandidateCommandV1,
  GenerateTaskActionCandidateCommandV1,
  RejectTaskActionCandidateCommandV1,
  TaskActionCandidateV1,
  TaskActionConfirmResultV1,
  TaskActionDecisionV1,
} from "@logix/contracts";
import { requestJson } from "./httpClient";

function candidatePath(taskId: string, candidateId?: string): string {
  const base = `/api/node-tasks/${encodeURIComponent(taskId)}/ai/action-candidates`;
  return candidateId ? `${base}/${encodeURIComponent(candidateId)}` : base;
}

export function generateTaskActionCandidate(
  taskId: string,
  command: GenerateTaskActionCandidateCommandV1,
  signal: AbortSignal,
): Promise<TaskActionCandidateV1> {
  return requestJson<TaskActionCandidateV1>(candidatePath(taskId), {
    method: "POST",
    body: command,
    fallback: "暂时无法生成任务建议",
    signal,
  });
}

export function getTaskActionCandidate(
  taskId: string,
  candidateId: string,
  signal: AbortSignal,
): Promise<TaskActionCandidateV1> {
  return requestJson<TaskActionCandidateV1>(
    candidatePath(taskId, candidateId),
    {
      fallback: "暂时无法读取任务建议",
      signal,
    },
  );
}

export function rejectTaskActionCandidate(
  taskId: string,
  candidateId: string,
  command: RejectTaskActionCandidateCommandV1,
  signal: AbortSignal,
): Promise<TaskActionDecisionV1> {
  return requestJson<TaskActionDecisionV1>(
    `${candidatePath(taskId, candidateId)}/rejections`,
    {
      method: "POST",
      body: command,
      fallback: "暂时无法拒绝任务建议",
      signal,
    },
  );
}

export function confirmTaskActionCandidate(
  taskId: string,
  candidateId: string,
  command: ConfirmTaskActionCandidateCommandV1,
  signal: AbortSignal,
): Promise<TaskActionConfirmResultV1> {
  return requestJson<TaskActionConfirmResultV1>(
    `${candidatePath(taskId, candidateId)}/confirmations`,
    {
      method: "POST",
      body: command,
      fallback: "暂时无法确认任务建议",
      signal,
    },
  );
}
