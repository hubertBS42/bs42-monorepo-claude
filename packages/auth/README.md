# Shared authentication

`@workspace/auth` exposes separate server configurations and browser clients:

- `@workspace/auth/store`: email/password and Google sign-in
- `@workspace/auth/console`: email/password, admin, and organization plugins;
  public sign-up is disabled
- `@workspace/auth/bootstrap`: server-only initial administrator setup
- `@workspace/auth/store-client`: storefront browser client
- `@workspace/auth/console-client`: console browser client with admin actions

Each Next.js app mounts its own `/api/auth/[...all]` route. Both server
configurations use the same Prisma database, Better Auth secret, trusted origins,
and (when enabled) cross-subdomain session cookie.

## Environment

Configure these variables in both app environments:

- `DATABASE_URL`: PostgreSQL connection string, available to each app at runtime
- `BETTER_AUTH_SECRET`: the same random secret in both apps, at least 32
  characters
- `AUTH_COOKIE_DOMAIN`: set to `bs42.net` in production to share sessions
  between `bs42.net` and `console.bs42.net`
- `SESSION_CACHE_EXPIRATION`: optional session cookie-cache lifetime in seconds
  (defaults to `300`). This is separate from the session lifetime; cached
  session data may remain in use until this interval expires.

For local development, put the same `BETTER_AUTH_SECRET` and `DATABASE_URL` in
both `apps/store/.env.local` and `apps/console/.env.local`. Generate the secret
with `openssl rand -base64 32`. Prisma CLI commands load
`packages/database/.env` through `prisma7.config.ts`, so configure `DATABASE_URL`
there as well, or provide it in the command's environment.

Optional URL overrides:

- `STORE_AUTH_URL` (defaults to `http://localhost:3001` locally and
  `https://bs42.net` in production)
- `CONSOLE_AUTH_URL` (defaults to `http://localhost:3000` locally and
  `https://console.bs42.net` in production)

Set both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for the storefront.
Google sign-in is omitted locally when neither is configured; both are required
for the storefront in production. The console does not require or configure
Google credentials. Register these OAuth redirect URIs with Google:

- `http://localhost:3001/api/auth/callback/google`
- `https://bs42.net/api/auth/callback/google`

## Database

The Prisma schema includes Better Auth's core models and the console Admin and
Organization plugin fields. Generate the client and apply the checked-in
migrations from the database package:

```sh
pnpm --filter @workspace/auth auth:generate
pnpm --filter @workspace/db db:generate
pnpm --filter @workspace/db db:migrate
```

`auth:generate` uses the workspace-pinned Better Auth CLI and a schema-only
configuration containing the console plugins. It does not load application
secrets or connect to the database. Review generated schema changes before
creating or applying a Prisma migration.

On the first console visit, `/setup` is available only while the database has
no users. It creates the initial administrator and the `Global`
organization with that administrator as owner. The bootstrap operation is
serialized with a PostgreSQL advisory lock and is not exposed as an auth API.
After setup, public console sign-up is disabled. The storefront does not mount
the Admin plugin or its management endpoints.

## Access-control policy

| Scope        | Role         | Intended access                                                                                   |
| ------------ | ------------ | ------------------------------------------------------------------------------------------------- |
| Platform     | `user`       | No console access                                                                                 |
| Platform     | `admin`      | Console access; list/read users and list/revoke sessions; brand, category, and product management |
| Platform     | `superAdmin` | Full Better Auth administration plus organization create, update, delete, and switch              |
| Organization | `owner`      | Full organization and member administration, plus listing create, update, and delete              |
| Organization | `admin`      | Organization and member administration, plus listing create, update, and delete                   |
| Organization | `member`     | Listing create and update only                                                                    |

Console pages should use `requireConsoleAdmin` for the console shell and
`requireSystemPermission` for privileged platform operations. Organization data
actions must use `requireOrganizationPermission` with the target organization
ID and required permissions, then scope all reads and writes to that same
organization ID. A global admin role alone does not grant access to an
organization's tenant data. Organization creation through the console is
limited to `superAdmin`; onboarding creates the initial `Global` organization
as a system action.

Only `superAdmin` can grant global roles through Better Auth's admin API. Keep
that role assignment capability limited to explicitly trusted operators.
