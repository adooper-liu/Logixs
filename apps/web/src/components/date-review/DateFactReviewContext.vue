<script setup lang="ts">
import type { LifecycleDateFactReviewItem } from "@logix/contracts";
import type { DeepReadonly } from "vue";

defineProps<{ item: DeepReadonly<LifecycleDateFactReviewItem> | null }>();
</script>

<template>
  <section class="review-context" aria-labelledby="review-context-title">
    <p class="eyebrow">事实与证据</p>
    <h2 id="review-context-title">复核上下文</h2>
    <p v-if="!item" class="empty">从左侧选择一条日期声明。</p>
    <template v-else>
      <dl class="facts">
        <div>
          <dt>货柜 / 备货单</dt>
          <dd>
            {{ item.containerNumber || "待绑定" }} / {{ item.orderNumber }}
          </dd>
        </div>
        <div>
          <dt>节点 / 事件</dt>
          <dd>{{ item.nodeCode }} / {{ item.eventCode }}</dd>
        </div>
        <div>
          <dt>实际发生时间</dt>
          <dd>{{ new Date(item.occurredAt).toLocaleString() }}</dd>
        </div>
        <div>
          <dt>来源原值</dt>
          <dd>{{ item.rawValue }}（{{ item.sourceUtcOffset }}）</dd>
        </div>
        <div>
          <dt>来源系统</dt>
          <dd>{{ item.sourceSystem }} / {{ item.authoritySystem }}</dd>
        </div>
        <div>
          <dt>录入人</dt>
          <dd>{{ item.submittedBy || "身份缺失" }}</dd>
        </div>
        <div>
          <dt>录入时间</dt>
          <dd>{{ new Date(item.recordedAt).toLocaleString() }}</dd>
        </div>
        <div>
          <dt>地点</dt>
          <dd>
            {{ item.location?.unlocode || item.location?.locationId || "未提供"
            }}<template v-if="item.location">
              · {{ item.location.timezone }}</template
            >
          </dd>
        </div>
      </dl>
      <div class="evidence-heading">
        <h3>证据</h3>
        <span
          >{{ item.evidence.filter((entry) => entry.qualified).length }} /
          {{ item.evidence.length }} 合格</span
        >
      </div>
      <ul class="evidence-list">
        <li v-for="entry in item.evidence" :key="entry.evidenceId">
          <span
            ><strong>{{ entry.evidenceType }}</strong
            ><small>{{ entry.evidenceId }}</small></span
          >
          <span :class="entry.qualified ? 'qualified' : 'unqualified'">
            {{
              entry.qualified
                ? "已核验有效"
                : `${entry.verificationState} / ${entry.validity}`
            }}
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.review-context {
  min-width: 0;
}
.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-label);
}
h2 {
  margin: 0 0 var(--space-4);
  font-size: var(--text-title);
  letter-spacing: 0;
}
.empty {
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-meta);
}
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3) var(--space-4);
  margin: 0;
}
.facts div {
  min-width: 0;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid #eaecf0;
}
dt {
  margin-bottom: var(--space-1);
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-label);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--text-meta);
}
.evidence-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: var(--space-5) 0 var(--space-2);
}
h3 {
  margin: 0;
  font-size: var(--text-body);
  letter-spacing: 0;
}
.evidence-heading span {
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-label);
}
.evidence-list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.evidence-list li {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: #f8fafc;
  border-radius: 4px;
  font-size: var(--text-label);
}
.evidence-list li > span:first-child {
  display: grid;
  min-width: 0;
}
small {
  overflow: hidden;
  color: var(--app-text-secondary, #667085);
  text-overflow: ellipsis;
}
.qualified {
  color: #067647;
  white-space: nowrap;
}
.unqualified {
  color: #b54708;
  white-space: nowrap;
}
@media (max-width: 720px) {
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
