// 业务 Activity（确定性业务步骤；AI/模型调用在 ai-worker，见 ADR-005）。
export async function echoActivity(message: string): Promise<string> {
  return `echo: ${message}`;
}
