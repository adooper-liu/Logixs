import { describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import type { AuthSession, SessionSnapshot } from "./session";

let current: SessionSnapshot;
const listeners = new Set<(snapshot: SessionSnapshot) => void>();

vi.mock("./session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./session")>()),
  getAuthSession: () =>
    ({
      mode: "oidc",
      snapshot: () => current,
      subscribe(listener: (snapshot: SessionSnapshot) => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }) as unknown as AuthSession,
}));

const { useAuthSession } = await import("./useAuthSession");

function publish(next: SessionSnapshot) {
  current = next;
  for (const listener of listeners) listener(next);
}

describe("useAuthSession actorId", () => {
  it("只在已认证时投影 profile.subject，其余状态一律为 null", () => {
    current = { status: "initializing", profile: null, errorCode: null };
    const scope = effectScope();
    const { actorId } = scope.run(() => useAuthSession())!;

    expect(actorId.value).toBeNull();

    publish({
      status: "authenticated",
      profile: { subject: "sub-1", displayName: null },
      errorCode: null,
    });
    expect(actorId.value).toBe("sub-1");

    publish({
      status: "error",
      profile: { subject: "sub-1", displayName: null },
      errorCode: "SESSION_REJECTED",
    });
    expect(actorId.value).toBeNull();

    publish({ status: "anonymous", profile: null, errorCode: null });
    expect(actorId.value).toBeNull();
    scope.stop();
    expect(listeners.size).toBe(0);
  });
});
