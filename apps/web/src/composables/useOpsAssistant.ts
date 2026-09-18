import type {
  AssistantSessionResponse,
  OpenAssistantSessionRequest,
} from "@logix/contracts";
import { readonly, shallowRef } from "vue";
import {
  openAssistantSession,
  postAssistantMessage,
} from "../api/notifications";

export function useOpsAssistant() {
  const session = shallowRef<AssistantSessionResponse | null>(null);
  const opening = shallowRef(false);
  const sending = shallowRef(false);
  const error = shallowRef("");

  async function open(input: OpenAssistantSessionRequest): Promise<void> {
    opening.value = true;
    error.value = "";
    session.value = null;
    try {
      session.value = await openAssistantSession(input);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "打开助手失败";
    } finally {
      opening.value = false;
    }
  }

  async function send(body: string): Promise<void> {
    if (!session.value || !body.trim()) return;
    sending.value = true;
    error.value = "";
    try {
      session.value = await postAssistantMessage(
        session.value.sessionId,
        body.trim(),
      );
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "发送失败";
    } finally {
      sending.value = false;
    }
  }

  function close(): void {
    session.value = null;
    error.value = "";
  }

  return {
    session: readonly(session),
    opening: readonly(opening),
    sending: readonly(sending),
    error: readonly(error),
    open,
    send,
    close,
  };
}
