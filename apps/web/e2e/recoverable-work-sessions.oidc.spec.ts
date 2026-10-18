import type { ProductInitiativeV1, WorkSessionV1 } from "@logix/contracts";
import { expect, test, type Page, type Request } from "@playwright/test";
import { OIDC_APP_URL } from "../src/e2eDevServer";
import { OidcIdentityProvider } from "./support/oidcIdentityProvider";

const USER = { subject: "recoverable-e2e-user", name: "会话恢复测试员" };
const HANDOFF = "44444444-4444-4444-8444-444444444444";
const SIGNAL = "55555555-5555-4555-8555-555555555555";
const CONTAINER = "66666666-6666-4666-8666-666666666666";
const TASK = "77777777-7777-4777-8777-777777777777";
const SELECTION_SESSION = "88888888-8888-4888-8888-888888888888";
const STUFFING_SESSION = "99999999-9999-4999-8999-999999999999";
const ROUTE = `/workspaces/product-selection?handoffId=${HANDOFF}`;
const TYPED_OBJECTIVE = "OIDC 前已保存的 typed 目标";

test("one target 401 reauthenticates once and restores typed draft from the server", async ({
  page,
}) => {
  const setup = await installRecoverableOidcApi(page, false);
  await page.goto(ROUTE);
  await expect(page.getByLabel("目标结果")).toBeVisible();
  await page.getByLabel("目标结果").fill(TYPED_OBJECTIVE);
  await page.getByRole("button", { name: "切换工作现场" }).click();
  await page.locator(`[data-session="${STUFFING_SESSION}"]`).click();
  await page.getByText("保存领域草稿并切换", { exact: true }).click();

  await expect.poll(() => setup.idp.authorizeRequests).toBe(2);
  await expect(page).toHaveURL(`${OIDC_APP_URL}${ROUTE}`);
  await expect(page.getByLabel("目标结果")).toHaveValue(TYPED_OBJECTIVE);
  await expect(
    page.locator('input[name="product-initiative-outcome"][value="approve"]'),
  ).toBeChecked();
  await expect(page.getByLabel("由我对此立项负责")).toBeChecked();
  await expect(page.getByLabel("承接团队或岗位")).toHaveValue("产品开发 / NPI");
  await expect(page.getByLabel("目标日期")).toHaveValue("2026-11-15");
  await expect(page.getByLabel("下一决策日期")).toHaveValue("2026-10-20");
  await page.getByRole("button", { name: "切换工作现场" }).click();
  await expectUniqueCurrent(page, SELECTION_SESSION);

  expect(setup.draftSaveCalls).toBe(1);
  expect(setup.targetReadCalls).toBe(1);
  expect(setup.activateCalls).toBe(0);
  expect(setup.idp.tokenRequests).toBe(2);
  expect(setup.idp.violations).toEqual([]);
  await expectBusinessTextAbsentFromStorage(page, TYPED_OBJECTIVE);
});

