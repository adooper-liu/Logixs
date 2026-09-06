<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import {
  Camera,
  CircleCheck,
  FileCheck2,
  Link,
  ScanLine,
  Upload,
} from "@lucide/vue";
import type { Component } from "vue";
import type {
  TaskEvidenceKind,
  TaskEvidenceRequirement,
} from "../../data/sample";

const props = defineProps<{
  taskId: string;
  evidence: TaskEvidenceRequirement[];
  attention?: boolean;
  openByDefault?: boolean;
}>();

const emit = defineEmits<{
  verify: [evidenceId: string, value?: string];
}>();

const drafts = reactive<Record<string, string>>({});
const requiredEvidence = computed(() =>
  props.evidence.filter((item) => item.required),
);
const verifiedRequiredCount = computed(
  () =>
    requiredEvidence.value.filter((item) => item.state === "verified").length,
);
const allRequiredVerified = computed(
  () => verifiedRequiredCount.value === requiredEvidence.value.length,
);
const visibleEvidence = computed(() =>
  allRequiredVerified.value
    ? props.evidence
    : props.evidence.filter((item) => item.state !== "verified"),
);

const kindMeta: Record<
  TaskEvidenceKind,
  { label: string; icon: Component; action: string }
> = {
  scan: { label: "身份核对", icon: ScanLine, action: "核对" },
  document: { label: "单证", icon: FileCheck2, action: "确认已核验" },
  photo: { label: "照片", icon: Camera, action: "记录照片" },
  checklist: { label: "清单", icon: CircleCheck, action: "确认完成" },
  external_event: { label: "外部事件", icon: Link, action: "" },
  receipt: { label: "外部回执", icon: Link, action: "" },
};

watch(
  () => props.taskId,
  () => Object.keys(drafts).forEach((key) => delete drafts[key]),
);

const updateDraft = (evidenceId: string, event: Event) => {
  drafts[evidenceId] = (event.target as HTMLInputElement).value;
};

const recordPhoto = (evidenceId: string, event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  emit("verify", evidenceId, file?.name);
};
</script>

<template>
  <details
    class="section-band"
    :class="{ attention }"
    :open="attention || openByDefault"
  >
    <summary class="section-head">
      <span
        ><b>完成证据</b
        ><small
          >{{ verifiedRequiredCount }}/{{ requiredEvidence.length }} 必需</small
        ></span
      >
      <strong :class="allRequiredVerified ? 'verified' : 'pending'">{{
        allRequiredVerified ? "已验证" : "待处理"
      }}</strong>
    </summary>

    <ul class="evidence-list" :class="{ single: visibleEvidence.length === 1 }">
      <li
        v-for="item in visibleEvidence"
        :key="item.id"
        :class="{ verified: item.state === 'verified' }"
      >
        <div class="evidence-title">
          <component
            :is="kindMeta[item.kind].icon"
            :size="16"
            aria-hidden="true"
          />
          <span
            ><b>{{ item.label }}</b
            ><small
              >{{ kindMeta[item.kind].label }} ·
              {{ item.required ? "必需" : "按需" }}</small
            ></span
          >
          <strong :class="item.state">
            {{
              item.state === "verified"
                ? "已验证"
                : item.state === "waiting"
                  ? "等待来源"
                  : "待处理"
            }}
          </strong>
        </div>
        <p>{{ item.detail }}</p>

        <div
          v-if="item.kind === 'scan' && item.state !== 'verified'"
          class="scan-row"
        >
          <input
            :value="drafts[item.id] ?? ''"
            type="text"
            :aria-label="item.label"
            :placeholder="`输入或扫描 ${item.label}`"
            @input="updateDraft(item.id, $event)"
            @keydown.enter="emit('verify', item.id, drafts[item.id])"
          />
          <button
            class="icon-button"
            type="button"
            title="核对扫描结果"
            @click="emit('verify', item.id, drafts[item.id])"
          >
            <ScanLine :size="17" />
          </button>
        </div>

        <label
          v-else-if="item.kind === 'photo' && item.state !== 'verified'"
          class="file-action"
        >
          <Upload />选择照片
          <input
            type="file"
            accept="image/*"
            @change="recordPhoto(item.id, $event)"
          />
        </label>

        <button
          v-else-if="
            item.state !== 'verified' &&
            item.kind !== 'external_event' &&
            item.kind !== 'receipt'
          "
          class="secondary"
          type="button"
          @click="emit('verify', item.id)"
        >
          <CircleCheck :size="16" />
          {{ kindMeta[item.kind].action }}
        </button>

        <p v-if="item.validationMessage" class="error" role="alert">
          {{ item.validationMessage }}
        </p>
      </li>
    </ul>
    <p
      v-if="!allRequiredVerified && verifiedRequiredCount"
      class="collapsed-count"
    >
      另有 {{ verifiedRequiredCount }} 项必需证据已验证
    </p>
  </details>
