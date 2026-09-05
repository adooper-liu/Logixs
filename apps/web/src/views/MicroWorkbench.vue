<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  container,
  rail,
  customsChecklist,
  timeline,
  nextActions,
  type WorkNode,
  type ActionItem
} from '../data/sample'

const route = useRoute()
const orderNumber = route.params.orderNumber as string

const activeKey = ref('customs')
const showAction = ref<ActionItem | null>(null)
const executing = ref(false)
const doneActions = ref<string[]>([])

const activeNode = computed<WorkNode>(() => rail.find((n) => n.key === activeKey.value) || rail[6])
const nodeState = (n: WorkNode) =>
  n.phase === 'current' ? 'cur' : n.phase === 'done' ? 'done' : n.phase === 'skipped' ? 'skip' : 'todo'

const nodeTip = (n: WorkNode) => {
  const t = [n.name]
  if (n.planned) t.push(n.planned)
  if (n.actual) t.push('实际 ' + n.actual)
  if (n.note) t.push(n.note)
  if (n.phase === 'skipped') t.push('(未发生 · 跳过)')
  if (n.phase === 'optional') t.push('(可选 · 未启用)')
  return t.join(' · ')
}

const freeDays = container.freeDaysLeft ?? 0
const freeRisk = freeDays <= 2
const redCount = computed(() => customsChecklist.filter((x) => x.state !== 'ok').length)
const glyph = (s: string) => (s === 'ok' ? '✓' : s === 'warn' ? '!' : '✕')

/* ---- 节点卡语义字段：由领域规则推导，不是摆拍 ---- */
const STATUS: Record<string, string> = {
  ready: '已就绪', stuffing: '定稿完成', shipment: '已装船', depart: '已离港',
  sailing: '在途', transit: '未发生', customs: '清关中', arrival: '已到港',
  rail: '未启用', pickup: '待提柜', delivery: '待送仓', unload: '待卸柜',
  unstuff: '待卸空', return: '待还箱'
}
const TONE: Record<string, 'ok' | 'warn' | 'risk' | undefined> = {
  ready: 'ok', stuffing: 'ok', shipment: 'ok', depart: 'ok', sailing: undefined,
  transit: undefined, customs: 'risk', arrival: 'ok', rail: undefined,
  pickup: 'warn', delivery: undefined, unload: undefined, unstuff: undefined, return: undefined
}
const NA: Record<string, string> = { transit: '未发生 · 跳过', rail: '可选 · 未启用' }
const BLOCKER: Record<string, string> = {
  customs: 'ISF 未申报 · 单据缺 1 份',
  pickup: '免堆剩余 2 天'
}
const SRC: Record<string, string> = {
  ready: '计划系统', stuffing: '导入', shipment: '导入/船司', depart: '船司',
  sailing: '船司/AIS', customs: '海关/导入', arrival: '船司', pickup: '码头/拖车'
}

interface TRow { label: string; val: string; dot: 'p' | 'a' }
const rowsOf = (n: WorkNode): TRow[] => {
  const r: TRow[] = []
  if (n.planned) r.push({ label: n.planned.includes('最晚') ? '最晚' : '预计', val: n.planned, dot: 'p' })
  if (n.actual) r.push({ label: '实际', val: n.actual, dot: 'a' })
  return r
}
const actsOf = (n: WorkNode): ActionItem[] => {
  if (n.key === 'customs') return nextActions
  const act = { delivery: '确认送仓', unload: '确认卸柜', unstuff: '确认卸空', return: '安排还箱', pickup: '一键派拖提柜', arrival: '确认到港', depart: '确认离港', stuffing: '确认装箱' } as Record<string, string>
  const name = act[n.key]
  return name ? [{ code: name, name, desc: '推进到下一站并留证', channel: '内部' }] : []
}

const runAction = () => {
  if (!showAction.value) return
  executing.value = true
  setTimeout(() => {
    executing.value = false
    doneActions.value.push(showAction.value!.code)
    ElMessage.success(`已登记「${showAction.value!.name}」（示例）`)
    showAction.value = null
  }, 400)
}
const selectNode = (n: WorkNode) => {
  if (n.phase !== 'skipped' && n.phase !== 'optional') activeKey.value = n.key
}
</script>

