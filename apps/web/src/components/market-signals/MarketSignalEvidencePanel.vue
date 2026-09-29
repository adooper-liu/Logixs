<script setup lang="ts">
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Lightbulb,
  MapPin,
  RadioTower,
  Sparkles,
} from "@lucide/vue";
import { computed, shallowRef, watch } from "vue";
import {
  deriveMarketSignalPrefill,
  marketSignalEvidenceCompleteness,
  marketSignalEvidenceHeading,
  marketSignalFactsReady,
  marketSignalGapActionVerb,
} from "../../data/marketSignalEvidenceFlow";
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
const prefillDismissed = shallowRef(false);

const selectedGap = computed(
  () =>
    props.signal.gaps.find((gap) => gap.code === selectedGapCode.value) ?? null,
);

const completeness = computed(() =>
  marketSignalEvidenceCompleteness(props.signal),
);
const factsReady = computed(() => marketSignalFactsReady(props.signal));
const heading = computed(() => marketSignalEvidenceHeading(props.signal.title));

const derivedPrefill = computed(() =>
  deriveMarketSignalPrefill(props.signal.title),
);

const pendingPrefill = computed(() => {
  if (props.closed || prefillDismissed.value) return null;
  const derived = derivedPrefill.value;
  const pending: { market?: string; channel?: string; category?: string } = {};
  if (derived.market && !props.signal.market) pending.market = derived.market;
  if (derived.channel && !props.signal.channel) {
    pending.channel = derived.channel;
  }
  if (derived.category && !props.signal.category) {
    pending.category = derived.category;
  }
  return Object.keys(pending).length ? pending : null;
});

const primaryWarnGap = computed(() =>
  props.closed ? null : (props.signal.gaps[0] ?? null),
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
  if (count === 0) return "尚无来源证据";
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
    prefillDismissed.value = false;
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
  if (code === "hypothesis" && !factsReady.value) return;
  selectedGapCode.value = selectedGapCode.value === code ? null : code;
}

function gapFor(code: MarketSignalGapCode) {
  return props.signal.gaps.find((gap) => gap.code === code) ?? null;
}

function saveSupplement(draft: MarketSignalSupplementDraft): void {
  emit("supplement", draft);
  selectedGapCode.value = null;
}

function applyPrefill(): void {
  const pending = pendingPrefill.value;
  if (!pending?.market) {
    prefillDismissed.value = true;
    return;
  }
  // 多字段一次确认会并发打写接口；本片只可靠推导市场，确认后写一条。
  emit("supplement", {
    gapCode: "market",
    content: pending.market,
    sourceName: "",
    sourceUrl: "",
  });
  prefillDismissed.value = true;
}

