#!/usr/bin/env node
// 生成 docs/planning/progress-board.html —— Logix 交付进度板。
//
// 唯一真相源（本脚本只读，不写回）：
//   - docs/planning/tasks/*.md            任务 brief 的 frontmatter（status / verification）
//   - apps/api/src/modules/*/module.manifest.ts  模块身份、kind 与 depends
//   - database/migrations/                迁移数量
//   - packages/contracts/catalogs/v1/lifecycle-nodes.json  十四站主链
//   - docs/planning/PROJECT_BOOTSTRAP_CHECKLIST.md         阶段门禁勾选
//
// 产出的 HTML 是派生物：不要手工编辑，改仓库数据后重跑本脚本再发布。
// 手工维护的判断只有两处，已在下方用「人工维护」标出，改时请连证据一起改。

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceDir = join(root, "scripts");
const outputPath = join(root, "docs/planning/progress-board.html");

const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");
const listDir = (relativePath) =>
  readdirSync(join(root, relativePath), { withFileTypes: true });

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// ---------------------------------------------------------------- git 元信息

const git = (args, fallback) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
};

const commit = git(["rev-parse", "--short", "HEAD"], "未知");
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], "未知");
const dirty = git(["status", "--porcelain"], "") !== "";
const remote = git(["remote", "get-url", "origin"], "");
const repoUrl = (() => {
  const match = remote.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);
  return match ? `https://github.com/${match[1]}/${match[2]}` : null;
})();
const blame = (relativePath) => {
  if (!repoUrl) return `<span class="mono">${esc(relativePath)}</span>`;
  return `<a href="${repoUrl}/blob/${commit}/${relativePath}">${esc(relativePath)}</a>`;
};

// ------------------------------------------------------------ 任务 brief

const parseFrontmatter = (source) => {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return {};
  const fields = {};
  for (const line of block[1].split(/\r?\n/)) {
    const entry = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!entry) continue;
    // 只有 status 行带 `# 取值域` 尾注，其余字段原样保留（可能含合法 # 字符）。
    const value =
      entry[1] === "status" ? entry[2].replace(/\s+#.*$/, "") : entry[2];
    fields[entry[1]] = value.trim();
  }
  return fields;
};