test("persistent 401 stops after one re-login and never activates the target", async ({
  page,
}) => {
  const setup = await installRecoverableOidcApi(page, true);
  await page.goto(ROUTE);
  await expect(page.getByLabel("目标结果")).toBeVisible();
  await page.getByLabel("目标结果").fill(TYPED_OBJECTIVE);
  await page.getByRole("button", { name: "切换工作现场" }).click();
  await page.locator(`[data-session="${STUFFING_SESSION}"]`).click();
  await page.getByText("保存领域草稿并切换", { exact: true }).click();

  await expect(
    page.getByTestId("login-identity").getByText("会话无效，请重新登录"),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(setup.idp.authorizeRequests).toBe(2);
  expect(setup.idp.tokenRequests).toBe(2);
  expect(setup.targetReadCalls).toBe(1);
  expect(setup.activateCalls).toBe(0);
  expect(setup.sourceStatus()).toBe("current");
  await expect(page).toHaveURL(`${OIDC_APP_URL}${ROUTE}`);
  await expectBusinessTextAbsentFromStorage(page, TYPED_OBJECTIVE);
});

async function installRecoverableOidcApi(page: Page, persistent401: boolean) {
  const idp = new OidcIdentityProvider(USER);
  await idp.install(page);
  let draftSaveCalls = 0;
  let targetReadCalls = 0;
  let activateCalls = 0;
  let decisionDraft: ReturnType<typeof savedDraft> | null = null;
  let sourceStatus: WorkSessionV1["status"] = "current";

  await page.route(
    (url) => url.origin === OIDC_APP_URL && url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      if (persistent401 && targetReadCalls > 0 && idp.authorizeRequests >= 2) {
        await route.fulfill({ status: 401, json: { code: "UNAUTHENTICATED" } });
        return;
      }
      if (path === "/api/work-sessions") {
        await route.fulfill({
          json: sessionPage([
            session(SELECTION_SESSION, sourceStatus, "product_selection"),
            session(STUFFING_SESSION, "resumable", "stuffing"),
          ]),
        });
        return;
      }
      if (path === "/api/work-sessions/open") {
        await route.fulfill({
          json: session(SELECTION_SESSION, sourceStatus, "product_selection"),
        });
        return;
      }
      if (/^\/api\/work-sessions\/[^/]+\/pointer$/.test(path)) {
        await route.fulfill({
          json: session(SELECTION_SESSION, sourceStatus, "product_selection"),
        });
        return;
      }
      if (/^\/api\/work-sessions\/[^/]+\/activate$/.test(path)) {
        activateCalls += 1;
        sourceStatus = "draft_saved";
        await route.fulfill({
          json: session(STUFFING_SESSION, "current", "stuffing"),
        });
        return;
      }
      if (path === "/api/product-opportunities") {
        await route.fulfill({ json: opportunityPage() });
        return;
      }
      if (path === "/api/product-initiatives") {
        await route.fulfill({ json: initiativeQueue() });
        return;
      }
      if (path === `/api/product-initiatives/${HANDOFF}`) {
        await route.fulfill({
          json: {
            handoffId: HANDOFF,
            initiative: formalInitiative(),
            decisionDraft,
            evidenceCandidates: [],
            currencyOptions: [],
          },
        });
        return;
      }
      if (path === `/api/product-initiatives/${HANDOFF}/drafts`) {
        draftSaveCalls += 1;
        decisionDraft = savedDraft(request);
        await route.fulfill({ json: decisionDraft });
        return;
      }
      if (path === `/api/containers/${CONTAINER}/stuffing-snapshot`) {
        targetReadCalls += 1;
        if (targetReadCalls === 1 || persistent401) {
          await route.fulfill({
            status: 401,
            json: { code: "UNAUTHENTICATED" },
          });
          return;
        }
        await route.fulfill({ json: null });
        return;
      }
      await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
    },
  );

  return {
    idp,
    get draftSaveCalls() {
      return draftSaveCalls;
    },
    get targetReadCalls() {
      return targetReadCalls;
    },
    get activateCalls() {
      return activateCalls;
    },
    sourceStatus: () => sourceStatus,
  };
}

function savedDraft(request: Request) {
  const command = request.postDataJSON() as Record<string, unknown>;
  return {
    contractVersion: "product-initiative-decision-draft.v1",
    draftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    handoffId: HANDOFF,
    draftVersion: 1,
    initiativeVersionSeen: 3,
    objective: command.objective ?? null,
    reviewPoints: command.reviewPoints ?? [],
    businessCaseDraft: command.businessCaseDraft ?? [],
    riskAssessmentDraft: command.riskAssessmentDraft ?? [],
    unitEconomicsDraft: command.unitEconomicsDraft ?? null,
    negativeConservativeReason: command.negativeConservativeReason ?? null,
    createdAt: "2026-10-18T08:00:00.000Z",
    updatedAt: "2026-10-18T08:00:00.000Z",
  };
}

