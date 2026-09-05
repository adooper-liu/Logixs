<script setup lang="ts">
import { computed, ref } from 'vue'
import { paperRows } from '../data/sample'

const mainline = [
  { name: '备货单', meta: '12' },
  { name: '出运', meta: '10' },
  { name: '清关计划', meta: 'W38' },
  { name: '提柜卸柜计划', meta: '今日6' },
  { name: '计划与达成跟踪', meta: '跟踪' }
]

const capability = [
  { k: '清关产能(单/周)', plan: 15, used: 12 },
  { k: '提柜运力(车/日)', plan: 8, used: 6 },
  { k: '卸柜(柜/周)', plan: 16, used: 11 }
]
const gapNote = '年初按历史+未来预计规划；当前在途评估：清关/提柜富余，卸柜接近预算——建议评估新增 1 台卸柜月台。'

const portParam = [
  { port: 'LAX', cond: '优', n: 2 },
  { port: 'ROT', cond: '良', n: 3 },
  { port: 'NYC', cond: '差', n: 3 },
  { port: 'LGB', cond: '良', n: 2 }
]
const condDist = [
  { cond: '优', n: 2, tone: 'ok' },
  { cond: '良', n: 5, tone: '' },
  { cond: '差', n: 3, tone: 'risk' }
]

type Gran = 'month' | 'week' | 'day'
const seg = ref<Gran>('month')
const monthW = ['W20', 'W21', 'W22', 'W23']
const weekD = ['一', '二', '三', '四', '五', '六', '日']
const monthly = [
  { name: '清关', cells: [[12, 9], [12, 10], [13, 8], [15, 12]] },
  { name: '提柜', cells: [[6, 5], [6, 6], [7, 5], [8, 6]] },
  { name: '堆场', cells: [[10, 8], [10, 9], [11, 7], [11, 9]] },
  { name: '送仓', cells: [[8, 6], [8, 7], [9, 7], [9, 8]] },
  { name: '卸柜', cells: [[15, 11], [15, 12], [16, 13], [16, 14]] }
]
const weekly = [
  { name: '清关', cells: [[2, 2], [2, 1], [2, 2], [2, 1], [2, 2], [1, 1], [1, 0]] },
  { name: '提柜', cells: [[1, 1], [1, 1], [1, 0], [1, 1], [1, 1], [0, 0], [1, 0]] },
  { name: '堆场', cells: [[2, 2], [1, 1], [2, 1], [2, 2], [1, 1], [1, 0], [1, 1]] },
  { name: '送仓', cells: [[1, 1], [1, 1], [1, 0], [2, 2], [1, 1], [1, 0], [1, 1]] },
  { name: '卸柜', cells: [[2, 2], [3, 2], [2, 1], [2, 2], [3, 3], [1, 0], [2, 1]] }
]
const daily = [
  { name: '清关', p: 3, d: 2 },
  { name: '提柜', p: 1, d: 1 },
  { name: '堆场', p: 2, d: 1 },
  { name: '送仓', p: 2, d: 1 },
  { name: '卸柜', p: 4, d: 3 }
]
const tone = (p: number, d: number) => (d >= p ? 'ok' : d > 0 ? 'warn' : 'risk')
const monSum = (r: { cells: number[][] }) => [r.cells.reduce((a, x) => a + x[0], 0), r.cells.reduce((a, x) => a + x[1], 0)]

const cycles = [
  { name: '海运', days: '29d' },
  { name: '清关', days: '2d' },
  { name: '提柜卸柜', days: '1d' }
]
const redCount = computed(() => paperRows.filter((r) => r.tone === 'risk').length)
const toneCls = (t: string) => (t === 'ok' ? 'ok' : t === 'risk' ? 'risk' : '')
</script>