const tasks = listDir("docs/planning/tasks")
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .filter((entry) => !entry.name.startsWith("_"))
  .map((entry) => {
    const id = entry.name.replace(/\.md$/, "");
    const source = read(`docs/planning/tasks/${entry.name}`);
    const meta = parseFrontmatter(source);
    const heading = source.match(/^#\s+(.+)$/m);
    const title = (heading ? heading[1] : id)
      .replace(/^任务[：:]\s*/, "")
      .trim();
    const phase = (id.match(/^p(\d+)-/) || [])[1];
    return {
      id,
      title,
      status: meta.status || "unknown",
      branch: meta.branch || "",
      proof: Boolean(meta.verification && meta.verification.length),
      phase: phase ? `P${phase}` : "—",
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const byStatus = (status) =>
  tasks.filter((task) => task.status === status).length;
const STATUS_ORDER = ["done", "coding", "review", "fix", "blocked", "design"];

// 状态色永远配字形与文字，颜色不单独承载含义（见 dataviz 状态色规则）。
const TASK_STATUS = {
  done: { s: "done", glyph: "✓", label: "完成" },
  coding: { s: "active", glyph: "◐", label: "进行中" },
  review: { s: "active", glyph: "◑", label: "评审" },
  fix: { s: "active", glyph: "◒", label: "修正" },
  blocked: { s: "blocked", glyph: "✕", label: "阻塞" },
  design: { s: "idle", glyph: "○", label: "设计" },
};

// ---------------------------------------------------------------- 模块

const LAYER_DEFS = [
  {
    id: "platform",
    title: "基座 · 平台",
    blurb: "始终启用，与业务无关的支撑面；业务模块不得绕过。",
  },
  {
    id: "chain",
    title: "主链核",
    blurb: "货柜对象、生命周期状态机与任务工单聚合的持有者。",
  },
  {
    id: "incremental",
    title: "增量业务",
    blurb: "按产品阶段启用，各自持有专业事实并经公开端口协作。",
  },
];

// 人工维护：MODULE_PLUGIN_CONVENTION §3 把 kind: "base" 分成平台与主链核两类。
// 下面的守卫保证：新出现的 base 模块若未归类，生成直接失败，不会静默漏掉。
const PLATFORM_MODULES = [
  "identity",
  "audit",
  "master-data",
  "notification",
  "workflow",
  "exception-management",
];
const CHAIN_MODULES = [
  "shipment-registry",
  "lifecycle-control",
  "work-execution",
];

const walk = (dir) => {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
};

const parseManifest = (source) => ({
  kind: (source.match(/\bkind:\s*"([^"]+)"/) || [])[1] || "unknown",
  depends: [
    ...((source.match(/\bdepends:\s*\[([\s\S]*?)\]/) || [])[1] || "").matchAll(
      /"([^"]+)"/g,
    ),
  ].map((match) => match[1]),
});

const modules = listDir("apps/api/src/modules")
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const id = entry.name;
    const dir = join(root, "apps/api/src/modules", id);
    const manifestPath = join(dir, "module.manifest.ts");
    if (!existsSync(manifestPath)) {
      throw new Error(`模块 ${id} 缺少 module.manifest.ts，无法判定分层`);
    }
    const manifest = parseManifest(readFileSync(manifestPath, "utf8"));
    const files = walk(dir).filter((file) => file.endsWith(".ts"));
    const source = files.filter((file) => !file.endsWith(".test.ts"));
    const tests = files.length - source.length;
    const lines = source.reduce(
      (total, file) => total + readFileSync(file, "utf8").split("\n").length,
      0,
    );
    const hasDomain = existsSync(join(dir, "domain"));
    const hasApplication = existsSync(join(dir, "application"));

    let state = "built";
    if (!hasDomain && !hasApplication)
      state = lines < 60 ? "empty" : "skeleton";

    let layer;
    if (manifest.kind === "base") {
      if (PLATFORM_MODULES.includes(id)) layer = "platform";
      else if (CHAIN_MODULES.includes(id)) layer = "chain";
      else {
        throw new Error(
          `base 模块 ${id} 未归类。请在 build-progress-board.mjs 的 PLATFORM_MODULES / CHAIN_MODULES 中登记（依据 MODULE_PLUGIN_CONVENTION §3）。`,
        );
      }
    } else {
      layer = "incremental";
    }

    return {
      id,
      ...manifest,
      files: source.length,
      tests,
      lines,
      state,
      layer,
    };
  })
  .sort((a, b) => b.lines - a.lines);

const maxLines = Math.max(...modules.map((module) => module.lines));

const MODULE_STATE = {
  built: { s: "done", glyph: "●", label: "成形" },
  skeleton: { s: "active", glyph: "◐", label: "骨架" },
  empty: { s: "idle", glyph: "○", label: "未开工" },
};

// ------------------------------------------------------------ 十四站主链

