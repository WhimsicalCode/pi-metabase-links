import assert from "node:assert/strict";
import { existsSync, promises as fs } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionRunner,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SHORT_LINKS_EXTENSION = path.resolve(
  PACKAGE_ROOT,
  "../pi-short-links/extensions/short-links.ts",
);
const INTEGRATION_AVAILABLE = existsSync(SHORT_LINKS_EXTENSION);

const MANAGED_ENVIRONMENT = [
  "PI_METABASE_BASE_URL",
  "PI_METABASE_DATABASE_ID",
  "PI_SHORT_LINKS_PORT",
  "PI_SHORT_LINKS_PORT_END",
  "PI_SHORT_LINKS_STORE",
] as const;

test(
  "both packages compose in a Pi runtime without exposing the raw URL",
  { skip: !INTEGRATION_AVAILABLE },
  async (context) => {
    const root = await fs.mkdtemp(
      path.join(tmpdir(), "pi-metabase-links-integration-"),
    );
    const port = await availablePort();
    const previous = Object.fromEntries(
      MANAGED_ENVIRONMENT.map((name) => [name, process.env[name]]),
    );
    process.env.PI_METABASE_BASE_URL = "https://metabase.example.com/metabase";
    process.env.PI_METABASE_DATABASE_ID = "2";
    process.env.PI_SHORT_LINKS_PORT = String(port);
    process.env.PI_SHORT_LINKS_PORT_END = String(port);
    process.env.PI_SHORT_LINKS_STORE = path.join(root, "links.json");

    let session:
      Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
    let shutdownComplete = false;
    context.after(async () => {
      if (session) {
        if (!shutdownComplete) {
          await extensionRunner(session).emit({
            type: "session_shutdown",
            reason: "quit",
          });
        }
        session.dispose();
      }
      for (const name of MANAGED_ENVIRONMENT) {
        const value = previous[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      await fs.rm(root, { recursive: true, force: true });
    });

    const settingsManager = SettingsManager.inMemory();
    const loader = new DefaultResourceLoader({
      cwd: root,
      agentDir: path.join(root, "agent"),
      settingsManager,
      additionalExtensionPaths: [
        path.join(PACKAGE_ROOT, "extensions/metabase-links.ts"),
        SHORT_LINKS_EXTENSION,
      ],
    });
    await loader.reload();
    const createdSession = await createAgentSession({
      cwd: root,
      agentDir: path.join(root, "agent"),
      noTools: "builtin",
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(root),
      settingsManager,
    });
    session = createdSession.session;
    assert.deepEqual(createdSession.extensionsResult.errors, []);

    const tool = session.agent.state.tools.find(
      (candidate) => candidate.name === "create_metabase_link",
    );
    assert.ok(tool);
    const result = await tool.execute("integration-call", {
      sql: "select 1;",
    });
    assert(isRecord(result.details));
    assert.equal(result.details.shortened, true);
    assert.equal(result.details.localOnly, true);
    const shortUrl = result.details.url;
    assert(typeof shortUrl === "string");
    assert.match(shortUrl, new RegExp(`^http://127\\.0\\.0\\.1:${port}/s/`));
    assert.doesNotMatch(JSON.stringify(result), /metabase\.example\.com/);

    const redirect = await fetch(shortUrl, { redirect: "manual" });
    assert.equal(redirect.status, 302);
    const target = redirect.headers.get("location");
    assert(target);
    const [targetPath, fragment] = target.split("#");
    assert.equal(targetPath, "https://metabase.example.com/metabase/question");
    assert.deepEqual(
      JSON.parse(Buffer.from(fragment!, "base64url").toString("utf8")),
      {
        dataset_query: {
          type: "native",
          native: { query: "select 1;" },
          database: 2,
        },
        display: "table",
        visualization_settings: {},
      },
    );

    await extensionRunner(session).emit({
      type: "session_shutdown",
      reason: "quit",
    });
    shutdownComplete = true;
    await assert.rejects(fetch(shortUrl, { signal: AbortSignal.timeout(500) }));
  },
);

function extensionRunner(session: unknown): ExtensionRunner {
  return (session as { _extensionRunner: ExtensionRunner })._extensionRunner;
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return address.port;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
