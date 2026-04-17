import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let clientPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const transport = new StdioClientTransport({
        command: process.platform === "win32" ? "npx.cmd" : "npx",
        args: ["tsx", "src/mcp/server.ts"],
      });

      const client = new Client(
        {
          name: "is219-chat-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      await client.connect(transport);
      return client;
    })();
  }

  return clientPromise;
}

function extractToolText(
  content: Array<{ type: string; text?: string }> | undefined,
): string {
  if (!content) {
    throw new Error("MCP tool returned no content.");
  }

  const firstTextBlock = content.find((item) => item.type === "text" && item.text);
  if (!firstTextBlock?.text) {
    throw new Error("MCP tool response had no text payload.");
  }

  return firstTextBlock.text;
}

export interface TextbookResult {
  title: string;
  author: string;
  url: string;
  isbn?: string;
  edition?: string;
  source: string;
}

export interface TextbookSearchResponse {
  query: string;
  title?: string | null;
  author?: string | null;
  found: number;
  results: TextbookResult[];
  message: string;
}

export interface TextbookSearchInput {
  query?: string;
  title?: string;
  author?: string;
}

export async function searchTextbookPDFWithMcp(
  input: TextbookSearchInput,
): Promise<TextbookSearchResponse> {
  const hasInput = Boolean(
    input.query?.trim() || input.title?.trim() || input.author?.trim(),
  );
  if (!hasInput) {
    throw new Error("Textbook search input requires query, title, or author.");
  }

  const client = await getClient();
  const response = await client.callTool({
    name: "findCounselorSources",
    arguments: {
      query: input.query?.trim() || undefined,
      title: input.title?.trim() || undefined,
      author: input.author?.trim() || undefined,
    },
  });

  const text = extractToolText(response.content as Array<{ type: string; text?: string }>);
  return JSON.parse(text) as TextbookSearchResponse;
}
