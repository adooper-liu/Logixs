import { watch } from "vue";
import { useRoute } from "vue-router";
import { useLiveWorkspace } from "./useLiveWorkspace";

export function useTaskWorkspace() {
  const route = useRoute();
  const live = useLiveWorkspace();

  watch(
    () => String(route.query.containerId ?? ""),
    () => {
      void live.reload();
    },
    { immediate: true },
  );

  return {
    loading: live.loading,
    loadingMore: live.loadingMore,
    moreError: live.moreError,
    hasMore: live.hasMore,
    error: live.error,
    containers: live.containers,
    tasks: live.tasks,
    exceptions: live.exceptions,
    activeTaskId: live.activeTaskId,
    activeTask: live.activeTask,
    activeContainer: live.activeContainer,
    activeSubmission: live.activeSubmission,
    canSubmit: live.canSubmit,
    isSubmitting: live.isSubmitting,
    selectTask: live.selectTask,
    claimTask: live.claimTask,
    acknowledgeInput: live.acknowledgeInput,
    verifyEvidence: live.verifyEvidence,
    executeAction: (actionCode: string) => {
      void live.executeAction(actionCode);
    },
    reportException: live.reportException,
    retrySubmission: live.retrySubmission,
    loadMore: () => {
      void live.loadMore();
    },
  };
}