// 人工维护：节点 ← 喂事实的专业模块。state 取值见下方 STATION_STATE。
const NODE_INFO = {
  cargo_ready: {
    cn: "备货就绪",
    state: "wired",
    by: "建柜展开 + 导入时间事实",
  },
  container_stuffing: {
    cn: "工厂装箱",
    state: "wired",
    by: "work-execution 申请 stuffed",
  },
  shipment_dispatch: {
    cn: "出运",
    state: "wired",
    by: "work-execution 申请 loaded",
  },
  origin_departure: {
    cn: "离港",
    state: "wired",
    by: "work-execution 申请 departed",
  },
  ocean_transit: { cn: "海运在途", state: "wired", by: "departed 后自动激活" },
  transshipment: { cn: "中转", state: "none", by: "无专业模块承接" },
  customs_clearance: { cn: "清关", state: "none", by: "无专业模块承接" },
  destination_arrival: { cn: "到港", state: "none", by: "无专业模块承接" },
  rail_transfer: { cn: "铁路转运", state: "none", by: "无专业模块承接" },
  container_pickup: {
    cn: "提柜",
    state: "partial",
    by: "inland 计划 + 最晚提柜日，事实靠人工",
  },
  warehouse_delivery: {
    cn: "送仓",
    state: "partial",
    by: "inland 提送卸还计划，事实靠人工",
  },
  container_unloading: {
    cn: "卸柜",
    state: "partial",
    by: "inland 提送卸还计划，事实靠人工",
  },
  container_unstuffing: {
    cn: "卸空",
    state: "partial",
    by: "导入时间事实已有槽位",
  },
  empty_return: {
    cn: "还箱",
    state: "partial",
    by: "inland 计划 + 最晚还箱日，事实靠人工",
  },
};

const STATION_STATE = {
  wired: { s: "done", glyph: "●", label: "已通" },
  partial: { s: "active", glyph: "◐", label: "仅有计划" },
  none: { s: "idle", glyph: "○", label: "无模块" },
};

const catalog = JSON.parse(
  read("packages/contracts/catalogs/v1/lifecycle-nodes.json"),
);
const stations = catalog
  .slice()
  .sort((a, b) => a.sequence - b.sequence)
  .map((node) => {
    const info = NODE_INFO[node.nodeCode];
    if (!info) {
      throw new Error(
        `节点 ${node.nodeCode} 不在 NODE_INFO 中。新增节点后请在 build-progress-board.mjs 补上中文名与承接模块。`,
      );
    }
    return {
      seq: node.sequence,
      code: node.nodeCode,
      applicability: node.applicability,
      ...info,
    };
  });

const countStation = (state) =>
  stations.filter((station) => station.state === state).length;

// ------------------------------------------------------------ 阶段门禁

const checklist = read("docs/planning/PROJECT_BOOTSTRAP_CHECKLIST.md");
const sectionPattern = /^##\s+\d+\.\s+(?:(P\d)\s+(.+?)|(横向持续任务))\s*$/gm;
const sections = [...checklist.matchAll(sectionPattern)].map(
  (match, index, all) => {
    const start = match.index + match[0].length;
    const end =
      index + 1 < all.length ? all[index + 1].index : checklist.length;
    const body = checklist.slice(start, end);
    const tally = (mark) =>
      (body.match(new RegExp(`^- \\[${mark}\\]`, "gm")) || []).length;
    const done = tally("x");
    const na = tally("-");
    const partial = tally("~");
    const todo = tally(" ");
    return {
      id: match[1] || "C",
      name: match[1] ? match[2].trim() : match[3],
      done,
      na,
      partial,
      todo,
      total: done + na + partial + todo,
    };
  },
);

for (const section of sections) {
  const settled = section.done + section.na;
  section.settled = settled;
  section.ratio = section.total ? settled / section.total : 0;
  section.ledgerDone = tasks.filter(
    (task) => task.phase === section.id && task.status === "done",
  ).length;
  section.desynced = settled === 0 && section.ledgerDone > 0;
}

const checklistSettled = sections.reduce(
  (total, section) => total + section.settled,
  0,
);
const checklistTotal = sections.reduce(
  (total, section) => total + section.total,
  0,
);

// ---------------------------------------------------------------- 落差

