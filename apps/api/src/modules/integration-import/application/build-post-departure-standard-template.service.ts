import { Inject, Injectable } from "@nestjs/common";
import {
  REFERENCE_LOCATION_CATALOG,
  type ReferenceLocationCatalogPort,
} from "../../master-data";
import { buildPostDepartureStandardTemplate } from "./build-post-departure-standard-template";

@Injectable()
export class BuildPostDepartureStandardTemplateService {
  constructor(
    @Inject(REFERENCE_LOCATION_CATALOG)
    private readonly referenceLocations: ReferenceLocationCatalogPort,
  ) {}

  async execute(): Promise<Buffer> {
    const referenceLocations = await this.referenceLocations.listActive();
    return buildPostDepartureStandardTemplate(referenceLocations);
  }
}
