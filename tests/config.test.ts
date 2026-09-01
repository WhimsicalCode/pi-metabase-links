import assert from "node:assert/strict";
import test from "node:test";

import { parseBaseUrl, parseDatabaseId } from "../src/config.ts";

test("parseBaseUrl reports an actionable error when the value is missing", () => {
  assert.throws(
    () => parseBaseUrl(undefined),
    new Error(
      "PI_METABASE_BASE_URL is required. Example: https://metabase.example.com",
    ),
  );
});

test("parseBaseUrl preserves path prefixes and removes trailing slashes", () => {
  assert.equal(
    parseBaseUrl("https://analytics.example.com/metabase///"),
    "https://analytics.example.com/metabase",
  );
});

test("parseBaseUrl rejects unsupported or unsafe URLs", () => {
  const invalidUrls = [
    "metabase.example.com",
    "file:///tmp/metabase",
    "https://user:password@example.com",
    "https://example.com?instance=metabase",
    "https://example.com?",
    "https://example.com/#foo",
    "https://example.com#",
  ];

  for (const value of invalidUrls) {
    assert.throws(
      () => parseBaseUrl(value),
      /PI_METABASE_BASE_URL must be an absolute http\(s\) URL without credentials, query, or fragment/,
      value,
    );
  }
});

test("parseDatabaseId reports an actionable error when the value is missing", () => {
  assert.throws(
    () => parseDatabaseId(undefined),
    new Error(
      "PI_METABASE_DATABASE_ID is required. Find the database ID in your Metabase instance configuration.",
    ),
  );
});

test("parseDatabaseId rejects values that are not positive base-10 integers", () => {
  for (const value of ["abc", "1.5", "0", "-1", "2e1", "0x2"]) {
    assert.throws(
      () => parseDatabaseId(value),
      /PI_METABASE_DATABASE_ID must be a positive base-10 integer/,
      value,
    );
  }
});

test("parseDatabaseId accepts a positive integer", () => {
  assert.equal(parseDatabaseId(" 42 "), 42);
});