// 人工维护：这几条是对照仓库后写下的判断，不是算出来的。改时请连证据一起改。
const gaps = [
  {
    sev: "high",
    title: "启动清单已失真，不再是可信的进度源",
    body: [
      `P6 一节 14 项全部未勾，而 <code>tasks/</code> 下 p6-* 已有 ${tasks.filter((t) => t.phase === "P6" && t.status === "done").length} 条 done。第 15 节「建议立即推进」仍写着下一条主线是 P5-02 OIDC，而该任务已经完成。`,
      `要么重写清单，要么在顶部声明进度以 tasks frontmatter 为准、清单只作阶段门禁——现在两份口径并列，读者无法判断信哪个。`,
    ],
  },
  {
    sev: "high",
    title: `${modules.filter((m) => m.state === "empty").length} 个模块是空壳，其中 5 个是核心`,
    body: [
      `尤其 ${blame("apps/api/src/modules/audit")}（动作授权的落点）与 ${blame("apps/api/src/modules/master-data")}（港口/船司/仓库主数据）。没有主数据，节点事实无法归一；没有审计，高风险写操作不能上。`,
    ],
  },
  {
    sev: "mid",
    title: "P2 门禁大面积未勾，但实现已经跑在前面",
    body: [
      `P2-01/02/03/06/07/08/09/10/11/12 未勾，对应文档却都是「候选 v0.5」。含义是设计稿有、负责人评审没走完，代码先跑了——后续契约反复改的概率留在这里。`,
    ],
  },
  {
    sev: "mid",
    title: "AI 面是通路建好、模型没接",
    body: [
      `导入映射建议走的是 Python 关键词规则（<code>suggest_mapping_handler</code> 自述「Mock 关键词规则，不调模型」），LiteLLM / Langfuse / OTel 未启用，P7 评测为零。如果对外说法里有「AI 智能导入」，目前名不副实。`,
    ],
  },
  {
    sev: "low",
    title: "状态标注不一致，需要一次收口",
    body: [
      `文档索引写 <code>p6-pipeline-task-pool</code> 是「实施中」，其 frontmatter 是 <code>blocked</code>（原因：串行槽位让给了通知助手），且验收项 <code>pnpm validate</code> 仍未勾。`,
    ],
  },
];

// ---------------------------------------------------------------- 渲染

const tile = (label, value, unit, note) =>
  `<div class="tile"><span class="tile-label">${esc(label)}</span><span class="tile-value">${esc(value)}${
    unit ? `<span class="unit">${esc(unit)}</span>` : ""
  }</span><span class="tile-note">${note}</span></div>`;

const tiles = [
  tile(
    "后端模块",
    String(modules.length),
    "",
    `${modules.filter((m) => m.kind === "base").length} 基座 · ${modules.filter((m) => m.kind !== "base").length} 增量`,
  ),
  tile(
    "空壳模块",
    String(modules.filter((m) => m.state === "empty").length),
    "",
    "只有清单、入口与模块文件",
  ),
  tile(
    "任务台账",
    String(tasks.length),
    "",
    `${byStatus("done")} 完成 · ${byStatus("coding")} 进行中 · ${byStatus("blocked")} 阻塞`,
  ),
  tile(
    "主链已通",
    `${countStation("wired")} / ${stations.length}`,
    "",
    `${countStation("partial")} 站仅有计划，${countStation("none")} 站无模块`,
  ),
  tile(
    "数据库迁移",
    String(
      listDir("database/migrations").filter((e) => e.isDirectory()).length,
    ),
    "",
    "单一 Prisma 入口",
  ),
  tile(
    "清单已了结",
    `${checklistSettled} / ${checklistTotal}`,
    "",
    "与任务台账口径不同步",
  ),
].join("\n        ");

const moduleRow = (module) => {
  const meta = MODULE_STATE[module.state];
  const width = Math.max(1, Math.round((module.lines / maxLines) * 100));
  return `<tr>
            <td class="mod-name">${esc(module.id)}<span class="mono">${esc(module.kind)}</span></td>
            <td>
              <span class="size">
                <span class="size-track"><span class="size-fill" style="--w:${width}%"></span></span>
                <span class="size-num">${module.lines.toLocaleString("en-US")} 行</span>
              </span>
            </td>
            <td class="num">${module.tests || "—"}</td>
            <td class="deps">${module.depends.length ? esc(module.depends.join(", ")) : "—"}</td>
            <td>
              <span class="chip" data-s="${meta.s}"><span class="glyph">${meta.glyph}</span>${meta.label}</span>
            </td>
          </tr>`;
};

