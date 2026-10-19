import { mount } from "@vue/test-utils";
import { computed, ref, shallowRef } from "vue";
import { describe, expect, it, vi } from "vitest";
import type {
  TaskCollaborationMessageV1,
  TaskCollaborationPostCommandV1,
} from "@logix/contracts";
import type { TaskCollaborationPanelModel } from "../../composables/useTaskCollaboration";
import TaskCollaborationPanel from "./TaskCollaborationPanel.vue";

describe("TaskCollaborationPanel", () => {
  it("renders loading, empty, error retry, and load-more states", async () => {
    const state = collaborationState();
    state.loading.value = true;
    const wrapper = mount(TaskCollaborationPanel, { props: { state } });
    expect(wrapper.get('[role="status"]').text()).toContain("正在读取协作消息");

    state.loading.value = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="collaboration-empty"]').text()).toContain(
      "还没有协作消息",
    );

    state.error.value = "FORBIDDEN";
    state.retryable.value = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[role="alert"]').text()).toContain("FORBIDDEN");
    await wrapper.get('[data-testid="collaboration-retry"]').trigger("click");
    expect(wrapper.emitted("retry")).toEqual([["thread"]]);
    expect(state.refresh).not.toHaveBeenCalled();

    state.error.value = "";
    state.messages.value = [message("message-1", "最新消息")];
    state.hasMore = ref(true);
    await wrapper.vm.$nextTick();
    await wrapper
      .get('[data-testid="collaboration-load-more"]')
      .trigger("click");
    expect(wrapper.emitted("loadMore")).toEqual([[]]);
    expect(state.loadMore).not.toHaveBeenCalled();
  });

  it("shows author, time, body, visibility label, and concise boundaries", () => {
    const state = collaborationState();
    state.messages.value = [message("message-1", "请核对装箱材料")];
    const wrapper = mount(TaskCollaborationPanel, { props: { state } });

    const item = wrapper.get('[data-message-id="message-1"]');
    expect(item.text()).toContain("当前用户");
    expect(item.text()).toContain("请核对装箱材料");
    expect(item.get("time").attributes("datetime")).toBe(
      "2026-10-18T08:01:00.000Z",
    );
    expect(wrapper.text()).toContain("当前任务参与者");
    expect(wrapper.text()).toContain(
      "消息不改变任务状态、责任或期限；EvidenceRef 只是当前有权读取的证据引用，不代表已核验。",
    );
    expect(wrapper.text()).toContain(
      "仅显示当前有权读取的证据引用；未显示不表示不存在。",
    );
  });

  it("renders only one parent summary instead of a recursive reply tree", () => {
    const grandparent = message("grandparent", "最早消息");
    const parent = {
      ...message("parent", "父消息摘要"),
      parentMessageId: grandparent.messageId,
    };
    const child = {
      ...message("child", "当前回复"),
      parentMessageId: parent.messageId,
    };
    const state = collaborationState();
    state.messages.value = [child, parent, grandparent];
    const wrapper = mount(TaskCollaborationPanel, { props: { state } });

    const childItem = wrapper.get('[data-message-id="child"]');
    const summary = childItem.get('[data-testid="parent-summary"]');
    expect(summary.text()).toContain("父消息摘要");
    expect(summary.text()).not.toContain("最早消息");
    expect(summary.find('[data-testid="parent-summary"]')).toBeTruthy();
  });

  it("offers Mention and Evidence selections only from server options", async () => {
    const state = collaborationState();
    const wrapper = mount(TaskCollaborationPanel, { props: { state } });

    const mention = wrapper.get<HTMLInputElement>(
      '[data-mention-id="actor-1"]',
    );
    const evidence = wrapper.get<HTMLInputElement>(
      '[data-evidence-id="55555555-5555-4555-8555-555555555555"]',
    );
    expect(wrapper.text()).toContain("当前用户");
    expect(wrapper.text()).toContain("装箱照片");
    expect(wrapper.find('input[name="mentionActorId"]').exists()).toBe(false);
    expect(wrapper.find('input[name="evidenceRecordId"]').exists()).toBe(false);

    await mention.setValue(true);
    await evidence.setValue(true);
    expect(state.selectedMentionIds.value).toEqual(["actor-1"]);
    expect(state.selectedEvidenceIds.value).toEqual([
      "55555555-5555-4555-8555-555555555555",
    ]);
  });

  it("supports reply, cancel, send, pending failure retry, and sending feedback", async () => {
    const state = collaborationState();
    const existing = message("message-1", "需要回复");
    state.messages.value = [existing];
    const wrapper = mount(TaskCollaborationPanel, { props: { state } });

    await wrapper.get('[data-reply-id="message-1"]').trigger("click");
    expect(state.startReply).toHaveBeenCalledWith(existing);
    state.replyTo.value = existing;
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="replying-to"]').text()).toContain(
      "需要回复",
    );
    await wrapper.get('[data-testid="cancel-reply"]').trigger("click");
    expect(state.cancelReply).toHaveBeenCalledTimes(1);

    await wrapper.get("textarea").setValue("回复内容");
    await wrapper.get('[data-testid="collaboration-send"]').trigger("click");
    expect(wrapper.emitted("submit")).toEqual([[]]);
    expect(state.send).not.toHaveBeenCalled();

    state.sending.value = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="collaboration-send"]').text()).toContain(
      "发送中",
    );

    state.sending.value = false;
    state.sendError.value = "网络失败";
    state.pendingCommand.value = pendingCommand();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="send-error"]').text()).toContain(
      "网络失败",
    );
    expect(wrapper.get<HTMLTextAreaElement>("textarea").element.value).toBe(
      "回复内容",
    );
    await wrapper
      .get('[data-testid="collaboration-send-retry"]')
      .trigger("click");
    expect(wrapper.emitted("retry")).toEqual([["send"]]);
    expect(state.retrySend).not.toHaveBeenCalled();
  });

  it("uses only the server post-disabled reason for read-only state", () => {
    const state = collaborationState();
    state.canPost.value = false;
    state.postDisabledReason.value = "任务已完成，只能查看历史协作。";
    const wrapper = mount(TaskCollaborationPanel, { props: { state } });

    expect(wrapper.text()).toContain("任务已完成，只能查看历史协作。");
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.find('[data-testid="collaboration-send"]').exists()).toBe(
      false,
    );
  });

  it("keeps raw IDs and codes only in closed technical details", () => {
    const state = collaborationState();
    state.messages.value = [
      {
        ...message("message-1", "带引用消息"),
        mentions: [
          { kind: "actor", id: "actor-technical-id", displayName: "经办人" },
        ],
        evidenceRefs: [
          {
            kind: "evidence_record",
            id: "55555555-5555-4555-8555-555555555555",
          },
        ],
        sourceRefs: [{ kind: "result", id: "result-technical-id", version: 2 }],
      },
    ];
    const wrapper = mount(TaskCollaborationPanel, { props: { state } });
    const details = wrapper.get('[data-message-id="message-1"] details');

    expect(details.attributes("open")).toBeUndefined();
    expect(details.text()).toContain("message-1");
    expect(details.text()).toContain("actor-technical-id");
    expect(details.text()).toContain("55555555-5555-4555-8555-555555555555");
    expect(details.text()).toContain("result-technical-id");
    expect(details.text()).toContain("task_scope");
    const visibleText = wrapper.get('[data-message-id="message-1"]').element
      .childNodes[0]?.textContent;
    expect(visibleText).not.toContain("actor-technical-id");
  });

  it("does not render an attachment row, count, name, ID, or hidden marker for empty EvidenceRefs", () => {
    const state = collaborationState();
    state.messages.value = [message("message-1", "普通协作消息")];
    const wrapper = mount(TaskCollaborationPanel, { props: { state } });
    const item = wrapper.get('[data-message-id="message-1"]');

    expect(item.find('[data-testid="message-evidence"]').exists()).toBe(false);
    expect(item.text()).not.toMatch(
      /附件|装箱照片|evidence_record|隐藏|未显示 \d+/,
    );
    expect(item.text()).not.toContain("55555555-5555-4555-8555-555555555555");
  });

  it("does not expose fake business actions or an inner vertical scroll owner", () => {
    const state = collaborationState();
    state.messages.value = [message("message-1", "普通消息")];
    const wrapper = mount(TaskCollaborationPanel, { props: { state } });

    expect(wrapper.text()).not.toMatch(/完成任务|转移责任|核验证据|设为已读/);
    expect(
      wrapper.findAll("*").filter((node) => {
        const style = getComputedStyle(node.element);
        return /(auto|scroll)/.test(`${style.overflow} ${style.overflowY}`);
      }),
    ).toHaveLength(0);
  });
});

