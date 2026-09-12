import { ApiProperty } from "@nestjs/swagger";

export class EchoRequest {
  @ApiProperty({ description: "回显的消息", example: "hello via api" })
  message!: string;
}
