<script setup lang="ts">
import { computed, type DeepReadonly } from "vue";
import type { CargoReadyComplianceAssessment } from "../../api/cargoReadyCompliance";

const props = defineProps<{
  assessment: DeepReadonly<CargoReadyComplianceAssessment> | null;
  loading: boolean;
}>();

const decisionLabel = computed(() => {
  const code = props.assessment?.currentDecision?.decisionCode;
  if (!code) return "待决定";
  return (
    {
      approved: "已放行",
      approved_with_conditions: "有条件放行",
      blocked: "已阻断",
      evidence_required: "待补证",
    }[code] ?? code
  );
});
</script>

<template>
  <section class="assessment-panel" aria-labelledby="assessment-title">
    <header class="panel-heading">
      <div>
        <p class="panel-eyebrow">当前评审</p>
        <h2 id="assessment-title" class="panel-title">
          {{ assessment ? decisionLabel : "尚未评审" }}
        </h2>
      </div>
      <span v-if="assessment" class="state-mark" :data-state="assessment.state">
        v{{ assessment.version }} · {{ assessment.state }}
      </span>
    </header>

    <p v-if="loading" class="empty-state">正在读取评审…</p>
    <p v-else-if="!assessment" class="empty-state">
      当前货柜还没有备货合规评审。
    </p>

    <template v-else>
      <dl class="fact-strip">
        <div>
          <dt>司法辖区</dt>
          <dd>{{ assessment.jurisdictionCountryCode }}</dd>
        </div>
        <div>
          <dt>评审日期</dt>
          <dd>{{ assessment.assessmentDate }}</dd>
        </div>
        <div>
          <dt>SKU</dt>
          <dd>{{ assessment.items.length }}</dd>
        </div>
        <div>
          <dt>适用规则</dt>
          <dd>{{ assessment.applicableRules.length }}</dd>
        </div>
        <div>
          <dt>未关闭发现</dt>
          <dd>{{ assessment.findings.length }}</dd>
        </div>
      </dl>

      <section class="data-section" aria-labelledby="rule-list-title">
        <h3 id="rule-list-title" class="section-title">适用规则</h3>
        <p v-if="assessment.applicableRules.length === 0" class="empty-state">
          没有锁定适用规则。
        </p>
        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>规则</th>
                <th>SKU</th>
                <th>层级</th>
                <th>证书</th>
                <th>依据</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="rule in assessment.applicableRules"
                :key="`${rule.ruleVersionId}:${rule.productSkuId}`"
              >
                <td>{{ rule.ruleCode }} v{{ rule.version }}</td>
                <td>{{ rule.productSkuId }}</td>
                <td>{{ rule.requirementLayer }}</td>
                <td>{{ rule.requiredCertificateTypes.join(", ") || "—" }}</td>
                <td>
                  <a
                    :href="rule.officialSourceUrl"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ rule.legalCitation }}
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="data-section" aria-labelledby="finding-list-title">
        <h3 id="finding-list-title" class="section-title">整改发现</h3>
        <p v-if="assessment.findings.length === 0" class="clear-state">
          当前评审没有未解决发现。
        </p>
        <ul v-else class="finding-list">
          <li
            v-for="(finding, index) in assessment.findings"
            :key="`${finding.code}:${finding.productSkuId ?? 'container'}:${index}`"
            class="finding-row"
          >
            <span class="finding-code">{{ finding.code }}</span>
            <span class="finding-detail">{{ finding.detail }}</span>
            <span class="finding-target">
              {{ finding.productSkuId ?? "整柜" }}
            </span>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style scoped>
.assessment-panel {
  min-width: 0;
  border: 1px solid var(--line, #d7dde5);
  background: var(--surface, #ffffff);
}
.panel-heading {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--line, #d7dde5);
}
.panel-eyebrow,
.panel-title,
.section-title,
.empty-state,
.clear-state {
  margin: 0;
}
.panel-eyebrow {
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-label);
}
.panel-title {
  margin-top: var(--space-1);
  font-size: var(--text-page);
  letter-spacing: 0;
}
.state-mark {
  flex: 0 0 auto;
  color: var(--app-text-secondary, #667085);
  font:
    12px ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}
.fact-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(90px, 1fr));
  margin: 0;
  border-bottom: 1px solid var(--line, #d7dde5);
}
.fact-strip div {
  min-width: 0;
  padding: var(--space-3) var(--space-4);
  border-right: 1px solid var(--line, #d7dde5);
}
.fact-strip div:last-child {
  border-right: 0;
}
.fact-strip dt {
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-micro);
}
.fact-strip dd {
  margin: var(--space-1) 0 0;
  overflow-wrap: anywhere;
  font-weight: 600;
}
.data-section {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--line, #d7dde5);
}
.data-section:last-child {
  border-bottom: 0;
}
.section-title {
  margin-bottom: var(--space-3);
  font-size: var(--text-body);
  letter-spacing: 0;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-label);
}
.data-table th,
.data-table td {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  border-bottom: 1px solid var(--line, #d7dde5);
  vertical-align: top;
}
.data-table th {
  color: var(--app-text-secondary, #667085);
  font-weight: 600;
}
.data-table a {
  color: var(--app-link, #0b63ce);
}
.finding-list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.finding-row {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(220px, 1.5fr) minmax(
      120px,
      1fr
    );
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-3) var(--space-3);
  border-left: 3px solid var(--app-danger, #c2413b);
  background: color-mix(in srgb, var(--app-danger, #c2413b) 7%, transparent);
  font-size: var(--text-label);
}
.finding-code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  overflow-wrap: anywhere;
}
.finding-detail,
.finding-target {
  overflow-wrap: anywhere;
}
.finding-target {
  color: var(--app-text-secondary, #667085);
}
.empty-state,
.clear-state {
  padding: var(--space-5);
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-meta);
}
.data-section .empty-state,
.data-section .clear-state {
  padding: var(--space-1) 0;
}
.clear-state {
  color: var(--app-success, #087f5b);
}
@media (max-width: 880px) {
  .fact-strip {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }
  .fact-strip div {
    border-bottom: 1px solid var(--line, #d7dde5);
  }
  .finding-row {
    grid-template-columns: 1fr;
  }
}
</style>
