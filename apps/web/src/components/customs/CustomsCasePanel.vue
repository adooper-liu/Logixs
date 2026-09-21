<script setup lang="ts">
import {
  Anchor,
  BadgeCheck,
  CirclePause,
  FileCheck2,
  Landmark,
} from "@lucide/vue";
import type { CustomsClearanceCaseView } from "../../api/customsClearance";
import type { LifecycleDateFact } from "../../api/lifecycleDateFacts";
import type { LiveNodeView } from "../../data/liveNodeProjection";

defineProps<{
  clearanceCase: CustomsClearanceCaseView | null;
  arrivalFact: LifecycleDateFact | null;
  customsActualFact: LifecycleDateFact | null;
  node: LiveNodeView | null;
}>();

function dateLabel(value: string | undefined): string {
  return value ? new Date(value).toLocaleString() : "尚未登记";
}

function filingLabel(value: CustomsClearanceCaseView["filingState"]): string {
  return { not_filed: "未申报", filed: "已申报", accepted: "申报已受理" }[
    value
  ];
}

function decisionLabel(
  value: CustomsClearanceCaseView["decisionState"],
): string {
  return { pending: "待海关决定", held: "海关扣留", released: "海关已放行" }[
    value
  ];
}
</script>

<template>
  <section class="case-panel" aria-label="清关事实总览">
    <header>
      <span><Landmark :size="17" />清关案件</span>
      <b>{{ node?.stateLabel ?? "流程未初始化" }}</b>
    </header>
    <div class="milestones">
      <span
        ><Anchor :size="15" /><small>目的港实际到港</small
        ><b>{{ dateLabel(arrivalFact?.occurredAt) }}</b></span
      >
      <span
        ><FileCheck2 :size="15" /><small>实际清关</small
        ><b>{{ dateLabel(customsActualFact?.occurredAt) }}</b></span
      >
    </div>
    <div v-if="clearanceCase" class="facts">
      <span
        ><small>进口司法辖区</small
        ><b>{{ clearanceCase.jurisdictionCountryCode }}</b></span
      >
      <span
        ><small>申报编号</small
        ><b>{{ clearanceCase.declarationNumber ?? "待申报" }}</b></span
      >
      <span
        ><small>清关行档案</small
        ><b>{{ clearanceCase.customsBrokerPartyId ?? "待分配" }}</b></span
      >
      <span
        ><small>申报状态</small
        ><b>{{ filingLabel(clearanceCase.filingState) }}</b></span
      >
      <span>
        <small>海关决定</small>
        <b
          :class="
            clearanceCase.decisionState === 'released'
              ? 'ok'
              : clearanceCase.decisionState === 'held'
                ? 'risk'
                : ''
          "
        >
          <BadgeCheck
            v-if="clearanceCase.decisionState === 'released'"
            :size="13"
          />
          <CirclePause
            v-else-if="clearanceCase.decisionState === 'held'"
            :size="13"
          />
          {{ decisionLabel(clearanceCase.decisionState) }}
        </b>
      </span>
      <span
        ><small>活动扣留</small
        ><b>{{ clearanceCase.activeHoldCodes.join("、") || "无" }}</b></span
      >
      <span
        ><small>证据</small
        ><b>{{ clearanceCase.evidenceRefs.length }} 份</b></span
      >
      <span
        ><small>当前版本</small><b>第 {{ clearanceCase.version }} 版</b></span
      >
    </div>
    <p v-else class="empty">尚未建立清关案件。</p>
    <p
      v-if="customsActualFact?.applicationState === 'review_required'"
      class="review"
    >
      实际清关时间已提交，等待复核岗位核验。
    </p>
    <p
      v-else-if="customsActualFact?.applicationState === 'pending_application'"
      class="review"
    >
      日期已采信，正在等待清关案件或前序节点满足过站条件。
    </p>
  </section>
</template>

<style scoped>
.case-panel {
  display: grid;
}
header {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
  font-size: 12px;
}
header span,
.ok,
.risk {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.milestones,
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.milestones > span,
.facts > span {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 11px 12px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.facts {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
b {
  overflow-wrap: anywhere;
  font-size: 12px;
}
small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 10px;
}
.ok {
  color: var(--ok);
}
.risk {
  color: var(--risk);
}
.empty,
.review {
  margin: 0;
  padding: 13px 12px;
  font-size: 12px;
}
.empty {
  color: var(--muted);
}
.review {
  background: var(--warn-bg);
  color: var(--warn);
}
@media (max-width: 720px) {
  .milestones,
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
