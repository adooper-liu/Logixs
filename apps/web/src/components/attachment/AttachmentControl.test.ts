import { defineComponent, ref } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import AttachmentControl, {
  type AttachmentItem,
} from "./AttachmentControl.vue";

function host() {
  const files = ref<AttachmentItem[]>([]);
  const wrapper = mount(
    defineComponent({
      components: { AttachmentControl },
      setup() {
        return { files };
      },
      template: `<AttachmentControl v-model="files" label="提单附件" />`,
    }),
  );
  return { wrapper, files };
}

function choose(wrapper: ReturnType<typeof host>["wrapper"], names: string[]) {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: names.map(
      (name) => new File(["doc"], name, { type: "application/pdf" }),
    ),
  });
  return input.trigger("change");
}

describe("AttachmentControl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows only the upload control when there is no file", () => {
    const { wrapper } = host();
    expect(wrapper.find(".attachment-files").exists()).toBe(false);
    expect(
      wrapper.get('input[type="file"]').attributes("multiple"),
    ).toBeDefined();
    expect(wrapper.text()).not.toContain("选择文件");
    expect(wrapper.text()).not.toContain("未选择文件");
  });

  it("appends files across separate uploads and keeps earlier names", async () => {
    const { wrapper, files } = host();
    await choose(wrapper, ["提单.pdf"]);
    await choose(wrapper, ["装箱单.pdf", "发票.pdf"]);
    expect(files.value.map((item) => item.name)).toEqual([
      "提单.pdf",
      "装箱单.pdf",
      "发票.pdf",
    ]);
    expect(wrapper.text()).toContain("提单.pdf");
    expect(wrapper.text()).toContain("发票.pdf");
  });

  it("previews, downloads, and deletes one file without dropping the others", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:attachment");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const downloaded: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded.push(this.download);
    });
    const { wrapper, files } = host();
    await choose(wrapper, ["提单.pdf", "发票.pdf"]);

    await wrapper.get('[aria-label="预览 提单.pdf"]').trigger("click");
    expect(open).toHaveBeenCalledWith(
      "blob:attachment",
      "_blank",
      "noopener,noreferrer",
    );

    await wrapper.get('[aria-label="下载 提单.pdf"]').trigger("click");
    expect(downloaded).toEqual(["提单.pdf"]);

    await wrapper.get('[aria-label="删除 提单.pdf"]').trigger("click");
    expect(files.value.map((item) => item.name)).toEqual(["发票.pdf"]);
    expect(wrapper.text()).not.toContain("提单.pdf");
  });
});
