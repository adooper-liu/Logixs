#!/usr/bin/env node
// 生成 docs/planning/progress-board.html —— Logix 交付进度板。
//
// 唯一真相源（本脚本只读，不写回）：
//   - docs/planning/tasks/*.md
//   - apps/api/src/modules/*/module.manifest.ts
//   - database/migrations/
//   - packages/contracts/catalogs/v1/lifecycle-nodes.json
//   - docs/planning/PROJECT_BOOTSTRAP_CHECKLIST.md
//
// 产出的 HTML 是派生物：不要手工编辑，改仓库数据后重跑本脚本再发布。

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildCalibrationProjection,
  normalizeTaskRecords,
  observeCheckout,
  resolveCurrentTask,
} from "./task-brief-state.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const templatePath = join(
  repositoryRoot,
  "scripts/progress-board.template.html",
);
const outputPath = join(repositoryRoot, "docs/planning/progress-board.html");

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const STATUS_ORDER = ["done", "coding", "review", "fix", "blocked", "design"];
const TASK_STATUS = {
  done: { s: "done", glyph: "✓", label: "完成" },
  coding: { s: "active", glyph: "◐", label: "进行中" },
  review: { s: "active", glyph: "◑", label: "评审" },
  fix: { s: "active", glyph: "◒", label: "修正" },
  blocked: { s: "blocked", glyph: "✕", label: "阻塞" },
  design: { s: "idle", glyph: "○", label: "设计" },
};
const MODULE_STATE = {
  built: { s: "done", glyph: "●", label: "成形" },
  skeleton: { s: "active", glyph: "◐", label: "骨架" },
  empty: { s: "idle", glyph: "○", label: "未开工" },
};
const STATION_STATE = {
  wired: { s: "done", glyph: "●", label: "已通" },
  partial: { s: "active", glyph: "◐", label: "仅有计划" },
  none: { s: "idle", glyph: "○", label: "无模块" },
};
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

const repositoryUrl = (remote) => {
  const match = remote.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);
  return match ? `https://github.com/${match[1]}/${match[2]}` : null;
};

