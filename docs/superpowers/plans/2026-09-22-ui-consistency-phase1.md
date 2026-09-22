# UI 一致性收编与防漂门禁 · 阶段 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 立起排版与间距令牌，装上自研的样式比例门禁（带存量基线，CI 保持绿），并迁完侧栏 —— 侧栏在每一页都出现，那一个 `gap:10px` 的全站影响面最大。

**Architecture:** 令牌加在既有的 `themes/logix/tokens.css`；门禁做成 `scripts/check-repository.mjs` 里的一个纯函数 `findStyleScaleViolations(records, baseline)`，与既有 `findUiThemeBoundaryViolations` 同构，挂在 `pnpm repo:check`（已在 CI 第 107 行）。存量违规写进 `scripts/style-scale-baseline.json`，检查器按**文件计数**比对基线：**不超基线放行，超了报错** —— 这样存量可逐页收敛，而新代码写不进新漂移。

**Tech Stack:** 纯 Node ESM（无新依赖）· `node:test` + `node:assert/strict` · Vue 3 scoped CSS · pnpm + turbo

**Spec:** `docs/superpowers/specs/2026-09-22-ui-consistency-and-drift-guard-design.md`

## Global Constraints

- **零新依赖。** 不引入 stylelint 或任何 CSS 解析库。
- **字号 6 档**（spec D3）：`--text-page 20px` `--text-title 15px` `--text-body 14px` `--text-meta 13px` `--text-label 12px` `--text-micro 11px`。
- **间距 7 档**（spec D4）：`--space-1 4px` `--space-2 8px` `--space-3 12px` `--space-4 16px` `--space-5 20px` `--space-6 24px` `--space-8 32px`。
- **`--text-micro` 只允许用于非必读元数据**（表头日期、轨道摘要、编号）；正文、标签、按钮禁用。
- **不新增任何"旧值 → 新值"的 px 别名**（如 `--space-10: 10px`）—— 那会让越界值合法化，门禁形同虚设。
- **豁免必须写理由且理由 ≥ 4 字**：`/* style-scale-exempt: 与 1px 边框对齐 */`。
- **基线只减不增。**
- 提交信息用中文，动词开头。
- 门禁命令：`pnpm repo:check`（= `node scripts/check-repository.mjs`）；单测 `pnpm test`（根，跑 `node --test scripts/check-repository.test.mjs`）。
- 前端回归：`pnpm --filter @logix/web validate`（lint / format / typecheck / test / e2e / build）。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `apps/web/src/themes/logix/tokens.css` | **改**：新增 6 个排版令牌 + 7 个间距令牌 |
| `scripts/check-repository.mjs` | **改**：新增 `STYLE_SCALE_TOKENS`、`findMissingStyleScaleTokens`、`findStyleScaleViolations`；主流程联入；新增 `--write-style-baseline` 生成模式 |
| `scripts/check-repository.test.mjs` | **改**：新增 8 类用例 |
| `scripts/style-scale-baseline.json` | **建**：存量违规基线（由生成模式产出，不手写） |
| `apps/web/src/styles/base.css` | **改**：`font-family: inherit` → `font: inherit`，修掉全站按钮 `13.3333px` |
| `apps/web/src/components/shell/AppSidebar.vue` | **改**：全部越界字号/间距换令牌 |
| `docs/product/UI_SYSTEM.md` | **改**：§7.2 / §7.3 补令牌名与 `--text-micro` 边界 |

---

### Task 1: 新增排版与间距令牌

**Files:**
- Modify: `apps/web/src/themes/logix/tokens.css`
- Modify: `scripts/check-repository.mjs`（新增 `STYLE_SCALE_TOKENS` 与 `findMissingStyleScaleTokens`）
- Test: `scripts/check-repository.test.mjs`

**Interfaces:**
- Produces: `STYLE_SCALE_TOKENS: string[]`（导出的令牌名清单）、`findMissingStyleScaleTokens(source: string): string[]`

- [ ] **Step 1: 写失败测试**

