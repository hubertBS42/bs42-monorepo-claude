# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Overview

BS42.NET is a multi-tenant e-commerce platform in a pnpm + Turborepo monorepo (started from the shadcn/ui Next.js monorepo template).

- `apps/console`: the admin dashboard (console.bs42.net, port 3000 in dev). Almost all current work is here.
- `apps/store`: the customer storefront (bs42.net, port 3001 in dev). Currently a placeholder.
- `packages/*`: shared workspace packages imported as `@workspace/<name>` (the database package is `@workspace/db`). `@workspace/commerce` holds the order logic both apps use (see Orders and money).

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
- Organization roles (`owner`, `admin`, `member`) on `Member.role`, defined in `organization-permissions.ts`. Besides Better Auth's defaults they have `listing` (owner/admin: create, update, delete; member: create, update) and `order` (owner/admin: read, create, update, refund; member: read, create). `refund` covers refunds and returns on the store's own orders. `purchaseOrder` (owner/admin: read, create, update, receive, cancel; member: read, receive) and `supplier` (owner/admin: create, update, delete).
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
- `updateProductAction` updates options, values, variants and documents in place, matched by id (`lib/product-sync.ts`). Store listing variants hang off variants and cascade, so recreating a variant would wipe the stores' prices and stock for it. A removed variant that has been ordered, directly or through a store's listing, or bought in on a store's purchase order, is archived instead of deleted.
- The edit loader (`getProductForEdit`) sends plain values plus `savedFiles` (the form never deletes those; the action removes replaced ones after it commits) and each variant's usage, so the form can warn before removing a listed or ordered variant.

### Store listings
- A listing is a store's price and stock for a catalogue product, with a `StoreListingVariant` per variant on sale. A variant without its own sell price sells at the listing's.
- The listings table (`getStoreListings`) filters by stock (in / low / out / not tracked, worked out like the stock column's badges: a listing with variants counts its variants on sale against the listing's low-stock threshold, which saving a listing copies to its variants; that compares across tables, so the ids come from SQL), brand, category (with subcategories) and "visible to customers" (`visibleToCustomers`: the listing and its product published and, with variants, at least one variant on sale; the same rule as the table's "not on sale" note).
- **Stock history**: every change to a listing's or variant's stock writes a `StockMovement` (the change, the stock after, a reason, who, and a link to the order, return or purchase order delivery behind it) in the same transaction, so the movements add up to the current stock. Writers use `@workspace/commerce/stock-movements`: `addStock` (add-only, for cancellations, returns and deliveries; taking stock away needs a guard against going below 0, as a sale reserves it) or `recordStockMovement(s)` for a change already written. They cover a sale, a cancellation, a restocked return, a purchase order delivery, a new listing's (or newly added variant's) initial stock, and an edit on the listing form, which must give a reason (`stockReason`: count correction, damaged, lost, or other with a note; `STOCK_REASON_REQUIRED`). Anything new that changes stock must do the same. The history is at `/store/listings/[id]/stock-history` (`lib/data/stock-history.data.ts`); reason labels are in `lib/stock-reasons.ts`.
- `updateListingAction` runs `lib/listing-sync.ts`. The edit form sends back the values it loaded (`original`); inside a transaction that locks the listing's rows (`SELECT … FOR UPDATE`), a change someone else made returns `CONFLICT`, and stock the user changed that changed meanwhile (a sale) returns `STOCK_CHANGED` with the current stock, which the form merges in. Stock the user left alone is never written.

