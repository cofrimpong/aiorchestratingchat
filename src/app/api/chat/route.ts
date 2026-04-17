import OpenAI from "openai";
import { NextResponse } from "next/server";
import { searchTextbookPDFWithMcp } from "@/mcp/client";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  messages?: ChatMessage[];
};

const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const textbookToolDefinition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "findCounselorSources",
    description:
      "Find relevant Project Gutenberg sources for designing AI orchestrators that enhance human skills and preserve human qualities. Always includes Sun Tzu context and related public-domain works.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "General search terms about human skills, leadership, strategy, ethics, collaboration, or creativity.",
        },
        title: {
          type: "string",
          description:
            "Exact or near-exact work title when the user provides one.",
        },
        author: {
          type: "string",
          description:
            "Author name(s) when the user provides them (e.g., 'Sun Tzu').",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const role = candidate.role;
  const content = candidate.content;

  return (
    (role === "system" || role === "user" || role === "assistant") &&
    typeof content === "string" &&
    content.trim().length > 0
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing OPENAI_API_KEY." },
      { status: 500 },
    );
  }

  const openai = new OpenAI({ apiKey });

  try {
    const body = (await request.json()) as ChatRequestBody;

    if (!Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "Expected body.messages to be an array." },
        { status: 400 },
      );
    }

    const incomingMessages = body.messages.filter(isChatMessage).slice(-20);

    if (incomingMessages.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one valid message." },
        { status: 400 },
      );
    }

    const requestMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are an AI counselor that helps people design AI orchestrators to enhance human skills and preserve human qualities (judgment, empathy, responsibility, creativity, and cooperation). " +
          "For EVERY user message, you MUST call the findCounselorSources tool. " +
          "When possible, pass structured arguments: title, author, and query (human-skill and strategy keywords). " +
          "Never skip the tool call, never guess from memory. " +
          "Use tool results as internal grounding by default; do NOT automatically list books, links, or resource catalogs unless the user explicitly asks for sources or reading references. " +
          "If users ask how to AI engineer or what words to say, switch into coaching mode and provide: (1) a reusable prompt formula, (2) copy-paste prompt templates, (3) better wording alternatives, and (4) a short critique of the user's draft prompt. " +
          "Prioritize vocabulary and frameworks from modern orchestration practice: spec to sprint to implementation to QA loops; role, scope, invariants, acceptance criteria, sequencing, verification; policy versus execution boundaries; typed schemas as message-in-a-bottle contracts; deterministic tool execution; inspectable invocation; structured results; talker-to-doer capability progression; composition roots and middleware guardrails. " +
          "When giving vocabulary, define each term in one practical line and include a direct usage phrase users can paste into prompts for coding agents like Claude, ChatGPT, or VS Code agents. " +
          "Then provide practical guidance: goals, roles for agents, guardrails, and a weekly human-skill practice loop. " +
          "If the tool returns zero results, suggest 2-3 alternative shorter search terms the user could try. " +
          "Keep responses conversational, ethical, and action-oriented.",
      },
      ...incomingMessages,
    ];

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages: requestMessages,
      tools: [textbookToolDefinition],
      tool_choice: "required",
    });

    const assistantMessage = completion.choices[0]?.message;

    if (assistantMessage?.tool_calls?.length) {
      requestMessages.push({
        role: "assistant",
        content: assistantMessage.content ?? "",
        tool_calls: assistantMessage.tool_calls,
      });

      for (const toolCall of assistantMessage.tool_calls) {
        if (
          toolCall.type !== "function" ||
          toolCall.function.name !== "findCounselorSources"
        ) {
          continue;
        }

        const args = JSON.parse(toolCall.function.arguments || "{}") as {
          query?: string;
          title?: string;
          author?: string;
        };

        const toolResult = await searchTextbookPDFWithMcp({
          query: args.query,
          title: args.title,
          author: args.author,
        });

        requestMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      const finalCompletion = await openai.chat.completions.create({
        model,
        temperature: 0.3,
        messages: requestMessages,
      });

      const finalReply = finalCompletion.choices[0]?.message?.content?.trim();

      if (!finalReply) {
        return NextResponse.json(
          { error: "No response returned from model." },
          { status: 502 },
        );
      }

      return NextResponse.json({ reply: finalReply });
    }

    const reply = assistantMessage?.content?.trim();

    if (!reply) {
      return NextResponse.json(
        { error: "No response returned from model." },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    return NextResponse.json(
      { error: `Chat request failed: ${message}` },
      { status: 500 },
    );
  }
}