在 `scripts/check-repository.test.mjs` 的 import 块里加入 `findMissingStyleScaleTokens`（与既有 `findUiThemeBoundaryViolations` 同一行组），并追加：

```js
test("requires every style scale token to be defined", () => {
  assert.deepEqual(
    findMissingStyleScaleTokens(`
      :root[data-ui-theme="logix"] {
        --text-page: 20px;
        --text-title: 15px;
        --text-body: 14px;
        --space-1: 4px;
      }
    `),
    [
      "tokens.css 缺少 --text-meta",
      "tokens.css 缺少 --text-label",
      "tokens.css 缺少 --text-micro",
      "tokens.css 缺少 --space-2",
      "tokens.css 缺少 --space-3",
      "tokens.css 缺少 --space-4",
      "tokens.css 缺少 --space-5",
      "tokens.css 缺少 --space-6",
      "tokens.css 缺少 --space-8",
    ],
  );
});

test("accepts a complete style scale token set", () => {
  const complete = [
    "--text-page: 20px",
    "--text-title: 15px",
    "--text-body: 14px",
    "--text-meta: 13px",
    "--text-label: 12px",
    "--text-micro: 11px",
    "--space-1: 4px",
    "--space-2: 8px",
    "--space-3: 12px",
    "--space-4: 16px",
    "--space-5: 20px",
    "--space-6: 24px",
    "--space-8: 32px",
  ].join(";\n");
  assert.deepEqual(findMissingStyleScaleTokens(complete), []);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test`
Expected: FAIL —— `findMissingStyleScaleTokens is not a function`

- [ ] **Step 3: 定义令牌清单与检查函数**

在 `scripts/check-repository.mjs` 里，`findUiThemeBoundaryViolations` **之前**插入：

```js
// 排版与间距的唯一合法档位。页面只能用这些令牌，不得写裸 px。
// 权威：docs/product/UI_SYSTEM.md §7.2 / §7.3（本清单是它们的可执行副本）。
export const STYLE_SCALE_TOKENS = [
  "--text-page",
  "--text-title",
  "--text-body",
  "--text-meta",
  "--text-label",
  "--text-micro",
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-5",
  "--space-6",
  "--space-8",
];

export function findMissingStyleScaleTokens(tokensSource) {
  return STYLE_SCALE_TOKENS.filter(
    (token) => !new RegExp(`${token}\\s*:`).test(tokensSource),
  ).map((token) => `tokens.css 缺少 ${token}`);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test`
Expected: PASS（新增 2 条 + 全部既有）

- [ ] **Step 5: 加令牌**

在 `apps/web/src/themes/logix/tokens.css` 的 `--disabled: #b9c3d2;` 之后、`--font-sans` 之前插入：

```css
  /* 排版：收编 UI_SYSTEM §7.2 的档位。页面只能用这些，不得写裸 px。 */
  --text-page: 20px;
  --text-title: 15px;
  --text-body: 14px;
  --text-meta: 13px;
  --text-label: 12px;
  --text-micro: 11px;

  /* 间距：收编 UI_SYSTEM §7.3 的比例。 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
```

> **只加在 `:root[data-ui-theme="logix"]` 块内。** 字号与间距与主题无关，**不要**在 `[data-theme="dark"]` 块里重复定义。

- [ ] **Step 6: 把令牌齐备检查接进主流程**

在 `runRepositoryChecks` 的非 docsOnly 分支里，`findUiThemeBoundaryViolations(...)` 那一段**之后**追加：

```js
      ...findMissingStyleScaleTokens(
        readFileSync(
          resolve(repositoryRoot, "apps/web/src/themes/logix/tokens.css"),
          "utf8",
        ),
      ),
```

- [ ] **Step 7: 验证门禁通过**