<template>
  <div class="ops">
    <section class="panel">
      <header class="ph"><span>主线 · 备货 → 出运 → 清关计划 → 提柜卸柜计划 → 达成</span><em>流程内</em></header>
      <div class="steps">
        <div v-for="(p, i) in mainline" :key="p.name" class="step">
          <b>{{ p.name }}</b><span class="mono">{{ p.meta }}</span>
          <em v-if="i < mainline.length - 1" class="arrow">→</em>
        </div>
      </div>
    </section>

    <div class="two">
      <section class="panel">
        <header class="ph"><span>年度资源计划 · 能力评估</span><em>流程外</em></header>
        <div class="rows">
          <div v-for="c in capability" :key="c.k" class="crow">
            <span class="c-lab">{{ c.k }}</span>
            <div class="bar"><i class="fill" :style="{ width: Math.min(100, Math.round((c.used / c.plan) * 100)) + '%' }"></i></div>
            <span class="mono c-val">{{ c.used }}/{{ c.plan }}</span>
          </div>
        </div>
        <p class="note">{{ gapNote }}</p>
      </section>

      <section class="panel">
        <header class="ph"><span>目的港收货条件</span><em>难度/风险 → 反馈订舱</em></header>
        <div class="dist">
          <span v-for="c in condDist" :key="c.cond" class="pill" :class="toneCls(c.tone)">{{ c.cond }} {{ c.n }}<em>柜</em></span>
        </div>
        <div class="params">
          <span v-for="p in portParam" :key="p.port" class="pp"><i>{{ p.port }}</i><b :class="toneCls(p.cond === '差' ? 'risk' : p.cond === '优' ? 'ok' : '')">{{ p.cond }}</b></span>
        </div>
      </section>
    </div>

    <div class="grid">
      <section class="panel">
        <header class="ph"><span>到港队列 · 一柜一档</span><em>出运→在途→查验→入库</em></header>
        <table class="tbl">
          <thead>
            <tr><th>柜号</th><th>备货单</th><th>B/L</th><th>节点</th><th>到港 预/实</th><th>查验</th><th>收货</th><th>卡点</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="r in paperRows" :key="r.box">
              <td class="mono">{{ r.box }}</td>
              <td class="mono">{{ r.order }}</td>
              <td class="mono">{{ r.bl }}</td>
              <td><span class="nodecur" :class="toneCls(r.tone)">{{ r.node }}</span></td>
              <td class="mono">{{ r.eta }}/{{ r.ata || '—' }}</td>
              <td :class="r.customs === '查验中' ? 'risk' : r.customs === '放行' ? 'ok' : ''">{{ r.customs }}</td>
              <td>{{ r.cond }}</td>
              <td :class="toneCls(r.tone)">{{ r.risk }}</td>
              <td><router-link :to="`/container/${r.order}`">档</router-link></td>
            </tr>
          </tbody>
        </table>
      </section>

      <aside class="side">
        <!-- ② 计划与达成 · 右侧 -->
        <section class="panel">
          <header class="ph">
            <span>计划与达成 <i>· 清关 / 提柜 / 堆场 / 送仓 / 卸柜</i></span>
            <div class="seg">
              <button :class="seg === 'month' ? 'on' : ''" @click="seg = 'month'">月</button>
              <button :class="seg === 'week' ? 'on' : ''" @click="seg = 'week'">周</button>
              <button :class="seg === 'day' ? 'on' : ''" @click="seg = 'day'">日</button>
            </div>
          </header>
          <p class="flownote">堆场＝提柜后因仓容不足暂存外部堆场；送仓＝从港口直送，或从堆场送仓 → 再卸柜</p>
          <div class="scroll">
            <table v-if="seg === 'month'" class="grid-t">
              <caption>计划/达成</caption>
              <thead><tr><th>段</th><th v-for="w in monthW" :key="w">{{ w }}</th><th>月合计</th></tr></thead>
              <tbody>
                <tr v-for="r in monthly" :key="r.name">
                  <td class="rn">{{ r.name }}</td>
                  <td v-for="c in r.cells" :key="String(c[0]) + c[1]" :class="tone(c[0], c[1])" class="mono">{{ c[0] }}/{{ c[1] }}</td>
                  <td><b class="mono">{{ monSum(r)[1] }}/{{ monSum(r)[0] }}</b></td>
                </tr>
              </tbody>
            </table>

            <table v-else-if="seg === 'week'" class="grid-t">
              <caption>计划/达成</caption>
              <thead><tr><th>段</th><th v-for="w in weekD" :key="w">周{{ w }}</th><th>周合计</th></tr></thead>
              <tbody>
                <tr v-for="r in weekly" :key="r.name">
                  <td class="rn">{{ r.name }}</td>
                  <td v-for="c in r.cells" :key="String(c[0]) + c[1]" :class="tone(c[0], c[1])" class="mono">{{ c[0] }}/{{ c[1] }}</td>
                  <td><b class="mono">{{ monSum(r)[1] }}/{{ monSum(r)[0] }}</b></td>
                </tr>
              </tbody>
            </table>

            <table v-else class="grid-t day">
              <thead><tr><th>段</th><th>今日计划</th><th>今日达成</th><th>率</th></tr></thead>
              <tbody>
                <tr v-for="r in daily" :key="r.name">
                  <td class="rn">{{ r.name }}</td>
                  <td class="mono">{{ r.p }}</td>
                  <td :class="tone(r.p, r.d)" class="mono">{{ r.d }}</td>
                  <td :class="tone(r.p, r.d)" class="mono">{{ Math.round((r.d / r.p) * 100) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <header class="ph"><span>周期 · 异常</span></header>
          <div class="chips">
            <span v-for="c in cycles" :key="c.name" class="chip">{{ c.name }}<b class="mono">{{ c.days }}</b></span>
          </div>
          <div class="line"><span>红灯</span><b :class="redCount ? 'risk' : ''">{{ redCount }}</b></div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.ops {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 10px;
}
.ph > span {
  font-weight: 700;
}
.ph em {
  font-style: normal;
  font-size: 12px;
  color: var(--muted);
}
.ph i {
  font-style: normal;
  font-weight: 500;
  color: var(--muted);
  font-size: 12px;
}
.flownote {
  margin: -4px 0 8px;
  font-size: 11px;
  color: var(--muted);
}
.steps {
  display: flex;
  overflow-x: auto;
}
.step {
  position: relative;
  min-width: 132px;
  padding: 8px 14px 8px 10px;
  border: 1px solid var(--line);
  border-right: 0;
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.step:first-child {
  border-radius: var(--radius-s) 0 0 var(--radius-s);
}
.step:last-child {
  border-right: 1px solid var(--line);
  border-radius: 0 var(--radius-s) var(--radius-s) 0;
}
.step b {
  font-size: 13px;
}
.step span.mono {
  font-size: 12px;
  color: var(--muted);
}
.step .arrow {
  position: absolute;
  right: -8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  color: var(--muted);
  font-style: normal;
  background: var(--surface);
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.crow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.c-lab {
  width: 112px;
  flex: none;
  font-size: 12px;
  color: var(--ink-soft);
}
.bar {
  flex: 1;
  height: 8px;
  background: var(--surface-2);
  border-radius: 999px;
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  background: var(--brand);
  border-radius: 999px;
}
.c-val {
  width: 46px;
  text-align: right;
  color: var(--muted);
  font-size: 12px;
}
.note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.dist {
  display: flex;
  gap: 8px;
}
.pill {
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 600;
  color: var(--ink-soft);
  background: var(--surface-2);
}
.pill em {
  font-style: normal;
  font-size: 11px;
}
.pill.ok {
  color: var(--ok);
  background: var(--ok-bg);
}
.pill.risk {
  color: var(--risk);
  background: var(--risk-bg);
}
.params {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.pp {
  display: inline-flex;
  gap: 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
}
.pp i {
  font-style: normal;
  color: var(--muted);
}
.pp b.ok {
  color: var(--ok);
}
.pp b.risk {
  color: var(--risk);
}
.grid {
  display: grid;
  grid-template-columns: 1fr 440px;
  gap: 12px;
  align-items: start;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th,
.tbl td {
  text-align: left;
  padding: 7px 6px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.tbl th {
  color: var(--muted);
  font-weight: 500;
}
.stag {
  display: inline-block;
  margin-right: 2px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--muted);
  border: 1px solid var(--line);
}
.stag.on {
  color: var(--ok);
  border-color: var(--ok);
}
.side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.seg {
  display: flex;
  gap: 2px;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
}
.seg button {
  border: 0;
  background: var(--surface);
  padding: 2px 12px;
  cursor: pointer;
  color: var(--ink-soft);
}
.seg button.on {
  background: var(--brand);
  color: #fff;
}
.scroll {
  overflow-x: visible;
}
.grid-t {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.grid-t caption {
  padding: 0 6px 5px;
  color: var(--muted);
  text-align: right;
  font-size: 11px;
}
.grid-t th,
.grid-t td {
  padding: 5px 6px;
  border-bottom: 1px solid var(--line);
  text-align: center;
  white-space: nowrap;
}
.grid-t th {
  color: var(--muted);
  font-weight: 500;
}
.grid-t .rn {
  text-align: left;
  font-weight: 600;
}
.grid-t td.ok {
  color: var(--ok);
}
.grid-t td.warn {
  color: var(--warn);
}
.grid-t td.risk {
  color: var(--risk);
}
.grid-t.day td {
  text-align: center;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--ink-soft);
}
.chip b {
  color: var(--ink);
}
.line {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 13px;
}
.risk {
  color: var(--risk);
}
.warn {
  color: var(--warn);
}
.ok {
  color: var(--ok);
}
a {
  color: var(--brand);
  text-decoration: none;
}
.line .risk {
  font-weight: 700;
}
</style>
