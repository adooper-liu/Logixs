import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const HELP = [
  "智慧开启：<工作台>——先锁定业务目的、优先损失和负责人决策，只读",
  "业务开工：<工作台>——从智慧基线出发，端到端执行到 PR/CI/合并",
  "主线：<brief#slice>｜<状态>｜<唯一下一动作>——登记或更新唯一主任务线",
  "支线：<名称>｜<brief#slice>｜<状态>｜<唯一下一动作>——登记支线并切换过去，主线保留",
  "切线：主线 / 切线：<名称>——切换当前活动线，只召回该线指针",
  "更新线：<状态>｜<唯一下一动作>——更新当前活动线",
  "集成授权——一次授权当前活动线执行安全 Git/PR/CI/合并闭环，不重复索权",
  "取消集成授权——撤销当前活动线的集成授权",
  "收支线：<名称>——关闭支线并切回主线",
  "任务线——只列主线、支线和当前活动线",
  "归线——停止漂移，回到当前活动线的唯一下一动作",
  "口令——查询本清单",
];

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  const payload = parseJson(input, {});
  const prompt = String(payload.prompt ?? payload.user_prompt ?? "").trim();
  const statePath = resolveStatePath();
  const state = loadState(statePath);
  const commit = currentCommit();
  let context = "";
  let changed = false;

  const main = matchCommand(prompt, "主线");
  const branch = matchCommand(prompt, "支线");
  const switchLine = matchCommand(prompt, "切线");
  const update = matchCommand(prompt, "更新线");
  const closeBranch = matchCommand(prompt, "收支线");

  if (main !== null) {
    const [pointer, status = "未记录", next = "未记录"] = fields(main);
    if (!pointer) context = usage("主线：<brief#slice>｜<状态>｜<唯一下一动作>");
    else {
      state.main = line("主线", pointer, status, next, commit);
      state.active = { type: "main", name: "主线" };
      changed = true;
      context = response(`已登记并切换到主线：${describe(state.main)}`);
    }
  } else if (branch !== null) {
    const [name, pointer, status = "未记录", next = "未记录"] = fields(branch);
    if (!name || !pointer)
      context = usage("支线：<名称>｜<brief#slice>｜<状态>｜<唯一下一动作>");
    else {
      state.branches[name] = line(name, pointer, status, next, commit);
      state.active = { type: "branch", name };
      changed = true;
      context = response(`已登记并切换到支线：${describe(state.branches[name])}`);
    }
  } else if (switchLine !== null) {
    const target = switchLine.trim();
    if (target === "主线" && state.main) {
      state.active = { type: "main", name: "主线" };
      changed = true;
      context = response(`已切换到主线：${describe(state.main)}`);
    } else if (state.branches[target]) {
      state.active = { type: "branch", name: target };
      changed = true;
      context = response(`已切换到支线：${describe(state.branches[target])}`);
    } else context = response(`未找到任务线“${target || "空"}”；发送“任务线”查看已登记任务线。`);
  } else if (update !== null) {
    const active = activeLine(state);
    const [status, next] = fields(update);
    if (!active || !status || !next)
      context = usage("更新线：<状态>｜<唯一下一动作>");
    else {
      active.status = status;
      active.next = next;
      active.commit = commit;
      active.updatedAt = new Date().toISOString();
      if (/^(done|completed|merged|已完成|已合并)$/iu.test(status)) {
        delete active.integrationAuthorization;
      }
      changed = true;
      context = response(`已更新当前任务线：${describe(active)}`);
    }
  } else if (prompt === "集成授权") {
    const active = activeLine(state);
    if (!active) context = response("尚未登记当前活动线，不能绑定集成授权。");
    else {
      active.integrationAuthorization = {
        grantedAt: new Date().toISOString(),
        pointer: active.pointer,
        scope: "safe-full-integration",
      };
      changed = true;
      context = response(
        `已授权当前活动线执行安全集成闭环：${describe(active)}\n允许：盘点全部 worktree/实际 diff/任务锁，fetch，非破坏性同步 origin/main，精确暂存与提交，推功能分支，创建或更新 PR，等待 CI，必需检查通过后合并，同步本地 main。\n不包含：强推、硬重置、覆盖或丢弃任何改动、删除 worktree/分支/标签、裸 stash pop、绕过门禁、部署或修改外部业务系统。遇到冲突、外来改动、门禁失败或授权指针变化时才暂停。`,
      );
    }
  } else if (prompt === "取消集成授权") {
    const active = activeLine(state);
    if (!active) context = response("尚未登记当前活动线。");
    else {
      delete active.integrationAuthorization;
      changed = true;
      context = response(`已撤销当前活动线的集成授权：${active.name}｜${active.pointer}`);
    }
  } else if (closeBranch !== null) {
    const name = closeBranch.trim();
    if (!state.branches[name]) context = response(`未找到支线“${name || "空"}”。`);
    else {
      delete state.branches[name];
      state.active = state.main ? { type: "main", name: "主线" } : null;
      changed = true;
      context = response(
        state.main
          ? `已关闭支线“${name}”并切回主线：${describe(state.main)}`
          : `已关闭支线“${name}”；尚未登记主线。`,
      );
    }
  } else if (prompt === "任务线") {
    context = response(formatTaskLines(state));
  } else if (prompt === "归线") {
    const active = activeLine(state);
    context = active
      ? realign(active)
      : response("尚未登记任务线。先发送：主线：<brief#slice>｜<状态>｜<唯一下一动作>");
  } else if (prompt === "口令") {
    context = response(HELP.map((item, index) => `${index + 1}. ${item}`).join("\n"));
  } else {
    const active = activeLine(state);
    if (active) context = activeReminder(active);
  }

  if (changed) saveState(statePath, state);
  output(context);
});

