<script setup lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Ship,
} from "@lucide/vue";
import { computed } from "vue";
import type { PostDepartureSourceCandidateV1 } from "../../api/postDepartureSourcePackages";
import {
  handoffIssueAction,
  handoffDecisionCopy,
  isHandoffIssueBlocking,
  type HandoffResolutionTarget,
} from "../../data/postDepartureHandoffCopy";

const props = withDefaults(
  defineProps<{
    candidate: PostDepartureSourceCandidateV1;
    activeResolution?: HandoffResolutionTarget | null;
  }>(),
  { activeResolution: null },
);

const emit = defineEmits<{
  resolve: [target: HandoffResolutionTarget];
}>();

const actionableIssues = computed(() =>
  props.candidate.issues
    .filter((issue) => issue.resolutionState !== "system_handled")
    .map((issue) => ({
      issue,
      action: handoffIssueAction(issue),
      blocking: isHandoffIssueBlocking(issue),
      sourceValue: sourceValueFor(handoffIssueAction(issue).target),
    })),
);
const systemHandledCount = computed(
  () =>
    props.candidate.issues.filter(
      (issue) => issue.resolutionState === "system_handled",
    ).length,
);
const cargoLineCount = computed(
  () => props.candidate.correction?.cargoAllocations?.length ?? 0,
);

function sourceValueFor(target: HandoffResolutionTarget): string {
  if (target === "origin_port")
    return props.candidate.originPortRaw || "未提供";
  if (target === "destination_port") {
    return props.candidate.destinationPortRaw || "未提供";
  }
  if (target === "departure") return props.candidate.departureRaw || "未提供";
  if (target === "shipment_grouping") {
    return props.candidate.billNumbers.join("、") || "未提供可用归组";
  }
  if (target === "cargo_owner") {
    return props.candidate.cargoOwnerName || "未提供";
  }
  if (target === "cargo") return "未提供 SKU 装载明细";
  return "当前来源文件";
}
</script>

