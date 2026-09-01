import assert from "node:assert/strict";
import test from "node:test";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import metabaseLinksExtension from "../extensions/metabase-links.ts";
import type { ShortLinkCreateRequestV1 } from "../src/short-links.ts";

type ToolInput = { sql: string; title?: string; shorten?: boolean };
type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details: {
    url: string;
    shortened: boolean;
    localOnly: boolean;
    warnings: string[];
  };
};
type CapturedTool = {
  name: string;
  execute(
    toolCallId: string,
    params: ToolInput,
    signal?: AbortSignal,
  ): Promise<ToolResult>;
};

function captureTool(
  onEmit?: (eventName: string, data: unknown) => void,
): CapturedTool {
  let registeredTool: CapturedTool | undefined;
  metabaseLinksExtension({
    events: {
      emit(eventName: string, data: unknown) {
        onEmit?.(eventName, data);
      },
    },
    registerTool(tool: CapturedTool) {
      registeredTool = tool;
    },
  } as unknown as ExtensionAPI);
  assert.ok(registeredTool);
  return registeredTool;
}

test("the extension loads and registers its tool without configuration", () => {
  const originalBaseUrl = process.env.PI_METABASE_BASE_URL;
  const originalDatabaseId = process.env.PI_METABASE_DATABASE_ID;
  delete process.env.PI_METABASE_BASE_URL;
  delete process.env.PI_METABASE_DATABASE_ID;
  let registeredName: string | undefined;

  try {
    registeredName = captureTool().name;
  } finally {
    if (originalBaseUrl === undefined) delete process.env.PI_METABASE_BASE_URL;
    else process.env.PI_METABASE_BASE_URL = originalBaseUrl;
    if (originalDatabaseId === undefined)
      delete process.env.PI_METABASE_DATABASE_ID;
    else process.env.PI_METABASE_DATABASE_ID = originalDatabaseId;
  }

  assert.equal(registeredName, "create_metabase_link");
});

test("tool invocation validates missing base URL lazily", async () => {
  const originalBaseUrl = process.env.PI_METABASE_BASE_URL;
  const originalDatabaseId = process.env.PI_METABASE_DATABASE_ID;
  delete process.env.PI_METABASE_BASE_URL;
  process.env.PI_METABASE_DATABASE_ID = "2";

  try {
    const tool = captureTool();
    await assert.rejects(
      tool.execute("test-call", { sql: "select 1;", shorten: false }),
      new Error(
        "PI_METABASE_BASE_URL is required. Example: https://metabase.example.com",
      ),
    );
  } finally {
    if (originalBaseUrl === undefined) delete process.env.PI_METABASE_BASE_URL;
    else process.env.PI_METABASE_BASE_URL = originalBaseUrl;
    if (originalDatabaseId === undefined)
      delete process.env.PI_METABASE_DATABASE_ID;
    else process.env.PI_METABASE_DATABASE_ID = originalDatabaseId;
  }
});

test("tool invocation validates missing database ID lazily", async () => {
  const originalBaseUrl = process.env.PI_METABASE_BASE_URL;
  const originalDatabaseId = process.env.PI_METABASE_DATABASE_ID;
  process.env.PI_METABASE_BASE_URL = "https://metabase.example.com/metabase/";
  delete process.env.PI_METABASE_DATABASE_ID;

  try {
    const tool = captureTool();
    await assert.rejects(
      tool.execute("test-call", { sql: "select 1;", shorten: false }),
      new Error(
        "PI_METABASE_DATABASE_ID is required. Open https://metabase.example.com/metabase/admin/databases/, select the database, and use the final number in its URL (for example, https://metabase.example.com/metabase/admin/databases/2).",
      ),
    );
  } finally {
    if (originalBaseUrl === undefined) delete process.env.PI_METABASE_BASE_URL;
    else process.env.PI_METABASE_BASE_URL = originalBaseUrl;
    if (originalDatabaseId === undefined)
      delete process.env.PI_METABASE_DATABASE_ID;
    else process.env.PI_METABASE_DATABASE_ID = originalDatabaseId;
  }
});

test("shorten false returns a raw URL without contacting short links", async () => {
  const originalBaseUrl = process.env.PI_METABASE_BASE_URL;
  const originalDatabaseId = process.env.PI_METABASE_DATABASE_ID;
  process.env.PI_METABASE_BASE_URL = "https://metabase.example.com/metabase/";
  process.env.PI_METABASE_DATABASE_ID = "2";
  let emitted = 0;

  try {
    const result = await captureTool(() => {
      emitted += 1;
    }).execute("test-call", { sql: "select 1;", shorten: false });

    assert.match(
      result.details.url,
      /^https:\/\/metabase\.example\.com\/metabase\/question#[A-Za-z0-9_-]+$/,
    );
    assert.deepEqual(result, {
      content: [{ type: "text", text: `Metabase link: ${result.details.url}` }],
      details: {
        url: result.details.url,
        shortened: false,
        localOnly: false,
        warnings: [],
      },
    });
    assert.equal(emitted, 0);
  } finally {
    if (originalBaseUrl === undefined) delete process.env.PI_METABASE_BASE_URL;
    else process.env.PI_METABASE_BASE_URL = originalBaseUrl;
    if (originalDatabaseId === undefined)
      delete process.env.PI_METABASE_DATABASE_ID;
    else process.env.PI_METABASE_DATABASE_ID = originalDatabaseId;
  }
});

