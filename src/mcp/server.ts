import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { findCounselorSources } from "../lib/textbookFinder";

const server = new McpServer({
  name: "is219-ai-counselor-mcp",
  version: "1.0.0",
});

const searchSchema = z.object({
  query: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
});

function buildSearchQuery(input: {
  query?: string;
  title?: string;
  author?: string;
}): string {
  const parts = [input.title?.trim(), input.author?.trim(), input.query?.trim()]
    .filter((value): value is string => Boolean(value && value.length > 0));

  return Array.from(new Set(parts)).join(" ").trim();
}

server.tool(
  "findCounselorSources",
  "Find public-domain reading sources from Project Gutenberg for designing AI orchestrators that enhance human skills and preserve human qualities. Always includes Sun Tzu's Art of War resources.",
  searchSchema.shape,
  async ({ query, title, author }) => {
    const searchQuery = buildSearchQuery({ query, title, author });
    if (!searchQuery) {
      throw new Error("Tool call must include at least one of: query, title, author.");
    }

    const results = await findCounselorSources(searchQuery);

    const message =
      results.length === 0
        ? `No sources found for "${searchQuery}". Try broader terms like leadership, strategy, ethics, cooperation, or judgment.`
        : `Found ${results.length} source(s) for "${searchQuery}" focused on strategic thinking, human judgment, and character development.`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            query: searchQuery,
            title: title ?? null,
            author: author ?? null,
            found: results.length,
            results,
            message,
          }),
        },
      ],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main().catch((error) => {
  console.error("MCP server failed to start:", error);
  process.exit(1);
});
