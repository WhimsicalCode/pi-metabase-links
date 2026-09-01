import assert from "node:assert/strict";
import test from "node:test";

import { buildMetabasePayload, createMetabaseUrl } from "../src/metabase.ts";

test("buildMetabasePayload rejects whitespace-only SQL", () => {
  assert.throws(
    () => buildMetabasePayload(" \n\t ", 2),
    new Error("SQL must be a non-empty string."),
  );
});

test("buildMetabasePayload produces the exact v1 payload", () => {
  assert.deepEqual(buildMetabasePayload("select 1;", 2), {
    dataset_query: {
      type: "native",
      native: { query: "select 1;" },
      database: 2,
    },
    display: "table",
    visualization_settings: {},
  });
});

test("buildMetabasePayload trims edges while preserving SQL formatting and Unicode", () => {
  const sql = "  select\n  'héllo 👋' -- keep  spaces\n;  ";

  assert.equal(
    buildMetabasePayload(sql, 7).dataset_query.native.query,
    "select\n  'héllo 👋' -- keep  spaces\n;",
  );
});

test("createMetabaseUrl uses the configured path and encodes the exact payload", () => {
  const url = createMetabaseUrl(
    "https://analytics.example.com/metabase",
    2,
    "select 1;",
  );
  const [path, fragment] = url.split("#");

  assert.equal(path, "https://analytics.example.com/metabase/question");
  assert.equal(
    Buffer.from(fragment!, "base64url").toString("utf8"),
    JSON.stringify(buildMetabasePayload("select 1;", 2)),
  );
});

test("createMetabaseUrl preserves formatted Unicode SQL through UTF-8 encoding", () => {
  const sql = "select\n  'héllo 👋' -- keep  spaces\n;";
  const fragment = createMetabaseUrl(
    "https://metabase.example.com",
    2,
    sql,
  ).split("#")[1]!;
  const payload = JSON.parse(Buffer.from(fragment, "base64url").toString());

  assert.equal(payload.dataset_query.native.query, sql);
});

test("createMetabaseUrl emits an unpadded URL-safe Base64 fragment", () => {
  const fragment = createMetabaseUrl(
    "https://metabase.example.com",
    2,
    "select 'ÿ';",
  ).split("#")[1]!;

  assert.match(fragment, /^[A-Za-z0-9_-]+$/);
});

test("createMetabaseUrl performs no network request", () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls += 1;
    throw new Error("Unexpected network request");
  }) as typeof fetch;

  try {
    createMetabaseUrl("https://metabase.example.com", 2, "select 1;");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
