import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ShipmentDetailV1 } from "@logix/contracts";
import {
  SHIPMENT_READ_REPOSITORY,
  type ShipmentReadRepository,
} from "../domain/shipment-read.repository";

export interface GetShipmentInput {
  tenantId?: string;
  id?: string;
}

@Injectable()
export class GetShipmentService {
  constructor(
    @Inject(SHIPMENT_READ_REPOSITORY)
    private readonly repository: ShipmentReadRepository,
  ) {}

  async execute(input: GetShipmentInput): Promise<ShipmentDetailV1> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const id = input.id?.trim() ?? "";
    if (!id) throw new NotFoundException("RESOURCE_NOT_FOUND");

    const projection = await this.repository.findById({ tenantId, id });
    if (!projection) throw new NotFoundException("RESOURCE_NOT_FOUND");
    return { ...projection, asOf: new Date().toISOString() };
  }
}