Run: `pnpm repo:check`
Expected: `Repository policy checks passed.`

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/themes/logix/tokens.css scripts/check-repository.mjs scripts/check-repository.test.mjs
git commit -m "feat(web): 新增排版与间距令牌，并加令牌齐备自检"
```

---

### Task 2: 样式比例检查器核心

**Files:**
- Modify: `scripts/check-repository.mjs`
- Test: `scripts/check-repository.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `STYLE_SCALE_TOKENS`
- Produces: `findStyleScaleViolations(records: {path: string; source: string}[], baseline?: {files?: Record<string, number>}): string[]`

- [ ] **Step 1: 写失败测试**

在 `scripts/check-repository.test.mjs` 追加（注意 `import` 块要加 `findStyleScaleViolations`）：

```js
test("rejects literal font sizes and off-scale spacing", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Demo.vue",
        source: `<template><div /></template>
<style scoped>
.a { font-size: 14px; padding: 10px; }
.b { font-size: var(--text-body); padding: var(--space-3); }
</style>`,
      },
    ]),
    [
      "apps/web/src/views/Demo.vue: font-size 必须用 var(--text-*) 令牌，当前为 '14px'",
      "apps/web/src/views/Demo.vue: padding 必须用 4/8/12/16/20/24/32 的 var(--space-*) 令牌，当前为 '10px'",
    ],
  );
});

test("accepts tokens, zero, auto and calc over space tokens", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Ok.vue",
        source: `<style scoped>
.a { margin: 0 auto; gap: var(--space-2); padding: var(--space-1) var(--space-3); }
.b { margin-top: calc(var(--space-2) * -1); }
</style>`,
      },
    ]),
    [],
  );
});

test("checks every part of a shorthand（裸 px 一律不认，含在档上的 12px）", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Short.vue",
        source: "<style scoped>\n.a { margin: 12px 10px 6px; }\n</style>",
      },
    ]),
    [
      "apps/web/src/views/Short.vue: margin 必须用 4/8/12/16/20/24/32 的 var(--space-*) 令牌，当前为 '12px'",
      "apps/web/src/views/Short.vue: margin 必须用 4/8/12/16/20/24/32 的 var(--space-*) 令牌，当前为 '10px'",
      "apps/web/src/views/Short.vue: margin 必须用 4/8/12/16/20/24/32 的 var(--space-*) 令牌，当前为 '6px'",
    ],
  );
});

test("catches declarations packed onto one line", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Packed.vue",
        source:
          "<style scoped>\n.a { position: relative; font-size: 10px; gap: 10px; }\n</style>",
      },
    ]),
    [
      "apps/web/src/views/Packed.vue: font-size 必须用 var(--text-*) 令牌，当前为 '10px'",
      "apps/web/src/views/Packed.vue: gap 必须用 4/8/12/16/20/24/32 的 var(--space-*) 令牌，当前为 '10px'",
    ],
  );
});

test("accepts an exemption that states a reason", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Ok.vue",
        source:
          "<style scoped>\n.a { margin-top: -1px; /* style-scale-exempt: 与 1px 边框对齐 */ }\n</style>",
      },
    ]),
    [],
  );
});

test("rejects an exemption without a real reason", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Bad.vue",
        source:
          "<style scoped>\n.a { margin-top: -1px; /* style-scale-exempt: 先这样 */ }\n</style>",
      },
    ]),
    [
      "apps/web/src/views/Bad.vue: 豁免必须写明理由（≥4 字），当前为 '先这样'",
    ],
  );
});

test("ignores token definitions, tests and non-web files", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/themes/logix/tokens.css",
        source: ":root { --space-9: 36px; font-size: 10px; }",
      },
      {
        path: "apps/web/src/views/Demo.test.ts",
        source: "const a = 'font-size: 10px';",
      },
      {
        path: "docs/notes.md",
        source: "font-size: 10px",
      },
    ]),
    [],
  );
});

test("allows within-baseline counts and rejects going over", () => {
  const record = {
    path: "apps/web/src/views/Legacy.vue",
    source: "<style scoped>\n.a { font-size: 10px; }\n</style>",
  };
  assert.deepEqual(
    findStyleScaleViolations([record], { files: { "apps/web/src/views/Legacy.vue": 1 } }),
    [],
  );
  assert.deepEqual(
    findStyleScaleViolations([record], { files: { "apps/web/src/views/Legacy.vue": 0 } }),
    [
      "apps/web/src/views/Legacy.vue: font-size 必须用 var(--text-*) 令牌，当前为 '10px'",
    ],
  );
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test`
Expected: FAIL —— `findStyleScaleViolations is not a function`