const layers = LAYER_DEFS.map((layer) => {
  const members = modules.filter((module) => module.layer === layer.id);
  return `<div class="layer">
        <div class="layer-head">
          <h3>${esc(layer.title)}</h3>
          <p>${esc(layer.blurb)}</p>
        </div>
        <div class="panel" style="overflow-x: auto">
          <table>
            <thead>
              <tr>
                <th>模块</th>
                <th>规模</th>
                <th class="num">测试</th>
                <th>依赖</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              ${members.map(moduleRow).join("\n              ")}
            </tbody>
          </table>
        </div>
      </div>`;
}).join("\n      ");

const rail = stations
  .map((station) => {
    const meta = STATION_STATE[station.state];
    return `<li class="station" data-state="${station.state}">
          <span class="station-head">
            <span class="station-seq">${String(station.seq).padStart(2, "0")}</span>
            <span class="station-cn">${esc(station.cn)}</span>
            <span class="station-code">${esc(station.code)}</span>
            <span class="chip" data-s="${meta.s}"><span class="glyph">${meta.glyph}</span>${meta.label}</span>
          </span>
          <span class="station-by">${esc(station.by)}</span>
        </li>`;
  })
  .join("\n        ");

const phases = sections
  .map((section) => {
    const note = section.desynced
      ? `<span class="flag">清单未同步</span> · 台账已 ${section.ledgerDone} 完成`
      : section.ledgerDone
        ? `台账 ${section.ledgerDone} 完成`
        : "台账无对应任务";
    const parts = [`${section.done} 完成`];
    if (section.partial) parts.push(`${section.partial} 部分`);
    if (section.na) parts.push(`${section.na} 不适用`);
    if (section.todo) parts.push(`${section.todo} 未开始`);
    return `<li class="phase">
          <span class="phase-id">${esc(section.id)}</span>
          <span class="phase-name">${esc(section.name)}</span>
          <span class="meter" role="img" aria-label="${esc(`${section.settled} / ${section.total} 已了结`)}"><span class="meter-fill" style="--w:${Math.round(section.ratio * 100)}%"></span></span>
          <span class="phase-num">${section.settled}/${section.total}</span>
          <span class="phase-note">${note} · ${esc(parts.join("，"))}</span>
        </li>`;
  })
  .join("\n        ");

const statusChip = (status) => {
  const meta = TASK_STATUS[status] || { s: "idle", glyph: "?", label: status };
  return `<span class="chip" data-s="${meta.s}"><span class="glyph">${meta.glyph}</span>${esc(meta.label)}</span>`;
};

const ledger = tasks
  .map(
    (
      task,
    ) => `<tr data-status="${esc(task.status)}" data-id="${esc(task.id)}" data-phase="${esc(task.phase)}" data-text="${esc(
      `${task.id} ${task.title} ${task.branch}`.toLowerCase(),
    )}">
            <td class="id">${esc(task.id)}</td>
            <td class="title">${esc(task.title)}</td>
            <td>${statusChip(task.status)}</td>
            <td class="phase mono">${esc(task.phase)}</td>
            <td class="proof">${task.proof ? '<span class="tick" title="frontmatter 带 verification">✓</span>' : '<span class="dash">—</span>'}</td>
          </tr>`,
  )
  .join("\n          ");

const filterChip = (value, label, tally) =>
  `<button class="fchip" type="button" data-filter="${value}" aria-pressed="${value === "all"}">${esc(label)}<span class="tally">${tally}</span></button>`;