function dismissPrefill(): void {
  prefillDismissed.value = true;
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
        <small>依据与判断</small>
        <h2>{{ heading }}</h2>
      </div>
      <span>{{ signal.owner }}</span>
    </header>

    <section
      v-if="!closed"
      class="progress-head"
      :class="{ 'progress-head--warn': completeness.remaining > 0 }"
      aria-label="依据完备度"
    >
      <div class="progress-head__copy">
        <b>依据完备度</b>
        <span>
          {{ completeness.filled }}/{{ completeness.total }}
          <template v-if="completeness.remaining > 0">
            · 必填剩 {{ completeness.remaining }}
          </template>
          <template v-else> · 本屏资料已齐</template>
        </span>
      </div>
      <div
        class="progress-bar"
        role="meter"
        :aria-valuemin="0"
        :aria-valuemax="completeness.total"
        :aria-valuenow="completeness.filled"
      >
        <span
          class="progress-bar__fill"
          :style="{
            width: `${(completeness.filled / completeness.total) * 100}%`,
          }"
        />
      </div>
      <button
        v-if="pendingPrefill"
        type="button"
        class="prefill-action"
        @click="applyPrefill"
      >
        <Sparkles :size="14" aria-hidden="true" />
        从标题预填
      </button>
    </section>

    <section
      v-if="!closed && pendingPrefill"
      class="prefill-banner"
      aria-label="已自动推导"
    >
      <p>
        已自动推导：
        <template v-if="pendingPrefill.market"
          >市场「{{ pendingPrefill.market }}」</template
        >
        <template v-if="pendingPrefill.channel"
          >、渠道「{{ pendingPrefill.channel }}」</template
        >
        <template v-if="pendingPrefill.category"
          >、商品范围「{{ pendingPrefill.category }}」</template
        >
        。确认即可写入，也可改选。
      </p>
      <div class="prefill-banner__actions">
        <button type="button" class="secondary-action" @click="dismissPrefill">
          暂不使用
        </button>
        <button type="button" class="primary-action" @click="applyPrefill">
          确认预填
        </button>
      </div>
    </section>

    <section
      class="judgment-layer"
      :aria-label="closed ? '关闭时的事实与判断' : '事实与经营判断'"
    >
      <div class="judgment-layer__head">
        <h3>事实与经营判断</h3>
      </div>
      <div class="fact-hypothesis">
        <section aria-labelledby="observed-title">
          <span class="section-marker">已观察到</span>
          <h4 id="observed-title">事实</h4>
          <ul v-if="signal.observedFacts.length">
            <li v-for="fact in signal.observedFacts" :key="fact">{{ fact }}</li>
          </ul>
          <template v-else>
            <p class="missing-copy">
              {{ closed ? "关闭时未登记观察事实。" : "尚未登记观察事实。" }}
            </p>
            <button
              v-if="!closed && gapFor('observed_fact')"
              type="button"
              class="field-action"
              :class="{
                'field-action--warn': primaryWarnGap?.code === 'observed_fact',
              }"
              :aria-label="marketSignalGapActionVerb('observed_fact')"
              :aria-expanded="selectedGapCode === 'observed_fact'"
              @click="openGap('observed_fact')"
            >
              {{ marketSignalGapActionVerb("observed_fact") }}
            </button>
          </template>
        </section>
        <section
          aria-labelledby="hypothesis-title"
          :class="{ 'judgment-locked': !closed && !factsReady }"
        >
          <span class="section-marker section-marker--hypothesis">需验证</span>
          <h4 id="hypothesis-title">经营判断</h4>
          <p v-if="!closed && !factsReady" class="lock-hint" role="status">
            先补齐观察事实后，再填写经营判断。
          </p>
          <p v-else-if="signal.hypothesis">
            <Lightbulb :size="17" aria-hidden="true" />{{ signal.hypothesis }}
          </p>
          <template v-else>
            <p class="missing-copy">
              <Lightbulb :size="17" aria-hidden="true" />
              {{ closed ? "关闭时未登记经营判断。" : "尚未填写经营判断。" }}
            </p>
            <button
              v-if="!closed && gapFor('hypothesis') && factsReady"
              type="button"
              class="field-action"
              :class="{
                'field-action--warn': primaryWarnGap?.code === 'hypothesis',
              }"
              :aria-label="marketSignalGapActionVerb('hypothesis')"
              :aria-expanded="selectedGapCode === 'hypothesis'"
              @click="openGap('hypothesis')"
            >
              {{ marketSignalGapActionVerb("hypothesis") }}
            </button>
          </template>
        </section>
      </div>
    </section>

    <section class="basis-layer" aria-label="依据与范围">
      <dl class="signal-scope">
        <div>
          <dt><MapPin :size="14" aria-hidden="true" />市场</dt>
          <dd>{{ signal.market || (closed ? "关闭时未填" : "—") }}</dd>
          <button
            v-if="!closed && gapFor('market')"
            type="button"
            class="field-action"
            :class="{ 'field-action--warn': primaryWarnGap?.code === 'market' }"
            :aria-label="marketSignalGapActionVerb('market')"
            :aria-expanded="selectedGapCode === 'market'"
            @click="openGap('market')"
          >
            {{ marketSignalGapActionVerb("market") }}
          </button>
        </div>
        <div>
          <dt><RadioTower :size="14" aria-hidden="true" />渠道</dt>
          <dd>{{ signal.channel || (closed ? "关闭时未填" : "—") }}</dd>
          <button
            v-if="!closed && gapFor('channel')"
            type="button"
            class="field-action"
            :class="{
              'field-action--warn': primaryWarnGap?.code === 'channel',
            }"
            :aria-label="marketSignalGapActionVerb('channel')"
            :aria-expanded="selectedGapCode === 'channel'"
            @click="openGap('channel')"
          >
            {{ marketSignalGapActionVerb("channel") }}
          </button>
        </div>
        <div>
          <dt>商品范围</dt>
          <dd>{{ signal.category || (closed ? "关闭时未填" : "—") }}</dd>
          <button
            v-if="!closed && gapFor('category')"
            type="button"
            class="field-action"
            :class="{
              'field-action--warn': primaryWarnGap?.code === 'category',
            }"
            :aria-label="marketSignalGapActionVerb('category')"
            :aria-expanded="selectedGapCode === 'category'"
            @click="openGap('category')"
          >
            {{ marketSignalGapActionVerb("category") }}
          </button>
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
        <div v-else-if="closed" class="source-empty">关闭时无来源证据。</div>
        <div v-else class="evidence-recommend" aria-label="证据推荐">
          <p>还没有来源证据。可从走查样本、站点周报或客服记录带入。</p>
          <button
            v-if="gapFor('source_evidence')"
            type="button"
            class="field-action"
            :class="{
              'field-action--warn': primaryWarnGap?.code === 'source_evidence',
            }"
            :aria-label="marketSignalGapActionVerb('source_evidence')"
            :aria-expanded="selectedGapCode === 'source_evidence'"
            @click="openGap('source_evidence')"
          >
            {{ marketSignalGapActionVerb("source_evidence") }}
          </button>
        </div>
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