function collaborationState(): TaskCollaborationPanelModel {
  const hasMoreValue = ref(false);
  const draft = ref("");
  const selectedMentionIds = ref<string[]>([]);
  const selectedEvidenceIds = ref<string[]>([]);
  return {
    messages: shallowRef([]),
    asOf: shallowRef("2026-10-18T08:00:00.000Z"),
    visibility: shallowRef("task_scope"),
    visibilityLabel: shallowRef("当前任务参与者"),
    canPost: shallowRef(true),
    postDisabledReason: shallowRef(null),
    mentionOptions: shallowRef([
      { kind: "actor", id: "actor-1", displayName: "当前用户" },
    ]),
    evidenceOptions: shallowRef([
      {
        ref: {
          kind: "evidence_record",
          id: "55555555-5555-4555-8555-555555555555",
        },
        label: "装箱照片",
      },
    ]),
    loading: shallowRef(false),
    loadingMore: shallowRef(false),
    sending: shallowRef(false),
    error: shallowRef(""),
    sendError: shallowRef(""),
    hasMore: computed(() => hasMoreValue.value),
    retryable: shallowRef(false),
    draft,
    replyTo: shallowRef(null),
    selectedMentionIds,
    selectedEvidenceIds,
    pendingCommand: shallowRef(null),
    idempotencyReplay: shallowRef(null),
    refresh: vi.fn(),
    loadMore: vi.fn(),
    send: vi.fn(),
    retrySend: vi.fn(),
    setDraft: vi.fn((value: string) => {
      draft.value = value;
    }),
    setMentionSelected: vi.fn((actorId: string, selected: boolean) => {
      selectedMentionIds.value = selected
        ? [...selectedMentionIds.value, actorId]
        : selectedMentionIds.value.filter((id) => id !== actorId);
    }),
    setEvidenceSelected: vi.fn((evidenceId: string, selected: boolean) => {
      selectedEvidenceIds.value = selected
        ? [...selectedEvidenceIds.value, evidenceId]
        : selectedEvidenceIds.value.filter((id) => id !== evidenceId);
    }),
    startReply: vi.fn(),
    cancelReply: vi.fn(),
  };
}

function message(id: string, body: string): TaskCollaborationMessageV1 {
  return {
    contractVersion: "task-collaboration-message.v1",
    messageId: id,
    threadId: "66666666-6666-4666-8666-666666666666",
    author: { kind: "actor", id: "actor-1", displayName: "当前用户" },
    body,
    parentMessageId: null,
    mentions: [],
    evidenceRefs: [],
    sourceRefs: [],
    occurredAt: "2026-10-18T08:01:00.000Z",
    recordedAt: "2026-10-18T08:01:01.000Z",
  };
}

function pendingCommand(): TaskCollaborationPostCommandV1 {
  return {
    contractVersion: "task-collaboration-post-command.v1",
    subjectRef: {
      kind: "container",
      id: "11111111-1111-4111-8111-111111111111",
    },
    workRef: {
      kind: "node_task",
      id: "33333333-3333-4333-8333-333333333333",
    },
    body: "回复内容",
    parentMessageId: null,
    mentionActorIds: [],
    evidenceRecordIds: [],
    sourceRefs: [],
    idempotencyKey: "77777777-7777-4777-8777-777777777777",
  };
}
