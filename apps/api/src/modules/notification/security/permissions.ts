export const notificationPermissions = [
  {
    capabilityCode: "notification.read",
    resource: "ops_notification",
    actions: ["read"] as const,
    description:
      "Read ops problem notifications and read-only assistant sessions",
  },
] as const;