const filters = [
  filterChip("all", "全部", tasks.length),
  ...STATUS_ORDER.filter((status) => byStatus(status) > 0).map((status) =>
    filterChip(status, TASK_STATUS[status].label, byStatus(status)),
  ),
].join("\n      ");

const gapItems = gaps
  .map(
    (gap) => `<li class="gap" data-sev="${gap.sev}">
          <span class="chip" data-s="${gap.sev === "high" ? "blocked" : gap.sev === "mid" ? "active" : "idle"}"><span class="glyph">${
            gap.sev === "high" ? "✕" : gap.sev === "mid" ? "◐" : "○"
          }</span>${gap.sev === "high" ? "高" : gap.sev === "mid" ? "中" : "低"}</span>
          <div class="gap-body">
            <h3>${esc(gap.title)}</h3>
            ${gap.body.map((paragraph) => `<p>${paragraph}</p>`).join("\n            ")}
          </div>
        </li>`,
  )
  .join("\n      ");

const doneWithoutProof = tasks.filter(
  (task) => task.status === "done" && !task.proof,
);

const template = readFileSync(
  join(sourceDir, "progress-board.template.html"),
  "utf8",
);
const html = template
  .replace("<!--__META__-->", () =>
    [
      [
        "生成于",
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
      ],
      ["提交", commit + (dirty ? "（含未提交改动）" : "")],
      ["分支", branch],
      ["数据源", `${tasks.length} 份任务 brief · ${modules.length} 份模块清单`],
    ]
      .map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`)
      .join("\n      "),
  )
  .replace("<!--__TILES__-->", () => tiles)
  .replace(
    "<!--__MODULE_NOTE__-->",
    () => `${modules.length} 个模块 · 按代码行数排序`,
  )
  .replace("<!--__MODULES__-->", () => layers)
  .replace(
    "<!--__CHAIN_NOTE__-->",
    () =>
      `${countStation("wired")} 已通 · ${countStation("partial")} 仅有计划 · ${countStation("none")} 无模块`,
  )
  .replace("<!--__RAIL__-->", () => rail)
  .replace(
    "<!--__PHASE_NOTE__-->",
    () => `${checklistSettled} / ${checklistTotal} 项已了结`,
  )
  .replace("<!--__PHASES__-->", () => phases)
  .replace("<!--__FILTERS__-->", () => filters)
  .replace(
    "<!--__LEDGER_NOTE__-->",
    () =>
      `${tasks.length} 条 · ${byStatus("done")} 完成${
        doneWithoutProof.length
          ? ` · ${doneWithoutProof.length} 条缺验证证据`
          : ""
      }`,
  )
  .replace("<!--__TASKS__-->", () => ledger)
  .replace("<!--__GAP_NOTE__-->", () => `${gaps.length} 条`)
  .replace("<!--__GAPS__-->", () => gapItems)
  .replace(
    "<!--__FOOTER_NOTE__-->",
    () =>
      `本页由 ${blame("scripts/build-progress-board.mjs")} 从仓库生成，快照取自 <span class="mono">${esc(commit)}</span>。frontmatter 变了要重跑生成再发布，页面本身不会自己去读仓库。`,
  );

for (const placeholder of html.match(/<!--__[A-Z_]+__-->/g) || []) {
  throw new Error(`模板占位符未被替换：${placeholder}`);
}

writeFileSync(outputPath, html, "utf8");

const flag = sections
  .filter((section) => section.desynced)
  .map((section) => section.id);
console.log(
  `进度板已生成：docs/planning/progress-board.html（${modules.length} 模块 / ${tasks.length} 任务 / ${stations.length} 节点${flag.length ? ` / 清单未同步：${flag.join("、")}` : ""}）`,
);
if (doneWithoutProof.length) {
  console.log(
    `注意：${doneWithoutProof.length} 条 done 任务缺少 verification 证据：`,
  );
  for (const task of doneWithoutProof) console.log(`  - ${task.id}`);
}
