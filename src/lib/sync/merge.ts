export function mergeFieldsLWW(
  existingFields: Record<string, unknown>,
  existingTimestamps: Record<string, string>,
  incomingFields: Record<string, unknown>,
  incomingUpdatedAt: string
): { fields: Record<string, unknown>; timestamps: Record<string, string> } {
  const fields = { ...existingFields };
  const timestamps = { ...existingTimestamps };
  for (const [key, value] of Object.entries(incomingFields)) {
    const existingTs = timestamps[key];
    if (!existingTs || incomingUpdatedAt > existingTs) {
      fields[key] = value;
      timestamps[key] = incomingUpdatedAt;
    }
  }
  return { fields, timestamps };
}