- [ ] **Step 3: 实现检查器**

在 `scripts/check-repository.mjs` 的 `findMissingStyleScaleTokens` **之后**插入：

```js
const TEXT_TOKEN_VALUE = /^var\(--text-(?:page|title|body|meta|label|micro)\)$/;
const SPACE_TOKEN_VALUE = /^var\(--space-(?:1|2|3|4|5|6|8)\)$/;
const SPACING_PROPERTIES = new Set([
  "gap",
  "row-gap",
  "column-gap",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
]);
const EXEMPTION_COMMENT = /\/\*\s*style-scale-exempt:\s*(.*?)\s*\*\//;
const MIN_EXEMPTION_REASON_LENGTH = 4;

function styleBlocksOf(record) {
  const path = normalizePath(record.path);
  if (path.endsWith(".css")) return [record.source];
  if (!path.endsWith(".vue")) return [];
  return [...record.source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
    (match) => match[1],
  );
}

function isAllowedSpacingPart(part) {
  if (part === "0" || part === "auto") return true;
  if (part.endsWith("%")) return true;
  return SPACE_TOKEN_VALUE.test(part);
}

// 把整个 calc(...) 折叠成一个可判定片段，避免其中的空格被当成多个值拆开。
// 括号要配对计数：calc(var(--space-2) * -1) 里有嵌套括号。
// 内部含 var(--space-*) 的 calc 视为合法，否则原样保留（让它照常报错）。
function foldCalcExpressions(value) {
  let out = "";
  let index = 0;
  while (index < value.length) {
    if (!value.startsWith("calc(", index)) {
      out += value[index];
      index += 1;
      continue;
    }
    let depth = 0;
    let end = index + 4;
    for (; end < value.length; end += 1) {
      if (value[end] === "(") depth += 1;
      else if (value[end] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const expression = value.slice(index, end + 1);
    out += expression.includes("var(--space-") ? "0" : expression;
    index = end + 1;
  }
  return out;
}

// 扫描 web 源码里的裸 px 字号与越界间距。
// baseline.files 按文件记存量违规数：不超基线放行，超了报错 —— 存量可收敛，新漂移写不进来。
export function findStyleScaleViolations(records, baseline = { files: {} }) {
  const allowedCounts = baseline?.files ?? {};
  const errors = [];
  const violationsByPath = new Map();

  for (const record of records) {
    const path = normalizePath(record.path);
    if (!path.startsWith("apps/web/src/")) continue;
    if (path.endsWith("themes/logix/tokens.css")) continue;
    if (path.includes(".test.")) continue;

    const fileErrors = [];
    for (const block of styleBlocksOf(record)) {
      for (const line of block.split("\n")) {
        // 豁免按「行」判定：注释在行尾，拆声明后会与声明分开。
        const exemption = EXEMPTION_COMMENT.exec(line);
        if (exemption) {
          if (exemption[1].trim().length >= MIN_EXEMPTION_REASON_LENGTH) {
            continue;
          }
          fileErrors.push(
            `${path}: 豁免必须写明理由（≥${MIN_EXEMPTION_REASON_LENGTH} 字），当前为 '${exemption[1].trim()}'`,
          );
          continue;
        }

        // 去掉选择器：取最后一个 '{' 之后的部分，这样单行多声明
        // （.a { font-size: 14px; padding: 10px; }）也能逐条查到，
        // 不依赖「代码已被 Prettier 展开成一行一条」这个假设。
        const brace = line.lastIndexOf("{");
        const body = brace === -1 ? line : line.slice(brace + 1);

        for (const chunk of body.split(";")) {
          const declaration = /^\s*([a-z-]+)\s*:\s*(.+?)\s*\}?\s*$/.exec(chunk);
          if (!declaration) continue;
          const property = declaration[1];
          const value = declaration[2].trim();

          if (property === "font-size") {
            if (value === "inherit" || TEXT_TOKEN_VALUE.test(value)) continue;
            fileErrors.push(
              `${path}: font-size 必须用 var(--text-*) 令牌，当前为 '${value}'`,
            );
            continue;
          }

          if (!SPACING_PROPERTIES.has(property)) continue;
          for (const part of foldCalcExpressions(value).split(/\s+/)) {
            if (!part || isAllowedSpacingPart(part)) continue;
            fileErrors.push(
              `${path}: ${property} 必须用 4/8/12/16/20/24/32 的 var(--space-*) 令牌，当前为 '${part}'`,
            );
          }
        }
      }
    }

    if (!fileErrors.length) continue;
    const allowed = allowedCounts[path] ?? 0;
    if (fileErrors.length <= allowed) continue;
    violationsByPath.set(path, fileErrors);
    errors.push(...fileErrors.slice(allowed));
  }

  return errors;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test`
