import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  workbenchPurposes,
  type WorkbenchCode,
} from "../src/data/workbenchPurposes.generated";
import { workbenchStages } from "../src/data/workbenchNetwork";

const evidenceDirectory = resolve(
  process.cwd(),
  "../../.tmp/workbench-purpose-navigation-v1",
);

const pathByCode = new Map(
  workbenchStages.map((stage) => [stage.code, stage.path]),
);

async function expectWorkbenchIdentity(
  page: Page,
  code: WorkbenchCode,
): Promise<void> {
  const purpose = workbenchPurposes.find((item) => item.code === code);
  const path = pathByCode.get(code);
  if (!purpose || !path)
    throw new Error(`Missing workbench catalog entry: ${code}`);

  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: purpose.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(purpose.businessPurpose, { exact: true }),
  ).toHaveCount(1);
}

test("all 23 workbench routes render one generated business purpose", async ({
  page,
}) => {
  for (const purpose of workbenchPurposes) {
    await expectWorkbenchIdentity(page, purpose.code);
  }
});

test("planned workbenches keep their purpose while remaining read-only", async ({
  page,
}) => {
  for (const code of [
    "booking",
    "export_customs",
    "compliance_operations",
  ] as const) {
    await expectWorkbenchIdentity(page, code);
    await expect(page.getByText("框架已建立，业务能力待接通")).toBeVisible();
    await expect(
      page.locator(
        ".planned-page button, .planned-page form, .planned-page input",
      ),
    ).toHaveCount(0);
  }
});

test("selection and NPI purpose remain stable across a fresh render", async ({
  page,
}) => {
  for (const code of ["product_selection", "product_npi"] as const) {
    const purpose = workbenchPurposes.find((item) => item.code === code);
    const path = pathByCode.get(code);
    if (!purpose || !path)
      throw new Error(`Missing workbench catalog entry: ${code}`);

    await page.goto(path);
    await expect(
      page.getByText(purpose.businessPurpose, { exact: true }),
    ).toHaveCount(1);
    await page.reload();
    await expect(
      page.getByText(purpose.businessPurpose, { exact: true }),
    ).toHaveCount(1);
  }
});

test("dispatch keeps one identity across its internal views", async ({
  page,
}) => {
  const purpose = workbenchPurposes.find((item) => item.code === "dispatch");
  if (!purpose) throw new Error("Missing dispatch purpose");

  for (const [query, localTitle] of [
    ["", "接管已出运数据"],
    ["?view=loading", "装船交接历史"],
    ["?view=risk", "在途风险"],
  ] as const) {
    await page.goto(`/workspaces/dispatch${query}`);
    await expect(
      page.getByRole("heading", { name: purpose.title, exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByText(purpose.businessPurpose, { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: localTitle, exact: true }),
    ).toHaveCount(1);
  }
});

test("captures purpose-navigation viewport evidence without page overflow", async ({
  page,
}, testInfo) => {
  await mkdir(resolve(evidenceDirectory, testInfo.project.name), {
    recursive: true,
  });
  const projectDirectory = resolve(evidenceDirectory, testInfo.project.name);

  await page.goto("/workspaces");
  await expect(
    page.getByRole("heading", { name: "业务工作台", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(projectDirectory, "workbench-directory.png"),
    fullPage: true,
  });

  await page.goto("/workspaces/dispatch?view=risk");
  await expect(
    page.getByText(
      "汇合当前有效订舱、装箱/VGM、出口放行和码头条件，确认可信实际离港并交海运运营",
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(projectDirectory, "dispatch-risk.png"),
    fullPage: true,
  });

  await page.goto("/workspaces/booking");
  await expect(
    page.getByText(
      "在获批边界内取得并维持承运人确认、当前有效且可执行的订舱承诺",
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(projectDirectory, "planned-booking.png"),
    fullPage: true,
  });

  const overflow = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(".app-content");
    if (!content) throw new Error("Missing .app-content for overflow evidence");
    return {
      documentElement: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollHeight: document.documentElement.scrollHeight,
      },
      appContent: {
        clientWidth: content.clientWidth,
        scrollWidth: content.scrollWidth,
        clientHeight: content.clientHeight,
        scrollHeight: content.scrollHeight,
      },
    };
  });
  await writeFile(
    resolve(projectDirectory, "overflow.json"),
    `${JSON.stringify(overflow, null, 2)}\n`,
    "utf8",
  );
  expect(overflow.documentElement.scrollWidth).toBeLessThanOrEqual(
    overflow.documentElement.clientWidth + 1,
  );
  expect(overflow.appContent.scrollWidth).toBeLessThanOrEqual(
    overflow.appContent.clientWidth + 1,
  );
});
