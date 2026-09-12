import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Client } from "@temporalio/client";

// workflow 模块是启动/查询 Temporal 工作流的唯一代理（MODULE_DEPENDENCIES §2）。
// 其余模块经它发起/查询，不直接触碰 Temporal 细节。
@Injectable()
export class WorkflowService implements OnModuleDestroy {
  private readonly client = new Client({});

  async startEcho(message: string): Promise<{ workflowId: string }> {
    const handle = await this.client.workflow.start("echoWorkflow", {
      taskQueue: "logix-business",
      workflowId: `echo-${Date.now()}`,
      args: [{ message }],
    });
    return { workflowId: handle.workflowId };
  }

  async getResult(workflowId: string): Promise<unknown> {
    const handle = this.client.workflow.getHandle(workflowId);
    return handle.result();
  }

  onModuleDestroy(): void {
    this.client.connection.close();
  }
}