<template>
  <section class="candidate-detail" aria-label="当前候选事实与待办">
    <div class="route-block">
      <header class="candidate-heading">
        <span class="candidate-heading__identity">
          <small>当前候选</small>
          <b>{{ candidate.containerNumber }}</b>
        </span>
        <span
          class="candidate-state"
          :class="`candidate-state--${candidate.decision}`"
        >
          <CheckCircle2
            v-if="candidate.decision === 'ready'"
            :size="14"
            aria-hidden="true"
          />
          <Clock3
            v-else-if="candidate.decision === 'review_required'"
            :size="14"
            aria-hidden="true"
          />
          <AlertTriangle v-else :size="14" aria-hidden="true" />
          {{ handoffDecisionCopy(candidate.decision) }}
        </span>
      </header>

      <section class="route-overview" aria-label="候选出运路线">
        <div class="route-endpoint">
          <small>起运港</small>
          <b>{{ candidate.originPortRaw || "待确认" }}</b>
          <span>{{
            candidate.departureRaw
              ? `${candidate.departureRaw} 离港`
              : "离港时间待补"
          }}</span>
        </div>
        <div class="route-progress">
          <div class="route-meta">
            <span>已出运</span>
            <span
              >{{ candidate.carrierCode || "船公司待补" }} ·
              {{ candidate.vesselName || "船名待补" }} /
              {{ candidate.voyageNumber || "航次待补" }}</span
            >
          </div>
          <div class="route-axis" aria-hidden="true">
            <span class="route-axis__point route-axis__point--active"></span>
            <span class="route-axis__line route-axis__line--active"></span>
            <span class="route-axis__ship"><Ship :size="17" /></span>
            <span class="route-axis__line"></span>
            <span class="route-axis__point"></span>
          </div>
        </div>
        <div class="route-endpoint route-endpoint--destination">
          <small>目的港</small>
          <b>{{ candidate.destinationPortRaw || "待确认" }}</b>
          <span>{{
            candidate.estimatedArrivalRaw
              ? `预计 ${candidate.estimatedArrivalRaw}`
              : "到港时间待补"
          }}</span>
        </div>
      </section>
    </div>

    <section class="fact-section" aria-label="候选核心信息">
      <header class="section-heading">
        <b>核心信息</b>
        <small>提单 / 船公司 / 货主 / 装载</small>
      </header>
      <dl class="fact-grid">
        <div>
          <dt>备货单</dt>
          <dd>
            {{ candidate.replenishmentOrderNumbers.join("、") || "待补" }}
          </dd>
        </div>
        <div>
          <dt>提单</dt>
          <dd>{{ candidate.billNumbers.join("、") || "待补" }}</dd>
        </div>
        <div>
          <dt>船名 / 航次</dt>
          <dd>
            {{ candidate.vesselName || "待补" }} /
            {{ candidate.voyageNumber || "待补" }}
          </dd>
        </div>
        <div>
          <dt>船公司</dt>
          <dd>{{ candidate.carrierCode || "待补" }}</dd>
        </div>
        <div>
          <dt>货主</dt>
          <dd>{{ candidate.cargoOwnerName || "待映射" }}</dd>
        </div>
        <div>
          <dt>柜型</dt>
          <dd>{{ candidate.containerTypeCode || "待补" }}</dd>
        </div>
        <div>
          <dt>件 / 重 / 体</dt>
          <dd>
            {{ candidate.packageCount || "-" }} ·
            {{ candidate.grossWeightKg || "-" }} kg ·
            {{ candidate.volumeM3 || "-" }} m³
          </dd>
        </div>
        <div>
          <dt>SKU 明细</dt>
          <dd>{{ cargoLineCount ? `${cargoLineCount} 行` : "未提供" }}</dd>
        </div>
      </dl>
    </section>

    <section class="action-runway" aria-label="待补动作">
      <header class="action-runway__heading">
        <span>
          <Clock3 :size="17" aria-hidden="true" />
          <b>待补清单</b>
          <em>{{ actionableIssues.length }} 项待补</em>
        </span>
        <small>可先接管，按优先顺序补齐</small>
      </header>

      <p v-if="actionableIssues.length === 0" class="action-runway__empty">
        <CheckCircle2 :size="17" aria-hidden="true" />
        当前资料已齐，可直接接管。
      </p>
      <ul v-else class="action-list">
        <li
          v-for="{ issue, action, blocking, sourceValue } in actionableIssues"
          :key="`${issue.code}:${issue.fieldCodes?.join(',')}`"
          :class="[
            'action-row',
            {
              'action-row--active': activeResolution === action.target,
              'action-row--blocking': blocking,
            },
          ]"
        >
          <span class="action-row__content">
            <span class="action-row__title">
              <AlertTriangle
                v-if="blocking"
                class="action-row__icon"
                :size="15"
                aria-hidden="true"
              />
              <Clock3
                v-else
                class="action-row__icon"
                :size="15"
                aria-hidden="true"
              />
              <b>{{ action.title }}</b>
            </span>
            <span class="action-row__meta">
              <small
                class="action-row__impact"
                :title="action.impact"
                :aria-label="action.impact"
              >
                {{ blocking ? "需先解决" : "不影响接管" }}
              </small>
              <small class="action-row__source" :title="sourceValue">
                当前：{{ sourceValue }}
              </small>
            </span>
          </span>
          <button
            type="button"
            :aria-pressed="activeResolution === action.target"
            @click="emit('resolve', action.target)"
          >
            {{ action.actionLabel }}
            <ArrowRight :size="15" aria-hidden="true" />
          </button>
        </li>
      </ul>

      <p v-if="systemHandledCount" class="system-result">
        <CheckCircle2 :size="16" aria-hidden="true" />
        {{ systemHandledCount }} 项已由系统处理
      </p>
    </section>
  </section>
</template>

<style scoped>
.candidate-detail {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
  background: var(--surface-2);
}

.route-block,
.fact-section,
.action-runway {
  background: var(--surface);
}

.candidate-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  min-height: 58px;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.candidate-heading__identity {
  display: grid;
  gap: var(--space-1);
}

.candidate-heading small,
.fact-grid dt,
.action-runway small,
.action-row small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.candidate-state {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-control);
  background: var(--surface-2);
  color: var(--muted);
  font-size: var(--text-label);
  font-weight: 600;
}

.candidate-state--ready {
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.candidate-state--review_required {
  background: var(--warn-bg);
  color: var(--warn);
}

.candidate-state--rejected {
  background: var(--risk-bg);
  color: var(--risk);
}

.route-overview {
  display: grid;
  grid-template-columns: minmax(120px, 0.8fr) minmax(180px, 1.4fr) minmax(
      120px,
      0.8fr
    );
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-4);
}