<template>
  <div class="board">
    <!-- 身份行 -->
    <section class="idbar">
      <div class="left">
        <span class="ring" :class="container.statusTone"></span>
        <span class="cno mono">{{ container.containerNumber }}</span>
        <span class="loc">{{ container.location }}</span>
      </div>
      <div class="right">
        <el-tooltip :content="`免堆剩余 ${freeDays} 天`"><span class="metric" :class="freeRisk ? 'risk' : ''">{{ freeDays }}<i>天免堆</i></span></el-tooltip>
        <el-tooltip :content="`清关红灯 ${redCount} 项`"><span class="metric red" :class="redCount ? 'on' : ''">{{ redCount }}<i>红灯</i></span></el-tooltip>
      </div>
    </section>

    <div class="cols">
      <!-- 左：流转 -->
      <aside class="rail panel">
        <header class="ph"><span>流转</span></header>
        <ul class="list">
          <li v-for="n in rail" :key="n.key" class="node" :class="[nodeState(n), activeNode.key === n.key ? 'sel' : '']" @click="selectNode(n)">
            <el-tooltip :content="nodeTip(n)" placement="right" :show-after="150">
              <span class="row"><i class="dot"></i><b>{{ n.name }}</b></span>
            </el-tooltip>
          </li>
        </ul>
      </aside>

      <!-- 中：节点卡（按规范字段） -->
      <section class="stage panel">
        <header class="ph">
          <span class="now">{{ activeNode.name }}</span>
          <span class="pill" :class="TONE[activeNode.key]">{{ STATUS[activeNode.key] || '待发生' }}</span>
        </header>

        <div v-if="NA[activeNode.key]" class="na">{{ NA[activeNode.key] }}</div>

        <template v-else>
          <div v-if="rowsOf(activeNode).length" class="trows">
            <span v-for="tr in rowsOf(activeNode)" :key="tr.label + tr.val" class="tr mono">
              <i class="d" :class="tr.dot === 'p' ? 'pdot' : 'adot'"></i>
              <em>{{ tr.label }}</em>{{ tr.val }}
            </span>
          </div>

          <div v-if="BLOCKER[activeNode.key]" class="blocker">
            <b>卡点</b>{{ BLOCKER[activeNode.key] }}
          </div>

          <div v-if="SRC[activeNode.key]" class="src"><em>来源</em>{{ SRC[activeNode.key] }}</div>

          <div v-if="actsOf(activeNode).length" class="stage-acts">
            <button v-for="a in actsOf(activeNode)" :key="a.code" class="actbtn" @click="showAction = a">{{ a.name }}</button>
          </div>
        </template>

        <!-- 清关明细（仅当站=清关） -->
        <template v-if="activeNode.key === 'customs'">
          <p class="k">清关明细</p>
          <div class="checks">
            <el-tooltip v-for="(c, i) in customsChecklist" :key="c.q" placement="top" :show-after="100">
              <template #content>
                <div class="tip"><b>{{ c.q }}</b><span>{{ c.answer }} → {{ c.action }}</span></div>
              </template>
              <div class="check" :class="c.state">
                <span class="mark">{{ glyph(c.state) }}</span>
                <span class="lab">{{ c.state === 'ok' ? '已' : c.action }}</span>
              </div>
            </el-tooltip>
          </div>
        </template>
      </section>

      <!-- 右：关键日期 -->
      <aside class="side">
        <section class="panel">
          <header class="ph"><span>关键日期</span></header>
          <div class="clock">
            <div v-for="e in timeline" :key="e.label" class="leg">
              <b>{{ e.label }}</b>
              <div class="stack">
                <span class="r mono"><i class="d pdot"></i>{{ e.planned || '—' }}</span>
                <span class="r mono"><i class="d adot"></i>{{ e.actual || '待定' }}</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <el-dialog v-model="showAction" width="440px" :title="showAction ? showAction.name : ''">
      <div v-if="showAction" class="confirm">
        <p class="payload">默认将按以下执行：</p>
        <ul>
          <li><b>渠道</b>：{{ showAction.channel }}</li>
          <li><b>对象</b>：{{ container.containerNumber }} · {{ orderNumber }}</li>
          <li><b>动作</b>：{{ showAction.desc }}</li>
        </ul>
        <p class="tip">状态推进类需二次确认；执行后写事件流并审计（示例）。</p>
      </div>
      <template #footer>
        <button class="ghost" @click="showAction = null">取消</button>
        <button class="primary" :disabled="executing" @click="runAction">确认执行</button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.board {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
}
.idbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ring {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ok);
}
.ring.warn {
  background: var(--warn);
  box-shadow: 0 0 0 4px var(--warn-bg);
}
.ring.risk {
  background: var(--risk);
  box-shadow: 0 0 0 4px var(--risk-bg);
}
.cno {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.03em;
}
.loc {
  color: var(--muted);
  font-size: 13px;
}
.right {
  display: flex;
  gap: 10px;
}
.metric {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  color: var(--ink);
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  background: var(--surface);
}
.metric i {
  font-style: normal;
  font-size: 11px;
  color: var(--muted);
}
.metric.risk {
  color: var(--risk);
}
.metric.red.on {
  border-color: var(--risk);
}
.cols {
  display: grid;
  grid-template-columns: 168px 1fr 180px;
  gap: 12px;
  align-items: start;
}
.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  padding: 12px;
}
.ph {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 10px;
}
.ph > span {
  font-weight: 700;
}
/* rail */
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.node .row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 6px;
  cursor: pointer;
}
.node .dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--line-strong);
  flex: none;
}
.node.done .dot {
  background: var(--ok);
}
.node.cur .dot {
  background: var(--warn);
  box-shadow: 0 0 0 3px var(--warn-bg);
}
.node.skip .dot,
.node.optional .dot {
  border: 2px dashed var(--line-strong);
  background: transparent;
}
.node.todo .dot {
  background: var(--surface);
  border: 2px solid var(--line-strong);
}
.node .row b {
  font-weight: 500;
  color: var(--ink-soft);
  font-size: 13px;
}
.node.cur .row b {
  font-weight: 700;
  color: var(--ink);
}
.node.sel .row,
.node:hover .row {
  background: var(--surface-2);
}
/* stage */
.now {
  font-size: 15px;
}
.pill {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft);
  background: var(--surface-2);
}
.pill.risk {
  color: var(--risk);
  background: var(--risk-bg);
}
.pill.warn {
  color: var(--warn);
  background: var(--warn-bg);
}
.pill.ok {
  color: var(--ok);
  background: var(--ok-bg);
}
.na {
  color: var(--muted);
  font-size: 13px;
}
.trows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.tr {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ink);
}
.tr em {
  font-style: normal;
  color: var(--muted);
  width: 34px;
}
.d {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.d.pdot {
  background: var(--line-strong);
}
.d.adot {
  background: var(--ok);
}
.blocker {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  color: var(--risk);
  font-size: 13px;
}
.blocker b {
  color: var(--muted);
  font-weight: 500;
}
.src {
  margin-bottom: 12px;
  color: var(--muted);
  font-size: 12px;
  display: flex;
  gap: 8px;
}
.src em {
  font-style: normal;
  font-weight: 500;
}
.stage-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.actbtn {
  border: 1px solid var(--brand);
  color: var(--brand);
  background: var(--surface);
  border-radius: var(--radius-s);
  padding: 8px 12px;
  font-weight: 600;
  cursor: pointer;
}
.actbtn:hover {
  background: var(--brand-soft);
}
.k {
  margin: 14px 0 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.checks {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}
.check {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 2px;
  border-radius: var(--radius-s);
  border: 1px solid var(--line);
}
.check .mark {
  font-size: 15px;
  line-height: 1;
  color: var(--muted);
}
.check .lab {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
.check.ok .mark {
  color: var(--ok);
}
.check.warn .mark,
.check.warn .lab {
  color: var(--warn);
}
.check.risk {
  border-color: var(--risk);
}
.check.risk .mark,
.check.risk .lab {
  color: var(--risk);
}
/* right clock */
.side {
  display: flex;
  flex-direction: column;
}
.clock {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.leg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.leg b {
  font-weight: 600;
  color: var(--ink-soft);
  font-size: 13px;
  width: 52px;
  flex: none;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.r {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.tip {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tip b {
  font-size: 13px;
}
.tip span {
  font-size: 12px;
  color: var(--ink-soft);
}
.confirm .payload {
  margin: 0 0 8px;
  font-weight: 600;
}
.confirm ul {
  margin: 0 0 10px;
  padding-left: 16px;
}
.confirm li {
  margin: 4px 0;
}
.tip-text {
  font-size: 12px;
  color: var(--muted);
}
button.ghost {
  background: transparent;
  border: 1px solid var(--line-strong);
  color: var(--ink-soft);
  border-radius: 8px;
  padding: 7px 14px;
  margin-right: 8px;
  cursor: pointer;
}
button.primary {
  background: var(--brand);
  border: 0;
  color: #fff;
  border-radius: 8px;
  padding: 7px 14px;
  cursor: pointer;
}
button.primary:disabled {
  background: var(--disabled);
  cursor: not-allowed;
}
</style>
