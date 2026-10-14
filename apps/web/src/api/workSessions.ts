import type {
  WorkSessionActivateCommandV1,
  WorkSessionCloseCommandV1,
  WorkSessionOpenCommandV1,
  WorkSessionPageV1,
  WorkSessionUpdateCommandV1,
  WorkSessionV1,
} from "@logix/contracts";
import { requestJson } from "./httpClient";

export function listWorkSessions(
  input: {
    pageSize?: number;
    cursor?: string;
  } = {},
): Promise<WorkSessionPageV1> {
  const params = new URLSearchParams({
    pageSize: String(input.pageSize ?? 50),
  });
  if (input.cursor) params.set("cursor", input.cursor);
  return requestJson<WorkSessionPageV1>(`/api/work-sessions?${params}`, {
    fallback: "暂时无法读取工作现场",
  });
}

export function openWorkSession(
  command: WorkSessionOpenCommandV1,
): Promise<WorkSessionV1> {
  return requestJson<WorkSessionV1>("/api/work-sessions/open", {
    method: "POST",
    body: command,
    fallback: "暂时无法保留当前工作现场",
  });
}

export function updateWorkSession(
  sessionId: string,
  command: WorkSessionUpdateCommandV1,
): Promise<WorkSessionV1> {
  return requestJson<WorkSessionV1>(
    `/api/work-sessions/${encodeURIComponent(sessionId)}/pointer`,
    {
      method: "PATCH",
      body: command,
      fallback: "暂时无法更新工作现场",
    },
  );
}

export function activateWorkSession(
  sessionId: string,
  command: WorkSessionActivateCommandV1,
): Promise<WorkSessionV1> {
  return requestJson<WorkSessionV1>(
    `/api/work-sessions/${encodeURIComponent(sessionId)}/activate`,
    {
      method: "POST",
      body: command,
      fallback: "暂时无法切换工作现场",
    },
  );
}

export function closeWorkSession(
  sessionId: string,
  command: WorkSessionCloseCommandV1,
): Promise<WorkSessionV1> {
  return requestJson<WorkSessionV1>(
    `/api/work-sessions/${encodeURIComponent(sessionId)}/close`,
    {
      method: "POST",
      body: command,
      fallback: "暂时无法关闭工作现场",
    },
  );
}