function formalInitiative(): ProductInitiativeV1 {
  return {
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb",
    outcome: "approve",
    completion: "pending_completion",
    currentDestination: "needs_decision",
    responsibleActorId: USER.subject,
    responsibilityAccepted: true,
    receivingTeamOrRole: "产品开发 / NPI",
    resourceDescription: "结构工程 1 人",
    targetDate: "2026-11-15",
    nextDecisionDate: "2026-10-20",
    nextDecisionQuestion: "是否进入 EVT 打样",
    validationFocus: null,
    reconsiderationDate: null,
    unitEconomicsDraft: null,
    unitEconomicsSnapshot: null,
    negativeConservativeReason: null,
    objective: null,
    reviewPoints: [],
    businessCaseDraft: [],
    businessCaseSnapshot: null,
    riskAssessmentDraft: [],
    riskAssessmentSnapshot: null,
    reason: null,
    returnBasis: null,
    pendingFieldCodes: ["target_user_and_market"],
    version: 3,
    createdAt: "2026-10-14T08:00:00.000Z",
    updatedAt: "2026-10-18T08:00:00.000Z",
  };
}

function session(
  sessionId: string,
  status: WorkSessionV1["status"],
  kind: "product_selection" | "stuffing",
): WorkSessionV1 {
  const product = kind === "product_selection";
  return {
    contractVersion: "work-session.v1",
    sessionId,
    version: 1,
    status,
    workbenchCode: kind,
    contextKey: product
      ? `product_selection|product_initiative_handoff:${HANDOFF}`
      : `stuffing|container:${CONTAINER}|task:${TASK}`,
    routeContext: product
      ? { kind: "product_selection.v1", handoffId: HANDOFF }
      : { kind: "stuffing.v1", containerId: CONTAINER, taskId: TASK },
    subjectRef: product
      ? { kind: "product_initiative_handoff", id: HANDOFF }
      : { kind: "container", id: CONTAINER },
    taskRef: product ? null : { kind: "node_task", id: TASK },
    domainVersionSeen: product ? 3 : 0,
    activeItemKey: "objective",
    contextMode: "context",
    displaySummary: product ? "选品 · 宠物出行品类" : "装箱 · KOCU4960726",
    lastOpenedAt: "2026-10-18T08:00:00.000Z",
    createdAt: "2026-10-18T08:00:00.000Z",
    updatedAt: "2026-10-18T08:00:00.000Z",
  };
}

function sessionPage(items: readonly WorkSessionV1[]) {
  return {
    contractVersion: "work-session-page.v1",
    items,
    pageSize: 50,
    nextCursor: null,
  };
}

function opportunityPage() {
  return {
    contractVersion: "product-opportunity-page.v1",
    items: [
      {
        handoff: {
          contractVersion: "market_opportunity_handoff.v1",
          handoffId: HANDOFF,
          version: 1,
          signalId: SIGNAL,
          signalVersion: 1,
          title: "宠物出行品类",
          recipientQueueCode: "product_selection",
          marketCode: "CA",
          channelCode: "amazon",
          categoryRef: "pet-travel",
          observedFactSummary: "需求增长",
          evidenceRefs: [],
          hypothesis: "可形成机会",
          opportunityStatement: "评估是否立项",
          judgmentNote: null,
          pendingFieldCodes: [],
          createdBy: "market-owner",
          createdAt: "2026-10-14T08:00:00.000Z",
          idempotencyKey: "handoff-oidc",
        },
        intakeState: "accepted",
        intakeVersion: 1,
        assignedActorId: USER.subject,
        supplementedFieldCodes: [],
        responsibility: {
          status: "transferred_to_selection",
          responsibleTeamCode: "product_selection",
        },
        latestSelectionDecision: null,
      },
    ],
    pageSize: 100,
    nextCursor: null,
  };
}

function initiativeQueue() {
  return {
    contractVersion: "product-initiative-queue.v1",
    items: [],
    pageSize: 200,
    nextCursor: null,
  };
}

async function expectUniqueCurrent(page: Page, sessionId: string) {
  const dialog = page.getByRole("dialog", { name: "工作现场切换" });
  await expect(dialog.locator('[aria-current="true"]')).toHaveCount(1);
  await expect(dialog.locator(`[data-session="${sessionId}"]`)).toHaveAttribute(
    "aria-current",
    "true",
  );
}

async function expectBusinessTextAbsentFromStorage(page: Page, text: string) {
  await expect
    .poll(() =>
      page.evaluate(
        (value) => ({
          session: JSON.stringify(Object.values(sessionStorage)).includes(
            value,
          ),
          local: JSON.stringify(Object.values(localStorage)).includes(value),
        }),
        text,
      ),
    )
    .toEqual({ session: false, local: false });
}
