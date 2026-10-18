import type {
  WorkSessionActivateCommandV1,
  WorkSessionCloseCommandV1,
  WorkSessionOpenCommandV1,
  WorkSessionPageV1,
  WorkSessionUpdateCommandV1,
  WorkSessionV1,
} from "@logix/contracts";
import { requestJson } from "./httpClient";

export async function listWorkSessions(
  input: { includeClosed?: boolean } = {},
): Promise<WorkSessionPageV1> {
  const items = new Map<string, WorkSessionV1>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (cursor) params.set("cursor", cursor);
    if (input.includeClosed) params.set("includeClosed", "true");
    const page = await requestJson<WorkSessionPageV1>(
      `/api/work-sessions?${params}`,
      { fallback: "暂时无法读取工作现场" },
    );
    for (const session of page.items) {
      if (!items.has(session.sessionId)) items.set(session.sessionId, session);
    }
    cursor = page.nextCursor;
    if (cursor && seenCursors.has(cursor)) {
      throw new Error("WORK_SESSION_PAGINATION_CURSOR_LOOP");
    }
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return {
    contractVersion: "work-session-page.v1",
    items: [...items.values()],
    pageSize: 100,
    nextCursor: null,
  };
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
