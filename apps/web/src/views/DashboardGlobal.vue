<script setup lang="ts">
import { globalStats } from '../data/sample'
</script>

<template>
  <section class="dash">
    <h2>全局 · 货柜状态与分布（示意口径）</h2>
    <div class="stat-grid">
      <div v-for="s in globalStats" :key="s.name" class="stat">
        <b>{{ s.v }}</b>
        <span>{{ s.name }}</span>
      </div>
    </div>
    <div class="cards">
      <div class="card">
        <div class="t">状态分布</div>
        <p class="note">环形图 · 每柜只计一次（下钻到中观/微观）</p>
      </div>
      <div class="card">
        <div class="t">逾期风险分桶（示意）</div>
        <ul class="risk-list">
          <li class="risk">ETA 超期：3</li>
          <li class="risk">计划提柜超期：2</li>
          <li class="warn">最晚还箱临近：5</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dash {
  padding: 20px;
  max-width: 900px;
}
h2 {
  font-size: 18px;
  margin: 0 0 14px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
}
.stat b {
  font-size: 28px;
  color: var(--brand);
  font-variant-numeric: tabular-nums;
}
.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px;
}
.t {
  font-weight: 600;
  margin-bottom: 6px;
}
.note {
  color: var(--muted);
  font-size: 13px;
}
.risk-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.risk-list li {
  margin: 4px 0;
}
.risk {
  color: var(--risk);
}
.warn {
  color: var(--warn);
}
</style>
