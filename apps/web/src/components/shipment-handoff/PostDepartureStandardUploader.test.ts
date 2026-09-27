import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadPostDepartureStandardTemplate } from "../../api/postDepartureSourcePackages";
import PostDepartureStandardUploader from "./PostDepartureStandardUploader.vue";

vi.mock("../../api/postDepartureSourcePackages", () => ({
  downloadPostDepartureStandardTemplate: vi.fn(),
}));

describe("PostDepartureStandardUploader", () => {
  beforeEach(() =>
    vi.mocked(downloadPostDepartureStandardTemplate).mockReset(),
  );

  it("presents the V1 template as a three-step primary path", async () => {
    const wrapper = mount(PostDepartureStandardUploader, {
      props: {
        upload: {
          fileName: "",
          batch: null,
          uploading: false,
          error: "",
        },
        preflighting: false,
      },
    });

    expect(wrapper.text()).toContain("下载并填写");
    expect(wrapper.text()).toContain("上传文件");
    expect(wrapper.text()).toContain("预检并接管");
    expect(
      wrapper
        .get('[data-testid="standard-post-departure-preflight"]')
        .attributes("disabled"),
    ).toBeDefined();

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("下载 V1 模板"))!
      .trigger("click");
    expect(downloadPostDepartureStandardTemplate).toHaveBeenCalledOnce();
  });

  it("emits the selected workbook and enables preflight after parsing", async () => {
    const wrapper = mount(PostDepartureStandardUploader, {
      props: {
        upload: {
          fileName: "standard.xlsx",
          batch: {
            fileName: "standard.xlsx",
            rowCount: 16,
          },
          uploading: false,
          error: "",
        },
        preflighting: false,
      },
    });
    const input = wrapper.get('input[type="file"]');
    const file = new File(["workbook"], "standard.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    Object.defineProperty(input.element, "files", {
      configurable: true,
      value: [file],
    });

    await input.trigger("change");
    await wrapper
      .get('[data-testid="standard-post-departure-preflight"]')
      .trigger("click");

    expect(wrapper.text()).toContain("已读取 16 行");
    expect(wrapper.emitted("selectFile")).toEqual([[file]]);
    expect(wrapper.emitted("preflight")).toEqual([[]]);
  });
});
