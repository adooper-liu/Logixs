import { expect, test } from "@playwright/test";

test("shipping operator saves handoff and sends actual loading for review", async ({
  page,
}) => {
  let dispatch: Record<string, unknown> | null = null;
  let loadedFact: Record<string, unknown> | null = null;
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/containers/container-1/dispatch-snapshot") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        dispatch = {
          snapshotId: "dispatch-1",
          containerRecordId: "container-1",
          version: 1,
          stuffingSnapshotId: "stuffing-1",
          stuffingSnapshotVersion: 2,
          bookingNumber: body.bookingNumber,
          carrierCode: body.carrierCode,
          vesselName: body.vesselName,
          voyageNumber: body.voyageNumber,
          masterBillNumber: body.masterBillNumber,
          houseBillNumber: body.houseBillNumber,
          vgmHandoffState: "accepted",
          evidenceRefs: body.evidenceRefs,
          actorId: "dev-operator",
          reasonCode: body.reasonCode,
          createdAt: "2026-09-21T01:00:00Z",
          duplicate: false,
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: dispatch,
      });
      return;
    }
    if (path === "/api/containers/container-1/date-facts") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        loadedFact = {
          factId: "loaded-fact-1",
          nodeCode: "shipment_dispatch",
          eventCode: body.eventCode,
          timeKind: "actual",
          occurredAt: body.occurredAt,
          rawValue: body.rawValue,
          sourceUtcOffset: body.sourceUtcOffset,
          ingestionChannel: "manual_ui",
          captureSource: "manual_backfill",
          sourceSystem: "logix.manual",
          authoritySystem: "ops-team",
          verificationState: "pending",
          confidenceState: "unknown",
          validity: "effective",
          authorityPolicyRef: "policy-1:1",
          evidenceRefs: body.evidenceRefs,
          applicationState: "review_required",
          applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
          canonicalEventId: null,
          projectionVersion: 1,
          recordedAt: "2026-09-21T02:01:00Z",
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            factId: "loaded-fact-1",
            recordState: "recorded",
            applicationState: "review_required",
            reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
            canonicalEventId: null,
            projectionVersion: 1,
          },
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            items: loadedFact ? [loadedFact] : [],
            projectionVersion: loadedFact ? 1 : 0,
            asOf: "2026-09-21T02:01:00Z",
          },
        });
      }
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: responseFor(path),
    });
  });

  await page.goto("/workspaces/dispatch?view=loading");
  await expect(
    page.getByRole("heading", { name: "装船交接历史" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /KOCU4960726.*领取出运任务/ }).click();
  await expect(page.getByText("8500 KGM", { exact: true })).toBeVisible();

  await page.getByLabel("订舱号").fill("BKG-2026-001");
  await page.getByLabel("船司代码").fill("HMM");
  await page.getByLabel("船名").fill("HMM LEAF");
  await page.getByLabel("航次").fill("0002W");
  await page
    .getByLabel(/订舱 \/ VGM 接收/)
    .fill("33333333-3333-4333-8333-333333333333");
  await page.getByRole("checkbox", { name: /VGM 已被/ }).check();
  await page.getByRole("button", { name: "保存出运交接" }).click();
  await expect(page.getByText("出运交接第 1 版已保存")).toBeVisible();
  await expect(
    page.getByText("HMM LEAF / 0002W", { exact: true }),
  ).toBeVisible();

  await page.getByLabel("实际装船").fill("2026-09-21T10:00");
  await page.getByRole("button", { name: "确认实际装船" }).click();
  await expect(
    page.getByText(/SOURCE_AUTHORITY_REVIEW_REQUIRED/),
  ).toBeVisible();

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

test("shipping operator uploads four sources and reviews joined post-departure gaps", async ({
  page,
}) => {
  let uploadIndex = 0;
  let reviewRequestCount = 0;
  let documentCompletionRequestCount = 0;
  let pendingQueueFilled = false;
  const sourceNames = [
    "引出列表_货柜信息表.xlsx",
    "引出列表_清关信息表.xlsx",
    "引出列表_物流信息表.xlsx",
    "引出列表_仓库信息表.xlsx",
  ];
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/import-batches" && request.method() === "POST") {
      const fileName =
        sourceNames[uploadIndex] ?? `来源${uploadIndex + 1}.xlsx`;
      uploadIndex += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          id: `00000000-0000-4000-8000-00000000000${uploadIndex}`,
          fileName,
          sourceFileStatus: "retained",
          sourceSizeBytes: 1024,
          parserVersion: "tabular-v2",
          replacesBatchId: null,
          status: "parsed",
          rowCount: 20,
          columnCount: 41,
          mappingSuggestions: [],
          confirmedQuantityUnit: null,
          createdAt: "2026-09-23T00:00:00Z",
        },
      });
      return;
    }
    if (path === "/api/post-departure-source-packages/preflight") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          packageId: "a".repeat(64),
          sources: [],
          candidates: [
            {
              candidateRef: "MSNU9762671",
              decision: "ready",
              containerNumber: "MSNU9762671",
              replenishmentOrderNumbers: ["26DSA01884"],
              billNumbers: ["1811F026PE36669R2"],
              carrierCode: "MSC",
              vesselName: "MSC MAKALU III",
              voyageNumber: "HD638A",
              originPortRaw: "福州",
              destinationPortRaw: "萨凡纳",
              cargoOwnerName: "AOSOM LLC",
              departureRaw: "2026-09-23 00:00:00",
              estimatedArrivalRaw: "2026-11-01 00:00:00",
              containerTypeCode: "40HQ",
              packageCount: "367",
              grossWeightKg: "12511.3",
              volumeM3: "68.4",
              issues: [
                {
                  code: "SOURCE_RANGE_METADATA_INVALID",
                  messageKey: "shipment_handoff_source_range_metadata_invalid",
                  subjectRef: "MSNU9762671",
                  fieldCodes: ["source_range"],
                  blocking: false,
                  resolutionState: "system_handled",
                },
                {
                  code: "UNKNOWN_REFERENCE_CODE",
                  messageKey: "shipment_handoff_port_mapping_required",
                  subjectRef: "MSNU9762671",
                  fieldCodes: ["origin_port_code"],
                  blocking: false,
                  resolutionState: "operator_action_required",
                },
                {
                  code: "UNKNOWN_REFERENCE_CODE",
                  messageKey: "shipment_handoff_port_mapping_required",
                  subjectRef: "MSNU9762671",
                  fieldCodes: ["destination_port_code"],
                  blocking: false,
                  resolutionState: "operator_action_required",
                },
                {
                  code: "DEPARTURE_PROOF_REQUIRED",
                  messageKey:
                    "shipment_handoff_departure_timezone_or_authority_required",
                  subjectRef: "MSNU9762671",
                  fieldCodes: ["departure_proof"],
                  blocking: false,
                  resolutionState: "operator_action_required",
                },
                {
                  code: "CARGO_DETAIL_INCOMPLETE",
                  messageKey: "shipment_handoff_cargo_detail_incomplete",
                  subjectRef: "MSNU9762671",
                  fieldCodes: ["cargo_allocations"],
                  blocking: false,
                  resolutionState: "upstream_action_required",
                },
                {
                  code: "EXTERNAL_SHIPMENT_MATCH_REQUIRED",
                  messageKey:
                    "shipment_handoff_external_shipment_match_required",
                  subjectRef: "MSNU9762671",
                  fieldCodes: ["shipment_grouping"],
                  blocking: false,
                  resolutionState: "operator_action_required",
                },
              ],
            },
          ],
          totals: {
            containers: 1,
            bills: 1,
            replenishmentOrders: 1,
            ready: 1,
            reviewRequired: 0,
            rejected: 0,
          },
          traceId: "trace-post-departure-1",
        },
      });
      return;
    }
    if (path === "/api/post-departure-source-packages/reference-ports") {
      const query = new URL(request.url()).searchParams.get("query");
      const port =
        query === "福州"
          ? {
              portId: "22222222-2222-4222-8222-222222222222",
              unlocode: "CNFZG",
              officialName: "Fuzhou",
              areaCode: "CN",
            }
          : {
              portId: "33333333-3333-4333-8333-333333333333",
              unlocode: "USSAV",
              officialName: "Savannah",
              areaCode: "US",
            };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: { items: [port], pageSize: 20, nextCursor: null },
      });
      return;
    }
    if (path === "/api/shipments" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          items: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              shipmentNumber: "SHIP-2026-0001",
              transportMode: "ocean",
              carrierCode: "MSC",
              vesselName: "MSC MAKALU III",
              voyageNumber: "HD638A",
              originCountryCode: "CN",
              originUnlocode: "CNFZG",
              destinationCountryCode: "US",
              destinationUnlocode: "USSAV",
              salesCountryCode: "US",
              cargoOwnerReferenceId: null,
              cargoOwnerName: "AOSOM LLC",
              atdAt: "2026-09-22T16:00:00.000Z",
              etaAt: "2026-11-01T00:00:00.000Z",
              currentLifecycleStatus: "departed",
              lifecycleVersion: 1,
              relationshipVersion: 3,
              activeContainerCount: 2,
              activeCargoLineCount: 15,
              lifecycleInitializationState: "ready",
              updatedAt: "2026-09-24T00:00:00.000Z",
            },
          ],
          pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
          asOf: "2026-09-24T00:00:00.000Z",
          projectionVersion: 1,
        },
      });
      return;
    }
    if (
      path === "/api/shipments/pending-completion" &&
      request.method() === "GET"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          items: pendingQueueFilled
            ? [
                {
                  shipment: {
                    id: "99999999-9999-4999-8999-999999999999",
                    shipmentNumber: "SHIP-2026-0001",
                    transportMode: "ocean",
                    carrierCode: "MSC",
                    vesselName: "MSC MAKALU III",
                    voyageNumber: "HD638A",
                    originCountryCode: "CN",
                    originUnlocode: "CNFZG",
                    destinationCountryCode: "US",
                    destinationUnlocode: "USSAV",
                    salesCountryCode: "US",
                    cargoOwnerReferenceId: null,
                    cargoOwnerName: "AOSOM LLC",
                    atdAt: "2026-09-22T16:00:00.000Z",
                    etaAt: "2026-11-01T00:00:00.000Z",
                    currentLifecycleStatus: "departed",
                    lifecycleVersion: 2,
                    relationshipVersion: 1,
                    activeContainerCount: 1,
                    activeCargoLineCount: 1,
                    lifecycleInitializationState: "ready",
                    updatedAt: "2026-09-24T02:00:00.000Z",
                  },
                  pendingItems: [
                    {
                      code: "bill_of_lading_missing",
                      label: "补充提单资料",
                      subjectType: "document",
                      subjectRef: "99999999-9999-4999-8999-999999999999",
                      currentValue: null,
                      sourceSystem: "legacy-departed-file",
                      sourceValue: null,
                      candidateValues: [],
                      responsibility: {
                        roleCode: "operations_dispatcher",
                        roleLabel: "出运运营",
                      },
                      deadline: {
                        dueAt: null,
                        source: "not_configured",
                        label: "未设定",
                      },
                      restrictedActions: [],
                      directAction: {
                        code: "add_transport_document",
                        label: "补录提单",
                      },
                    },
                  ],
                },
              ]
            : [],
          pageInfo: {
            nextCursor: null,
            hasNextPage: false,
            pageSize: 100,
          },
          asOf: "2026-09-24T02:00:00.000Z",
          projectionVersion: pendingQueueFilled ? 2 : 0,
        },
      });
      return;
    }
    if (
      path === "/api/shipments/99999999-9999-4999-8999-999999999999" &&
      request.method() === "GET"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          shipment: {
            id: "99999999-9999-4999-8999-999999999999",
            shipmentNumber: "SHIP-2026-0001",
            transportMode: "ocean",
            carrierCode: "MSC",
            vesselName: "MSC MAKALU III",
            voyageNumber: "HD638A",
            originCountryCode: "CN",
            originUnlocode: "CNFZG",
            destinationCountryCode: "US",
            destinationUnlocode: "USSAV",
            salesCountryCode: "US",
            cargoOwnerReferenceId: null,
            cargoOwnerName: "AOSOM LLC",
            atdAt: "2026-09-22T16:00:00.000Z",
            etaAt: "2026-11-01T00:00:00.000Z",
            currentLifecycleStatus: "departed",
            lifecycleVersion: 2,
            relationshipVersion: 1,
            activeContainerCount: 1,
            activeCargoLineCount: 1,
            lifecycleInitializationState: "ready",
            updatedAt: "2026-09-24T02:00:00.000Z",
          },
          handoff: null,
          containers: [
            {
              linkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              containerRecordId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              containerNumber: "MSNU9762671",
              containerTypeCode: "40HQ",
              sealNumber: null,
              currentStatus: "shipped",
              linkVersion: 1,
              currentNodeCode: null,
              flowState: null,
              allocations: [],
            },
          ],
          cargoLines: [
            {
              id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              lineNo: 1,
              productSkuId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              productNumber: "SKU-001",
              quantity: "10",
              quantityUnit: "piece",
              packageCount: null,
              packageUnit: null,
              grossWeight: null,
              weightUnit: null,
              volume: null,
              volumeUnit: null,
              replenishmentOrderLineId: null,
              sourceLineId: "source-1",
              version: 1,
            },
          ],
          transportDocuments: [],
          upstreamReferences: [],
          pendingItems: [
            {
              code: "bill_of_lading_missing",
              label: "补充提单资料",
              subjectType: "document",
              subjectRef: "99999999-9999-4999-8999-999999999999",
              currentValue: null,
              sourceSystem: "legacy-departed-file",
              sourceValue: null,
              candidateValues: [],
              responsibility: {
                roleCode: "operations_dispatcher",
                roleLabel: "出运运营",
              },
              deadline: {
                dueAt: null,
                source: "not_configured",
                label: "未设定",
              },
              restrictedActions: [],
              directAction: {
                code: "add_transport_document",
                label: "补录提单",
              },
            },
          ],
          lifecycleInitialization: {
            state: "ready",
            activeContainerCount: 1,
            initializedContainerCount: 1,
            relationshipVersion: 1,
            lastErrorCode: null,
          },
          projectionVersion: 2,
          asOf: "2026-09-24T02:00:00.000Z",
        },
      });
      return;
    }
    if (
      path ===
        "/api/shipment-handoffs/shipments/99999999-9999-4999-8999-999999999999/pending-documents" &&
      request.method() === "POST"
    ) {
      documentCompletionRequestCount += 1;
      expect(request.postDataJSON()).toMatchObject({
        contractVersion: "shipment-pending-document-completion.v1",
        expectedRelationshipVersion: 1,
        documents: [
          {
            documentType: "mbl",
            documentNumber: "NBOZ9FF56400",
            scac: "HMMU",
            containerRecordIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
          },
        ],
      });
      pendingQueueFilled = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          contractVersion: "shipment-pending-document-completion-result.v1",
          status: "saved",
          shipmentId: "99999999-9999-4999-8999-999999999999",
          relationshipVersion: 1,
          documentCount: 1,
          traceId: "trace-document-completion-1",
        },
      });
      return;
    }
    if (
      path === "/api/shipment-handoffs/internal-candidates" &&
      request.method() === "GET"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          items: [],
          asOf: "2026-09-24T00:00:00.000Z",
          projectionVersion: 1,
        },
      });
      return;
    }
    if (path === "/api/evidence" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({
        subjectType: "domain_fact",
        subjectId: "11111111-1111-4111-8111-111111111111",
        contentRef: "船司离港记录 ATD-1",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          evidenceId: "44444444-4444-4444-8444-444444444444",
          verificationState: "pending",
          validity: "effective",
        },
      });
      return;
    }
    if (
      path === "/api/evidence/44444444-4444-4444-8444-444444444444/verify" &&
      request.method() === "POST"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          evidenceId: "44444444-4444-4444-8444-444444444444",
          verificationState: "verified",
          validity: "effective",
        },
      });
      return;
    }
    if (
      path ===
        `/api/post-departure-source-packages/${"a".repeat(64)}/reviews/11111111-1111-4111-8111-111111111111/candidates/MSNU9762671/corrections` &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({
        shipmentGrouping: {
          kind: "existing_shipment",
          shipmentId: "77777777-7777-4777-8777-777777777777",
          expectedRelationshipVersion: 3,
        },
        originPortCode: "CNFZG",
        destinationPortCode: "USSAV",
        departureLocal: "2026-09-23T00:00",
        departureSourceTimezone: "Asia/Shanghai",
        departureEvidenceRef: "44444444-4444-4444-8444-444444444444",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          contractVersion:
            "post-departure-source-candidate-correction-result.v1",
          status: "saved",
          correctionId: "55555555-5555-4555-8555-555555555555",
          version: 1,
          candidate: {
            candidateRef: "MSNU9762671",
            decision: "ready",
            containerNumber: "MSNU9762671",
            replenishmentOrderNumbers: ["26DSA01884"],
            billNumbers: ["1811F026PE36669R2"],
            originPortRaw: "福州",
            destinationPortRaw: "萨凡纳",
            departureRaw: "2026-09-23 00:00:00",
            correction: {
              correctionId: "55555555-5555-4555-8555-555555555555",
              version: 1,
              shipmentGrouping: {
                kind: "existing_shipment",
                shipmentId: "77777777-7777-4777-8777-777777777777",
                expectedRelationshipVersion: 3,
              },
              originPort: {
                portId: "22222222-2222-4222-8222-222222222222",
                unlocode: "CNFZG",
                officialName: "Fuzhou",
                areaCode: "CN",
              },
              destinationPort: {
                portId: "33333333-3333-4333-8333-333333333333",
                unlocode: "USSAV",
                officialName: "Savannah",
                areaCode: "US",
              },
              departureProof: {
                kind: "actual_departure_time",
                occurredAt: "2026-09-22T16:00:00.000Z",
                sourceTimezone: "Asia/Shanghai",
                evidenceRef: "44444444-4444-4444-8444-444444444444",
              },
              reasonCode: "source_fact_confirmed",
              correctedAt: "2026-09-24T01:00:00Z",
            },
            issues: [
              {
                code: "SOURCE_RANGE_METADATA_INVALID",
                messageKey: "shipment_handoff_source_range_metadata_invalid",
                fieldCodes: ["source_range"],
                blocking: false,
                resolutionState: "system_handled",
              },
              {
                code: "CARGO_DETAIL_INCOMPLETE",
                messageKey: "shipment_handoff_cargo_detail_incomplete",
                fieldCodes: ["cargo_allocations"],
                blocking: false,
                resolutionState: "upstream_action_required",
              },
            ],
          },
          remainingIssues: [],
          decision: "ready",
          traceId: "trace-correction-1",
        },
      });
      return;
    }
    if (
      path ===
        `/api/post-departure-source-packages/${"a".repeat(64)}/reviews/11111111-1111-4111-8111-111111111111/candidates/MSNU9762671/cargo-lines` &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({
        expectedVersion: 1,
        cargoLines: [
          {
            replenishmentOrderNumber: "26DSA01884",
            productNumber: "SKU-001",
            quantity: "10",
            quantityUnit: "piece",
          },
        ],
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          contractVersion:
            "post-departure-source-candidate-correction-result.v1",
          status: "saved",
          correctionId: "66666666-6666-4666-8666-666666666666",
          version: 2,
          candidate: {
            candidateRef: "MSNU9762671",
            decision: "ready",
            containerNumber: "MSNU9762671",
            replenishmentOrderNumbers: ["26DSA01884"],
            billNumbers: ["1811F026PE36669R2"],
            correction: {
              correctionId: "66666666-6666-4666-8666-666666666666",
              version: 2,
              shipmentGrouping: {
                kind: "existing_shipment",
                shipmentId: "77777777-7777-4777-8777-777777777777",
                expectedRelationshipVersion: 3,
              },
              originPort: {
                portId: "22222222-2222-4222-8222-222222222222",
                unlocode: "CNFZG",
                officialName: "Fuzhou",
                areaCode: "CN",
              },
              destinationPort: {
                portId: "33333333-3333-4333-8333-333333333333",
                unlocode: "USSAV",
                officialName: "Savannah",
                areaCode: "US",
              },
              departureProof: {
                kind: "actual_departure_time",
                occurredAt: "2026-09-22T16:00:00.000Z",
                sourceTimezone: "Asia/Shanghai",
                evidenceRef: "44444444-4444-4444-8444-444444444444",
              },
              cargoAllocations: [
                {
                  sourceLineId: "MSNU9762671:26DSA01884:SKU-001:1",
                  replenishmentOrderNumber: "26DSA01884",
                  productSkuId: "77777777-7777-4777-8777-777777777777",
                  productNumber: "SKU-001",
                  quantity: "10",
                  quantityUnit: "piece",
                },
              ],
              reasonCode: "cargo_lines_confirmed",
              correctedAt: "2026-09-24T02:00:00Z",
            },
            issues: [
              {
                code: "SOURCE_RANGE_METADATA_INVALID",
                messageKey: "shipment_handoff_source_range_metadata_invalid",
                fieldCodes: ["source_range"],
                blocking: false,
                resolutionState: "system_handled",
              },
            ],
          },
          remainingIssues: [],
          decision: "ready",
          traceId: "trace-cargo-1",
        },
      });
      return;
    }
    if (
      path ===
        `/api/post-departure-source-packages/${"a".repeat(64)}/candidates/MSNU9762671/accept` &&
      request.method() === "POST"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          contractVersion: "post-departure-source-candidate-accept-result.v1",
          acceptedCandidateRefs: ["MSNU9762671"],
          handoff: {
            receptionState: "accepted",
            businessDecisionState: "ready",
            commitState: "committed",
            handoffId: "88888888-8888-4888-8888-888888888888",
            handoffVersion: 1,
            duplicate: false,
            shipmentId: "99999999-9999-4999-8999-999999999999",
            containerResults: [],
            cargoResults: [],
            documentResults: [],
            lifecycleInitializationState: "ready",
            customsAssimilationState: "pending",
            inlandAssimilationState: "pending",
            warehouseAssimilationState: "pending",
            issues: [],
            traceId: "trace-accept-1",
          },
        },
      });
      return;
    }
    if (
      path === `/api/post-departure-source-packages/${"a".repeat(64)}/accept` &&
      request.method() === "POST"
    ) {
      pendingQueueFilled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          contractVersion: "post-departure-source-package-accept-result.v1",
          packageId: "a".repeat(64),
          items: [
            {
              candidateRefs: ["MSNU9762671"],
              status: "accepted",
              shipmentId: "99999999-9999-4999-8999-999999999999",
              errorCode: null,
              traceId: "trace-batch-accept-1",
              recoveryAction: "open_shipment",
            },
          ],
          totals: {
            groups: 1,
            accepted: 1,
            duplicate: 0,
            conflict: 0,
            rejected: 0,
            failed: 0,
          },
        },
      });
      return;
    }
    if (
      path ===
        `/api/post-departure-source-packages/${"a".repeat(64)}/reviews` &&
      request.method() === "POST"
    ) {
      reviewRequestCount += 1;
      expect(request.headers()["x-roles"]).toBe("import_operator");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          contractVersion: "post-departure-source-package-review-result.v1",
          reviewId: "11111111-1111-4111-8111-111111111111",
          packageId: "a".repeat(64),
          decision: "review_required",
          status: "saved",
          candidateCount: 1,
          savedAt: "2026-09-23T08:00:00Z",
          traceId: "trace-review-1",
        },
      });
      return;
    }
    throw new Error(`Unhandled API path in handoff intake E2E: ${path}`);
  });

  await page.goto("/workspaces/dispatch");
  await expect(
    page.getByRole("heading", { name: "接管已出运数据" }),
  ).toBeVisible();

  for (const label of ["货柜信息", "清关信息", "物流信息", "仓库信息"]) {
    await page.getByLabel(`选择${label}文件`).setInputFiles({
      name: `${label}.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(label),
    });
  }
  await expect(page.getByText("已收到 4/4")).toBeVisible();
  await page.getByRole("button", { name: "开始联合预检" }).click();

  await expect(page.getByText("MSNU9762671").first()).toBeVisible();
  await expect(page.getByText("5 项待补", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "确认起运港" })).toBeVisible();
  await expect(page.getByRole("button", { name: "补离港依据" })).toBeVisible();
  await expect(page.getByRole("button", { name: "补 SKU 明细" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "确认所属出运" }),
  ).toBeVisible();
  await expect(page.getByText("1 项已由系统处理")).toBeVisible();
  await expect(page.getByText("0", { exact: true }).first()).toBeVisible();

  const actionList = page.locator('[aria-label="待补动作"] .action-list');
  const actionListLayout = await actionList.evaluate((element) => ({
    columns: getComputedStyle(element)
      .gridTemplateColumns.split(" ")
      .filter(Boolean).length,
    height: element.getBoundingClientRect().height,
  }));
  const viewportWidth = page.viewportSize()?.width ?? 1440;
  expect(actionListLayout.columns).toBe(viewportWidth > 680 ? 2 : 1);
  expect(actionListLayout.height).toBeLessThan(viewportWidth > 680 ? 360 : 430);

  await page.getByRole("button", { name: "补 SKU 明细" }).click();
  await expect(page.getByTestId("handoff-cargo-editor")).toBeVisible();
  await expect(page.getByRole("button", { name: "批量粘贴" })).toBeVisible();
  await expect(page.getByLabel("第 1 行 SKU")).toBeFocused();

  await page.getByRole("button", { name: "确认起运港" }).click();
  await expect(page.getByLabel("搜索起运港")).toBeFocused();
  await expect(page.getByText("当前：福州")).toBeVisible();
  const portFieldColumns = await page
    .locator(".port-fields")
    .evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean)
          .length,
    );
  expect(portFieldColumns).toBe(viewportWidth > 680 ? 2 : 1);
  await expect(
    page.getByRole("button", { name: /CNFZG · Fuzhou/ }),
  ).toBeVisible();
  expect(reviewRequestCount).toBe(0);

  await expect(page.getByText("系统建议")).toBeVisible();
  await expect(page.getByText("CNFZG → USSAV")).toBeVisible();
  await page.getByTestId("existing-shipment-SHIP-2026-0001").click();
  await page.getByRole("button", { name: "查找起运港" }).click();
  await page.getByRole("button", { name: /CNFZG · Fuzhou/ }).click();
  await page.getByRole("button", { name: "查找目的港" }).click();
  await page.getByRole("button", { name: /USSAV · Savannah/ }).click();
  await page.getByLabel("实际离港日期和时间").fill("2026-09-23T00:00");
  await page.getByLabel("来源所在地时区").selectOption("Asia/Shanghai");
  await page.getByLabel("离港依据").fill("船司离港记录 ATD-1");
  await page.getByRole("button", { name: "保存当前进度" }).click();

  await expect(page.getByText("当前进度已保存")).toBeVisible();
  await expect(page.getByText("补全记录已建立")).toBeVisible();
  await expect(page.getByText("追踪号 trace-review-1")).toBeVisible();
  expect(reviewRequestCount).toBe(1);
  await expect(page.getByText("1 项待补", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "补 SKU 明细" }).click();

  await page.getByLabel("第 1 行 SKU").fill("SKU-001");
  await page.getByLabel("第 1 行数量").fill("10");
  await page.getByRole("button", { name: "核对并保存全部明细" }).click();
  await expect(page.getByText("SKU 装载明细已保存")).toBeVisible();
  await expect(page.getByText("当前候选接管条件已齐备")).toBeVisible();
  await expect(page.getByText("可接管", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "接管全部可接管项（1 票）" }).click();
  await expect(page.getByText("批量接管已完成")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /已接管待补/ }).click();
  await expect(
    page.getByRole("heading", { name: "接管已出运数据" }),
  ).toBeVisible();
  await expect(page.getByText("1 票待补")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "当前 Shipment 待补事实" })
      .getByText("补充提单资料"),
  ).toBeVisible();
  const shipmentRoute = page.getByRole("region", {
    name: "当前 Shipment 航线",
  });
  await expect(shipmentRoute.getByText("CNFZG", { exact: true })).toBeVisible();
  await expect(shipmentRoute.getByText("USSAV", { exact: true })).toBeVisible();
  await expect(
    shipmentRoute.getByText("已出运", { exact: true }),
  ).toBeVisible();
  const shipmentCore = page.getByRole("region", {
    name: "当前 Shipment 核心信息",
  });
  await expect(
    shipmentCore.getByText("AOSOM LLC", { exact: true }),
  ).toBeVisible();
  await expect(shipmentCore.getByText("40HQ", { exact: true })).toBeVisible();
  await expect(shipmentCore.getByText("1 行", { exact: true })).toBeVisible();
  const documentEditor = page.getByRole("region", { name: "补充运输单证" });
  await expect(documentEditor).toBeVisible();
  await documentEditor.getByLabel("单证号码").fill("NBOZ9FF56400");
  await documentEditor.getByLabel("SCAC（可选）").fill("HMMU");
  await documentEditor.getByRole("button", { name: "保存提单" }).click();
  await expect(page.getByText("当前没有待补任务。")).toBeVisible();
  expect(documentCompletionRequestCount).toBe(1);

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

function responseFor(path: string): unknown {
  if (path === "/api/containers") return containerPage;
  if (path === "/api/node-tasks") return taskPage;
  if (path === "/api/containers/container-1") return container;
  if (path === "/api/containers/container-1/lifecycle-nodes")
    return lifecycleNodes;
  if (path === "/api/containers/container-1/stuffing-snapshot") return stuffing;
  throw new Error(`Unhandled API path in dispatch E2E: ${path}`);
}

const container = {
  id: "container-1",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  currentStatus: "not_shipped",
  updatedAt: "2026-09-21T00:00:00Z",
};
const containerPage = {
  items: [container],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-09-21T00:00:00Z",
  projectionVersion: 1,
};
const taskPage = {
  items: [
    {
      id: "task-1",
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-1",
      nodeCode: "shipment_dispatch",
      containerId: "container-1",
      taskDefinitionKey: "node-shipment_dispatch",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: [],
      workOrders: [],
      outcome: null,
      nextAction: {
        actionCode: "work_execution.claim_work_order",
        workOrderId: "work-1",
        workOrderDefinitionKey: "dispatch",
        assignmentState: "pool",
        assigneeId: null,
        dueAt: null,
      },
    },
  ],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-09-21T00:00:00Z",
  projectionVersion: 1,
};
const stuffing = {
  snapshotId: "stuffing-1",
  containerRecordId: "container-1",
  version: 2,
  allocationSetId: "allocation-1",
  allocationSetVersion: 2,
  containerNumber: "KOCU4960726",
  sealNumber: "25H1059249",
  packageCount: 524,
  grossWeight: "8319",
  grossWeightUnit: "KGM",
  netWeight: null,
  volume: "66.74",
  volumeUnit: "MTQ",
  vgm: {
    weight: "8500",
    weightUnit: "KGM",
    method: "method_2",
    verifiedAt: "2026-09-20T01:00:00Z",
  },
  evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
  actorId: "operator",
  reasonCode: "confirmed",
  createdAt: "2026-09-20T01:00:00Z",
  duplicate: false,
};
const lifecycleNodes = {
  flow: {
    id: "flow-1",
    state: "active",
    currentNodeCode: "shipment_dispatch",
    version: 3,
  },
  nodes: [
    {
      nodeInstanceId: "node-1",
      nodeCode: "shipment_dispatch",
      sequence: 3,
      state: "active",
      applicability: "required",
      completedAt: null,
      blockedReasonRefs: [],
      isCurrent: true,
      times: { plannedAt: null, estimatedAt: null, actualAt: null },
    },
  ],
  asOf: "2026-09-21T00:00:00Z",
  projectionVersion: 3,
};
