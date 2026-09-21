import { nextTick, effectScope, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCargoReadyCompliance } from "./useCargoReadyCompliance";

const getCargoReadyCompliance = vi.fn();

vi.mock("../api/cargoReadyCompliance", () => ({
  getCargoReadyCompliance: (...args: unknown[]) =>
    getCargoReadyCompliance(...args),
  assessCargoReadyCompliance: vi.fn(),
  decideCargoReadyCompliance: vi.fn(),
}));

describe("useCargoReadyCompliance", () => {
  beforeEach(() => {
    getCargoReadyCompliance.mockReset();
  });

  it("aborts the active request and clears loading when the container is cleared", async () => {
    getCargoReadyCompliance.mockImplementation(
      () => new Promise(() => undefined),
    );
    const containerId = ref("container-1");
    const scope = effectScope();
    const state = scope.run(() => useCargoReadyCompliance(containerId));

    expect(state).toBeDefined();
    expect(state!.loading.value).toBe(true);
    expect(getCargoReadyCompliance).toHaveBeenCalledWith(
      "container-1",
      expect.any(AbortSignal),
    );
    const signal = getCargoReadyCompliance.mock.calls[0]?.[1] as AbortSignal;

    containerId.value = "";
    await nextTick();

    expect(signal.aborted).toBe(true);
    expect(state!.loading.value).toBe(false);
    expect(state!.assessment.value).toBeNull();
    expect(state!.error.value).toBe("");
    scope.stop();
  });
});