export function loadProgressBoardData({
  root = repositoryRoot,
  now = () => new Date(),
  calibrationIdentity = {},
  git = (args, fallback = "") => {
    try {
      return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    } catch {
      return fallback;
    }
  },
} = {}) {
  const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");
  const listDir = (relativePath) =>
    readdirSync(join(root, relativePath), { withFileTypes: true });
  const commit = git(["rev-parse", "--short", "HEAD"], "未知");
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], "未知");
  const dirty = git(["status", "--porcelain"], "") !== "";
  const repoUrl = repositoryUrl(git(["remote", "get-url", "origin"], ""));

  const taskRecords = normalizeTaskRecords(
    listDir("docs/planning/tasks")
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .filter((entry) => !entry.name.startsWith("_"))
      .map((entry) => ({
        path: `docs/planning/tasks/${entry.name}`,
        source: read(`docs/planning/tasks/${entry.name}`),
      })),
  );
  const tasks = taskRecords.map((task) => {
    const phase = (task.id.match(/^p(\d+)-/) || [])[1];
    return {
      id: task.id,
      title: task.title,
      status: task.status || "unknown",
      branch: task.branch,
      proof: Boolean(task.verification),
      phase: phase ? `P${phase}` : "—",
    };
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
    .sort((left, right) => right.lines - left.lines);

  const catalog = JSON.parse(
    read("packages/contracts/catalogs/v1/lifecycle-nodes.json"),
  );
  const stations = catalog
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
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

  const checklist = read("docs/planning/PROJECT_BOOTSTRAP_CHECKLIST.md");
  const sectionPattern = /^##\s+\d+\.\s+(?:(P\d)\s+(.+?)|(横向持续任务))\s*$/gm;
  const matches = [...checklist.matchAll(sectionPattern)];
  const sections = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end =
      index + 1 < matches.length ? matches[index + 1].index : checklist.length;
    const body = checklist.slice(start, end);
    const tally = (mark) =>
      (body.match(new RegExp(`^- \\[${mark}\\]`, "gm")) || []).length;
    const done = tally("x");
    const na = tally("-");
    const partial = tally("~");
    const todo = tally(" ");
    const id = match[1] || "C";
    const total = done + na + partial + todo;
    const settled = done + na;
    const ledgerDone = tasks.filter(
      (task) => task.phase === id && task.status === "done",
    ).length;
    return {
      id,
      name: match[1] ? match[2].trim() : match[3],
      done,
      na,
      partial,
      todo,
      total,
      settled,
      ratio: total ? settled / total : 0,
      ledgerDone,
      desynced: settled === 0 && ledgerDone > 0,
    };
  });

  const gaps = [
    {
      sev: "high",
      title: "启动清单已失真，不再是可信的进度源",
      body: [
        `P6 一节 14 项全部未勾，而 <code>tasks/</code> 下 p6-* 已有 ${tasks.filter((task) => task.phase === "P6" && task.status === "done").length} 条 done。第 15 节「建议立即推进」仍写着下一条主线是 P5-02 OIDC，而该任务已经完成。`,
        "要么重写清单，要么在顶部声明进度以 tasks frontmatter 为准、清单只作阶段门禁——现在两份口径并列，读者无法判断信哪个。",
      ],
    },
    {
      sev: "high",
      title: `${modules.filter((module) => module.state === "empty").length} 个模块是空壳，其中 5 个是核心`,
      body: [
        "尤其 {{AUDIT_PATH}}（动作授权的落点）与 {{MASTER_DATA_PATH}}（港口/船司/仓库主数据）。没有主数据，节点事实无法归一；没有审计，高风险写操作不能上。",
      ],
    },
    {
      sev: "mid",
      title: "P2 门禁大面积未勾，但实现已经跑在前面",
      body: [
        "P2-01/02/03/06/07/08/09/10/11/12 未勾，对应文档却都是「候选 v0.5」。含义是设计稿有、负责人评审没走完，代码先跑了——后续契约反复改的概率留在这里。",
      ],
    },
    {
      sev: "mid",
      title: "AI 面是通路建好、模型没接",
      body: [
        "导入映射建议走的是 Python 关键词规则（<code>suggest_mapping_handler</code> 自述「Mock 关键词规则，不调模型」），LiteLLM / Langfuse / OTel 未启用，P7 评测为零。如果对外说法里有「AI 智能导入」，目前名不副实。",
      ],
    },
    {
      sev: "low",
      title: "状态标注不一致，需要一次收口",
      body: [
        "文档索引写 <code>p6-pipeline-task-pool</code> 是「实施中」，其 frontmatter 是 <code>blocked</code>（原因：串行槽位让给了通知助手），且验收项 <code>pnpm validate</code> 仍未勾。",
      ],
    },
  ];

  let calibration;
  try {
    const observation = observeCheckout({
      ...calibrationIdentity,
      git: (args) => git(args),
    });
    const resolution = resolveCurrentTask({
      records: taskRecords,
      branch: observation.actualBranch,
    });
    if (!resolution.task || !observation.baseSha) {
      calibration = {
        state: "not-observed",
        reason:
          resolution.finding?.code ??
          (!observation.baseSha
            ? "TASK_BASE_UNKNOWN"
            : "TASK_CURRENT_NOT_FOUND"),
      };
    } else {
      calibration = {
        ...buildCalibrationProjection({
          task: resolution.task,
          records: taskRecords,
          authorityExists: (path) => existsSync(join(root, path)),
          observation,
        }),
        state: "observed",
      };
    }
  } catch {
    calibration = {
      state: "not-observed",
      reason: "TASK_BASE_UNKNOWN",
    };
  }

  return {
    generatedAt: `${now().toISOString().replace("T", " ").slice(0, 16)} UTC`,
    commit,
    branch,
    dirty,
    repoUrl,
    taskRecords,
    tasks,
    modules,
    stations,
    sections,
    gaps,
    migrationCount: listDir("database/migrations").filter((entry) =>
      entry.isDirectory(),
    ).length,
    calibration,
  };
}