</template>

<style scoped>
.section-band {
  border-bottom: 1px solid var(--line);
}

.section-band.attention {
  border-bottom-color: transparent;
}

.section-band.attention .section-head b {
  color: var(--brand-strong);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  gap: 12px;
  padding: 8px 14px;
  cursor: pointer;
  list-style: none;
}

.section-head::-webkit-details-marker {
  display: none;
}

.section-head > span {
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
}

.section-head small {
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
}

.section-head strong {
  color: var(--warn);
  font-size: 11px;
}

.section-head strong.verified {
  color: var(--ok);
}

.evidence-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
  margin: 0;
  padding: 0 14px 8px;
  list-style: none;
}

.evidence-list.single {
  grid-template-columns: minmax(0, 1fr);
}

.evidence-list.single .evidence-title strong {
  display: none;
}

.evidence-list li {
  min-width: 0;
  padding: 8px 0;
  border-top: 1px dashed var(--line);
}

@media (min-width: 1280px) {
  .evidence-list.single li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 20px;
  }

  .evidence-list.single .evidence-title,
  .evidence-list.single li > p {
    grid-column: 1;
  }

  .evidence-list.single .scan-row,
  .evidence-list.single .file-action,
  .evidence-list.single .secondary {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .evidence-list.single .scan-row {
    width: min(360px, 32vw);
  }

  .evidence-list.single li > .error {
    grid-column: 1 / -1;
    grid-row: auto;
  }
}

.evidence-title {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  gap: 7px;
  align-items: start;
}

.evidence-title > svg {
  margin-top: 2px;
  color: var(--brand);
}

.evidence-title span {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.evidence-title b {
  font-size: 12px;
}

.evidence-title small,
.evidence-list li > p {
  color: var(--muted);
  font-size: 10px;
}

.evidence-title strong {
  color: var(--warn);
  font-size: 10px;
}

.evidence-title strong.verified {
  color: var(--ok);
}

.evidence-title strong.waiting {
  color: var(--info);
}

.evidence-list li > p {
  margin: 6px 0 8px 25px;
  overflow-wrap: anywhere;
}

.scan-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
}

.scan-row input {
  width: 100%;
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-s) 0 0 var(--radius-s);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}

.icon-button {
  border: 1px solid var(--brand);
  border-radius: 0 var(--radius-s) var(--radius-s) 0;
  background: var(--brand);
  color: var(--on-brand);
  cursor: pointer;
}

.secondary {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: var(--ink-soft);
  font-weight: 600;
  cursor: pointer;
}

.file-action {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: var(--ink-soft);
  font-weight: 600;
  cursor: pointer;
}

.file-action svg {
  width: 1em;
  height: 1em;
}

.file-action input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.evidence-list li > .error {
  margin: 6px 0 0;
  color: var(--risk);
  font-size: 11px;
}

.collapsed-count {
  margin: -3px 14px 8px;
  color: var(--muted);
  font-size: 10px;
}

@media (max-width: 720px) {
  .evidence-list {
    grid-template-columns: 1fr;
  }
}
</style>