test("omitted shorten returns a raw URL silently when the request is unclaimed", async () => {
  const originalBaseUrl = process.env.PI_METABASE_BASE_URL;
  const originalDatabaseId = process.env.PI_METABASE_DATABASE_ID;
  process.env.PI_METABASE_BASE_URL = "https://metabase.example.com";
  process.env.PI_METABASE_DATABASE_ID = "2";
  let emitted = 0;

  try {
    const result = await captureTool((_eventName, data) => {
      emitted += 1;
      const request = data as ShortLinkCreateRequestV1;
      assert.equal(request.input.title, "Metabase query");
    }).execute("test-call", { sql: "select 1;" });

    assert.equal(emitted, 1);
    assert.equal(result.details.shortened, false);
    assert.deepEqual(result.details.warnings, []);
    assert.equal(result.content.length, 1);
  } finally {
    if (originalBaseUrl === undefined) delete process.env.PI_METABASE_BASE_URL;
    else process.env.PI_METABASE_BASE_URL = originalBaseUrl;
    if (originalDatabaseId === undefined)
      delete process.env.PI_METABASE_DATABASE_ID;
    else process.env.PI_METABASE_DATABASE_ID = originalDatabaseId;
  }
});

test("explicit shortening returns installation guidance when unclaimed", async () => {
  const originalBaseUrl = process.env.PI_METABASE_BASE_URL;
  const originalDatabaseId = process.env.PI_METABASE_DATABASE_ID;
  process.env.PI_METABASE_BASE_URL = "https://metabase.example.com";
  process.env.PI_METABASE_DATABASE_ID = "2";

  try {
    const result = await captureTool().execute("test-call", {
      sql: "select 1;",
      shorten: true,
    });
    const warning =
      "Shortening unavailable because pi-short-links is not loaded; returned the raw Metabase URL.\nInstall it with: pi install git:github.com/WhimsicalCode/pi-short-links";

    assert.deepEqual(result.details.warnings, [warning]);
    assert.equal(
      result.content[0]!.text,
      `Metabase link: ${result.details.url}\n${warning}`,
    );
  } finally {
    if (originalBaseUrl === undefined) delete process.env.PI_METABASE_BASE_URL;
    else process.env.PI_METABASE_BASE_URL = originalBaseUrl;
    if (originalDatabaseId === undefined)
      delete process.env.PI_METABASE_DATABASE_ID;
    else process.env.PI_METABASE_DATABASE_ID = originalDatabaseId;
  }
});

test("a claimed request returns only the local short URL", async () => {
  const originalBaseUrl = process.env.PI_METABASE_BASE_URL;
  const originalDatabaseId = process.env.PI_METABASE_DATABASE_ID;
  process.env.PI_METABASE_BASE_URL = "https://metabase.example.com";
  process.env.PI_METABASE_DATABASE_ID = "2";
  let rawUrl: string | undefined;

  try {
    const tool = captureTool((eventName, data) => {
      assert.equal(eventName, "pi-short-links:create:v1");
      const request = data as ShortLinkCreateRequestV1;
      rawUrl = request.input.url;
      assert.equal(request.input.title, "Pending invites");
      assert.equal(request.claim(), true);
      request.resolve({
        shortUrl: "http://127.0.0.1:8765/s/pending-invites-abc",
        localOnly: true,
        warnings: [],
      });
    });
    const result = await tool.execute("test-call", {
      sql: "select 1;",
      title: "Pending invites",
    });

    assert.deepEqual(result, {
      content: [
        {
          type: "text",
          text: "Metabase link: http://127.0.0.1:8765/s/pending-invites-abc\nWorks only on this machine while Pi's short-links server is running.",
        },
      ],
      details: {
        url: "http://127.0.0.1:8765/s/pending-invites-abc",
        shortened: true,
        localOnly: true,
        warnings: [],
      },
    });
    assert.ok(rawUrl);
    assert.equal(JSON.stringify(result).includes(rawUrl), false);
  } finally {
    if (originalBaseUrl === undefined) delete process.env.PI_METABASE_BASE_URL;
    else process.env.PI_METABASE_BASE_URL = originalBaseUrl;
    if (originalDatabaseId === undefined)
      delete process.env.PI_METABASE_DATABASE_ID;
    else process.env.PI_METABASE_DATABASE_ID = originalDatabaseId;
  }
});

test("a claimed request failure falls back to the raw URL", async () => {
  const originalBaseUrl = process.env.PI_METABASE_BASE_URL;
  const originalDatabaseId = process.env.PI_METABASE_DATABASE_ID;
  process.env.PI_METABASE_BASE_URL = "https://metabase.example.com";
  process.env.PI_METABASE_DATABASE_ID = "2";

  try {
    const tool = captureTool((_eventName, data) => {
      const request = data as ShortLinkCreateRequestV1;
      assert.equal(request.claim(), true);
      request.reject(new Error("short-links server failed"));
    });
    const result = await tool.execute("test-call", { sql: "select 1;" });
    const warning =
      "Shortening failed (short-links server failed); returned the raw Metabase URL.";

    assert.equal(result.details.shortened, false);
    assert.match(
      result.details.url,
      /^https:\/\/metabase\.example\.com\/question#/,
    );
    assert.deepEqual(result.details.warnings, [warning]);
    assert.equal(
      result.content[0]!.text,
      `Metabase link: ${result.details.url}\n${warning}`,
    );
  } finally {
    if (originalBaseUrl === undefined) delete process.env.PI_METABASE_BASE_URL;
    else process.env.PI_METABASE_BASE_URL = originalBaseUrl;
    if (originalDatabaseId === undefined)
      delete process.env.PI_METABASE_DATABASE_ID;
    else process.env.PI_METABASE_DATABASE_ID = originalDatabaseId;
  }
});
