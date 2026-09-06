import { computed, readonly, shallowRef } from "vue";

export type DemoRole = "operator" | "planner" | "manager";

const currentRole = shallowRef<DemoRole>("operator");

const roleLabels: Record<DemoRole, string> = {
  operator: "现场员工",
  planner: "计划调度",
  manager: "运营管理",
};

export function useDemoRole() {
  const setRole = (role: DemoRole) => {
    currentRole.value = role;
  };

  return {
    currentRole: readonly(currentRole),
    roleLabel: computed(() => roleLabels[currentRole.value]),
    roleLabels,
    setRole,
  };
}

export function resetDemoRole() {
  currentRole.value = "operator";
}
