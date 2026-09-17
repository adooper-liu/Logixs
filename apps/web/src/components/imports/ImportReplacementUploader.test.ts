import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ImportReplacementUploader from "./ImportReplacementUploader.vue";

describe("ImportReplacementUploader", () => {
  it("选择文件后向父级发出替代上传事件", async () => {
    const wrapper = mount(ImportReplacementUploader, {
      props: { disabled: false },
    });
    const file = new File(["order-number\nSO-1"], "split.csv", {
      type: "text/csv",
    });
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, "files", { value: [file] });

    await input.trigger("change");

    expect(wrapper.emitted("replace")?.[0]).toEqual([file]);
  });

  it("忙碌时禁用文件选择", () => {
    const wrapper = mount(ImportReplacementUploader, {
      props: { disabled: true },
    });

    expect(
      wrapper.get('input[type="file"]').attributes("disabled"),
    ).toBeDefined();
  });
});