function defaultState() {
  return { version: 1, main: null, branches: {}, active: null, updatedAt: null };
}

function loadState(path) {
  if (!existsSync(path)) return defaultState();
  const parsed = parseJson(readFileSync(path, "utf8"), defaultState());
  return {
    ...defaultState(),
    ...parsed,
    branches: parsed.branches && typeof parsed.branches === "object" ? parsed.branches : {},
  };
}

function saveState(path, state) {
  state.updatedAt = new Date().toISOString();
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}

function resolveStatePath() {
  if (process.env.LOGIX_TASK_LINES_FILE) return resolve(process.env.LOGIX_TASK_LINES_FILE);
  try {
    const common = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const absoluteCommon = resolve(common);
    return resolve(dirname(absoluteCommon), ".claude", "task-lines.local.json");
  } catch {
    return resolve(".claude", "task-lines.local.json");
  }
}

function currentCommit() {
  if (process.env.LOGIX_TASK_LINES_COMMIT) return process.env.LOGIX_TASK_LINES_COMMIT;
  try {
    return execFileSync("git", ["rev-parse", "--short=8", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function line(name, pointer, status, next, commit) {
  return { name, pointer, status, next, commit, updatedAt: new Date().toISOString() };
}

function activeLine(state) {
  if (!state.active) return null;
  return state.active.type === "main"
    ? state.main
    : state.branches[state.active.name] ?? null;
}

function fields(value) {
  return value
    .split(/[|｜]/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function matchCommand(prompt, name) {
  const match = prompt.match(new RegExp(`^${name}[：:]([\\s\\S]*)$`, "u"));
  return match ? match[1].trim() : null;
}

function describe(item) {
  const authorization = item.integrationAuthorization
    ? "｜集成授权：安全完整闭环"
    : "｜集成授权：未授予";
  return `${item.name}｜${item.pointer}｜状态：${item.status}｜下一动作：${item.next}｜commit：${item.commit}${authorization}`;
}

function formatTaskLines(state) {
  const rows = [];
  if (state.main) rows.push(`${state.active?.type === "main" ? "*" : "-"} ${describe(state.main)}`);
  for (const [name, item] of Object.entries(state.branches)) {
    rows.push(`${state.active?.type === "branch" && state.active.name === name ? "*" : "-"} ${describe(item)}`);
  }
  return rows.length ? rows.join("\n") : "尚未登记任务线。";
}

function realign(active) {
  const integration = active.integrationAuthorization
    ? "\n集成授权：已授权安全完整闭环；条件具备后直接集成，不重复索权。"
    : "\n集成授权：未授予。";
  return `【归线纠偏已触发】\n业务主线位置：以正式业务权威和已登记主线为准，不重新解释项目背景。\n当前批准任务：${active.name}｜${active.pointer}｜${active.status}\n尚未满足的收口条件：只核对该 brief、实际 Git diff 与最近 commit ${active.commit} 的增量变化。\n唯一下一动作：${active.next}${integration}\n立即停止其他节奏，只执行上述唯一下一动作。禁止新增计划、文档或切片，禁止重复确认，禁止扩范围，禁止把横向门禁当业务主线。严格按 AGENTS.md 角色：Claude 主代理只写 brief、权威和集成；产品实现只输出标准 TASK 给真实 GPT-5.6 Codex，由负责人手工转交。`;
}

function activeReminder(active) {
  const integration = active.integrationAuthorization
    ? "当前线已获安全完整集成授权：完成条件具备后直接执行 fetch/同步/精确提交/推分支/PR/CI/合并/同步 main，不重复询问；遇到冲突、外来改动、门禁失败或指针变化才暂停。"
    : "当前线未授予集成闭环授权。";
  return `【当前活动任务线】${describe(active)}。只沿该指针增量工作，不重复解读完整项目上下文；仅当 base、权威或实际 diff 变化时核对变化。禁止切到其他任务线或扩范围，除非用户发送“切线：…”。${integration}`;
}

function response(message) {
  return `【任务线控制】只简短回复以下结果，不执行工具、不展开项目背景：\n${message}`;
}

function usage(example) {
  return response(`格式错误。用法：${example}`);
}

function output(additionalContext) {
  if (!additionalContext) {
    process.stdout.write("{}");
    return;
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext,
      },
    }),
  );
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
