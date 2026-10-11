import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("standard seed never calls the legacy demo seed", async () => {
  const source = await read("database/seed.ts");
  assert.doesNotMatch(source, /seedRealReplenishmentSample/u);
});

test("legacy demo seed has a separate package command", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.scripts["db:seed"], "tsx database/seed.ts");
  assert.equal(
    pkg.scripts["db:seed:legacy-demo"],
    "tsx database/seed-legacy-demo.ts",
  );
});
