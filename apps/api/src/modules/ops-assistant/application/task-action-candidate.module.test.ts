import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { TASK_CLAIM_EXPLANATION } from "../../ai-governance";
import { TASK_ASSISTANT_CLAIM_EXECUTION } from "../../work-execution";
import { TASK_ACTION_CANDIDATE_REPOSITORY } from "../domain/task-action-candidate.repository";
import { TaskActionCandidateController } from "../presentation/task-action-candidate.controller";
import {
  ConfirmTaskActionCandidateService,
  GenerateTaskActionCandidateService,
  GetTaskActionCandidateService,
  RejectTaskActionCandidateService,
  TASK_ACTION_TRACE_FACTORY,
} from "./task-action-candidate.services";

describe("task action candidate module wiring", () => {
  it("resolves public ports and optional clock/id factories", async () => {
    const module = await Test.createTestingModule({
      controllers: [TaskActionCandidateController],
      providers: [
        GenerateTaskActionCandidateService,
        GetTaskActionCandidateService,
        RejectTaskActionCandidateService,
        ConfirmTaskActionCandidateService,
        { provide: TASK_ACTION_CANDIDATE_REPOSITORY, useValue: {} },
        { provide: TASK_ASSISTANT_CLAIM_EXECUTION, useValue: {} },
        { provide: TASK_CLAIM_EXPLANATION, useValue: {} },
        { provide: TASK_ACTION_TRACE_FACTORY, useValue: () => "trace-id" },
      ],
    }).compile();
    expect(module.get(TaskActionCandidateController)).toBeInstanceOf(
      TaskActionCandidateController,
    );
    await module.close();
  });
});
