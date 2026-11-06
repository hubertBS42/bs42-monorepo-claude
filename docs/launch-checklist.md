# Launch checklist

Everything needed to run BS42.NET in production: the console at `console.bs42.net`, the storefront at `bs42.net`. Sections 1 to 9 set production up (work through them top to bottom); section 10 is the order for the day `bs42.net` moves from the old site to the new one. No secrets go in this file.

## 1. Have these ready

- [ ] A PostgreSQL database, reachable from the server.
- [ ] Two hostnames with HTTPS: `bs42.net` (store) and `console.bs42.net` (console).
- [ ] An Azure storage account for uploads (product images, logos, documents).
- [ ] A mailbox that can send by SMTP (order emails, sign-ups, staff alerts).
- [ ] Paystack **live** keys.
- [ ] An Open Exchange Rates API key (a free plan is enough: one call a day).
- [ ] A scheduler that can send HTTP POST requests (cron with `curl`, or the host's own).

## 2. Environment variables

On Azure App Service they're each app's app settings (section 5). Elsewhere, put them in each app's `.env` (`apps/console/.env`, `apps/store/.env`), and `DATABASE_URL` also in `packages/database/.env` for migrations and the seeds. With a pooled database (Neon), `DATABASE_URL` is the pooled connection and `DIRECT_URL` the direct one: Prisma's CLI uses the direct one for migrations, whose lock can stay held on a pooled connection. Both apps must use **the same** `BETTER_AUTH_SECRET`, URLs and cookie domain: they share sign-ins, and the store signs order links with the secret.

| Variable | Console | Store | Value |
|---|:-:|:-:|---|
| `DATABASE_URL` | ✓ | ✓ | `postgresql://…` |
| `BETTER_AUTH_SECRET` | ✓ | ✓ | 32+ random characters (`openssl rand -base64 48`). Never change it after launch: it breaks every emailed order link. |
| `CONSOLE_AUTH_URL` | ✓ | ✓ | `https://console.bs42.net` |
| `STORE_AUTH_URL` | ✓ | ✓ | `https://bs42.net` (Paystack's return address, the sitemap and links between the apps) |
| `AUTH_COOKIE_DOMAIN` | ✓ | ✓ | `bs42.net`. Required: the apps refuse to start without it. |
| `SITE_MAILER_HOST` | ✓ | ✓ | SMTP server |
| `SITE_MAILER_PORT` | ✓ | ✓ | `465` (TLS) or `587` (STARTTLS); defaults to 465 |
| `SITE_MAILER_EMAIL` | ✓ | ✓ | The sending address, also the SMTP user name |
| `SITE_MAILER_PASSWORD` | ✓ | ✓ | |
| `PAYSTACK_SECRET_KEY` | ✓ | ✓ | `sk_live_…`. The store takes payments; the console's unpaid-order job asks Paystack before cancelling. |
| `AZURE_STORAGE_ACCOUNT_NAME` | ✓ | | The storage account's name |
| `AZURE_STORAGE_CONTAINER_NAME` | ✓ | | Optional, defaults to `bs42-public` |
| `AZURE_STORAGE_PRIVATE_CONTAINER_NAME` | ✓ | | Optional, defaults to `bs42-private` (purchase order files) |
| `CRON_SECRET` | ✓ | | Random (`openssl rand -hex 32`); the scheduler sends it |
| `OPEN_EXCHANGE_RATES_API_KEY` | ✓ | | |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | | ✓ | Optional: "Continue with Google". Redirect URI `https://bs42.net/api/auth/callback/google` |

Azure sign-in for uploads uses `DefaultAzureCredential`: a managed identity when hosted on Azure, otherwise a service principal's `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` (console only).

> **Running through Turbo drops unlisted variables.** `pnpm start` runs both apps through Turbo, which passes on only the variables listed in `turbo.json`. Values in each app's `.env` are read by Next itself, so they always work. Variables set in the host's environment instead, such as the `AZURE_*` sign-in ones, only arrive if they're listed in `turbo.json`, or if each app is started on its own (`pnpm --filter console start`, `pnpm --filter store start`).

## 3. Storage (Azure)

- [ ] Give the console's identity the **Storage Blob Data Contributor** role on the account or container.
- [ ] Allow blob public access on the account, and set the `bs42-public` container's public access level to **Blob** (not Container, which lets anyone list every file): browsers load images straight from their URLs.
- [ ] A second container, `bs42-private`, with public access **off**: purchase order files (supplier invoices show costs), which the console serves to the store's members only. Created 2026-11-04.
- [ ] Turn on blob soft delete (undo after a delete relies on it).

## 4. Database

On Azure the deploy workflow applies the migrations on every push (section 5); the seeds are run once, by hand. Every seed skips what's already there, so running one again is safe.

**Before launch, on the database that's been set up (development):**

- [ ] `pnpm --filter @workspace/db db:export-config` writes `packages/database/prisma/seed-config.json`: Settings, delivery fees, installation areas, Terms and Privacy, and what the console adds to the catalogue (category images, featured, installation fees; brand logos and descriptions; products' own installation; "pairs well with" lists). Read it through: it's the production setup. It's gitignored (it holds contact details and staff addresses, and the repository is public), so run `db:seed:config` from the machine that has it.

**Then, with `packages/database/.env` pointing at production**, from the repo root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/db db:deploy        # apply every migration
pnpm --filter @workspace/db db:seed          # the catalogue: categories, brands and the old site's products
pnpm --filter @workspace/db db:seed:config   # seed-config.json: only what isn't set yet, so run it before saving anything in Settings
```

After `/setup` (section 5) and creating the store in the console (Stores → Add Store):

```bash
pnpm --filter @workspace/db db:seed:listings --store <slug>   # the store's slug, from its URL in the console
```

That lists every published product at the old site's prices, with stock 0: everything shows as out of stock until it's counted in, on each listing's form or by receiving a purchase order.

**Then bring the old system's records across**, once the old site (bs42.net and portal.bs42.net) has stopped taking orders, so nothing made after the export is missed:

```bash
pnpm --filter @workspace/db db:legacy:export --out ~/bs42-legacy-data   # read only: the old portal's orders, quotations, suppliers, inventory orders, stock levels, staff
AZURE_STORAGE_ACCOUNT_NAME=bs42shopstorage pnpm --filter @workspace/db db:legacy:import --store <slug> --data ~/bs42-legacy-data --by daniel@attelecomms.co.uk --dry-run
AZURE_STORAGE_ACCOUNT_NAME=bs42shopstorage pnpm --filter @workspace/db db:legacy:import --store <slug> --data ~/bs42-legacy-data --by daniel@attelecomms.co.uk
```

- [ ] `--by` is Daniel Chan, who entered the old system's orders: the old orders don't record who made them, so they're his, and quotations and purchase orders keep whoever made them on the old system (matched by email, else `--by`). He must have a console account in the store first.
- [ ] The dry run reports every order's total matching the old system's ("totalMismatches": 0) and lists the old products that aren't in the catalogue (their lines keep their names on an archived "Item from the old site").
- [ ] The import brings in the orders and quotations as history (walk-in sales without the shop's own email), the suppliers, the inventory orders as purchase orders with their files (into `bs42-private`), and the old stock counts as each listing's opening stock (draft listings for stocked products with no price). It sends no emails. Rehearsed on development on 2026-11-04 (909 orders, 72 quotations, 20 suppliers, 25 purchase orders, 278 listings' stock).
- [ ] Wrong buy prices (equal to the selling price, or missing) can be corrected before or after the import: the old orders recorded no costs, so the import estimates each line's cost from the buy price at that moment, for the Profit & Margins report ("linesWithCost" in the report), and `db:reestimate-costs` works those estimates out again from buy prices corrected later (section 10, Afterwards).
- [ ] Keep the export folder private (customers' details), out of the repository. `legacy-import-log.json` in it records what was written; `--undo` removes exactly that.
- [ ] Then count a few listings against the shelves: the old counts are only as good as the old system's.

Don't run `db:seed:demo` in production: it creates a demo store with made-up stock and exchange rate.

The uploaded files in `seed-config.json` and the catalogue seed are URLs in the storage container the development database uses: production must use the same container, or those images break. Development and production then share one container, so deleting a seeded product, brand or category on development deletes its files on production too, and only production may run the file cleanup job (section 7).

## 5. Build and start

### On Azure App Service

`.github/workflows/deploy.yml` deploys both apps on every push to `main` (and by hand, from GitHub's Actions tab): it runs the migrations, builds each app with Turbo, and zip-deploys Next's standalone output to its web app (`NEXT_STANDALONE=1` turns it on in each `next.config.ts`; local builds stay as they are, for `pnpm start`).

**On Azure:**

- [ ] A **Linux App Service plan** on Node 24, and two web apps on it: the console and the store. A Premium v3 plan (P0v3 or up) has deployment slots, so a new version starts in a staging slot and is swapped in once it answers; on Basic, deploys replace the running app directly, with a few seconds of downtime.
- [ ] Each app's **startup command**: `HOSTNAME=0.0.0.0 node apps/console/server.js` (console) and `HOSTNAME=0.0.0.0 node apps/store/server.js` (store). App Service sets `HOSTNAME` to the container's name, and the server would listen only there.
- [ ] Each app's **environment variables**: section 2's table, as app settings (Key Vault references for the secrets), not `.env` files. With a staging slot, give it the same settings, and set none of them as slot settings: they swap with the code.
- [ ] Turn on **Always On** (the scheduled jobs and the first visitor after a quiet spell need it) and **HTTPS Only**, on both apps.
- [ ] Don't set `WEBSITE_RUN_FROM_PACKAGE`: it makes the app's folder read-only, and Next writes its cache there.
- [ ] Keep **one instance** per app. Each instance has its own cache, and the console clears its cache only in its own instance, so scaling out would show stale settings for up to a minute.
- [ ] The console's **system-assigned managed identity** on, with the Storage Blob Data Contributor role (section 3). No `AZURE_*` keys are needed then.
- [ ] Custom domains: `console.bs42.net` on the console, `bs42.net` (and `www` if wanted) on the store, each with a free App Service managed certificate.
- [ ] The database in the same region as the apps.

**For the workflow:**

- [ ] An Entra ID app registration with a **federated credential** for this repository's `production` environment (GitHub OpenID Connect, so no Azure password is stored), given the Website Contributor role on the resource group.
- [ ] A GitHub environment named `production` with these **secrets**: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `DIRECT_URL` with a pooled database (Neon's connection without `-pooler`), for the migrations.
- [ ] And these **variables**: `CONSOLE_WEBAPP_NAME`, `STORE_WEBAPP_NAME`, `AZURE_RESOURCE_GROUP`, `AUTH_COOKIE_DOMAIN`, `CONSOLE_AUTH_URL`, `STORE_AUTH_URL`, and `DEPLOY_SLOT` (the staging slot's name, e.g. `staging`; leave it unset without slots).
- [ ] The database must accept connections from GitHub's runners: the workflow runs the migrations, and both apps' builds connect to it (the store's prerenders its homepage and sitemap from it). On Azure Database for PostgreSQL, that means allowing public access with SSL and a strong password (GitHub's runners have no fixed addresses), or running the workflow on a self-hosted runner inside the network.

- [ ] Run the workflow by hand (**Actions → Deploy → Run workflow**) and check both apps answer before going live. After changing an app setting the build reads (the URLs, the cookie domain), run it again: the build bakes them in.

**Visitor addresses:** App Service's front end sets `X-Forwarded-For` with the visitor's address and port; the store drops the port (`visitorIp`), so checkout's per-address limit on unpaid orders works.

### Elsewhere

```bash
pnpm build    # builds the shared packages, then both apps
pnpm start    # console on port 3000, store on 3001 (or start each on its own, see section 2)
```

- [ ] Point `console.bs42.net` at port 3000 and `bs42.net` at port 3001, over HTTPS.
- [ ] Have the proxy set `X-Forwarded-For` to the visitor's address. Checkout limits unpaid orders per address with it, so without it every customer shares one limit.

### Then, either way

- [ ] Open `https://console.bs42.net/setup` and create the first superAdmin, **before the storefront is public**. The page only works while the database has no users at all, so one customer signing up first locks it for good (fixing that means editing the database).

## 6. Paystack

- [ ] In the Paystack dashboard (live mode), set the webhook URL to `https://bs42.net/api/paystack/webhook`. Payments are also recorded when the customer comes back from Paystack, but the webhook catches those who close the tab.
- [ ] Refunds are only recorded in the console: give the money back in Paystack's dashboard.

## 7. Scheduled jobs

Each is a POST to the console with the cron secret. A failure answers with an error status, so the scheduler can alert.

| Job | When | What it does |
|---|---|---|
| `/api/cron/unpaid-orders` | Every 5 minutes | Cancels storefront orders unpaid after 45 minutes and puts their stock back; clears old baskets and notifications |
| `/api/cron/exchange-rate` | Daily, just after 00:00 UTC (Accra time) | Saves today's USD→GHS rate. Without it, prices disappear from the store after 2 days. |
| `/api/cron/file-cleanup` | Daily | Deletes uploaded files nothing uses any more |

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://console.bs42.net/api/cron/unpaid-orders
```

On Azure, a **Logic App** (Consumption plan) does this for a few cents a month: one workflow per job, each a Recurrence trigger (time zone UTC, which is Accra's) and an HTTP action (POST, the URL, header `Authorization: Bearer <CRON_SECRET>`, with the secret from Key Vault). Its run history shows each failure; add an alert rule on failed runs to hear of them.

Try `file-cleanup` once with `?dryRun=1` first: it lists what it would delete without deleting.

Run `file-cleanup` against production only, never a development console sharing its container: each database's cleanup deletes the files only the other one uses.

## 8. In the console

Signed in as the superAdmin, in Settings. `db:seed:config` (section 4) fills most of this in: check each page rather than starting from scratch.

- [ ] **General:** the store's and console's names, logo and favicon, and the Contact card (phones, WhatsApp, email, address, map link, opening hours), which the footer and the Contact us page show.
- [ ] **Pricing:** today's exchange rate (until the first daily fetch runs), the markup if any, quotation validity, and the bank details for bank-transfer orders.
- [ ] Optional, after setting the markup: fill in the last 90 days' exchange rates for the dashboard's chart, from a machine with the production `DATABASE_URL` and the API key: `pnpm --filter @workspace/db db:backfill-rates`. It adds only days with no rate.
- [ ] **Pricing → Tax:** leave off until the VAT and levy rates are confirmed with an accountant or the GRA.
- [ ] **Delivery:** delivery fees per region and town, the free-delivery threshold, and installation areas.
- [ ] **Notifications:** the email addresses that get staff alerts.
- [ ] **Legal:** Terms and Privacy Policy (each page is hidden until it has text).
- [ ] **Blog** (sidebar): the old site's 13 posts come with the migrations, at their old addresses. Read them through, and publish or delete the draft "CCTV and Networking Class" (a course announcement from June 2024).

Then create the stores, invite their staff, and add listings.

## 9. Smoke test

- [ ] The platform dashboard's checks (exchange rate, tax, mailer, notification recipients) are all green.
- [ ] Sign up on the store: the confirmation email arrives and its link signs you in.
- [ ] Place a small order and pay with Paystack: you land on the order page marked paid, the confirmation email arrives, and staff get the new-order alert.
- [ ] Refund it in the console, and in Paystack's dashboard.
- [ ] Upload a product image: it shows in the console and on the store.
- [ ] The next day, Settings → Pricing shows the rate the job fetched.

## 10. Going live

Production already runs at its App Service addresses; this is the switch from the old site. The old system's records
(section 4) come across once it has stopped taking orders, so nothing made after the export is missed.

**Before the day:**

- [x] Daniel Chan has a console account in the store (invited, accepted): every import step names him with `--by`.
- [x] A real `OPEN_EXCHANGE_RATES_API_KEY` in the console's settings (section 2).
- [ ] The live `PAYSTACK_SECRET_KEY`, waiting for Paystack's approval. Needed before Online Payments is turned on (step 7): with the test key, checkout is Paystack's test mode, where no real money is taken and a test card payment marks an order as paid.
- [x] The three scheduled jobs (section 7) exist and have run without failing.
- [x] Settings → General's Contact card filled in, and the Blog's draft post dealt with (deleted).
- [ ] The rest of Settings (section 8) checked.
- [ ] DNS: the `asuid` TXT records for `bs42.net` and `www` added on the store's web app (they prove the domain without moving traffic), and the domain's TTL lowered a day ahead so the switch takes effect quickly.

**On the day, in this order:**

1. [ ] Stop the old system taking orders: the old storefront and staff entering orders on portal.bs42.net.
2. [ ] Take a snapshot of the production database (a Neon branch): the way back if anything below goes wrong.
3. [ ] Remove the preview import of 2026-11-04: `db:legacy:import --undo` with the preview's data folder, against production's direct connection. This is only clean if nothing has used its records since (orders, stock edits or deliveries on its listings); otherwise restore a snapshot from before it, or reset. `--undo` puts the imported rows' stock back to 0.
4. [ ] A fresh `db:legacy:export` (section 4): it only reads, but the old portal must still be running.
5. [ ] The import's dry run, with `--by daniel@attelecomms.co.uk`: `totalMismatches` 0, and read the list of old products not in the catalogue. Then the import itself.
6. [ ] Count a few listings against the shelves.
7. [ ] Paystack (section 6): the live key in both apps, and the webhook URL `https://bs42.net/api/paystack/webhook` in live mode. Then turn on Settings → Pricing → Online Payments (off until then: the storefront offers quotes and the contact page instead, and staff create orders in the console). Going live without it is fine too: the storefront just doesn't take payments yet.
8. [ ] Point `bs42.net` (and `www`) at the store's web app and add their managed certificates (section 5). Set `STORE_AUTH_URL=https://bs42.net` in both apps' settings and in the GitHub environment's variables, and run the deploy workflow again: the build bakes the URL in. With Google sign-in, add `https://bs42.net/api/auth/callback/google` as a redirect URI.
9. [ ] The smoke test (section 9), with a real small order paid through Paystack, then refunded.
10. [ ] Google Search Console: add `bs42.net` and submit `https://bs42.net/sitemap.xml`. The old site's addresses aren't redirected (decided: it had little search traffic), so this gets the new pages found sooner.

**Afterwards:**

- [ ] Soon after the import, correct the store's wrong buy prices, then re-estimate the old orders' costs:
  1. The draft listings the import made for stocked products with no price (the preview's 36 go with step 3's `--undo`, so fix this import's, not those).
  2. The listings whose buy price equals the selling price, or has none (the Stock Value report lists stocked items without one). The old prices are landed costs (shipping, duty and clearing included), as receiving a purchase order now sets them; receiving one with "Update buy prices" on corrects its products by itself.
  3. `pnpm --filter @workspace/db db:reestimate-costs --dry-run`, read what it will change, then the same without `--dry-run`.

  The script only re-estimates the old site's order lines. A sale made after launch keeps the buy price it was made at, so a product sold before its buy price is fixed shows a 0% margin (or "Without a cost") on that sale in Profit & Margins for good: fix the products most likely to sell first.
- [ ] Once the import has been checked, back up the old system's database, then stop its App Service (bs42-admin): its API answers without a sign-in and holds customers' details. Then stop the old storefront (bs42-client).
- [ ] The next day, Settings → Pricing shows the rate the daily job fetched.
