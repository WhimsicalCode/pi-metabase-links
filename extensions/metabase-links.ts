import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { parseBaseUrl, parseDatabaseId } from "../src/config.ts";
import { createMetabaseUrl } from "../src/metabase.ts";
import { requestShortLink } from "../src/short-links.ts";

const SHORTENING_INSTALL_GUIDANCE =
  "Shortening unavailable because pi-short-links is not loaded; returned the raw Metabase URL.\nInstall it with: pi install git:github.com/WhimsicalCode/pi-short-links";

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim() !== ""
    ? error.message
    : "unknown error";
}

export default function metabaseLinksExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "create_metabase_link",
    label: "Create Metabase Link",
    description:
      "Generate a prefilled Metabase native-SQL question link. Uses pi-short-links in-process when available so encoded URLs do not pass through the model.",
    promptSnippet: "Generate prefilled Metabase native-SQL question links",
    promptGuidelines: [
      "Use create_metabase_link instead of Python, bash, or a manual URL encoder when the user asks for a Metabase link.",
      "Do not pass create_metabase_link output to create_short_link; create_metabase_link performs optional shortening in-process.",
      "Omit create_metabase_link shorten for normal requests, set it to true for explicitly short or readable links, and set it to false for raw or teammate-openable links.",
    ],
    parameters: Type.Object({
      sql: Type.String({ description: "Native SQL for the Metabase question" }),
      title: Type.Optional(
        Type.String({ description: "Optional short-link title" }),
      ),
      shorten: Type.Optional(
        Type.Boolean({ description: "Whether to request a local short link" }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const baseUrl = parseBaseUrl(process.env.PI_METABASE_BASE_URL);
      const databaseId = parseDatabaseId(
        process.env.PI_METABASE_DATABASE_ID,
        baseUrl,
      );
      const url = createMetabaseUrl(baseUrl, databaseId, params.sql);

      const warnings: string[] = [];
      if (params.shorten !== false) {
        try {
          const attempt = await requestShortLink(
            pi.events,
            { url, title: params.title ?? "Metabase query" },
            signal,
          );
          if (attempt.claimed) {
            const { shortUrl, warnings: shortLinkWarnings } = attempt.result;
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Metabase link: ${shortUrl}\nWorks only on this machine while Pi's short-links server is running.`,
                },
              ],
              details: {
                url: shortUrl,
                shortened: true,
                localOnly: true,
                warnings: shortLinkWarnings,
              },
            };
          }
          if (params.shorten === true) {
            warnings.push(SHORTENING_INSTALL_GUIDANCE);
          }
        } catch (error) {
          warnings.push(
            `Shortening failed (${describeError(error)}); returned the raw Metabase URL.`,
          );
        }
      }

      const warningText =
        warnings.length === 0 ? "" : `\n${warnings.join("\n")}`;
      return {
        content: [
          {
            type: "text" as const,
            text: `Metabase link: ${url}${warningText}`,
          },
        ],
        details: {
          url,
          shortened: false,
          localOnly: false,
          warnings,
        },
      };
    },
  });
}
