import { SetMetadata } from "@nestjs/common";

export const REQUIRED_CAPABILITIES_KEY = "logix.requiredCapabilities";

/** Declares capability codes the authenticated actor must hold (GC-008 / IAM V1). */
export const RequireCapabilities = (
  ...capabilities: string[]
): ClassDecorator & MethodDecorator =>
  SetMetadata(REQUIRED_CAPABILITIES_KEY, capabilities);
