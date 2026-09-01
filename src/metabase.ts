import { Buffer } from "node:buffer";

export function buildMetabasePayload(sql: string, databaseId: number) {
  const query = sql.trim();
  if (query === "") {
    throw new Error("SQL must be a non-empty string.");
  }

  return {
    dataset_query: {
      type: "native" as const,
      native: { query },
      database: databaseId,
    },
    display: "table" as const,
    visualization_settings: {},
  };
}

export function createMetabaseUrl(
  baseUrl: string,
  databaseId: number,
  sql: string,
): string {
  const payload = JSON.stringify(buildMetabasePayload(sql, databaseId));
  const fragment = Buffer.from(payload, "utf8").toString("base64url");
  return `${baseUrl}/question#${fragment}`;
}
