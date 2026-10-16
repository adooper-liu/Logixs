import { describe, expect, it, vi } from "vitest";
import { collectCursorPages } from "./useStuffingWorkbench";

describe("collectCursorPages", () => {
  it("reads every cursor page in order", async () => {
    const load = vi.fn(async (cursor?: string) =>
      cursor
        ? {
            items: ["third"],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }
        : {
            items: ["first", "second"],
            pageInfo: { hasNextPage: true, nextCursor: "cursor-2" },
          },
    );

    await expect(collectCursorPages(load)).resolves.toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(load).toHaveBeenNthCalledWith(1, undefined);
    expect(load).toHaveBeenNthCalledWith(2, "cursor-2");
  });

  it.each([{ nextCursor: null }, { nextCursor: "same" }])(
    "fails closed on an invalid cursor chain",
    async ({ nextCursor }) => {
      const load = vi.fn(async (cursor?: string) => ({
        items: [cursor ?? "first"],
        pageInfo: {
          hasNextPage: true,
          nextCursor: cursor ? "same" : nextCursor,
        },
      }));

      await expect(collectCursorPages(load)).rejects.toThrow(
        "PAGINATION_CURSOR_INVALID",
      );
    },
  );
});
