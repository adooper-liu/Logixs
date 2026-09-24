import { Inject, Injectable } from "@nestjs/common";
import type { PostDepartureReferencePortSearchResultV1 } from "@logix/contracts";
import {
  REFERENCE_PORT_DIRECTORY,
  type ReferencePortDirectoryPort,
} from "../../master-data";

@Injectable()
export class SearchPostDepartureReferencePortsService {
  constructor(
    @Inject(REFERENCE_PORT_DIRECTORY)
    private readonly ports: ReferencePortDirectoryPort,
  ) {}

  async execute(input: {
    query: string;
    pageSize: number;
    cursor?: string;
  }): Promise<PostDepartureReferencePortSearchResultV1> {
    const result = await this.ports.search(input);
    return { ...result, pageSize: input.pageSize };
  }
}
