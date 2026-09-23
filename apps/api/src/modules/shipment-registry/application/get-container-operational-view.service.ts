import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AllowedAction, ContainerOperationalView } from "@logix/contracts";
import {
  ACTION_CODES,
  findActionDefinition,
} from "@logix/contracts/action-catalog";
import {
  CONTAINER_OPERATIONAL_VIEW_REPOSITORY,
  type ContainerOperationalProjection,
  type ContainerOperationalViewRepository,
} from "../domain/container-operational-view.repository";

export interface GetContainerOperationalViewInput {
  tenantId?: string;
  containerId?: string;
  capabilities?: readonly string[];
}

@Injectable()
export class GetContainerOperationalViewService {
  constructor(
    @Inject(CONTAINER_OPERATIONAL_VIEW_REPOSITORY)
    private readonly repository: ContainerOperationalViewRepository,
  ) {}

  async execute(
    input: GetContainerOperationalViewInput,
  ): Promise<ContainerOperationalView> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    const containerId = input.containerId?.trim() ?? "";
    if (!containerId) throw new NotFoundException("RESOURCE_NOT_FOUND");

    const projection = await this.repository.findByContainer({
      tenantId,
      containerId,
    });
    if (!projection) throw new NotFoundException("RESOURCE_NOT_FOUND");

    const capabilities = new Set(input.capabilities ?? []);
    const canReadTasks = capabilities.has("task.read");
    const canReadEvidence = capabilities.has("evidence.read");
    return {
      ...projection,
      tasks: canReadTasks ? projection.tasks : [],
      workOrders: canReadTasks ? projection.workOrders : [],
      professionalFacts: projection.professionalFacts.map((fact) => ({
        ...fact,
        evidenceRefs: canReadEvidence ? fact.evidenceRefs : [],
      })),
      evidenceSummary: canReadEvidence
        ? projection.evidenceSummary
        : {
            total: 0,
            effective: 0,
            pending: 0,
            disputed: 0,
            evidenceRefs: [],
            restrictedEvidencePresent: projection.evidenceSummary.total > 0,
          },
      allowedActions: projectAllowedActions(projection, capabilities),
    };
  }
}

function projectAllowedActions(
  projection: ContainerOperationalProjection,
  capabilities: ReadonlySet<string>,
): AllowedAction[] {
  const actions: AllowedAction[] = [];
  if (capabilities.has("lifecycle.operate") && projection.flow) {
    actions.push(
      actionView(ACTION_CODES.recordLifecycleDateFact, projection.tenantId, {
        entityType: "container",
        entityId: projection.containerId,
        ownerModule: "shipment-registry",
        expectedVersion: projection.flow.version,
        executable: projection.flow.state === "active",
        denialCategory:
          projection.flow.state === "active" ? undefined : "state",
      }),
    );
  }
  return actions;
}

function actionView(
  actionCode: string,
  tenantId: string,
  input: {
    entityType: "container";
    entityId: string;
    ownerModule: "shipment-registry";
    expectedVersion: number;
    executable?: boolean;
    denialCategory?: AllowedAction["denialCategory"];
  },
): AllowedAction {
  const definition = findActionDefinition(actionCode);
  if (!definition) throw new Error("ACTION_UNKNOWN");
  return {
    actionCode: definition.actionCode,
    actionVersion: definition.actionVersion,
    target: {
      tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      ownerModule: input.ownerModule,
    },
    executable: input.executable ?? true,
    ...(input.denialCategory ? { denialCategory: input.denialCategory } : {}),
    confirmationPolicy: definition.confirmationPolicy,
    reviewPolicy: definition.reviewPolicy,
    requiredEvidenceTypes: [],
    expectedVersion: input.expectedVersion,
  };
}
