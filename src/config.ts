const BASE_URL_REQUIRED_ERROR =
  "PI_METABASE_BASE_URL is required. Example: https://metabase.example.com";
const BASE_URL_INVALID_ERROR =
  "PI_METABASE_BASE_URL must be an absolute http(s) URL without credentials, query, or fragment.";
const DATABASE_ID_REQUIRED_ERROR =
  "PI_METABASE_DATABASE_ID is required. Find the database ID in your Metabase instance configuration.";
const DATABASE_ID_INVALID_ERROR =
  "PI_METABASE_DATABASE_ID must be a positive base-10 integer.";

export function parseBaseUrl(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(BASE_URL_REQUIRED_ERROR);
  }

  const normalized = value.trim();
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(BASE_URL_INVALID_ERROR);
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    normalized.includes("?") ||
    normalized.includes("#")
  ) {
    throw new Error(BASE_URL_INVALID_ERROR);
  }

  return url.href.replace(/\/+$/, "");
}

export function parseDatabaseId(
  value: string | undefined,
  baseUrl?: string,
): number {
  if (value === undefined || value.trim() === "") {
    if (baseUrl !== undefined) {
      const databasesUrl = `${baseUrl}/admin/databases/`;
      throw new Error(
        `PI_METABASE_DATABASE_ID is required. Open ${databasesUrl}, select the database, and use the final number in its URL (for example, ${databasesUrl}2).`,
      );
    }
    throw new Error(DATABASE_ID_REQUIRED_ERROR);
  }

  const normalized = value.trim();
  const databaseId = Number(normalized);
  if (
    !/^\d+$/.test(normalized) ||
    !Number.isSafeInteger(databaseId) ||
    databaseId <= 0
  ) {
    throw new Error(DATABASE_ID_INVALID_ERROR);
  }

  return databaseId;
}
