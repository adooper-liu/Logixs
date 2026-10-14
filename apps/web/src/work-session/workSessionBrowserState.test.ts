import { describe, expect, it } from "vitest";
import {
  readActiveSessionId,
  writeActiveSessionId,
} from "./workSessionBrowserState";

class ThrowingStorage implements Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> {
  getItem(): string | null {
    throw new Error("blocked");
  }
  setItem(): void {
    throw new Error("blocked");
  }
  removeItem(): void {
    throw new Error("blocked");
  }
}

describe("workSessionBrowserState", () => {
  it("fails soft when browser storage is unavailable", () => {
    const storage = new ThrowingStorage();
    expect(readActiveSessionId(storage)).toBeNull();
    expect(() => writeActiveSessionId(storage, "session-1")).not.toThrow();
  });

  it("stores only the active session id", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    writeActiveSessionId(storage, "session-1");
    expect(readActiveSessionId(storage)).toBe("session-1");
    expect([...values.values()]).toEqual(["session-1"]);
  });
});