Expected: PASS（新增 7 条 + 全部既有）

- [ ] **Step 5: 提交**

```bash
git add scripts/check-repository.mjs scripts/check-repository.test.mjs
git commit -m "feat(scripts): 新增样式比例检查器（字号令牌 + 间距档位）"
```

---

### Task 3: 基线豁免机制与接线

**Files:**
- Create: `scripts/style-scale-baseline.json`
- Modify: `scripts/check-repository.mjs`
- Test: `scripts/check-repository.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 `findStyleScaleViolations`
- Produces: `--write-style-baseline` CLI 模式；`scripts/style-scale-baseline.json` 的 `{ note, files }` 结构

- [ ] **Step 1: 写失败测试（基线只减不增）**

在 `scripts/check-repository.test.mjs` 追加：

```js
test("style scale baseline only shrinks", () => {
  const baseline = JSON.parse(
    readFileSync(join("scripts", "style-scale-baseline.json"), "utf8"),
  );
  // 冻结快照：新增条目或调大某个计数都必须先改这里，
  // 让"把基线改大蒙混过关"在 review 里显形。
  assert.deepEqual(Object.keys(baseline.files).sort(), FROZEN_BASELINE_PATHS);
  for (const [path, count] of Object.entries(baseline.files)) {
    assert.ok(
      count <= FROZEN_BASELINE_COUNTS[path],
      `基线不得增大：${path} 从 ${FROZEN_BASELINE_COUNTS[path]} 涨到 ${count}`,
    );
  }
});
```

并在文件顶部（其他常量附近）加冻结快照 —— **由 Step 4 的生成模式产出后回填**：

```js
const FROZEN_BASELINE_PATHS = [];
const FROZEN_BASELINE_COUNTS = {};
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test`
Expected: FAIL —— 读不到 `scripts/style-scale-baseline.json`

- [ ] **Step 3: 加生成模式与接线**

在 `scripts/check-repository.mjs` 中：

a) 文件顶部常量区加：

```js
const styleBaselinePath = resolve(
  repositoryRoot,
  "scripts/style-scale-baseline.json",
);

function readStyleBaseline() {
  if (!existsSync(styleBaselinePath)) return { files: {} };
  return JSON.parse(readFileSync(styleBaselinePath, "utf8"));
}
```

> 若 `existsSync` 未在文件顶部 import，补进 `node:fs` 的 import 列表。

b) 在 `runRepositoryChecks` 的非 docsOnly 分支里，紧跟 Task 1 加的 `findMissingStyleScaleTokens(...)` 之后追加：

```js
      ...findStyleScaleViolations(
        webSourceFiles.map((path) => ({
          path: toRepositoryRelativePath(path),
          source: readFileSync(path, "utf8"),
        })),
        readStyleBaseline(),
      ),
