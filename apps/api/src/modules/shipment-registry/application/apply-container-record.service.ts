import { Inject, Injectable } from "@nestjs/common";
import {
  CONTAINER_RECORD_WRITER,
  type ApplyContainerRecordCommand,
  type ApplyContainerRecordResult,
  type ContainerRecordWriter,
} from "../domain/apply-container-record";

// 写端口用例：integration-import 落账时经此写 container_record。
@Injectable()
export class ApplyContainerRecordService {
  constructor(
    @Inject(CONTAINER_RECORD_WRITER)
    private readonly writer: ContainerRecordWriter,
  ) {}

  execute(
    command: ApplyContainerRecordCommand,
  ): Promise<ApplyContainerRecordResult> {
    return this.writer.apply(command);
  }
}