.progress-head {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.progress-head--warn {
  border-left: 3px solid var(--warn);
}

.progress-head__copy {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
}

.progress-head__copy b {
  color: var(--ink);
  font-size: var(--text-meta);
}

.progress-head__copy span {
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.progress-bar {
  height: 6px;
  overflow: hidden;
  border-radius: var(--radius-control);
  background: var(--line);
}

.progress-bar__fill {
  display: block;
  height: 100%;
  background: var(--brand);
}

.prefill-action,
.field-action,
.primary-action,
.secondary-action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 32px;
  padding: 0 var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
}

.prefill-action {
  justify-self: start;
  color: var(--brand-strong);
  border-color: var(--brand);
}

.field-action--warn {
  border-color: var(--warn);
  color: var(--warn);
}

.primary-action {
  border-color: var(--brand);
  background: var(--brand);
  color: var(--surface);
}

.secondary-action {
  color: var(--ink-soft);
}

.prefill-banner {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
  background: var(--info-bg);
}

.prefill-banner p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.prefill-banner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
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
  display: grid;
  gap: var(--space-2);
  align-content: start;
  min-width: 0;
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.fact-hypothesis section + section {
  border-left: 1px solid var(--line);
  background: var(--surface-2);
}

.judgment-locked {
  opacity: 0.72;
}

.section-marker {
  display: inline-flex;
  margin-bottom: var(--space-1);
  color: var(--ok);
  font-size: var(--text-micro);
  font-weight: 700;
}

.section-marker--hypothesis {
  color: var(--info);
}

.fact-hypothesis h4 {
  margin: 0;
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
.fact-hypothesis p,
.lock-hint {
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

.lock-hint {
  margin: 0;
  color: var(--muted);
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
  display: grid;
  gap: var(--space-2);
  align-content: start;
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
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-meta);
  font-weight: 700;
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

.evidence-recommend {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface-2);
}

.evidence-recommend p {
  margin: 0;
  color: var(--ink-soft);
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
