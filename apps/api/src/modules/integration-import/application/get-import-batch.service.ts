import { Inject, Injectable } from "@nestjs/common";
import {
  IMPORT_REPOSITORY,
  type ImportBatchWithRows,
  type ImportRepository,
} from "../domain/import.repository";

@Injectable()
export class GetImportBatchService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
  ) {}

  execute(id: string): Promise<ImportBatchWithRows | null> {
    return this.repository.findById(id);
  }
}
