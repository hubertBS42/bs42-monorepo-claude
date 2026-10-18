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
pnpm --filter @workspace/db db:seed       # starting categories and brands (prisma/seed.ts, via tsx); skips existing ones
```

Better Auth owns most of the schema. After changing auth plugins or `additionalFields`, regenerate the Prisma schema with `pnpm --filter @workspace/auth auth:generate` (writes `packages/database/prisma/schema.prisma`), then create a migration. The script runs the CLI with `--conditions=react-server` (so `server-only` imports load) and `--env-file=../database/.env` (the plugins import the database client). It keeps the non-auth models; its only side effect is a blank line after top-level comments.

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
- Those memberships are the system's to keep: `beforeRemoveMember` / `beforeUpdateMemberRole` hooks refuse changes to a system admin's membership through Better Auth (`PLATFORM_STAFF`), since store owners can call its endpoints directly. The console's own flows (store creation, promote/demote) write through Prisma.
- Store member lists (`lib/data/members.data.ts`) leave platform staff out, and inviting one is refused (`PLATFORM_STAFF`). Member loaders select only the user fields the pages show: any member can see them.

### Two permission layers
- System roles (`user`, `admin`, `superAdmin`) on `User.role`, defined in `system-permissions.ts`. Role strings can be comma-separated; always check with `hasSystemRole` / `hasSystemPermission`, never `===`.
- Organization roles (`owner`, `admin`, `member`) on `Member.role`, defined in `organization-permissions.ts`. Besides Better Auth's defaults they have `listing` (owner/admin: create, update, delete; member: create, update) and `order` (owner/admin: read, create, update; member: read, create). Refunds are platform-only.
- The catalogue (brands, categories, products) is global, not per store: it uses the system permissions `brand`/`category`/`product` and `/catalogue` is admin-only in the global workspace. Platform orders use the system permission `order` (`read`, `create`, `update`; `refund` is superAdmin-only).
- **SuperAdmins**:
  - Only superAdmins can manage superAdmins: console actions check `canManageUserWithRole`, and a consoleAuth `hooks.before` blocks Better Auth's admin write endpoints.
  - User loaders in `lib/data/users.data.ts` hide superAdmins from everyone else.
  - The role is never set at creation. It changes only through `promoteToSuperAdminAction` / `demoteToAdminAction`, which update the role and every store membership (owner ↔ admin) in one transaction.

### Console access control
- **Workspace context**: the session's `activeOrganizationId` puts the console in either the "global" workspace (the platform org is active) or the "store" workspace (any other org).
  - Only the login form sets it (client-side `organization.setActive`, preferring the platform org). A session Better Auth creates anywhere else starts with none, and the sidebar shows nothing. So don't use `changePassword`'s `revokeOtherSessions: true`, which replaces the current session: change the password, then call `revokeOtherSessions` (as `updatePasswordAction` does).
- **Route rules**: `apps/console/lib/route-access.ts` (`routeAccess`) is the single source of truth for which system roles and contexts may visit each path prefix.
  - `apps/console/proxy.ts` (Next's renamed middleware) enforces it.
  - The sidebar uses `checkAccess` to filter `lib/nav-config.ts`.
  - Every nav URL needs a matching entry (or parent prefix) in `routeAccess`.
  - Unlisted paths are allowed through, so they rely on page-level guards.
- **Page/action guards**: `apps/console/lib/auth-guard.ts` provides `requireConsoleAccess`, `requireConsoleAdmin`, `requireSystemPermission`, `requireOrganizationPermission` and `requireActiveStoreMember` for server components and actions, and `hasStorePermission` / `getStoreRole` for actions and loaders that must return an error rather than redirect.
  - Every page calls its own guard as its first statement; layouts do not guard (they aren't re-run on client navigation). A new page without a guard is open to any signed-in user, including storefront customers who share the auth cookie.
  - Global admin pages: `requireSystemPermission(...)` (or `requireConsoleAdmin()` when no permission exists yet). Pages for all console users (dashboard, `/account/*`): `requireConsoleAccess()`.
  - Store workspace pages: `requireActiveStoreMember()`, which returns `{ session, storeId, role }` for a membership of the active store (never the platform org; a user removed from it goes to `/`). A page that needs more checks `organizationRoles[role].authorize(...)` and redirects to `/forbidden`. Store actions take the store id from the page, not the session's active org (another tab may have switched it), and check `hasStorePermission(userId, storeId, ...)`.
  - The `user` system role has no permissions, so `requireSystemPermission` can't express "store staff"; use store membership for that.

### Database client extensions
`@workspace/db` exports a Prisma 7 client (driver adapter `@prisma/adapter-pg`, generated into `packages/database/generated/prisma`) wrapped in `$extends` query hooks:
- **Slugs** (organizations, brands, categories and products) are generated server-side from the name, with uniqueness retries. Any client-supplied slug is discarded, so callers send a placeholder (Better Auth requires one; Prisma's types require one for brands, categories and products). The exception is the platform org. Only a rename changes a slug, so moving a category keeps its URL; a taken category slug tries the parent's slug as a prefix (`men-accessories`) before numbering.
- **SKUs**: a simple product created without a SKU gets one (`IPHONE15-K3ZQ`). Variant SKUs come from `generateUniqueSku(tx, name)`, called by the action: a query hook can't read the transaction it runs in, so it couldn't see a product created earlier in it.
- **File cleanup**: deleting an organization, user, brand, category or product removes its files from Azure Blob Storage after the delete commits (`removeFiles` from `@workspace/storage`); for a product that's its images, banner, variant images and documents. Files nothing references any more, such as uploads from a form left without saving, are removed by `sweepOrphanedFiles` (`packages/database/src/file-sweep.ts`), which `POST /api/cron/file-cleanup` runs for a scheduler using `CRON_SECRET`. A new column holding file URLs must be added to both lists in `file-sweep.ts` (`getReferencedFileUrls` and `findReferencedFileUrls`), or the sweep deletes its files and the storage delete route stops protecting them.

`readAppSettings()` reads the singleton `AppSettings` row (falling back to defaults). The console caches it via `unstable_cache` with the `app-settings` tag. The settings form carries the row's `updatedAt` as a version and `saveAppSettings` only writes if it still matches (`CONFLICT` otherwise), so a stale form can't undo another save.

Migrations: Prisma doesn't model `CHECK` constraints or triggers, so they live in the migration SQL (stock, quantities, ratings, tax rates; the category cycle trigger). `prisma migrate dev` is interactive when a change could lose data (e.g. removing an enum value), so in a non-interactive shell generate that migration with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`.

### Categories
- A self-referencing tree (`parentId`, `onDelete: NoAction` on purpose: Postgres checks it at the end of the statement, so a `deleteMany` can remove a parent and its children together, which `Restrict` would reject).
- Names are unique among siblings (`@@unique([parentId, name])` plus a partial index for top-level names, via the `partialIndexes` preview feature). Siblings are ordered by `position`, then name.
- The `category_prevent_cycle` trigger rejects moving a category under itself or a descendant. Under the driver adapter its `category_no_cycle` error only appears in the error's `meta`; `updateCategoryAction` maps it to `PARENT_CYCLE`.
- `lib/data/categories.data.ts`: `getCategoryTree` (for `DataTableTree`), `getCategoryOptions(editingId?)` for the parent select (archived categories and the edited category's own subtree are disabled), `getCategoryById` (with `childCount`). Deleting a category with subcategories returns `HAS_CHILDREN`.

### Products
- One form for add and edit (`catalogue/products/_components/product-form.tsx`). Products go in leaf categories only, and a published product needs a sell price above 0.
- The products list (`getProductsForTable`) reads the category tree once per page for each row's path ("Men / Shoes") and for the category filter, which includes subcategories. Search (`search`) matches the name, SKU and barcode, including variants'.
- `updateProductAction` updates options, values, variants and documents in place, matched by id (`lib/product-sync.ts`). Store listing variants hang off variants and cascade, so recreating a variant would wipe the stores' prices and stock for it. A removed variant that has been ordered, directly or through a store's listing, is archived instead of deleted.
- The edit loader (`getProductForEdit`) sends plain values plus `savedFiles` (the form never deletes those; the action removes replaced ones after it commits) and each variant's usage, so the form can warn before removing a listed or ordered variant.

### Store listings
- A listing is a store's price and stock for a catalogue product, with a `StoreListingVariant` per variant on sale. A variant without its own sell price sells at the listing's.
- `updateListingAction` runs `lib/listing-sync.ts`. The edit form sends back the values it loaded (`original`); inside a transaction that locks the listing's rows (`SELECT … FOR UPDATE`), a change someone else made returns `CONFLICT`, and stock the user changed that changed meanwhile (a sale) returns `STOCK_CHANGED` with the current stock, which the form merges in. Stock the user left alone is never written.

### Orders and money
- Catalogue prices (products, store listings, variants) are USD. Customers are charged in GHS at the day's exchange rate (`ExchangeRate`, one row per pair per day, `rate` = units of `to` per 1 `from`). Order amounts are named after their currency (`subtotalUsd`, `subtotalGhs`, `shippingGhs`, `taxGhs`, `totalGhs`, `unitPriceUsd`/`unitPriceGhs`, ...).
- Each order line stores its GHS amounts, its share of the discount (`discountGhs`) and its tax (`taxGhs`), each rounded once; the order's subtotal, discount and tax are their sums, so receipts add up. `totalGhs = subtotalGhs - discountAmountGhs + shippingGhs + taxGhs`. Orders copy the exchange rate and tax rate they used.
- The platform is the seller of record: one tax rate in `AppSettings` (`taxEnabled`, `taxRate` as a fraction, `taxShipping`). Shown prices exclude tax; tax is charged after the discount. Do all money maths with `Prisma.Decimal`, never JS numbers (`AppSettingsData.taxRate` is a plain number only so it can reach client components).
- Anything that has been ordered is archived, never deleted: `OrderItem`'s links to stores, listings, variants and products are `Restrict`, and its snapshot fields keep what was sold at the time. Delete actions should return a code ("archive it instead") rather than hit the foreign key. `PaymentStatus` is the source of truth for money; `OrderStatus` tracks fulfilment only.
- **Exchange rate**: `POST /api/cron/exchange-rate` (a scheduler, daily after midnight Accra time, `Authorization: Bearer $CRON_SECRET`) saves today's USD→GHS rate from Open Exchange Rates (`OPEN_EXCHANGE_RATES_API_KEY`, `lib/exchange-rate-fetch.ts`). It only fills a day with no rate, and refuses a rate more than 20% from the previous one (answering 502). A superAdmin can set or override today's rate in Settings (`setTodaysExchangeRateAction`); `ExchangeRate.source` records which. Orders refuse a rate older than `EXCHANGE_RATE_MAX_AGE_DAYS` (2) with `NO_RATE`, and a day's rate can't change once an order has used it (`RATE_IN_USE`).
- **Pricing**: `lib/order-pricing.ts` (pure, `Decimal` only) implements the maths above. The discount is split by line totals, rounded down, with the remainder on the last line. Prices always come from the store's published listings on the server (`resolveOrderLines`), never from the browser.
- **Store orders** (`/store/orders`): a store manages only orders made entirely of its own items; an order spanning stores is the platform's (global `/orders`), and the store sees only its own lines.
  - `lib/store-order-writes.ts` creates orders and changes their status. Stock is reserved at creation with an atomic `updateMany({ stock: { gte } }, decrement)` per tracked row (`INSUFFICIENT_STOCK` rolls the whole order back) and restored when the order is cancelled.
  - Status changes follow `lib/order-status.ts` (`nextOrderStatuses`: shipped is for delivery only, cancel until shipped with a reason, completed needs a recorded payment, `hasBeenPaid`) and apply only from the status the page showed (`STATUS_CHANGED`). Nobody cancels a paid order through a status change (`PAID_ORDER`): it needs a refund.
  - Payment is recorded separately ("Record payment", with `paymentRecordedById`), never as a side effect of a status.
  - References are `BS42-yyyyMMdd-00001` from the Postgres sequence `order_reference_seq`, created in its migration's SQL; gaps are expected.
- **Platform orders** (`/orders`, system permission `order`): every order from every store, with a Store column and filters (`lib/data/orders.data.ts`; the "more than one store" filter gets its ids from SQL).
  - The details page has the store page's controls. Both pages share `components/orders/*` (which take `storeId: string | null`, null on the platform's pages, and check permission with `useCanUpdateOrders`), `lib/order-details.ts` (loader mapping) and `lib/order-updates.ts` (status, payment and pending edits behind both sets of actions).
  - Refunds (`OrderRefund`, superAdmins only, `lib/order-refunds.ts`): any amount up to what's left, which sets `PARTIALLY_REFUNDED`/`REFUNDED`; money only, stock comes back only on cancellation. "Cancel and refund" refunds the rest and cancels in one transaction, until the order has shipped. Both lock the order row and take the refunded total the page showed (`REFUNDS_CHANGED`).
  - Customer emails (`lib/order-emails.ts`) are scheduled with Next's `after()` once a create, status change or recorded payment has committed (created, confirmed, shipped, delivered, cancelled, payment received, refunded; processing and completed send none). They're skipped when the order has no `customerEmail` or the linked account has `getOrderEmails` off, and pickups get no shipped/delivered email.

### Staff notifications
Settings → Notifications holds a list of email addresses (`AppSettings.notificationEmails`, not necessarily console users) and a switch per event. `lib/notifications.ts` sends them with the `StaffAlertEmail` template; callers schedule them with `after()` once the change has committed, and they never throw.
- New orders: `notifyNewOrder(orderId, "storefront" | "staff")`. `createStoreOrderAction` sends "staff"; the storefront's checkout should send "storefront".
- Stock: `createStoreOrder` returns `stockAlerts` for the items a sale took to their low-stock threshold (crossing it, so no repeats while it stays low) or to 0, which `notifyStockAlerts` sends as one email. Stock edits by staff don't alert.
- The exchange-rate cron route calls `notifyRateFetchFailed` when the fetch fails.

### Console app conventions
- Routes are grouped: `(auth)` pages are public, `(root)` is the authenticated shell, and `(misc)` holds `no-stores` and `accept-invitation`. Route-specific components live in `_components/` next to the page.
- Server actions live in `lib/actions/*.actions.ts` (`"use server"`), validate input with zod schemas from `lib/schemas/*.schemas.ts`, and return `ActionResponse` from `@workspace/contracts`. Data loaders live in `lib/data/`.
  - Every exported action is a public endpoint, so each one calls its guard (e.g. `requireSystemPermission`) before its `try` block: `redirect()` works by throwing, and a `catch` would swallow it.
  - Report conflicts with a `code` the form can match (`EMAIL_EXISTS`, `NAME_EXISTS`), not the `formatError` text. Under the pg driver adapter Prisma leaves `meta.target` empty; the constraint name is in `meta.driverAdapterError.cause.constraint.index`, which `formatPrismaError` uses to name the field.
  - Loaders for `SelectField` options return `SelectItem[]` (`{ id, name }`, from `@/types`).
- Zod schemas: use `z.httpUrl()` for URLs, since `z.url()` accepts `javascript:`. When a schema has transforms, type the form as `useForm<z.input<S>, unknown, z.output<S>>` and its submit handler with `z.output<S>`.
- Images on edit forms: the action rejects URLs outside our container (`isManagedFileUrl`) and removes the replaced image only after the update succeeds (brands, app settings). The form must not delete the saved image when it's removed, only images uploaded during that edit. Stores update through Better Auth, so a replaced store logo is left to the orphaned-file sweep.
- Toasts: `toast` from `@workspace/ui/components/toast` is Base UI's toast manager. Use `toast.add({ title, description, type })`; there is no `toast.success`/`toast.error`.
- Action buttons (e.g. `DeleteStore`, `DeleteBrand`) check their own permission from the client session (store permissions via `useMemberRole` and `checkRolePermission`), show a skeleton while it loads and a line explaining a disabled button. The server action checks again. Pages don't pass `canX` props; a table fetches the role once and hands it to its cells. Page guards stay on the server.
- An action that changes something another person might have changed takes the value the page showed (`currentStatus`, `currentRole`, `original`) and refuses with a code (`STATUS_CHANGED`, `ROLE_CHANGED`, `NOT_PENDING`, `CONFLICT`) instead of overwriting; the UI refreshes on those codes.
- Transaction logic worth testing lives in its own `server-only` module with relative imports (`lib/product-sync.ts`, `lib/listing-sync.ts`, `lib/store-order-writes.ts`), so a script can run it against the database. Don't use TypeScript parameter properties there: Node's type stripping rejects them.
- Uploads go through `app/api/storage/{images,documents,files}/route.ts` → `lib/storage-api.ts` (per-route `UploadPolicy`) → `@workspace/storage` (Azure Blob via `DefaultAzureCredential`; `AZURE_STORAGE_ACCOUNT_NAME`, optional `AZURE_STORAGE_CONTAINER_NAME`). `/api` skips `proxy.ts`, so these routes check for a console user themselves, and the delete route refuses files a record still references (`findReferencedFileUrls`): the browser only deletes unsaved uploads.
- Invitations last 7 days (`INVITATION_EXPIRATION_SECONDS`). `/accept-invitation` is a public path in `proxy.ts`: the page sends a signed-out invitee to sign-up or login, offers "Sign out and continue" to someone signed in as another account, and explains an invalid invitation instead of redirecting.
- Store input is checked in the organization hooks (`packages/auth/src/store-input.ts`), because store admins can call Better Auth's organization endpoints directly: logos must be our own blobs, policies are cleaned with `sanitizeRichText`, and only system admins may change a store's status.
- Rich text (`RichTextField`) is stored as TipTap JSON, not HTML; an empty editor is `null`. Actions save it through `sanitizeRichText` (`@workspace/utils/rich-text`), which keeps only the nodes, marks and attributes the editor can produce and links with http(s)/mailto/tel. Render it with TipTap's renderer and the editor's extensions, never as raw HTML.
- Form fields come from `@workspace/forms` (react-hook-form wrappers), data tables from `@workspace/tables` (TanStack Table), and primitives from `@workspace/ui`.
- Table rows link to their page with `DataTable`'s `getRowHref`, which makes the main cell a real link. A cell that needs a second link (links can't nest) sets the column's `meta: { rendersRowLink: true }` and renders `RowLink` itself; clicks on any link in a row keep their own target. `DataTableTree` shows nested rows (`getSubRows`, same `getRowHref`) and isn't paginated. Toolbar filter types: `text`, `select`, `number`, `boolean` (`true`/`false`), `date` (a plain `yyyy-MM-dd` day), `dateRange` (two plain days, `<key>Start` and `<key>End`, both included; read them with `getDayParam` and filter from `dayStart(start)` to before `dayStart(end, 1)`), `numberRange`.
- Dates rendered in client components use `formatDate` from `@workspace/utils/date`. It formats in one fixed zone so the server render and hydration match.
- A form inside a dialog must call `e.stopPropagation()` before `handleSubmit`. React bubbles events through portals, so otherwise submitting the dialog also submits the page form around it.
- Never include `Session` rows in data passed to client components: each row holds its token.

### UI components
Add shadcn components from the repo root with `pnpm dlx shadcn@latest add <component> -c apps/console`. They land in `packages/ui/src/components` and are imported as `@workspace/ui/components/<name>`.

The primitives are built on Base UI, not Radix. Use `render={<Button />}` instead of `asChild`, and give menu items `onClick`: `onSelect` type-checks but never fires. A menu item that navigates is a `DropdownMenuLinkItem` (Base UI's `Menu.LinkItem`, a real `<a>`) with `render={<Link href="..." />}`.

### Email
`@workspace/email` holds React Email templates (auth flows, member invites, order lifecycle) sent via Nodemailer (`SITE_MAILER_*` env vars). The sender name and logo come from app settings: the console's name for staff emails, the storefront's (`resolveStoreName`) for customer emails. The console imports it for order emails, so build its `dist/` first.

## Environment

Required: `DATABASE_URL` and `BETTER_AUTH_SECRET` (≥32 chars). Optional, with defaults: `CONSOLE_AUTH_URL` and `STORE_AUTH_URL` (localhost:3000 / :3001 in dev). Required in production: `AUTH_COOKIE_DOMAIN` and the Google OAuth credentials. Env vars must also be listed in `turbo.json` (`globalEnv` / `globalPassThroughEnv`) to reach tasks.

## Style

Prettier: no semicolons, double quotes, `printWidth: 200`, Tailwind class sorting (`cn`, `cva`). Apps import their own code via the `@/` alias.

The shadcn components in `packages/ui/src/components` keep shadcn's own formatting. Don't run prettier on one you edit: it rewrites the whole file. Match its existing style by hand.