.route-endpoint {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.route-endpoint--destination {
  text-align: right;
}

.route-endpoint small,
.route-endpoint span,
.route-meta {
  color: var(--muted);
  font-size: var(--text-micro);
}

.route-endpoint b {
  overflow-wrap: anywhere;
  font-size: var(--text-title);
}

.route-progress {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.route-axis {
  min-width: 0;
  display: grid;
  grid-template-columns: 8px minmax(18px, 1fr) 34px minmax(18px, 1fr) 8px;
  align-items: center;
}

.route-axis__point {
  width: 8px;
  height: 8px;
  border: 2px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface);
}

.route-axis__point--active {
  border-color: var(--brand);
  background: var(--brand);
}

.route-axis__line {
  height: 2px;
  background: var(--line);
}

.route-axis__line--active {
  background: var(--brand);
}

.route-axis__ship {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--brand-line);
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.route-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-width: 0;
  text-align: center;
  flex-wrap: wrap;
}

.route-meta span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
}

.route-meta span:first-child {
  color: var(--brand-strong);
  font-weight: 600;
}

.fact-section {
  min-width: 0;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) var(--space-2);
}

.section-heading small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.fact-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
}

.fact-grid > div {
  min-width: 0;
  padding: var(--space-2) var(--space-4) var(--space-3);
}

.fact-grid dt {
  margin-bottom: var(--space-1);
}

.fact-grid dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--text-meta);
}

.action-runway {
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.action-runway__heading,
.action-runway__heading > span,
.system-result,
.action-runway__empty {
  display: flex;
  align-items: center;
}

.action-runway__heading {
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.action-runway__heading > span,
.system-result,
.action-runway__empty {
  gap: var(--space-2);
}

.action-runway__heading > span {
  color: var(--warn);
}

.action-runway__heading em {
  padding: 0 var(--space-1);
  border-radius: var(--radius-control);
  background: var(--warn-bg);
  color: var(--warn);
  font-size: var(--text-micro);
  font-style: normal;
  font-weight: 600;
}

.action-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.action-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  min-height: 68px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-left: 3px solid var(--warn);
  border-radius: var(--radius-control);
  background: var(--surface);
}

.action-row--active {
  background: var(--brand-soft);
  border-color: var(--brand-line);
  border-left-color: var(--brand);
}

.action-row--blocking {
  background: var(--risk-bg);
  border-color: color-mix(in srgb, var(--risk) 28%, var(--line));
  border-left-color: var(--risk);
}

.action-row__icon {
  color: var(--warn);
}

.action-row--blocking .action-row__icon {
  color: var(--risk);
}

.action-row__content {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.action-row__title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.action-row__title b {
  min-width: 0;
  line-height: var(--leading-title);
}

.action-row__content b,
.action-row__content small {
  overflow-wrap: anywhere;
}

.action-row__content .action-row__source {
  min-width: 0;
  color: var(--ink-soft);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-row__meta {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.action-row__impact {
  flex: none;
  padding: 0 var(--space-1);
  border-radius: var(--radius-control);
  background: var(--surface-2);
  color: var(--muted);
  font-weight: 600;
  white-space: nowrap;
}

.action-row button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--brand-line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--brand-strong);
  font-size: var(--text-label);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.action-row button:hover,
.action-row button:focus-visible {
  border-color: var(--brand);
  background: var(--brand-soft);
}

.action-row button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.action-runway__empty {
  margin: 0;
  color: var(--brand-strong);
  font-size: var(--text-label);
}

.system-result {
  margin: var(--space-2) 0 0;
  color: var(--brand-strong);
  font-size: var(--text-label);
}

@media (max-width: 680px) {
  .candidate-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .fact-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .route-overview {
    grid-template-columns: minmax(0, 1fr) minmax(120px, 1fr) minmax(0, 1fr);
    gap: var(--space-2);
  }

  .action-list {
    grid-template-columns: 1fr;
  }

  .action-runway__heading {
    align-items: flex-start;
  }
}

@media (max-width: 460px) {
  .route-overview {
    grid-template-columns: minmax(0, 1fr) minmax(86px, 0.8fr) minmax(0, 1fr);
    padding: var(--space-3);
  }

  .route-axis {
    grid-template-columns: 6px minmax(8px, 1fr) 30px minmax(8px, 1fr) 6px;
  }

  .route-axis__point {
    width: 6px;
    height: 6px;
  }

  .route-axis__ship {
    width: 30px;
    height: 30px;
  }

  .fact-grid,
  .action-list {
    grid-template-columns: 1fr;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