const statusChip = (status) => {
  const meta = TASK_STATUS[status] || { s: "idle", glyph: "?", label: status };
  return `<span class="chip" data-s="${meta.s}"><span class="glyph">${meta.glyph}</span>${esc(meta.label)}</span>`;
};

const tile = (label, value, unit, note) =>
  `<div class="tile"><span class="tile-label">${esc(label)}</span><span class="tile-value">${esc(value)}${unit ? `<span class="unit">${esc(unit)}</span>` : ""}</span><span class="tile-note">${note}</span></div>`;

const factTag = (kind) => `<span class="fact-tag">${kind}</span>`;

const factList = (items) =>
  `<ul class="cal-list">${items.length ? items.map((item) => `<li>${esc(item)}</li>`).join("") : "<li>none</li>"}</ul>`;

const unobservedIntegration = (projection = {}) =>
  `<dl><dt>其他 worktree</dt><dd>${esc(projection.otherWorktrees ?? "not-observed")}</dd><dt>远端评审 / PR / CI</dt><dd>${esc(projection.remoteIntegration ?? "not-observed")}</dd></dl>`;

const pathTrack = (label, paths) => {
  const shown = paths.slice(0, 50);
  const remainder = paths.length - shown.length;
  return `<div class="cal-track"><div class="cal-track-head"><span>${esc(label)}</span><span class="mono">${paths.length} total</span></div><div class="cal-paths">${shown.length ? shown.map((path) => `<code class="cal-path">${esc(path)}</code>`).join("") : '<span class="cal-empty">none</span>'}${remainder ? `<span class="cal-more">${remainder} more</span>` : ""}</div></div>`;
};

const findingItem = (finding) =>
  `<li class="cal-finding" data-severity="${esc(finding.severity)}"><span class="finding-severity">${esc(finding.severity)}</span><code>${esc(finding.code)}</code><strong>${esc(finding.subject)}</strong><span>${esc(finding.remedy ?? "")}</span></li>`;

export function renderCalibrationPanel(projection) {
  if (!projection || projection.state === "not-observed") {
    return `<div class="cal-board panel" data-state="not-observed"><div class="cal-cell" data-fact-kind="unknown">${factTag("unknown")}<h3>当前薄片未观察</h3><p>${esc(projection?.reason ?? "TASK_CURRENT_NOT_FOUND")}</p>${unobservedIntegration(projection)}</div></div>`;
  }

  const { task, declared, observed, derived } = projection;
  const checkoutWarnings = derived.findings.filter(
    ({ code }) => code === "TASK_UNOWNED_UNTRACKED_PRESENT",
  );
  const stableFindings = derived.findings.filter(
    ({ code }) => code !== "TASK_UNOWNED_UNTRACKED_PRESENT",
  );
  return `<div class="cal-board panel" data-state="observed">
    <div class="cal-column">
      <section class="cal-cell" data-fact-kind="declared">${factTag("declared")}<h3>任务与声明</h3><p class="cal-title">${esc(task.title)}</p><dl><dt>brief</dt><dd><code>${esc(task.path)}</code></dd><dt>状态 / 风险</dt><dd>${esc(declared.status)} / ${esc(declared.risk || "unknown")}</dd><dt>声明分支</dt><dd><code>${esc(declared.branch || "unknown")}</code></dd></dl><h4>声明写域</h4>${factList(declared.writeScopes)}</section>
      <section class="cal-cell" data-fact-kind="declared">${factTag("declared")}<h3>正式权威与依赖</h3><h4>权威</h4>${factList(derived.authorities.map(({ path, state }) => `${path} — ${state}`))}<h4>依赖</h4>${factList(derived.dependencies.map(({ id, status }) => `${id} — ${status}`))}</section>
    </div>
    <div class="cal-column">
      <section class="cal-cell" data-fact-kind="computed">${factTag("computed")}<h3>Checkout 与范围</h3>
        <!--VOLATILE_CALIBRATION_START--><dl><dt>实际分支</dt><dd><code>${esc(observed.actualBranch || "detached")}</code></dd><dt>base</dt><dd><code>${esc(observed.baseSha ?? "unknown")}</code> (${esc(observed.baseSource)})</dd><dt>head</dt><dd><code>${esc(observed.headSha ?? "unknown")}</code></dd></dl>${pathTrack("task-owned tracked", derived.ownedChangedPaths)}${pathTrack("out-of-scope tracked", derived.blockingOutOfScopePaths)}${pathTrack("task-owned untracked", derived.ownedUntrackedPaths)}${pathTrack("unowned untracked", derived.unownedUntrackedPaths)}${checkoutWarnings.length ? `<h4>Checkout warnings</h4><ul class="cal-findings">${checkoutWarnings.map(findingItem).join("")}</ul>` : ""}<!--VOLATILE_CALIBRATION_END-->
      </section>
    </div>
    <div class="cal-column">
      <section class="cal-cell" data-fact-kind="computed">${factTag("computed")}<h3>Finding 与下一门禁</h3><ul class="cal-findings">${stableFindings.length ? stableFindings.map(findingItem).join("") : '<li class="cal-empty">no blocking findings</li>'}</ul><div class="next-gate"><span>next gate</span><strong>${esc(derived.nextGate)}</strong></div></section>
      <section class="cal-cell" data-fact-kind="declared">${factTag("declared")}<h3>已声明验证</h3><p>${esc(declared.verification || "none declared")}</p></section>
      <section class="cal-cell" data-fact-kind="unknown">${factTag("unknown")}<h3>未观察集成证据</h3>${unobservedIntegration(projection)}</section>
      <section class="cal-cell" data-fact-kind="editorial">${factTag("editorial")}<h3>解释边界</h3><p>绿色校准不等于业务闭环、部署完成或负责人验收。</p></section>
    </div>
  </div>`;
}

