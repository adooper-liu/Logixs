import type {
  CollaborationSubjectRefV1,
  TaskCollaborationPageV1,
  TaskCollaborationPostCommandV1,
  TaskCollaborationPostResultV1,
} from "@logix/contracts";
import { requestJson } from "./httpClient";

export function listTaskCollaboration(
  taskId: string,
  query: {
    subjectRef: CollaborationSubjectRefV1;
    pageSize: number;
    cursor?: string;
  },
  signal?: AbortSignal,
): Promise<TaskCollaborationPageV1> {
  const params = new URLSearchParams({
    subjectKind: query.subjectRef.kind,
    subjectId: query.subjectRef.id,
    pageSize: String(query.pageSize),
  });
  if (query.cursor) params.set("cursor", query.cursor);
  return requestJson<TaskCollaborationPageV1>(
    `/api/node-tasks/${encodeURIComponent(taskId)}/collaboration?${params}`,
    {
      fallback: "暂时无法读取任务协作",
      signal,
    },
  );
}

export function postTaskCollaborationMessage(
  taskId: string,
  command: TaskCollaborationPostCommandV1,
  signal?: AbortSignal,
): Promise<TaskCollaborationPostResultV1> {
  return requestJson<TaskCollaborationPostResultV1>(
    `/api/node-tasks/${encodeURIComponent(taskId)}/collaboration/messages`,
    {
      method: "POST",
      body: command,
      fallback: "暂时无法发送协作消息",
      signal,
    },
  );
}
