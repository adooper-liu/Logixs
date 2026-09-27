<script setup lang="ts">
import {
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

const props = defineProps<{ signal: MarketSignalScenario }>();
const emit = defineEmits<{
  supplement: [draft: MarketSignalSupplementDraft];
}>();
const expandedEvidenceId = shallowRef<string | null>(null);
const selectedGapCode = shallowRef<MarketSignalGapCode | null>(null);
const selectedGap = computed(
  () =>
    props.signal.gaps.find((gap) => gap.code === selectedGapCode.value) ?? null,
);

watch(
  () => props.signal.id,
  () => {
    expandedEvidenceId.value = null;
    selectedGapCode.value = null;
  },
);

function toggleEvidence(id: string): void {
  expandedEvidenceId.value = expandedEvidenceId.value === id ? null : id;
}

function openGap(code: MarketSignalGapCode): void {
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
  <article class="evidence-panel">
    <header class="pane-heading">
      <div>
        <small>依据是什么</small>
        <h2>{{ signal.title }}</h2>
      </div>
      <span>{{ signal.owner }}</span>
    </header>

    <dl class="signal-scope">
      <div>
        <dt><MapPin :size="14" aria-hidden="true" />市场</dt>
        <dd :class="{ missing: !signal.market }">
          {{ signal.market || "待补，不影响先处理" }}
        </dd>
      </div>
      <div>
        <dt><RadioTower :size="14" aria-hidden="true" />渠道</dt>
        <dd :class="{ missing: !signal.channel }">
          {{ signal.channel || "待补，不影响先处理" }}
        </dd>
      </div>
      <div>
        <dt>商品范围</dt>
        <dd :class="{ missing: !signal.category }">
          {{ signal.category || "待选择，不影响先处理" }}
        </dd>
      </div>
    </dl>

    <div class="fact-hypothesis">
      <section aria-labelledby="observed-title">
        <span class="section-marker">已观察到</span>
        <h3 id="observed-title">事实</h3>
        <ul v-if="signal.observedFacts.length">
          <li v-for="fact in signal.observedFacts" :key="fact">{{ fact }}</li>
        </ul>
        <p v-else class="missing-copy">观察事实待补，可以先判断去向。</p>
      </section>
      <section aria-labelledby="hypothesis-title">
        <span class="section-marker section-marker--hypothesis">尚待验证</span>
        <h3 id="hypothesis-title">经营判断</h3>
        <p v-if="signal.hypothesis">
          <Lightbulb :size="17" aria-hidden="true" />{{ signal.hypothesis }}
        </p>
        <p v-else class="missing-copy">
          <Lightbulb
            :size="17"
            aria-hidden="true"
          />经营判断待补，可以后续完善。
        </p>
      </section>
    </div>

    <section class="source-section" aria-labelledby="source-title">
      <div class="section-heading">
        <div>
          <small>来源证据</small>
          <h3 id="source-title">这条信号从哪里来</h3>
        </div>
        <span>{{ signal.evidence.length }} 项</span>
      </div>
      <ul v-if="signal.evidence.length" class="source-list">
        <li v-for="evidence in signal.evidence" :key="evidence.id">
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
            <time :datetime="evidence.observedAt">{{
              evidence.observedAt
            }}</time>
          </button>
          <div v-if="expandedEvidenceId === evidence.id" class="source-preview">
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
      <p v-else class="source-empty">来源证据待补，可以先判断去向。</p>
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

    <section v-if="signal.gaps.length" class="gap-strip" aria-label="仍待补充">
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
      v-if="selectedGap"
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
.section-heading small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.pane-heading h2,
.section-heading h3 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  line-height: var(--leading-title);
}

.pane-heading h2 {
  overflow-wrap: anywhere;
  font-size: var(--text-title);
}

.pane-heading > span,
.section-heading > span {
  flex: none;
  color: var(--muted);
  font-size: var(--text-label);
}

.signal-scope {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  border-bottom: 1px solid var(--line);
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

.fact-hypothesis {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  border-bottom: 1px solid var(--line);
}

.fact-hypothesis section {
  min-width: 0;
  padding: var(--space-4);
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

.fact-hypothesis h3 {
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

.source-section {
  padding: var(--space-4);
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
  font-size: var(--text-meta);
}

.source-list {
  display: grid;
  margin: var(--space-3) 0 0;
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
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.source-trigger:hover {
  background: var(--surface-2);
}

.source-trigger:focus-visible,
.source-preview a:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

.source-trigger > svg {
  color: var(--brand-strong);
}

.source-trigger > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.source-list b {
  color: var(--ink);
  font-size: var(--text-label);
}

.source-list small,
.source-list time {
  color: var(--muted);
  font-size: var(--text-micro);
}

.source-preview {
  display: grid;
  gap: var(--space-2);
  margin: 0 0 var(--space-3) var(--space-6);
  padding: var(--space-3);
  border-left: 3px solid var(--info);
  background: var(--info-bg);
}

.source-preview p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.source-preview span {
  color: var(--muted);
  font-size: var(--text-micro);
}

.source-preview a {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--brand-strong);
  font-size: var(--text-label);
  font-weight: 700;
  text-decoration: none;
}

.source-empty,
.missing-copy {
  color: var(--warn);
  font-size: var(--text-label);
}

.source-empty {
  margin: var(--space-3) 0 0;
  padding: var(--space-3);
  background: var(--warn-bg);
}

.gap-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--line);
  background: var(--warn-bg);
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.gap-strip b {
  color: var(--warn);
}

.gap-strip button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border: 1px solid var(--warn);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--warn);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-micro);
  font-weight: 700;
}

.gap-strip button.active,
.gap-strip button:hover {
  background: var(--warn);
  color: var(--surface);
}

.gap-strip button:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

.gap-strip small {
  flex: 1 1 220px;
  color: var(--muted);
  font-size: var(--text-micro);
  text-align: right;
}

@media (max-width: 680px) {
  .signal-scope,
  .fact-hypothesis {
    grid-template-columns: 1fr;
  }

  .signal-scope > div,
  .fact-hypothesis section + section {
    border-right: 0;
    border-left: 0;
    border-bottom: 1px solid var(--line);
  }

  .source-trigger {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .source-trigger time {
    grid-column: 2;
  }

  .gap-strip small {
    text-align: left;
  }

  .supplement-list > div {
    grid-template-columns: 1fr;
    gap: var(--space-1);
  }
}
</style>