```

c) 在文件末尾的 `isDirectRun` 分支**之前**加写入模式：

```js
function writeStyleBaseline() {
  const files = {};
  const records = walkFiles(
    resolve(repositoryRoot, "apps/web/src"),
    (path) => [".css", ".vue"].includes(extname(path).toLowerCase()),
  ).map((path) => ({
    path: toRepositoryRelativePath(path),
    source: readFileSync(path, "utf8"),
  }));
  for (const record of records) {
    const path = normalizePath(record.path);
    const count = findStyleScaleViolations(
      [{ path, source: record.source }],
      { files: {} },
    ).length;
    if (count > 0) files[path] = count;
  }
  writeFileSync(
    styleBaselinePath,
    `${JSON.stringify(
      {
        note: "样式比例迁移基线：每迁完一页就删掉对应条目；清空后删除本文件、生成模式与冻结快照。只减不增。",
        files,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`style-scale-baseline.json 已写入 ${Object.keys(files).length} 个文件`);
}
```

> `writeFileSync` 若未 import，补进 `node:fs` 的 import 列表。

d) 在 `isDirectRun` 分支里加：

```js
if (isDirectRun) {
  if (process.argv.includes("--write-style-baseline")) {
    writeStyleBaseline();
  } else {
    const errors = runRepositoryChecks({
      docsOnly: process.argv.includes("--docs-only"),
    });
    if (errors.length) {
      console.error(errors.map((error) => `- ${error}`).join("\n"));
      process.exitCode = 1;
    } else {
      console.log("Repository policy checks passed.");
    }
  }
}
```

- [ ] **Step 4: 生成基线并回填冻结快照**

Run: `node scripts/check-repository.mjs --write-style-baseline`
Expected: 输出 `style-scale-baseline.json 已写入 N 个文件`，N > 0

然后**打开 `scripts/style-scale-baseline.json`，把 `files` 的键与值逐条抄进测试文件顶部的 `FROZEN_BASELINE_PATHS`（排序后）与 `FROZEN_BASELINE_COUNTS`**。

- [ ] **Step 5: 跑测试与门禁确认通过**

Run: `pnpm test && pnpm repo:check`
Expected: 两者都 PASS —— 存量全在基线内，门禁绿

- [ ] **Step 6: 提交**

```bash
git add scripts/check-repository.mjs scripts/check-repository.test.mjs scripts/style-scale-baseline.json
git commit -m "feat(scripts): 样式比例门禁接入 CI，存量收进基线"
```

---

### Task 4: 修掉全站按钮的 13.3333px

**Files:**
- Modify: `apps/web/src/styles/base.css:24-29`

**Interfaces:**
- Consumes: 无
- Produces: 无（纯修复）

**背景**：CDP 实测定位到 34 个元素字号为 `13.3333px`，全是 `<button>` 及其继承的 svg 子节点。根因是 `base.css` 只写了 `font-family: inherit`，**没继承字号**，按钮保持 UA 默认的 13.3333px。仓库里 `.role-switcher select` 已经用了正确写法 `font: inherit`，只是没推广。

- [ ] **Step 1: 改重置**

把 `apps/web/src/styles/base.css` 的：

```css
button,
input,
select,
textarea {
  font-family: inherit;
}
```

改为：

```css
button,
input,
select,
textarea {
  font: inherit;
}
```

- [ ] **Step 2: 目视与数值双重验证**

Run:
```bash
curl -s --max-time 25 -X POST --data-raw "http://127.0.0.1:5173/tasks" "http://localhost:3456/navigate?target=$T"
```
（`$T` 为 CDP 里那个后台 tab 的 targetId；若已失效，用 `curl -s http://localhost:3456/targets` 重新取，或重新 `--browser edge` 连一次）

然后跑定位脚本：

Run:
```bash
cd /d/Logixs/.superpowers/ui-review && curl -s -X POST "http://localhost:3456/eval?target=$T" --data-binary @find1333.js
```
Expected: `count` 从 34 降到 **0**

- [ ] **Step 3: 前端回归**

Run: `pnpm --filter @logix/web validate`
Expected: 全绿。**重点看 e2e** —— `font: inherit` 会连 `line-height` 一起重置，可能影响既有按钮高度断言。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/styles/base.css
git commit -m "fix(web): 表单控件继承字号，消除 UA 默认 13.3333px"
```

---

### Task 5: 迁移侧栏

**Files:**
- Modify: `apps/web/src/components/shell/AppSidebar.vue`
- Modify: `scripts/style-scale-baseline.json`（删掉本文件的条目）
- Modify: `scripts/check-repository.test.mjs`（`FROZEN_BASELINE_PATHS` / `FROZEN_BASELINE_COUNTS` 同步删除）

**Interfaces:**
- Consumes: Task 1 的令牌、Task 3 的基线机制
- Produces: 侧栏零越界；`grep gap:10px AppSidebar.vue` 无结果

**逐处映射**（不是机械替换，每处都要判断）：

| 位置 | 现值 | 改为 | 判断依据 |
| --- | --- | --- | --- |
| `.sidebar-brand` | `gap: 10px` | `var(--space-2)` | 品牌图标与文字，8px 够 |
| `.sidebar-brand` | `padding: 0 14px` | `0 var(--space-3)` | 12px 对齐侧栏内边距 |
| `.brand-symbol` | `gap: 6px` | `var(--space-1)` | 图标与文字的紧凑组 |
| `.brand-copy b` | `font-size: 15px` | `var(--text-title)` | — |
| 四处 muted 小字 | `font-size: 10px` | `var(--text-micro)` | 辅助元数据，非必读 |
| `.workspace-switcher` | `gap: 1px` | `var(--space-1)` | 标签与名称的紧凑堆叠 |
| `.workspace-switcher` | `margin: 12px 10px 6px` | `var(--space-3) var(--space-2) var(--space-1)` | — |
| `.workspace-switcher` | `padding: 10px` | `var(--space-3)` | — |
| `.navigation` | `padding: 6px 10px` | `var(--space-1) var(--space-2)` | — |
| `.nav-item` | `gap: 10px` | `var(--space-2)` | 图标与文字的紧凑组 |
| `.nav-item` | `padding: 0 10px` | `0 var(--space-2)` | — |
| `.nav-item` | `margin-bottom: 2px` | `var(--space-1)` | 相邻项间距 |
| `.role-switcher` | `gap: 5px` | `var(--space-1)` | — |
| `.role-switcher` | `margin: 8px 10px 12px` | `var(--space-2) var(--space-2) var(--space-3)` | — |
| `.role-label > span` | `font-size: 10px` | `var(--text-micro)` | — |
| `.role-switcher select` | `padding: 0 8px` | `0 var(--space-2)` | 已在档上，改成令牌保持一致 |
| `.sidebar-footer` | `gap: 9px` | `var(--space-2)` | — |
| `.sidebar-footer` | `padding: 10px 14px` | `var(--space-3) var(--space-3)` | — |
| `.sidebar-footer span` | `font-size: 10px` | `var(--text-micro)` | 已含在上面那条共用选择器里 |

- [ ] **Step 1: 逐处替换**

按上表改 `AppSidebar.vue` 的 `<style scoped>`。**若某处改为令牌后视觉明显异常**（例如 `gap: 1px` 提到 4px 后两块粘不住），不要硬改，改为带理由的豁免：

```css
  gap: 1px; /* style-scale-exempt: 标签与名称的贴合堆叠，非间距语义 */
```

- [ ] **Step 2: 从基线里删掉侧栏**

从 `scripts/style-scale-baseline.json` 的 `files` 里删掉 `apps/web/src/components/shell/AppSidebar.vue` 这一条，并同步删掉测试文件里 `FROZEN_BASELINE_PATHS` 与 `FROZEN_BASELINE_COUNTS` 的对应项。

- [ ] **Step 3: 跑门禁 —— 这一步同时证明侧栏已归零**

Run: `pnpm repo:check`
Expected: `Repository policy checks passed.`

> 侧栏条目已从基线移除，所以**只要它还剩哪怕一处越界，这条命令就会报错**。这就是"侧栏已归零"的证明，不需要另写验证脚本。

- [ ] **Step 4: 跑门禁与测试**

Run: `pnpm repo:check && pnpm test`
Expected: 都 PASS

- [ ] **Step 5: 前端回归**

Run: `pnpm --filter @logix/web validate`
Expected: 全绿

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/components/shell/AppSidebar.vue scripts/style-scale-baseline.json scripts/check-repository.test.mjs
git commit -m "refactor(web): 侧栏迁到排版与间距令牌"
```

---

### Task 6: 文档更新、暗色实测与阶段验收

**Files:**
- Modify: `docs/product/UI_SYSTEM.md` §7.2 / §7.3
- Modify: `docs/superpowers/specs/2026-09-22-ui-consistency-and-drift-guard-design.md` §7.6 / §7.7

- [ ] **Step 1: 更新 UI_SYSTEM §7.2**

在排版小节里补令牌名，并把 `--text-micro` 的边界写进去：

```markdown
| 令牌 | 值 | 用途 |
| ---- | -- | ---- |
| `--text-page` | 20px | 页名 |
| `--text-title` | 15px | 区块标题 |
| `--text-body` | 14px | 正文 |
| `--text-meta` | 13px | 表格、元数据 |
| `--text-label` | 12px | 标签、辅助 |
| `--text-micro` | 11px | **仅限非必读元数据**（表头日期、轨道摘要、编号）；正文、标签、按钮禁用 |

页面样式必须使用以上令牌，不得写裸 px；由 `pnpm repo:check` 的样式比例门禁强制。
```

- [ ] **Step 2: 更新 UI_SYSTEM §7.3**

在间距小节里补：

```markdown
间距必须使用 `--space-1`(4) `--space-2`(8) `--space-3`(12) `--space-4`(16) `--space-5`(20) `--space-6`(24) `--space-8`(32)，
不得写裸 px；由 `pnpm repo:check` 的样式比例门禁强制。
```

- [ ] **Step 3: 暗色主题实测**

切换主题到暗色（`UiThemeProvider` 的切换入口，或给 `document.documentElement` 加 `data-theme="dark"`），对 `/tasks`、`/containers`、`/workspaces/cargo-ready` 三页重跑审计：

Run:
```bash
cd /d/Logixs/.superpowers/ui-review && curl -s -X POST "http://localhost:3456/eval?target=$T" -d '(()=>{document.documentElement.setAttribute("data-theme","dark");return document.documentElement.getAttribute("data-theme")})()'
```
然后逐页 `navigate` + `--data-binary @audit.js`。

Expected: 越界占比与浅色**同一量级**。若某页暗色显著更差，记进 spec §7.7 作为独立问题。

- [ ] **Step 4: 回填 spec 的两处未决**

- §7.6：改为已解决，写明根因是 `base.css` 的 `font-family: inherit` 未含字号，已在 Task 4 修复。
- §7.7：填入暗色实测结论（要么"与浅色同量级"，要么记录具体差距）。

- [ ] **Step 5: 提交**

```bash
git add docs/product/UI_SYSTEM.md docs/superpowers/specs/2026-09-22-ui-consistency-and-drift-guard-design.md
git commit -m "docs: 补排版与间距令牌说明，记录暗色实测结果"
```

---

## 阶段验收

- [ ] `pnpm repo:check` 通过，且基线里**已无侧栏条目**
- [ ] `pnpm test` 通过（含 10 条新增用例）
- [ ] `pnpm --filter @logix/web validate` 全绿
- [ ] CDP 实测：全站 `13.3333px` 计数为 **0**
- [ ] CDP 实测：侧栏 `gap:10px` 消失
- [ ] 暗色主题实测已记录

## 下一阶段预告（不在本计划内）

阶段 2 迁 `/workspaces/cargo-ready`（实测 54% 文字低于下限，最差）、`/dashboard`、`/tasks`。每迁一页删一条基线。全部清空后进入阶段 4：删除基线机制与冻结快照，门禁转为硬门禁。
