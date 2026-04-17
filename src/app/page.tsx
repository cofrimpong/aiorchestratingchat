"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const initialMessage: ChatMessage = {
  role: "assistant",
  content:
    "Hello! I am your **AI Orchestrating Counselor**.\n\nBecome the best AI orchestrator while strengthening your human skills, preserving your qualities as a human, boosting your vocabulary and uniqueness!\n\n**You can ask me for:**\n- prompt formulas and copy-paste templates\n- orchestrator blueprints and agent roles\n- guardrails and weekly skill practice loops\n\nWhat are you building right now?",
};

const SUGGESTION_CHIPS = [
  {
    label: "Prompt Formula",
    prompt:
      "Teach me the right words to use for AI engineering prompts and give me a reusable formula",
  },
  {
    label: "Prompt Critique",
    prompt:
      "Critique this prompt and rewrite it so an AI agent can execute it reliably: build me a feature fast",
  },
  {
    label: "Orchestrator Blueprint",
    prompt:
      "Design an AI orchestrator to improve my decision making while preserving empathy and accountability",
  },
  {
    label: "Role + Scope Prompt",
    prompt:
      "Give me a role scope invariants acceptance criteria prompt template for feature implementation",
  },
  {
    label: "Human In Loop",
    prompt:
      "Create a human-in-the-loop workflow for an AI coding agent with approval checkpoints",
  },
  {
    label: "Ethical Guardrails",
    prompt:
      "Give me a robust guardrail checklist for agent orchestration to preserve human qualities",
  },
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(
    () => input.trim().length > 0 && !isLoading,
    [input, isLoading],
  );

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
      };

      if (!response.ok || !payload.reply) {
        throw new Error(payload.error ?? "The assistant did not return a response.");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.reply as string },
      ]);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Unexpected error while contacting the assistant.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  async function handleChip(prompt: string) {
    if (isLoading) return;
    const userMessage: ChatMessage = { role: "user", content: prompt };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error ?? "The assistant did not return a response.");
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.reply as string },
      ]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unexpected error.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  const isHeroState = messages.length === 1 && !isLoading;
  const showChips = isHeroState;

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="pointer-events-none absolute -left-10 top-5 -z-10 h-40 w-40 rotate-12 border-[5px] border-black bg-cyan-300 shadow-[9px_9px_0_#000]" />
      <div className="pointer-events-none absolute right-6 top-14 -z-10 h-36 w-36 rounded-full border-[5px] border-black bg-yellow-300 shadow-[8px_8px_0_#000]" />
      <div className="pointer-events-none absolute bottom-8 left-1/2 -z-10 h-44 w-[20rem] -translate-x-1/2 skew-x-[-14deg] rounded-3xl border-[4px] border-cyan-300/60 bg-cyan-400/10 blur-2xl" />

      <section className="relative flex flex-1 flex-col overflow-hidden rounded-[1.75rem] border-[4px] border-black bg-white shadow-[14px_14px_0_#000]">
        <div className="border-b-[3px] border-black bg-[linear-gradient(135deg,#ffec8a_0%,#ff8bd1_38%,#8ec5ff_100%)] px-4 py-3 sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-black bg-cyan-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] sm:text-xs">
            Neo Lab Interface
          </div>
          <h1 className="mt-2 font-[family:var(--font-display)] text-2xl leading-none tracking-tight text-black sm:text-4xl">
            AI Orchestrating Counselor
          </h1>
          <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-zinc-900 sm:text-sm">
            Ask for exact wording, orchestration plans, and prompt rewrites that execute cleanly.
          </p>
        </div>

        <div className={`flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_70%,#e0f2fe_100%)] px-4 py-4 sm:px-6 sm:py-6 ${isHeroState ? "flex items-center justify-center" : "space-y-4"}`}>
          {messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={`max-w-[95%] rounded-[1.2rem] border-[3px] px-4 py-3 text-sm leading-relaxed sm:max-w-[84%] ${
                message.role === "user"
                  ? "ml-auto -rotate-[0.8deg] border-black bg-black text-white shadow-[8px_8px_0_#14b8a6]"
                  : isHeroState
                    ? "mx-auto rotate-[0.3deg] border-black bg-white text-zinc-900 shadow-[8px_8px_0_#000]"
                    : "rotate-[0.3deg] border-black bg-white text-zinc-900 shadow-[8px_8px_0_#000]"
              }`}
            >
              <ReactMarkdown
                components={{
                  a: ({ node: _node, ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    />
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </article>
          ))}

          {isLoading && (
            <div className="inline-flex items-center gap-2 rounded-full border-[3px] border-black bg-yellow-200 px-4 py-2 text-sm font-semibold text-black shadow-[4px_4px_0_#000]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-black" />
              Assistant is thinking through the next move...
            </div>
          )}
        </div>

        {showChips && (
          <div className="flex flex-wrap gap-2 border-t-[3px] border-black bg-white px-4 py-3 sm:px-6">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => void handleChip(chip.prompt)}
                className="rounded-full border-[3px] border-black bg-cyan-200 px-3.5 py-2 text-xs font-black uppercase tracking-[0.06em] text-black shadow-[4px_4px_0_#000] transition duration-200 hover:-translate-y-1 hover:bg-fuchsia-200"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3 border-t-[4px] border-black bg-white px-4 py-4 sm:px-6">
          <label className="sr-only" htmlFor="chat-input">
            Message
          </label>
          <textarea
            id="chat-input"
            className="min-h-28 w-full resize-y rounded-[1rem] border-[3px] border-black bg-white p-4 text-sm text-black outline-none ring-0 placeholder:text-zinc-500 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.35)]"
            placeholder="Ask for better prompt wording, an orchestration plan, or a rewrite of your draft prompt..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={isLoading}
          />

          <div className="flex items-center justify-between gap-3">
            {error ? (
              <p className="text-sm font-semibold text-red-700">{error}</p>
            ) : (
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-700">Press Enter to send</p>
            )}
            <button
              type="button"
              className="rounded-full border-[3px] border-black bg-fuchsia-300 px-5 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-black shadow-[6px_6px_0_#000] transition duration-200 hover:-translate-y-1 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              disabled={!canSend}
              onClick={() => {
                void handleSend();
              }}
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
