<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
} from "vue";
import { CircleHelp } from "@lucide/vue";

const props = withDefaults(
  defineProps<{
    text: string;
    label?: string;
    inverse?: boolean;
  }>(),
  {
    label: "查看说明",
    inverse: false,
  },
);

const tooltipId = `info-tooltip-${useId()}`;
const trigger = useTemplateRef<HTMLButtonElement>("trigger");
const bubble = useTemplateRef<HTMLElement>("bubble");
const hovered = shallowRef(false);
const focused = shallowRef(false);
const pinned = shallowRef(false);
const dismissed = shallowRef(false);
const bubbleStyle = shallowRef({ top: "0px", left: "0px" });

const isOpen = computed(
  () => !dismissed.value && (hovered.value || focused.value || pinned.value),
);

const positionBubble = async () => {
  const triggerElement = trigger.value;
  if (!triggerElement) return;

  const triggerRect = triggerElement.getBoundingClientRect();
  bubbleStyle.value = {
    top: `${Math.round(triggerRect.bottom + 7)}px`,
    left: `${Math.round(triggerRect.left)}px`,
  };
  await nextTick();

  const bubbleElement = bubble.value;
  if (!bubbleElement) return;
  const bubbleRect = bubbleElement.getBoundingClientRect();
  const viewportPadding = 8;
  const centeredLeft =
    triggerRect.left + triggerRect.width / 2 - bubbleRect.width / 2;
  const maxLeft = Math.max(
    viewportPadding,
    window.innerWidth - bubbleRect.width - viewportPadding,
  );
  const left = Math.min(Math.max(centeredLeft, viewportPadding), maxLeft);
  const fitsAbove = triggerRect.top - bubbleRect.height - 7 >= viewportPadding;
  const wouldOverflowBelow =
    triggerRect.bottom + bubbleRect.height + 7 > window.innerHeight;
  const top =
    wouldOverflowBelow && fitsAbove
      ? triggerRect.top - bubbleRect.height - 7
      : triggerRect.bottom + 7;

  bubbleStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  };
};

const openFromHover = () => {
  hovered.value = true;
  dismissed.value = false;
};

const closeFromHover = () => {
  hovered.value = false;
  if (!focused.value && !pinned.value) dismissed.value = false;
};

const openFromFocus = () => {
  focused.value = true;
  dismissed.value = false;
};

const closeFromFocus = () => {
  focused.value = false;
  if (!hovered.value && !pinned.value) dismissed.value = false;
};

const togglePinned = () => {
  if (pinned.value) {
    pinned.value = false;
    dismissed.value = true;
    return;
  }
  pinned.value = true;
  dismissed.value = false;
};

const close = () => {
  pinned.value = false;
  dismissed.value = true;
};

watch(isOpen, (open, _, onCleanup) => {
  if (!open) return;

  const reposition = () => void positionBubble();
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  const closeOnOutsidePointer = (event: PointerEvent) => {
    if (trigger.value?.contains(event.target as Node)) return;
    close();
  };

  void positionBubble();
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
  document.addEventListener("keydown", closeOnEscape);
  document.addEventListener("pointerdown", closeOnOutsidePointer);

  onCleanup(() => {
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
    document.removeEventListener("keydown", closeOnEscape);
    document.removeEventListener("pointerdown", closeOnOutsidePointer);
  });
});

onBeforeUnmount(close);
</script>

<template>
  <span
    class="info-tooltip"
    :class="{ 'info-tooltip--inverse': props.inverse }"
    @mouseenter="openFromHover"
    @mouseleave="closeFromHover"
  >
    <button
      ref="trigger"
      class="info-tooltip__trigger"
      type="button"
      :aria-label="props.label"
      :aria-describedby="isOpen ? tooltipId : undefined"
      :aria-expanded="isOpen"
      @focus="openFromFocus"
      @blur="closeFromFocus"
      @click="togglePinned"
    >
      <CircleHelp :size="14" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <span
        v-if="isOpen"
        :id="tooltipId"
        ref="bubble"
        class="info-tooltip__bubble"
        role="tooltip"
        :style="bubbleStyle"
      >
        {{ props.text }}
      </span>
    </Teleport>
  </span>
</template>

<style scoped>
.info-tooltip {
  display: inline-flex;
  flex: none;
  vertical-align: middle;
}

.info-tooltip__trigger {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--muted);
  cursor: help;
}

.info-tooltip__trigger:hover,
.info-tooltip__trigger[aria-expanded="true"] {
  background: var(--surface-2);
  color: var(--ink-soft);
}

.info-tooltip--inverse .info-tooltip__trigger {
  color: currentColor;
  opacity: 0.82;
}

.info-tooltip--inverse .info-tooltip__trigger:hover,
.info-tooltip--inverse .info-tooltip__trigger[aria-expanded="true"] {
  background: color-mix(in srgb, currentColor 14%, transparent);
  color: currentColor;
  opacity: 1;
}

.info-tooltip__bubble {
  position: fixed;
  z-index: calc(var(--z-command) + 10);
  width: max-content;
  max-width: min(280px, calc(100vw - 16px));
  padding: 7px 9px;
  border: 1px solid var(--tooltip-line);
  border-radius: var(--radius-control);
  background: var(--tooltip-surface);
  box-shadow: var(--shadow-overlay);
  color: var(--tooltip-ink-soft);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.55;
  overflow-wrap: anywhere;
  pointer-events: none;
}

@media (max-width: 767px) {
  .info-tooltip__trigger {
    width: 32px;
    height: 32px;
  }
}
</style>
