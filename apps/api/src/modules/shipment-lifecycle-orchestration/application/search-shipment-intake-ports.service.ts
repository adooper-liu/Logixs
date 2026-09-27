import { Inject, Injectable } from "@nestjs/common";
import type { ShipmentIntakePortSearchResultV1 } from "@logix/contracts";
import {
  REFERENCE_PORT_DIRECTORY,
  type ReferencePortDirectoryPort,
} from "../../master-data";

@Injectable()
export class SearchShipmentIntakePortsService {
  constructor(
    @Inject(REFERENCE_PORT_DIRECTORY)
    private readonly ports: ReferencePortDirectoryPort,
  ) {}

  async execute(input: {
    query: string;
    pageSize: number;
    cursor?: string;
  }): Promise<ShipmentIntakePortSearchResultV1> {
    const result = await this.ports.search(input);
    return {
      contractVersion: "shipment-intake-port-search.v1",
      items: result.items,
      pageSize: input.pageSize,
      nextCursor: result.nextCursor,
    };
  }
}