export function renderProgressBoard(data, { template }) {
  const {
    generatedAt,
    commit,
    branch,
    dirty,
    repoUrl,
    tasks,
    modules,
    stations,
    sections,
    gaps,
    migrationCount,
    calibration,
  } = data;
  const taskStatusCounts = tasks.reduce((counts, task) => {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
    return counts;
  }, {});
  const stationStateCounts = stations.reduce((counts, station) => {
    counts[station.state] = (counts[station.state] ?? 0) + 1;
    return counts;
  }, {});
  const byStatus = (status) => taskStatusCounts[status] ?? 0;
  const countStation = (state) => stationStateCounts[state] ?? 0;
  const checklistSettled = sections.reduce(
    (total, section) => total + section.settled,
    0,
  );
  const checklistTotal = sections.reduce(
    (total, section) => total + section.total,
    0,
  );
  const maxLines = Math.max(1, ...modules.map((module) => module.lines));
  const blame = (relativePath) => {
    if (!repoUrl) return `<span class="mono">${esc(relativePath)}</span>`;
    return `<a href="${repoUrl}/blob/HEAD/${relativePath}">${esc(relativePath)}</a>`;
  };

  const tiles = [
    tile(
      "后端模块",
      String(modules.length),
      "",
      `${modules.filter((module) => module.kind === "base").length} 基座 · ${modules.filter((module) => module.kind !== "base").length} 增量`,
    ),
    tile(
      "空壳模块",
      String(modules.filter((module) => module.state === "empty").length),
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
    tile("数据库迁移", String(migrationCount), "", "单一 Prisma 入口"),
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
            <td><span class="size"><span class="size-track"><span class="size-fill" style="--w:${width}%"></span></span><span class="size-num">${module.lines.toLocaleString("en-US")} 行</span></span></td>
            <td class="num">${module.tests || "—"}</td>
            <td class="deps">${module.depends.length ? esc(module.depends.join(", ")) : "—"}</td>
            <td><span class="chip" data-s="${meta.s}"><span class="glyph">${meta.glyph}</span>${meta.label}</span></td>
          </tr>`;
  };
  const layers = LAYER_DEFS.map((layer) => {
    const members = modules.filter((module) => module.layer === layer.id);
    return `<div class="layer">
        <div class="layer-head"><h3>${esc(layer.title)}</h3><p>${esc(layer.blurb)}</p></div>
        <div class="panel" style="overflow-x: auto"><table><thead><tr><th>模块</th><th>规模</th><th class="num">测试</th><th>依赖</th><th>状态</th></tr></thead><tbody>
              ${members.map(moduleRow).join("\n              ")}
            </tbody></table></div>
      </div>`;
  }).join("\n      ");

  const rail = stations
    .map((station) => {
      const meta = STATION_STATE[station.state];
      return `<li class="station" data-state="${station.state}"><span class="station-head"><span class="station-seq">${String(station.seq).padStart(2, "0")}</span><span class="station-cn">${esc(station.cn)}</span><span class="station-code">${esc(station.code)}</span><span class="chip" data-s="${meta.s}"><span class="glyph">${meta.glyph}</span>${meta.label}</span></span><span class="station-by">${esc(station.by)}</span></li>`;
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
      return `<li class="phase"><span class="phase-id">${esc(section.id)}</span><span class="phase-name">${esc(section.name)}</span><span class="meter" role="img" aria-label="${esc(`${section.settled} / ${section.total} 已了结`)}"><span class="meter-fill" style="--w:${Math.round(section.ratio * 100)}%"></span></span><span class="phase-num">${section.settled}/${section.total}</span><span class="phase-note">${note} · ${esc(parts.join("，"))}</span></li>`;
    })
    .join("\n        ");

  const ledger = tasks
    .map(
      (task) =>
        `<tr data-status="${esc(task.status)}" data-id="${esc(task.id)}" data-phase="${esc(task.phase)}" data-text="${esc(`${task.id} ${task.title} ${task.branch}`.toLowerCase())}"><td class="id">${esc(task.id)}</td><td class="title">${esc(task.title)}</td><td>${statusChip(task.status)}</td><td class="phase mono">${esc(task.phase)}</td><td class="proof">${task.proof ? '<span class="tick" title="frontmatter 带 verification">✓</span>' : '<span class="dash">—</span>'}</td></tr>`,
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
    .map((gap) => {
      const body = gap.body.map((paragraph) =>
        paragraph
          .replace("{{AUDIT_PATH}}", blame("apps/api/src/modules/audit"))
          .replace(
            "{{MASTER_DATA_PATH}}",
            blame("apps/api/src/modules/master-data"),
          ),
      );
      return `<li class="gap" data-sev="${gap.sev}"><span class="chip" data-s="${gap.sev === "high" ? "blocked" : gap.sev === "mid" ? "active" : "idle"}"><span class="glyph">${gap.sev === "high" ? "✕" : gap.sev === "mid" ? "◐" : "○"}</span>${gap.sev === "high" ? "高" : gap.sev === "mid" ? "中" : "低"}</span><div class="gap-body"><h3>${esc(gap.title)}</h3>${body.map((paragraph) => `<p>${paragraph}</p>`).join("\n")}</div></li>`;
    })
    .join("\n      ");
  const doneWithoutProof = tasks.filter(
    (task) => task.status === "done" && !task.proof,
  );

  let html = template
    .replace("<!--__META__-->", () =>
      [
        ["生成于", generatedAt],
        ["提交", commit + (dirty ? "（含未提交改动）" : "")],
        ["分支", branch],
        [
          "数据源",
          `${tasks.length} 份任务 brief · ${modules.length} 份模块清单`,
        ],
      ]
        .map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`)
        .join("\n      "),
    )
    .replace("<!--__TILES__-->", () => tiles)
    .replace("<!--__CALIBRATION__-->", () =>
      renderCalibrationPanel(calibration),
    )
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
        `${tasks.length} 条 · ${byStatus("done")} 完成${doneWithoutProof.length ? ` · ${doneWithoutProof.length} 条缺验证证据` : ""}`,
    )
    .replace("<!--__TASKS__-->", () => ledger)
    .replace("<!--__GAP_NOTE__-->", () => `${gaps.length} 条`)
    .replace("<!--__GAPS__-->", () => gapItems)
    .replace(
      "<!--__FOOTER_NOTE__-->",
      () =>
        `本页由 ${blame("scripts/build-progress-board.mjs")} 从仓库生成，快照取自 <!--VOLATILE_COMMIT_START--><span class="mono">${esc(commit)}</span><!--VOLATILE_COMMIT_END-->。frontmatter 变了要重跑生成再发布，页面本身不会自己去读仓库。`,
    );

  for (const placeholder of html.match(/<!--__[A-Z_]+__-->/g) || []) {
    throw new Error(`模板占位符未被替换：${placeholder}`);
  }
  return html;
}

