import type {
  CreateOpsNotificationInput,
  OpsNotificationRecord,
} from "./domain/notification.types";

export const POST_NOTIFICATION = Symbol("PostNotification");

export type PostNotificationInput = CreateOpsNotificationInput;

export interface PostNotificationPort {
  execute(input: PostNotificationInput): Promise<OpsNotificationRecord>;
}
