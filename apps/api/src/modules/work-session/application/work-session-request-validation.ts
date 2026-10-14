export function assertExactKeys(
  value: object,
  allowed: readonly string[],
  required: readonly string[],
  field = "request",
): void {
  const keys = Object.keys(value);
  if (
    keys.some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new Error(`VALIDATION_FORMAT: ${field}`);
  }
}
