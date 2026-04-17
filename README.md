# IS219 Chat

Professional Next.js starter configured for production-oriented development.

## Stack

- Next.js (App Router) + TypeScript
- React + Tailwind CSS
- ESLint + Prettier
- Vitest + Testing Library
- Husky + lint-staged
- GitHub Actions CI

## Quick Start

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`.

## Scripts

- `npm run dev` - Start local development server (Turbopack)
- `npm run build` - Create production build
- `npm run start` - Run production server
- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Auto-fix lint issues
- `npm run typecheck` - TypeScript type checks
- `npm run test` - Run unit tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run format` - Format codebase with Prettier
- `npm run format:check` - Validate formatting

## Environment

Copy `.env.example` to `.env.local` and update values for your environment.

Required variables:

- `OPENAI_API_KEY` - your server-side OpenAI API key
- `OPENAI_MODEL` - model name (default: `gpt-4o-mini`)

## AI Counselor

- **Homepage chat interface**: Conversational AI counselor for orchestrator design
- **Messages sent to**: `POST /api/chat` endpoint
- **API key security**: OpenAI API key used only on the server (never exposed client-side)
- **Tool integration**: Powered by MCP (Model Context Protocol) client/server architecture
- **Counselor sources**: AI uses the `findCounselorSources` tool to ground guidance in public-domain strategy sources

## Process References

This project follows the same disciplined orchestration style used in these reference repos:

- [nextjs_ai_orchestration_spec_sprint_process](https://github.com/kaw393939/nextjs_ai_orchestration_spec_sprint_process) — spec → sprint → implementation → QA workflow, plus explicit read order, verification, and scope discipline
- [ai_orchestration_mcp_nextjs](https://github.com/kaw393939/ai_orchestration_mcp_nextjs) — MCP + Next.js architecture split, typed tool boundaries, and prompt patterns for talkers-to-doers design

When making changes here, follow the same pattern: read before writing, keep scope tight, verify with tests, and treat process artifacts as part of the system.

The chat uses OpenAI tool-calling to provide counseling-style planning for AI orchestrators that enhance human skills and preserve human qualities. For each user request, the assistant:

1. Calls the `findCounselorSources` MCP tool
2. Returns source-backed reading links (including The Art of War)
3. Proposes an orchestrator structure (agent roles, goals, and guardrails)
4. Suggests practical loops to strengthen human judgment, empathy, creativity, and responsibility

Primary source base:

- **Project Gutenberg**: Public-domain works
- **Sun Tzu, The Art of War**: Core strategic reference for counselor framing

## Quality Gates

- Pre-commit hook runs `lint-staged`
- CI workflow runs lint, typecheck, test, and build
