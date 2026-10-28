# Launch checklist

Everything needed to run BS42.NET in production: the console at `console.bs42.net`, the storefront at `bs42.net`. Work through it top to bottom. No secrets go in this file.

## 1. Have these ready

- [ ] A PostgreSQL database, reachable from the server.
- [ ] Two hostnames with HTTPS: `bs42.net` (store) and `console.bs42.net` (console).
- [ ] An Azure storage account for uploads (product images, logos, documents).
- [ ] A mailbox that can send by SMTP (order emails, sign-ups, staff alerts).
- [ ] Paystack **live** keys.
- [ ] An Open Exchange Rates API key (a free plan is enough: one call a day).
- [ ] A scheduler that can send HTTP POST requests (cron with `curl`, or the host's own).

## 2. Environment variables

On Azure App Service they're each app's app settings (section 5). Elsewhere, put them in each app's `.env` (`apps/console/.env`, `apps/store/.env`), and `DATABASE_URL` also in `packages/database/.env` for migrations. Both apps must use **the same** `BETTER_AUTH_SECRET`, URLs and cookie domain: they share sign-ins, and the store signs order links with the secret.

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
| `AZURE_STORAGE_CONTAINER_NAME` | ✓ | | Optional, defaults to `bs42` |
| `CRON_SECRET` | ✓ | | Random (`openssl rand -hex 32`); the scheduler sends it |
| `OPEN_EXCHANGE_RATES_API_KEY` | ✓ | | |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | | ✓ | Optional: "Continue with Google". Redirect URI `https://bs42.net/api/auth/callback/google` |

Azure sign-in for uploads uses `DefaultAzureCredential`: a managed identity when hosted on Azure, otherwise a service principal's `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` (console only).

> **Running through Turbo drops unlisted variables.** `pnpm start` runs both apps through Turbo, which passes on only the variables listed in `turbo.json`. Values in each app's `.env` are read by Next itself, so they always work. Variables set in the host's environment instead, such as the `AZURE_*` sign-in ones, only arrive if they're listed in `turbo.json`, or if each app is started on its own (`pnpm --filter console start`, `pnpm --filter store start`).

## 3. Storage (Azure)

- [ ] Give the console's identity the **Storage Blob Data Contributor** role on the account or container.
- [ ] Allow blob public access on the account, and set the container's public access level to **Blob**: browsers load images straight from their URLs.
- [ ] Turn on blob soft delete (undo after a delete relies on it).

## 4. Database

On Azure the deploy workflow applies the migrations on every push (section 5); the seed is still run once, by hand. From the repo root, with `packages/database/.env` pointing at production:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/db db:deploy   # apply every migration
pnpm --filter @workspace/db db:seed     # the catalogue: categories, brands and the old site's products; skips ones that exist
```

Don't run `db:seed:demo` in production: it creates a demo store.

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
- [ ] A GitHub environment named `production` with these **secrets**: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `DATABASE_URL`, `BETTER_AUTH_SECRET`.
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

## 8. In the console

Signed in as the superAdmin, in Settings:

- [ ] **General:** the store's and console's names, logo and favicon.
- [ ] **Pricing:** today's exchange rate (until the first daily fetch runs), the markup if any, quotation validity, and the bank details for bank-transfer orders.
- [ ] Optional, after setting the markup: fill in the last 90 days' exchange rates for the dashboard's chart, from a machine with the production `DATABASE_URL` and the API key: `pnpm --filter @workspace/db db:backfill-rates`. It adds only days with no rate.
- [ ] **Pricing → Tax:** leave off until the VAT and levy rates are confirmed with an accountant or the GRA.
- [ ] **Delivery:** delivery fees per region and town, the free-delivery threshold, and installation areas.
- [ ] **Notifications:** the email addresses that get staff alerts.
- [ ] **Legal:** Terms and Privacy Policy (each page is hidden until it has text).

Then create the stores, invite their staff, and add listings.

## 9. Smoke test

- [ ] The platform dashboard's checks (exchange rate, tax, mailer, notification recipients) are all green.
- [ ] Sign up on the store: the confirmation email arrives and its link signs you in.
- [ ] Place a small order and pay with Paystack: you land on the order page marked paid, the confirmation email arrives, and staff get the new-order alert.
- [ ] Refund it in the console, and in Paystack's dashboard.
- [ ] Upload a product image: it shows in the console and on the store.
- [ ] The next day, Settings → Pricing shows the rate the job fetched.
