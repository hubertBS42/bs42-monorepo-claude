# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Overview

BS42.NET is a multi-tenant e-commerce platform in a pnpm + Turborepo monorepo (started from the shadcn/ui Next.js monorepo template).

- `apps/console`: the admin dashboard (console.bs42.net, port 3000 in dev). Almost all current work is here.
- `apps/store`: the customer storefront (bs42.net, port 3001 in dev). Currently a placeholder.
- `packages/*`: shared workspace packages imported as `@workspace/<name>` (the database package is `@workspace/db`).

## Commands

Run from the repo root (Turbo fans out to every package):

```bash
pnpm dev          # runs db:generate first, then next dev for both apps
pnpm build
pnpm lint
pnpm typecheck
pnpm format       # prettier --write
```

Lint uses the shared flat configs in `packages/eslint-config` (`base`, `react-internal`, `next-js`) with typescript-eslint. `eslint-plugin-only-warn` turns every rule into a warning, so `pnpm lint` exits 0 even with findings; read the output.

Scope to one package with `--filter`, e.g. `pnpm --filter console dev`, `pnpm --filter @workspace/db db:migrate`.

Database (`packages/database`, reads `DATABASE_URL` from `packages/database/.env`):

```bash
pnpm --filter @workspace/db db:generate   # prisma generate -> packages/database/generated/prisma
pnpm --filter @workspace/db db:migrate    # prisma migrate dev
pnpm --filter @workspace/db db:deploy     # prisma migrate deploy
```

Better Auth owns most of the schema. After changing auth plugins or `additionalFields`, regenerate the Prisma schema with `pnpm --filter @workspace/auth auth:generate` (writes `packages/database/prisma/schema.prisma`), then create a migration.

Tests use the built-in Node test runner and exist only in `packages/email` (`packages/utils` has a `test` script but no `tests/` directory yet):

```bash
pnpm --filter @workspace/email test                          # builds, then runs tests/*.test.mjs
cd packages/email && pnpm build && node --test tests/formatters.test.mjs   # single file
```

`@workspace/email` and `@workspace/storage` export from `dist/` (gitignored), so they must be built (`pnpm --filter @workspace/email --filter @workspace/storage build`) before the apps can import them. `turbo dev` does not build them for you.

## Architecture

### Two Better Auth instances, one database
`packages/auth` defines separate Better Auth servers that share `sharedAuthOptions` (Prisma adapter, cookie cache, user `additionalFields`, cross-subdomain cookies via `AUTH_COOKIE_DOMAIN`):
- `@workspace/auth/console`: `consoleAuth`. Sign-up is disabled; users arrive via invitations or the set-password email flow. Uses the `admin` + `organization` plugins from `console-plugins.ts`.
- `@workspace/auth/console-bootstrap`: a permissive instance used only by the first-run `/setup` action to create the initial superAdmin and the platform organization.
- `@workspace/auth/store`: storefront auth (email + Google).
- `schema-config.ts` exists only for `auth:generate`.

### Stores are organizations
A "store" is a Better Auth organization. One special organization, slug `PLATFORM_ORGANIZATION_SLUG` (from `@workspace/contracts`), represents the platform itself: it can't be deleted, has a fixed slug, and can't receive invitations. When a new store is created, `afterCreateOrganization` adds all system admins as members (superAdmin → `owner`, admin → `admin`).

### Two permission layers
- System roles (`user`, `admin`, `superAdmin`) on `User.role`, defined in `system-permissions.ts`. Role strings can be comma-separated; always check with `hasSystemRole` / `hasSystemPermission`, never `===`.
- Organization roles (`owner`, `admin`, `member`) on `Member.role`, defined in `organization-permissions.ts`.

### Console access control
- **Workspace context**: the session's `activeOrganizationId` puts the console in either the "global" workspace (the platform org is active) or the "store" workspace (any other org).
- **Route rules**: `apps/console/lib/route-access.ts` (`routeAccess`) is the single source of truth for which system roles and contexts may visit each path prefix.
  - `apps/console/proxy.ts` (Next's renamed middleware) enforces it.
  - The sidebar uses `checkAccess` to filter `lib/nav-config.ts`.
  - Every nav URL needs a matching entry (or parent prefix) in `routeAccess`.
  - Unlisted paths are allowed through, so they rely on page-level guards.
- **Page/action guards**: `apps/console/lib/auth-guard.ts` provides `requireConsoleAccess`, `requireConsoleAdmin`, `requireSystemPermission` and `requireOrganizationPermission` for server components and actions.

### Database client extensions
`@workspace/db` exports a Prisma 7 client (driver adapter `@prisma/adapter-pg`, generated into `packages/database/generated/prisma`) wrapped in `$extends` query hooks:
- **Organization slugs** are generated server-side from the name, with uniqueness retries. Any client-supplied slug is discarded: Better Auth requires one, so callers send a random placeholder. The exception is the platform org.
- **File cleanup**: deleting an organization or user removes its logo/image from Azure Blob Storage after the delete commits.

`readAppSettings()` reads the singleton `AppSettings` row (falling back to defaults). The console caches it via `unstable_cache` with the `app-settings` tag.

### Console app conventions
- Routes are grouped: `(auth)` pages are public, `(root)` is the authenticated shell, and `(misc)` holds `no-stores` and `accept-invitation`. Route-specific components live in `_components/` next to the page.
- Server actions live in `lib/actions/*.actions.ts` (`"use server"`), validate input with zod schemas from `lib/schemas/*.schemas.ts`, and return `ActionResponse` from `@workspace/contracts`. Data loaders live in `lib/data/`.
- Uploads go through `app/api/storage/{images,documents,files}/route.ts` → `lib/storage-api.ts` (per-route `UploadPolicy`) → `@workspace/storage` (Azure Blob via `DefaultAzureCredential`; `AZURE_STORAGE_ACCOUNT_NAME`, optional `AZURE_STORAGE_CONTAINER_NAME`).
- Form fields come from `@workspace/forms` (react-hook-form wrappers), data tables from `@workspace/tables` (TanStack Table), and primitives from `@workspace/ui`.

### UI components
Add shadcn components from the repo root with `pnpm dlx shadcn@latest add <component> -c apps/console`. They land in `packages/ui/src/components` and are imported as `@workspace/ui/components/<name>`.

### Email
`@workspace/email` holds React Email templates (auth flows, member invites, order lifecycle) sent via Nodemailer (`SITE_MAILER_*` env vars). The sender name and logo come from app settings.

## Environment

Required: `DATABASE_URL` and `BETTER_AUTH_SECRET` (≥32 chars). Optional, with defaults: `CONSOLE_AUTH_URL` and `STORE_AUTH_URL` (localhost:3000 / :3001 in dev). Required in production: `AUTH_COOKIE_DOMAIN` and the Google OAuth credentials. Env vars must also be listed in `turbo.json` (`globalEnv` / `globalPassThroughEnv`) to reach tasks.

## Style

Prettier: no semicolons, double quotes, `printWidth: 200`, Tailwind class sorting (`cn`, `cva`). Apps import their own code via the `@/` alias.
