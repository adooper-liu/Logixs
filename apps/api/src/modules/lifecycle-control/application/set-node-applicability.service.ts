import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { LifecycleNodeCode, NodeApplicability } from "@logix/contracts";
import { decideSetNodeApplicability } from "../domain/node-applicability";
import {
  LIFECYCLE_REPOSITORY,
  type LifecycleRepository,
} from "../domain/lifecycle.repository";
import { NODE_SEQUENCE } from "../domain/node-status";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ASSERT_EVIDENCE_REFS = Symbol.for("logix.AssertEvidenceRefs");

interface AssertEvidenceRefsPort {
  execute(input: {
    tenantId: string;
    subjectType: string;
    subjectId: string;
    evidenceIds: string[];
  }): Promise<void>;
}

export interface SetNodeApplicabilityInput {
  containerId: string;
  tenantId: string;
  nodeCode: string;
  applicability: "optional_applicable" | "optional_not_applicable";
  evidenceRefs: string[];
  reasonCode: string;
  actorId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface SetNodeApplicabilityResult {
  flowInstanceId: string;
  nodeCode: LifecycleNodeCode;
  applicability: NodeApplicability;
  applied: boolean;
  version: number;
}

@Injectable()
export class SetNodeApplicabilityService {
  constructor(
    @Inject(LIFECYCLE_REPOSITORY)
    private readonly repository: LifecycleRepository,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
  ) {}

  async execute(
    input: SetNodeApplicabilityInput,
  ): Promise<SetNodeApplicabilityResult> {
    if (!(input.nodeCode in NODE_SEQUENCE)) {
      throw new HttpException(
        "VALIDATION_FORMAT: 未知节点码",
        HttpStatus.BAD_REQUEST,
      );
    }
    const nodeCode = input.nodeCode as LifecycleNodeCode;
    if (
      input.applicability !== "optional_applicable" &&
      input.applicability !== "optional_not_applicable"
    ) {
      throw new HttpException(
        "VALIDATION_FORMAT: 非法适用性",
        HttpStatus.BAD_REQUEST,
      );
    }
    validateCommandFields(input);

    const container = await this.repository.findContainerBase(
      input.containerId,
    );
    if (!container) throw new NotFoundException("RESOURCE_NOT_FOUND");
    if (container.tenantId !== input.tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 租户不匹配",
        HttpStatus.FORBIDDEN,
      );
    }

    const existing = await this.repository.findApplicabilityDecision(
      input.idempotencyKey,
    );
    if (existing) {
      if (
        existing.nodeCode !== nodeCode ||
        existing.applicability !== input.applicability
      ) {
        throw new HttpException(
          "IDEMPOTENCY_CONFLICT: 同键异载荷",
          HttpStatus.CONFLICT,
        );
      }
      return {
        flowInstanceId: existing.flowInstanceId,
        nodeCode: existing.nodeCode,
        applicability: existing.applicability,
        applied: false,
        version: existing.version,
      };
    }

    const flow = await this.repository.findFlowByContainer(input.containerId);
    if (!flow) throw new NotFoundException("RESOURCE_NOT_FOUND");

    if (input.expectedVersion !== flow.flow.version) {
      throw new HttpException(
        "CONCURRENCY_CONFLICT: expectedVersion 不匹配",
        HttpStatus.CONFLICT,
      );
    }

    const node = flow.nodes.find((item) => item.nodeCode === nodeCode);
    const decision = decideSetNodeApplicability({
      nodeCode,
      nodeState: node?.state ?? null,
      laterNodes: flow.nodes,
    });
    if (decision.kind === "reject") {
      throw new HttpException(
        `${decision.code}: ${decision.message}`,
        HttpStatus.CONFLICT,
      );
    }

    await this.assertEvidenceRefs.execute({
      tenantId: input.tenantId,
      subjectType: "container",
      subjectId: input.containerId,
      evidenceIds: input.evidenceRefs,
    });

    const saved = await this.repository.applyNodeApplicability({
      flowInstanceId: flow.flow.id,
      nodeCode,
      applicability: input.applicability,
      evidenceRefs: input.evidenceRefs,
      reasonCode: input.reasonCode,
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      flowInstanceId: flow.flow.id,
      nodeCode,
      applicability: input.applicability,
      applied: true,
      version: saved.version,
    };
  }
}

function validateCommandFields(input: SetNodeApplicabilityInput): void {
  if (!input.reasonCode || input.reasonCode.length > 64) {
    throw new HttpException(
      "VALIDATION_FORMAT: reasonCode 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 200) {
    throw new HttpException(
      "VALIDATION_FORMAT: idempotencyKey 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!input.actorId || input.actorId.length > 128) {
    throw new HttpException(
      "VALIDATION_FORMAT: actorId 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (input.evidenceRefs.length === 0) {
    throw new HttpException(
      "VALIDATION_FORMAT: evidenceRefs 至少一条",
      HttpStatus.BAD_REQUEST,
    );
  }
  const unique = new Set(input.evidenceRefs);
  if (unique.size !== input.evidenceRefs.length) {
    throw new HttpException(
      "VALIDATION_FORMAT: evidenceRefs 必须唯一",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (input.evidenceRefs.some((ref) => !UUID_PATTERN.test(ref))) {
    throw new HttpException(
      "VALIDATION_FORMAT: evidenceRefs 含非法 UUID",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new HttpException(
      "VALIDATION_FORMAT: expectedVersion 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
}