### Orders and money
- Catalogue prices (products, store listings, variants) are USD. Customers are charged in GHS at the day's exchange rate (`ExchangeRate`, one row per pair per day, `rate` = units of `to` per 1 `from`). Order amounts are named after their currency (`subtotalUsd`, `subtotalGhs`, `shippingGhs`, `taxGhs`, `totalGhs`, `unitPriceUsd`/`unitPriceGhs`, ...).
- Each order line stores its GHS amounts, its share of the discount (`discountGhs`) and its tax (`taxGhs`), each rounded once; the order's subtotal, discount and tax are their sums, so receipts add up. `totalGhs = subtotalGhs - discountAmountGhs + shippingGhs + taxGhs`. Orders copy the exchange rate and tax rate they used.
- The platform is the seller of record: one tax rate in `AppSettings` (`taxEnabled`, `taxRate` as a fraction, `taxShipping`). Shown prices exclude tax; tax is charged after the discount. Do all money maths with `Prisma.Decimal`, never JS numbers (`AppSettingsData.taxRate` is a plain number only so it can reach client components).
- Anything that has been ordered is archived, never deleted: `OrderItem`'s links to stores, listings, variants and products are `Restrict`, and its snapshot fields keep what was sold at the time. Delete actions should return a code ("archive it instead") rather than hit the foreign key. Purchase order lines restrict the same way (see Purchase orders). `PaymentStatus` is the source of truth for money; `OrderStatus` tracks fulfilment only.
- **Exchange rate**: `POST /api/cron/exchange-rate` (a scheduler, daily after midnight Accra time, `Authorization: Bearer $CRON_SECRET`) saves today's USD→GHS rate from Open Exchange Rates (`OPEN_EXCHANGE_RATES_API_KEY`, `lib/exchange-rate-fetch.ts`). It only fills a day with no rate, and refuses a rate more than 20% from the previous one (answering 502). A superAdmin can set or override today's rate in Settings (`setTodaysExchangeRateAction`); `ExchangeRate.source` records which. Orders refuse a rate older than `EXCHANGE_RATE_MAX_AGE_DAYS` (2) with `NO_RATE`, and a day's rate can't change once an order has used it (`RATE_IN_USE`).
- **Shared with the storefront**: `packages/commerce` (`@workspace/commerce/<module>`, exported from source) holds what both apps need: `pricing`, `order-status` (both pure, safe in client components), `exchange-rates` (`getLatestExchangeRate`, `getPricingContext`), `stock-movements`, `order-writes`, `order-emails` and `notifications`. Staff-only order changes (`lib/order-updates.ts`, `lib/order-refunds.ts`) stay in the console and import from it. Its modules import each other relatively, so scripts can run them like the console's transaction modules.
- **Pricing**: `@workspace/commerce/pricing` (pure, `Decimal` only) implements the maths above. The discount is split by line totals, rounded down, with the remainder on the last line. Prices always come from published listings on the server (`resolveOrderLines`), never from the browser: given a store id, only that store's (staff orders); given null, any store's, each line keeping its own store (`ResolvedLine.storeId`, for the storefront).
- **Store orders** (`/store/orders`): a store manages only orders made entirely of its own items; an order spanning stores is the platform's (global `/orders`), and the store sees only its own lines.
  - `@workspace/commerce/order-writes` creates orders (`createOrder`, with `createdById` null and its own `statusNote` for a storefront order) and changes their status (`changeOrderStatus`; `changedById` null for an automatic change). Stock is reserved at creation with an atomic `updateMany({ stock: { gte } }, decrement)` per tracked row (`INSUFFICIENT_STOCK` rolls the whole order back) and restored when the order is cancelled.
  - Status changes follow `@workspace/commerce/order-status` (`nextOrderStatuses`: shipped is for delivery only, cancel until shipped with a reason, completed needs a recorded payment, `hasBeenPaid`) and apply only from the status the page showed (`STATUS_CHANGED`). Nobody cancels a paid order through a status change (`PAID_ORDER`): it needs a refund.
  - Payment is recorded separately ("Record payment", with `paymentRecordedById`), never as a side effect of a status.
  - References are `BS42-yyyyMMdd-00001` from the Postgres sequence `order_reference_seq`, created in its migration's SQL; gaps are expected.
- **Platform orders** (`/orders`, system permission `order`): every order from every store, with a Store column and filters (`lib/data/orders.data.ts`; the "more than one store" filter gets its ids from SQL).
  - The details page has the store page's controls. Both pages share `components/orders/*` (which take `storeId: string | null`, null on the platform's pages, and check permission with `useCanUpdateOrders`), `lib/order-details.ts` (loader mapping) and `lib/order-updates.ts` (status, payment and pending edits behind both sets of actions).
  - Customer emails (`@workspace/commerce/order-emails`) are scheduled with Next's `after()` once a create, status change or recorded payment has committed (created, confirmed, shipped, delivered, cancelled, payment received, refunded, returned; processing and completed send none). They're skipped when the order has no `customerEmail` or the linked account has `getOrderEmails` off, and pickups get no shipped/delivered email.
