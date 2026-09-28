<script setup lang="ts">
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Lightbulb,
  MapPin,
  PencilLine,
  RadioTower,
} from "@lucide/vue";
import { computed, shallowRef, watch } from "vue";
import type {
  MarketSignalGapCode,
  MarketSignalScenario,
  MarketSignalSupplementDraft,
} from "../../data/marketSignalScenarios";
import MarketSignalGapEditor from "./MarketSignalGapEditor.vue";

const props = defineProps<{
  signal: MarketSignalScenario;
  /** 作废/归档：整页关闭态，禁止待补催办与补录。 */
  closed?: boolean;
}>();
const emit = defineEmits<{
  supplement: [draft: MarketSignalSupplementDraft];
}>();

const expandedEvidenceId = shallowRef<string | null>(null);
const selectedGapCode = shallowRef<MarketSignalGapCode | null>(null);
const evidenceOpen = shallowRef(false);
const selectedGap = computed(
  () =>
    props.signal.gaps.find((gap) => gap.code === selectedGapCode.value) ?? null,
);

const evidenceByDate = computed(() => {
  const groups = new Map<string, MarketSignalScenario["evidence"][number][]>();
  for (const item of props.signal.evidence) {
    const day = item.observedAt;
    const bucket = groups.get(day) ?? [];
    bucket.push(item);
    groups.set(day, bucket);
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }));
});

const evidenceSummary = computed(() => {
  const count = props.signal.evidence.length;
  if (count === 0) return "无来源证据";
  const dates = [
    ...new Set(props.signal.evidence.map((item) => item.observedAt)),
  ];
  if (dates.length === 1) return `${count} 条来源 · ${dates[0]}`;
  return `${count} 条来源 · ${dates[dates.length - 1]} 至 ${dates[0]}`;
});

watch(
  () => props.signal.id,
  () => {
    expandedEvidenceId.value = null;
    selectedGapCode.value = null;
    evidenceOpen.value = false;
  },
);

watch(
  () => props.closed,
  (closed) => {
    if (closed) {
      selectedGapCode.value = null;
      evidenceOpen.value = false;
    }
  },
);

function toggleEvidence(id: string): void {
  expandedEvidenceId.value = expandedEvidenceId.value === id ? null : id;
}

function openGap(code: MarketSignalGapCode): void {
  if (props.closed) return;
  selectedGapCode.value = selectedGapCode.value === code ? null : code;
}

function saveSupplement(draft: MarketSignalSupplementDraft): void {
  emit("supplement", draft);
  selectedGapCode.value = null;
}

