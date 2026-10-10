import test from "node:test";
import assert from "node:assert/strict";
import { run } from "./compile-full-chain-sample.mjs";
test("CLI requires external input arguments", async () => {
  await assert.rejects(() => run([]), /ARGUMENTS_INVALID/);
});
