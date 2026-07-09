# Wanasatna | ونساتنا

Arabic-first browser-based multiplayer party games platform. Players create a room, invite friends with a room code, and play together directly from the browser.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | pnpm workspaces |
| **Frontend** | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js, Express, Socket.IO |
| **Database** | PostgreSQL, Prisma |
| **Tooling** | ESLint, Prettier |

## Project Structure

```
wanasatna/
├── apps/
│   ├── web/          # Next.js frontend
│   └── server/       # Express + Socket.IO API server
├── packages/
│   ├── shared/       # Shared types, constants, utilities
│   └── ui/           # Shared UI components
├── docs/             # Project documentation
├── package.json      # Root workspace config
└── pnpm-workspace.yaml
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL (for server, when database work begins)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd wanasatna

# Install all workspace dependencies
pnpm install

# Copy server environment variables
cp apps/server/.env.example apps/server/.env

# Generate Prisma client (required before running the server)
pnpm --filter @wanasatna/server prisma:generate
```

## Development Commands

Run from the repository root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web and server in parallel |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint all workspace packages |
| `pnpm format` | Format all files with Prettier |
| `pnpm format:check` | Check formatting without writing |

Run a single app:

| Command | Description |
|---------|-------------|
| `pnpm --filter @wanasatna/web dev` | Start Next.js dev server (port 3000) |
| `pnpm --filter @wanasatna/server dev` | Start API server (port 4000) |

## Environment Variables

Server configuration lives in `apps/server/.env`. See `apps/server/.env.example` for required variables.