function safeSourceUrl(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
</script>

<template>
  <article class="evidence-panel" :class="{ 'evidence-panel--closed': closed }">
    <header v-if="!closed" class="pane-heading">
      <div>
        <small>依据是什么</small>
        <h2>{{ signal.title }}</h2>
      </div>
      <span>{{ signal.owner }}</span>
    </header>

    <section
      class="judgment-layer"
      :aria-label="closed ? '关闭时的事实与判断' : '事实与经营判断'"
    >
      <div class="judgment-layer__head">
        <small>判断</small>
        <h3>事实与经营判断</h3>
      </div>
      <div class="fact-hypothesis">
        <section aria-labelledby="observed-title">
          <span class="section-marker">已观察到</span>
          <h4 id="observed-title">事实</h4>
          <ul v-if="signal.observedFacts.length">
            <li v-for="fact in signal.observedFacts" :key="fact">{{ fact }}</li>
          </ul>
          <p v-else class="missing-copy">
            {{
              closed
                ? "关闭时未登记观察事实。"
                : "观察事实待补，可以先判断去向。"
            }}
          </p>
        </section>
        <section aria-labelledby="hypothesis-title">
          <span class="section-marker section-marker--hypothesis"
            >尚待验证</span
          >
          <h4 id="hypothesis-title">经营判断</h4>
          <p v-if="signal.hypothesis">
            <Lightbulb :size="17" aria-hidden="true" />{{ signal.hypothesis }}
          </p>
          <p v-else class="missing-copy">
            <Lightbulb :size="17" aria-hidden="true" />
            {{
              closed ? "关闭时未登记经营判断。" : "经营判断待补，可以后续完善。"
            }}
          </p>
        </section>
      </div>
    </section>

    <section class="basis-layer" aria-label="依据与范围">
      <dl class="signal-scope">
        <div>
          <dt><MapPin :size="14" aria-hidden="true" />市场</dt>
          <dd :class="{ missing: !closed && !signal.market }">
            {{
              signal.market || (closed ? "关闭时未填" : "待补，不影响先处理")
            }}
          </dd>
        </div>
        <div>
          <dt><RadioTower :size="14" aria-hidden="true" />渠道</dt>
          <dd :class="{ missing: !closed && !signal.channel }">
            {{
              signal.channel || (closed ? "关闭时未填" : "待补，不影响先处理")
            }}
          </dd>
        </div>
        <div>
          <dt>商品范围</dt>
          <dd :class="{ missing: !closed && !signal.category }">
            {{
              signal.category ||
              (closed ? "关闭时未填" : "待选择，不影响先处理")
            }}
          </dd>
        </div>
      </dl>

      <p
        v-if="closed && signal.gaps.length"
        class="closed-gap-summary"
        role="status"
      >
        关闭时 {{ signal.gaps.length }} 项未补齐（{{
          signal.gaps.map((gap) => gap.fieldLabel).join("、")
        }}）
      </p>
      <p
        v-else-if="closed"
        class="closed-gap-summary closed-gap-summary--ok"
        role="status"
      >
        关闭时无未补项。
      </p>
    </section>

    <section class="source-section" aria-labelledby="source-title">
      <button
        type="button"
        class="evidence-fold"
        :aria-expanded="evidenceOpen"
        @click="evidenceOpen = !evidenceOpen"
      >
        <span>
          <small>来源证据</small>
          <b id="source-title">{{ evidenceSummary }}</b>
        </span>
        <ChevronDown
          :size="16"
          aria-hidden="true"
          :class="{ open: evidenceOpen }"
        />
      </button>

      <div v-if="evidenceOpen" class="evidence-body">
        <ul v-if="evidenceByDate.length" class="source-timeline">
          <li
            v-for="group in evidenceByDate"
            :key="group.date"
            class="source-day"
          >
            <time :datetime="group.date">{{ group.date }}</time>
            <ul class="source-list">
              <li v-for="evidence in group.items" :key="evidence.id">
                <button
                  type="button"
                  class="source-trigger"
                  :aria-expanded="expandedEvidenceId === evidence.id"
                  @click="toggleEvidence(evidence.id)"
                >
                  <FileText :size="17" aria-hidden="true" />
                  <span>
                    <b>{{ evidence.sourceName }}</b>
                    <small>{{ evidence.detail }}</small>
                  </span>
                </button>
                <div
                  v-if="expandedEvidenceId === evidence.id"
                  class="source-preview"
                >
                  <p>{{ evidence.previewText }}</p>
                  <span v-if="evidence.attachmentName">
                    附件：{{ evidence.attachmentName }}
                  </span>
                  <a
                    v-if="safeSourceUrl(evidence.sourceUrl)"
                    :href="safeSourceUrl(evidence.sourceUrl)!"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    打开原始来源 <ExternalLink :size="14" aria-hidden="true" />
                  </a>
                </div>
              </li>
            </ul>
          </li>
        </ul>
        <p v-else class="source-empty">
          {{ closed ? "关闭时无来源证据。" : "来源证据待补，可以先判断去向。" }}
        </p>
      </div>
    </section>

    <section
      v-if="signal.supplements.length"
      class="supplement-section"
      aria-labelledby="supplement-title"
    >
      <div class="section-heading">
        <div>
          <small>刚补充的事实</small>
          <h3 id="supplement-title">当前补充结果</h3>
        </div>
        <span>{{ signal.supplements.length }} 项</span>
      </div>
      <dl class="supplement-list">
        <div v-for="item in signal.supplements" :key="item.id">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.content }}</dd>
        </div>
      </dl>
    </section>

    <section
      v-if="!closed && signal.gaps.length"
      class="gap-strip"
      aria-label="仍待补充"
    >
      <b>仍待补</b>
      <button
        v-for="gap in signal.gaps"
        :key="gap.code"
        type="button"
        :class="{ active: selectedGapCode === gap.code }"
        :aria-label="`补充${gap.fieldLabel}`"
        :aria-expanded="selectedGapCode === gap.code"
        @click="openGap(gap.code)"
      >
        {{ gap.label }}
        <PencilLine :size="14" aria-hidden="true" />
      </button>
      <small>点击待补项直接补录；也可以先作判断，未补内容会继续保留。</small>
    </section>

    <MarketSignalGapEditor
      v-if="!closed && selectedGap"
      :gap="selectedGap"
      @save="saveSupplement"
      @cancel="selectedGapCode = null"
    />
  </article>
</template>

<style scoped>
.evidence-panel {
  min-width: 0;
}

.evidence-panel--closed {
  filter: saturate(0.78);
}

.pane-heading,
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.pane-heading {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.pane-heading > div,
.section-heading > div {
  min-width: 0;
}

.pane-heading small,
.section-heading small,
.judgment-layer__head small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.pane-heading h2 {
  margin: var(--space-1) 0 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-title);
  line-height: var(--leading-title);
}