const normalizeVolatileBlock = (html, name) => {
  const start = `<!--VOLATILE_${name}_START-->`;
  const end = `<!--VOLATILE_${name}_END-->`;
  const starts = html.split(start).length - 1;
  const ends = html.split(end).length - 1;
  if (starts === 0 && ends === 0) return html;
  if (starts !== 1 || ends !== 1 || html.indexOf(start) > html.indexOf(end)) {
    throw new Error(`invalid volatile marker pair: ${name}`);
  }
  const before = html.slice(0, html.indexOf(start));
  const after = html.slice(html.indexOf(end) + end.length);
  return `${before}${start}\n${end}${after}`;
};

export function normalizeCheckableBoard(html) {
  return ["META", "CALIBRATION", "COMMIT"].reduce(normalizeVolatileBlock, html);
}

const parseCommand = (argv) => {
  const known = new Set(["--check", "--deterministic"]);
  const unknown = argv.find((arg) => !known.has(arg));
  if (unknown) return { error: `unknown argument '${unknown}'` };
  return {
    check: argv.includes("--check"),
    deterministic: argv.includes("--deterministic"),
  };
};

export async function runBoardCommand(argv, dependencies) {
  const command = parseCommand(argv);
  if (command.error) {
    return { exitCode: 2, stdout: "", stderr: `${command.error}\n` };
  }
  const data = await dependencies.load({
    deterministic: command.deterministic,
  });
  const template = await dependencies.readTemplate();
  const rendered = renderProgressBoard(data, { template });
  if (command.check) {
    const current = await dependencies.readOutput();
    const fresh = normalizeCheckableBoard(rendered);
    const committed = normalizeCheckableBoard(current);
    return fresh === committed
      ? { exitCode: 0, stdout: "progress board: current\n", stderr: "" }
      : {
          exitCode: 1,
          stdout: "",
          stderr: "progress board is stale; run pnpm board:build\n",
        };
  }
  await dependencies.writeOutput(rendered);
  return {
    exitCode: 0,
    stdout: `进度板已生成：docs/planning/progress-board.html（${data.modules.length} 模块 / ${data.tasks.length} 任务 / ${data.stations.length} 节点）\n`,
    stderr: "",
  };
}