- **Refunds and returns**: superAdmins on any order (`/orders`, system permission `order: refund`), and a store's owners and admins on orders made only of its items (store permission `order: refund`; an order shared with other stores is the platform's). Both sets of actions call `giveRefund` / `cancelWithRefund` / `recordReturn` in `lib/order-updates.ts`, with the transactions in `lib/order-refunds.ts`; the components take `storeId` and check with `useCanUpdateOrders(storeId, "refund")`. System admins are members of every store but refund by their system role there too (admins can't, superAdmins can; `checkRefundable`). A refund by a store's own staff also emails the platform's staff (`notifyStoreRefund`, the `notifyStoreRefunds` switch, on by default); a superAdmin's doesn't.
  - Refunds (`OrderRefund`): any amount up to what's left, which sets `PARTIALLY_REFUNDED`/`REFUNDED`; money only, a refund never restocks. "Cancel and refund" refunds the rest and cancels in one transaction, until the order has shipped. Both lock the order row and take the refunded total the page showed (`REFUNDS_CHANGED`).
  - Returns (`OrderReturn` + `OrderReturnItem`, `recordOrderReturn`): once an order is delivered or completed (`canBeReturned`) and its payment recorded (so a later "Record payment" can't count returned items as paid; `returnBlockedReason` says why the button is missing), with no time limit. Per line, how many came back (never more than sold, counting earlier returns) and whether they go back into stock (only rows that track it). The optional refund is a linked `OrderRefund`; the form suggests what those units cost the customer (`returnedUnitsAmount`: the line after its discount, with its tax, on a running total so a line returned in parts adds up), never shipping. The order's status doesn't change; the lines show the returned counts, the header and `/orders` show "Returned"/"Partly returned" (`returnLabel`), and `/orders` filters by "Returns". A return's refund shows on the return's timeline entry, not as a separate refund. It also takes the number of returns the page showed (`RETURNS_CHANGED`) and sends one `RETURNED` customer email.

### Purchase orders
- A store buys stock in with purchase orders (`/store/purchase-orders`) from its own suppliers (`/store/suppliers`, `Supplier`, unique name per store; one on a purchase order is archived, never deleted). Owners and admins create, edit and cancel them; every store role can see them and receive deliveries (whoever unpacks the boxes). System admins do the same in any store through their store membership. The writes are in `lib/purchase-order-writes.ts` (tested against the database like the other transaction modules); `lib/purchase-order-status.ts` holds the rules both sides use.
- Statuses: `DRAFT` (changes nothing; can be deleted) → `ORDERED` → `PARTIALLY_RECEIVED` → `RECEIVED`, or `CANCELLED` (ordered, nothing arrived) / `CLOSED` (partly received, the rest isn't coming). What's left on ordered and partly received lines is **incoming** stock, worked out, never stored (`getIncomingStock` / `getIncomingByListing`), and shown on the listings table and the form's search.
- Costs are kept in the order's currency as invoiced (`unitCost`, `shippingCost`); each line also keeps `unitCostUsd`. An order in GHS converts at the latest rate while it's a draft and takes the day's rate when it's marked as ordered (`exchangeRate`), which its lines keep from then on; no current rate refuses with `NO_RATE`. Shipping isn't spread over the lines.
- Receiving (`PurchaseOrderReceipt` + items) locks the order row, takes the number of deliveries the page showed (`RECEIPTS_CHANGED`), refuses more than is left (`TOO_MANY`), adds stock only to rows that track it, and can set each listing's (or variant's) `buyPrice` to the line's USD cost ("Update buy prices", on by default; needs `listing: update`).
- Edits take the order's `updatedAt` as a version (`CONFLICT`). Once ordered, the supplier and currency stay, and a line can't drop below what has arrived (`BELOW_RECEIVED`). Cancelling and closing take the status the page showed (`STATUS_CHANGED`).
- Purchase orders link to their store, and their lines to listings and variants, with `Restrict`, like order lines: a listing, variant or product that has been bought in is archived, never deleted (the `HAS_ORDERS` checks and `product-sync.ts` count them), and `beforeDeleteOrganization` refuses a store with purchase orders.

### Dashboard
`/` shows the active workspace's dashboard (`app/(root)/page.tsx`), laid out after shadcn's dashboard-01 block: a store's for a member of the active store, the platform's for system admins in the global workspace. Both have stat cards with the change from the previous period, a net-sales-per-day area chart (shadcn `chart`, Recharts) whose toggle sets the period for the whole page (`?period=7d|30d|90d`, default 30 days, whole days in Accra time), "Needs attention" rows linking to the matching filtered lists, and the 10 latest orders in a table beside an order card (after the old dashboard-05 block) that sums one up, browsed with its previous and next buttons or by clicking a row. The table is a picker (reference, customer, status, total); the card holds the rest in accordion sections (order details open by default; each closed section's header shows its key fact), with the status badges in its header. The card is built from the details pages' mapping (`getRecentStoreOrderDetails` / `getRecentOrderDetails`), trimmed by `toOrderSummary` to what it shows; the platform's adds per-store stock alerts and checks (exchange rate, tax, mailer, notification recipients).
- Money is counted when it moves: payments by `paidAt` (orders that have been paid, `hasBeenPaid`), less refunds by their `createdAt`. A store counts its own orders' totals and, on an order shared with other stores, only its lines (as its orders list does); refunds and returns on shared orders count only on the platform's dashboard. Order counts match the store's orders list (every order with its items).
- The numbers come from `lib/dashboard-stats.ts`, which loads the rows for the period and the one before it and adds them up as decimals per day (`toSalesTrend`); it takes the client so a script can run it in a transaction, and `lib/data/dashboard.data.ts` adds the access checks. Stock states (`lib/stock-states.ts`, `stockStatesSql`) are shared with the listings stock filter.

### Staff notifications
Settings → Notifications holds a list of email addresses (`AppSettings.notificationEmails`, not necessarily console users) and a switch per event. `@workspace/commerce/notifications` sends them with the `StaffAlertEmail` template; callers schedule them with `after()` once the change has committed, and they never throw.
- New orders: `notifyNewOrder(orderId, "storefront" | "staff")`. `createStoreOrderAction` sends "staff"; the storefront's checkout should send "storefront".
- Stock: `createOrder` returns `stockAlerts` for the items a sale took to their low-stock threshold (crossing it, so no repeats while it stays low) or to 0, which `notifyStockAlerts` sends as one email. Stock edits by staff don't alert.
- The exchange-rate cron route calls `notifyRateFetchFailed` when the fetch fails.
- Refunds given by a store (on their own, with a cancellation or with a return) call `notifyStoreRefund`; the platform's own don't notify.

### Console app conventions
- Routes are grouped: `(auth)` pages are public, `(root)` is the authenticated shell, and `(misc)` holds `no-stores` and `accept-invitation`. Route-specific components live in `_components/` next to the page.
- Server actions live in `lib/actions/*.actions.ts` (`"use server"`), validate input with zod schemas from `lib/schemas/*.schemas.ts`, and return `ActionResponse` from `@workspace/contracts`. Data loaders live in `lib/data/`.
  - Every exported action is a public endpoint, so each one calls its guard (e.g. `requireSystemPermission`) before its `try` block: `redirect()` works by throwing, and a `catch` would swallow it.
  - Report conflicts with a `code` the form can match (`EMAIL_EXISTS`, `NAME_EXISTS`), not the `formatError` text. Under the pg driver adapter Prisma leaves `meta.target` empty; the constraint name is in `meta.driverAdapterError.cause.constraint.index`, which `formatPrismaError` uses to name the field.
  - Loaders for `SelectField` options return `SelectItem[]` (`{ id, name }`, from `@/types`).
- Zod schemas: use `z.httpUrl()` for URLs, since `z.url()` accepts `javascript:`. When a schema has transforms, type the form as `useForm<z.input<S>, unknown, z.output<S>>` and its submit handler with `z.output<S>`.
- Images on edit forms: the action rejects URLs outside our container (`isManagedFileUrl`) and removes the replaced image only after the update succeeds (brands, app settings). The form must not delete the saved image when it's removed, only images uploaded during that edit. Stores update through Better Auth, so a replaced store logo is left to the orphaned-file sweep.
- Toasts: `toast` from `@workspace/ui/components/toast` is Base UI's toast manager. Use `toast.add({ title, description, type })`; there is no `toast.success`/`toast.error`.
- A dialog with a form that saves through an action (refunds, returns, receiving, cancelling a purchase order) is a `FormDialog` (`components/form-dialog.tsx`), with the codes that mean "changed under the page" in `refreshOn`. An add button in the store workspace is a `StoreAddButton`.
- Action buttons (e.g. `DeleteStore`, `DeleteBrand`) check their own permission from the client session (store permissions via `useMemberRole` and `checkRolePermission`), show a skeleton while it loads and a line explaining a disabled button. The server action checks again. Pages don't pass `canX` props; a table fetches the role once and hands it to its cells. Page guards stay on the server.
- An action that changes something another person might have changed takes the value the page showed (`currentStatus`, `currentRole`, `original`) and refuses with a code (`STATUS_CHANGED`, `ROLE_CHANGED`, `NOT_PENDING`, `CONFLICT`) instead of overwriting; the UI refreshes on those codes.
- Transaction logic worth testing lives in its own `server-only` module with relative imports (`lib/product-sync.ts`, `lib/listing-sync.ts`, `lib/order-refunds.ts`, `lib/purchase-order-writes.ts`, and `packages/commerce`'s `order-writes.ts` and `stock-movements.ts`), so a script can run it against the database. Don't use TypeScript parameter properties there: Node's type stripping rejects them.
- Uploads go through `app/api/storage/{images,documents,files}/route.ts` → `lib/storage-api.ts` (per-route `UploadPolicy`) → `@workspace/storage` (Azure Blob via `DefaultAzureCredential`; `AZURE_STORAGE_ACCOUNT_NAME`, optional `AZURE_STORAGE_CONTAINER_NAME`). `/api` skips `proxy.ts`, so these routes check for a console user themselves, and the delete route refuses files a record still references (`findReferencedFileUrls`): the browser only deletes unsaved uploads.
- Invitations last 7 days (`INVITATION_EXPIRATION_SECONDS`). `/accept-invitation` is a public path in `proxy.ts`: the page sends a signed-out invitee to sign-up or login, offers "Sign out and continue" to someone signed in as another account, and explains an invalid invitation instead of redirecting.
- Store input is checked in the organization hooks (`packages/auth/src/store-input.ts`), because store admins can call Better Auth's organization endpoints directly: logos must be our own blobs, policies are cleaned with `sanitizeRichText`, and only system admins may change a store's status.
- Rich text (`RichTextField`) is stored as TipTap JSON, not HTML; an empty editor is `null`. Actions save it through `sanitizeRichText` (`@workspace/utils/rich-text`), which keeps only the nodes, marks and attributes the editor can produce and links with http(s)/mailto/tel. Render it with TipTap's renderer and the editor's extensions, never as raw HTML.
- Form fields come from `@workspace/forms` (react-hook-form wrappers), data tables from `@workspace/tables` (TanStack Table), and primitives from `@workspace/ui`. `NumberInputField` rounds to its `step` when it loses focus, so the step must match the value's stored precision (the exchange rate uses 0.000001), or clicking in and out changes the value and marks the form dirty.
- Table rows link to their page with `DataTable`'s `getRowHref`, which makes the main cell a real link. A cell that needs a second link (links can't nest) sets the column's `meta: { rendersRowLink: true }` and renders `RowLink` itself; clicks on any link in a row keep their own target, and the row-selection checkbox must stop its click (`onClick={(e) => e.stopPropagation()}`) or ticking it opens the row. `DataTableTree` shows nested rows (`getSubRows`, same `getRowHref`) and isn't paginated. Toolbar filter types: `text`, `select`, `number`, `boolean` (`true`/`false`), `date` (a plain `yyyy-MM-dd` day), `dateRange` (two plain days, `<key>Start` and `<key>End`, both included; read them with `getDayParam` and filter from `dayStart(start)` to before `dayStart(end, 1)`), `numberRange`.
- Shared table cells live in `components/` so tables show the same thing the same way (e.g. `CategoryPath`, which mutes the parent categories).
- A link from a store's workspace to a global page (the catalogue) is a `GlobalWorkspaceLink`: route access ties each page to a workspace, so it switches the session to the platform org first (`useStoreSwitcher` with a `to` page; the switch applies to every tab of the session). It renders plain text, or nothing with `hideWithoutAccess`, for users who aren't system admins.
- A server component that imports a value (not a type) from a `"use client"` module gets a client reference, not the value. Constants both sides use go in a plain module (e.g. `app/(root)/_components/periods.ts`).
- Prefer Prisma's query API over raw SQL, for readability. Raw SQL is only for what Prisma can't express (row locks, sequences, comparisons across tables, "more than one store"), with a comment saying why; it's always the tagged `Prisma.sql` / `$queryRaw` template, never `$queryRawUnsafe` with values.
- Dates rendered in client components use `formatDate` from `@workspace/utils/date`. It formats in one fixed zone so the server render and hydration match.
- A form inside a dialog must call `e.stopPropagation()` before `handleSubmit`. React bubbles events through portals, so otherwise submitting the dialog also submits the page form around it.
- Never include `Session` rows in data passed to client components: each row holds its token.

### UI components
Add shadcn components from the repo root with `pnpm dlx shadcn@latest add <component> -c apps/console`. They land in `packages/ui/src/components` and are imported as `@workspace/ui/components/<name>`.

The primitives are built on Base UI, not Radix. Use `render={<Button />}` instead of `asChild`, and give menu items `onClick`: `onSelect` type-checks but never fires. A menu item that navigates is a `DropdownMenuLinkItem` (Base UI's `Menu.LinkItem`, a real `<a>`) with `render={<Link href="..." />}`.

- The style is `base-vega`. Blocks previewed on shadcn's site are usually the Radix (`new-york-v4`) versions, whose defaults differ: Radix's `ToggleGroup` takes `type="single"` and joins its items (`spacing` 0), Base UI's selects one by default (`multiple={false}`) and spaces them apart (`spacing` 2), so pass `spacing={0}` for the joined look. Fetch a block's `base-vega` source from `https://ui.shadcn.com/r/styles/base-vega/<name>.json`, and check its container-query breakpoints (`@[767px]/card`) against the column the block is put in.
- `shadcn add` skips files that already exist (it did for `toggle.tsx` and `card.tsx`); compare those with the registry's current version when a new component depends on them.
- Charts use shadcn's `chart` (Recharts 3.8.0). A chart component imports Recharts' parts itself, so `recharts` is a dependency of the console as well as `packages/ui`.

### Email
`@workspace/email` holds React Email templates (auth flows, member invites, order lifecycle, and `StaffAlertEmail` for staff notifications) sent via Nodemailer (`SITE_MAILER_*` env vars). The sender name and logo come from app settings: the console's name for staff emails, the storefront's (`resolveStoreName`) for customer emails. `@workspace/commerce` imports it for order emails and staff notifications, so build its `dist/` before the console.

## Environment

Required: `DATABASE_URL` and `BETTER_AUTH_SECRET` (≥32 chars). Optional, with defaults: `CONSOLE_AUTH_URL` and `STORE_AUTH_URL` (localhost:3000 / :3001 in dev). Required in production: `AUTH_COOKIE_DOMAIN` and the Google OAuth credentials. For features: `SITE_MAILER_*` (email), `AZURE_STORAGE_ACCOUNT_NAME` / `AZURE_STORAGE_CONTAINER_NAME` (uploads), `CRON_SECRET` (the `/api/cron/*` routes) and `OPEN_EXCHANGE_RATES_API_KEY` (the daily rate fetch). Env vars must also be listed in `turbo.json` (`globalEnv` / `globalPassThroughEnv`) to reach tasks.

## Style

Prettier: no semicolons, double quotes, `printWidth: 200`, Tailwind class sorting (`cn`, `cva`). Apps import their own code via the `@/` alias.

The shadcn components in `packages/ui/src/components` keep shadcn's own formatting. Don't run prettier on one you edit: it rewrites the whole file. Match its existing style by hand.
