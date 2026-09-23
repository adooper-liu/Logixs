<script setup lang="ts">
import { computed } from "vue";
import type {
  RaciCell,
  RaciCode,
  RaciNodeRow,
  RaciRole,
} from "../../data/raciContract";
import { raciRoleDefinitions } from "../../data/raciContract";
import InfoTooltip from "../ui/InfoTooltip.vue";

const props = defineProps<{
  rows: readonly RaciNodeRow[];
  containerRecordId?: string;
}>();

const codeDescriptions: Record<RaciCode, string> = {
  A: "最终负责并拍板",
  R: "负责执行",
  C: "提供意见",
  I: "同步知情",
};

const rowViews = computed(() =>
  props.rows.map((row, index) => ({
    ...row,
    index: index + 1,
    to: props.containerRecordId
      ? `/container/${props.containerRecordId}?node=${row.nodeKey}`
      : undefined,
    cellsByRole: new Map<RaciRole, RaciCell>(
      row.cells.map((cell) => [cell.role, cell]),
    ),
  })),
);

const describeCell = (cell: RaciCell, nodeName: string) => {
  const role = raciRoleDefinitions.find((item) => item.key === cell.role);
  return `${nodeName}：${role?.label ?? cell.role} ${cell.code} · ${codeDescriptions[cell.code]}`;
};
</script>

<template>
  <section class="raci-panel" aria-labelledby="raci-title">
    <header class="panel-head">
      <div>
        <h2 id="raci-title">RACI 责任投影</h2>
        <InfoTooltip
          label="查看 RACI 投影来源"
          text="运行时无 RACI 查询投影；空表表示尚未提供权威责任矩阵。"
        />
      </div>
      <span><b>A</b> 拍板 · <strong>R</strong> 执行</span>
    </header>

    <div class="raci-scroll" data-testid="raci-scroll">
      <table aria-label="14 节点 RACI 责任投影">
        <thead>
          <tr>
            <th scope="col">主链节点</th>
            <th v-for="role in raciRoleDefinitions" :key="role.key" scope="col">
              {{ role.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rowViews" :key="row.nodeKey">
            <th scope="row">
              <router-link v-if="row.to" :to="row.to">
                <small class="mono">{{
                  String(row.index).padStart(2, "0")
                }}</small>
                <span>{{ row.nodeName }}</span>
              </router-link>
              <span v-else class="node-label">
                <small class="mono">{{
                  String(row.index).padStart(2, "0")
                }}</small>
                <span>{{ row.nodeName }}</span>
              </span>
            </th>
            <td v-for="role in raciRoleDefinitions" :key="role.key">
              <template v-if="row.cellsByRole.get(role.key)">
                <span
                  v-if="row.cellsByRole.get(role.key)?.code === 'A'"
                  class="raci-code accountable"
                  :aria-label="
                    describeCell(row.cellsByRole.get(role.key)!, row.nodeName)
                  "
                  >A</span
                >
                <span
                  v-else-if="row.cellsByRole.get(role.key)?.code === 'R'"
                  class="raci-code responsible"
                  :aria-label="
                    describeCell(row.cellsByRole.get(role.key)!, row.nodeName)
                  "
                  >R</span
                >
                <InfoTooltip
                  v-else
                  :label="
                    describeCell(row.cellsByRole.get(role.key)!, row.nodeName)
                  "
                  :text="
                    describeCell(row.cellsByRole.get(role.key)!, row.nodeName)
                  "
                />
              </template>
              <span v-else class="empty" aria-label="无职责">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.raci-panel {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
  overflow: hidden;
}

.panel-head {
  min-height: 44px;
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.panel-head > div {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.panel-head h2 {
  margin: 0;
  font-size: var(--text-body);
}

.panel-head > span {
  color: var(--muted);
  font-size: var(--text-micro);
}

.panel-head > span b,
.panel-head > span strong {
  font-size: var(--text-micro);
}

.panel-head > span b {
  color: var(--brand);
}

.panel-head > span strong {
  color: var(--info);
}

.raci-scroll {
  max-width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  height: 40px;
  padding: var(--space-1) var(--space-2);
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  text-align: center;
}

th:last-child,
td:last-child {
  border-right: 0;
}

tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: 0;
}

thead th {
  height: 34px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 650;
}

thead th:first-child,
tbody th {
  width: 164px;
  text-align: left;
}

tbody th {
  background: var(--surface);
}

tbody tr:hover th,
tbody tr:hover td {
  background: var(--surface-2);
}

tbody th a,
.node-label {
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--ink);
  text-decoration: none;
}

tbody th a:hover span {
  color: var(--brand);
}

tbody th small {
  color: var(--muted);
  font-size: var(--text-micro);
}

tbody th span {
  overflow: hidden;
  font-size: var(--text-micro);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.raci-code {
  width: 24px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-s);
  font-size: var(--text-micro);
  font-weight: 750;
}

.accountable {
  background: var(--brand);
  color: var(--on-brand);
}

.responsible {
  border: 1px solid var(--info);
  background: var(--info-bg);
  color: var(--info);
}

.empty {
  color: var(--line-strong);
  font-size: var(--text-micro);
}

@media (max-width: 720px) {
  .panel-head {
    align-items: flex-start;
  }

  .panel-head > span {
    display: none;
  }

  table {
    min-width: 720px;
  }
}
</style>
