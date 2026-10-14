const ACTIVE_SESSION_KEY = "logix.work-session.active.v1";

export function readActiveSessionId(
  storage: Pick<Storage, "getItem">,
): string | null {
  try {
    return storage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeActiveSessionId(
  storage: Pick<Storage, "setItem" | "removeItem">,
  sessionId: string | null,
): void {
  try {
    if (sessionId) storage.setItem(ACTIVE_SESSION_KEY, sessionId);
    else storage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // Per-tab convenience only; the server remains authoritative.
  }
}
