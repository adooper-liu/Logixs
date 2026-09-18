import type { AssistantSessionResponse } from "@logix/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOpsAssistant } from "./useOpsAssistant";

const openAssistantSession = vi.fn();

vi.mock("../api/notifications", () => ({
  openAssistantSession: (...args: unknown[]) => openAssistantSession(...args),
  postAssistantMessage: vi.fn(),
}));

const SESSION: AssistantSessionResponse = {
  sessionId: "session-1",
  notificationId: null,
  containerId: "container-1",
  objectContext: null,
  messages: [],
};

describe("useOpsAssistant", () => {
  beforeEach(() => {
    openAssistantSession.mockReset();
  });

  it("clears stale context when opening a different object fails", async () => {
    openAssistantSession.mockResolvedValueOnce(SESSION);
    const assistant = useOpsAssistant();
    await assistant.open({ containerId: "container-1" });
    expect(assistant.session.value).toStrictEqual(SESSION);

    openAssistantSession.mockRejectedValueOnce(new Error("RESOURCE_NOT_FOUND"));
    await assistant.open({ containerId: "container-2" });

    expect(assistant.session.value).toBeNull();
    expect(assistant.error.value).toBe("RESOURCE_NOT_FOUND");
  });
});