.pane-heading > span,
.section-heading > span {
  flex: none;
  color: var(--muted);
  font-size: var(--text-label);
}

.judgment-layer {
  border-bottom: 1px solid var(--line);
  border-left: 4px solid var(--brand);
}

.judgment-layer__head {
  padding: var(--space-3) var(--space-4) 0;
}

.judgment-layer__head h3 {
  margin: var(--space-1) 0 var(--space-2);
  color: var(--ink);
  font-size: var(--text-title);
  line-height: var(--leading-title);
}

.fact-hypothesis {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
}

.fact-hypothesis section {
  min-width: 0;
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.fact-hypothesis section + section {
  border-left: 1px solid var(--line);
  background: var(--info-bg);
}

.section-marker {
  display: inline-flex;
  margin-bottom: var(--space-2);
  color: var(--ok);
  font-size: var(--text-micro);
  font-weight: 700;
}

.section-marker--hypothesis {
  color: var(--info);
}

.fact-hypothesis h4 {
  margin: 0 0 var(--space-3);
  color: var(--ink);
  font-size: var(--text-title);
}

.fact-hypothesis ul {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding-left: var(--space-5);
}

.fact-hypothesis li,
.fact-hypothesis p {
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.fact-hypothesis p {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: 0;
}

.fact-hypothesis p svg {
  flex: none;
  margin-top: var(--space-1);
  color: var(--info);
}

.basis-layer {
  border-bottom: 1px solid var(--line);
}

.signal-scope {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  background: var(--surface-2);
}

.signal-scope > div {
  min-width: 0;
  padding: var(--space-3) var(--space-4);
  border-right: 1px solid var(--line);
}

.signal-scope > div:last-child {
  border-right: 0;
}

.signal-scope dt {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--text-micro);
}

.signal-scope dd {
  margin: var(--space-1) 0 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-meta);
  font-weight: 700;
}

.signal-scope dd.missing {
  color: var(--warn);
}

.closed-gap-summary {
  margin: 0;
  padding: var(--space-2) var(--space-4) var(--space-3);
  color: var(--ink-soft);
  font-size: var(--text-meta);
  line-height: var(--leading-body);
}

.closed-gap-summary--ok {
  color: var(--muted);
}

.source-section {
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.evidence-fold {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.evidence-fold span {
  display: grid;
  gap: var(--space-1);
}

.evidence-fold small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.evidence-fold b {
  color: var(--ink);
  font-size: var(--text-meta);
  font-weight: 600;
}

.evidence-fold svg {
  flex: none;
  color: var(--muted);
  transition: transform 0.15s ease;
}

.evidence-fold svg.open {
  transform: rotate(180deg);
}

.evidence-body {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--line);
}

.source-timeline {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.source-day > time {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}

.source-list {
  display: grid;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
  list-style: none;
}

.source-list li {
  min-width: 0;
  border-bottom: 1px solid var(--line);
}

.source-trigger {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.source-trigger svg {
  margin-top: var(--space-1);
  color: var(--brand-strong);
}

.source-trigger span {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.source-trigger b {
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-meta);
}

.source-trigger small {
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.source-preview {
  display: grid;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-2);
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.source-preview p {
  margin: 0;
}

.source-preview a {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--brand-strong);
  text-decoration: none;
  font-weight: 600;
}

.source-empty,
.missing-copy {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.supplement-section {
  padding: var(--space-4);
  border-top: 1px solid var(--line);
  background: var(--ok-bg);
}

.supplement-list {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
}

.supplement-list > div {
  display: grid;
  grid-template-columns: minmax(110px, 0.3fr) minmax(0, 1fr);
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--line);
}

.supplement-list dt {
  color: var(--ok);
  font-size: var(--text-label);
  font-weight: 700;
}

.supplement-list dd {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.section-heading h3 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-meta);
}

.gap-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--line);
  background: var(--warn-bg);
}

.gap-strip b {
  color: var(--warn);
  font-size: var(--text-meta);
}

.gap-strip button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 34px;
  padding: 0 var(--space-2);
  border: 1px solid var(--warn);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--warn);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
}

.gap-strip button.active {
  background: var(--warn);
  color: var(--surface);
}

.gap-strip small {
  flex: 1 1 100%;
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

@media (max-width: 860px) {
  .fact-hypothesis,
  .signal-scope {
    grid-template-columns: 1fr;
  }

  .fact-hypothesis section + section,
  .signal-scope > div {
    border-left: 0;
    border-right: 0;
    border-top: 1px solid var(--line);
  }
}
</style>