const calibrationIdentityFromEnvironment = () => {
  const { BASE_SHA: base, HEAD_SHA: head, HEAD_BRANCH: branch } = process.env;
  return base && head && branch ? { base, head, branch } : {};
};

const defaultDependencies = () => ({
  load: ({ deterministic }) =>
    loadProgressBoardData({
      calibrationIdentity: calibrationIdentityFromEnvironment(),
      ...(deterministic
        ? {
            now: () => new Date("2000-01-01T00:00:00.000Z"),
            git: (args, fallback = "") => {
              const key = args.join(" ");
              if (key === "rev-parse --short HEAD") return "deterministic";
              if (key === "rev-parse --abbrev-ref HEAD") return "deterministic";
              if (key === "status --porcelain") return "";
              return key === "remote get-url origin"
                ? execFileSync("git", args, {
                    cwd: repositoryRoot,
                    encoding: "utf8",
                  }).trim()
                : fallback;
            },
          }
        : {}),
    }),
  readTemplate: () => readFileSync(templatePath, "utf8"),
  readOutput: () => readFileSync(outputPath, "utf8"),
  writeOutput: (html) => writeFileSync(outputPath, html, "utf8"),
});

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await runBoardCommand(
      process.argv.slice(2),
      defaultDependencies(),
    );
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`progress board failed: ${error.message}\n`);
    process.exitCode = 2;
  }
}
