# AGENTS.md

Guidelines for AI assistants and contributors working on Wanasatna.

## Project Overview

Wanasatna is an Arabic-first, browser-based multiplayer party games platform. Players join via room codes — no accounts required for MVP.

## Architecture Rules

- **Monorepo layout:** `apps/web` (frontend), `apps/server` (backend), `packages/shared` (types/constants), `packages/ui` (shared components).
- **No business logic in packages** unless it is genuinely shared between web and server.
- **Database access** stays in `apps/server` only — never import Prisma in the frontend.
- **Real-time logic** lives in `apps/server/src/sockets/` — the frontend connects via Socket.IO client when implemented.
- **Shared types** belong in `packages/shared` — both apps import from there to prevent drift.

## Language and Locale

- Product copy is **Arabic-first**.
- Root HTML uses `lang="ar"` and `dir="rtl"`.
- shadcn/ui is configured with RTL support.
- Code identifiers (variables, files, commits) remain in English.

## What NOT to Build Without Explicit Request

- Game logic or game-specific UI
- Room creation, joining, or lobby flows
- Socket event handlers
- Prisma models or migrations
- API routes beyond health checks (when requested)
- Authentication or payments
- Premium features or ads

## Code Conventions

- **TypeScript** everywhere — strict mode enabled.
- **Package names:** `@wanasatna/web`, `@wanasatna/server`, `@wanasatna/shared`, `@wanasatna/ui`.
- **Imports:** Use workspace package names for cross-package imports.
- **Formatting:** Prettier with single quotes, trailing commas, 100-char line width.
- **Linting:** ESLint flat config per app; packages use `tsc --noEmit`.
- **File naming:** kebab-case for files, PascalCase for React components.
- **Comments:** Only for non-obvious business logic — avoid narrating what code does.

## Frontend (`apps/web`)

- Next.js App Router — pages in `app/`.
- shadcn/ui components go in `components/ui/`; shared visual components go in `packages/ui`.
- Use the `cn()` helper from `@/lib/utils` for class merging.
- Do not add pages beyond what is explicitly requested.
- Keep the default landing page minimal until product design is implemented.

## Backend (`apps/server`)

- Express app factory in `src/app.ts`, entry in `src/index.ts`.
- Mount feature routes under `src/routes/`.
- Register Socket.IO handlers in `src/sockets/`.
- Environment variables via `src/config/env.ts` — never read `process.env` elsewhere.
- Prisma schema in `prisma/schema.prisma` — models added only when the data model is designed.

## Documentation

- Product and technical specs live in `docs/`.
- Do not write doc contents unless explicitly asked — placeholder files exist for future authoring.
- Update `README.md` when setup steps or project structure change.

## Dependency Policy

- Do not add libraries without a clear need.
- Prefer workspace packages over duplicating code.
- Run `pnpm install` from the repository root — never npm or yarn.

## Commit Guidance

- Small, focused changes per commit.
- No secrets in commits (`.env` files are gitignored).
- Do not commit `node_modules`, build outputs, or generated Prisma client artifacts.
