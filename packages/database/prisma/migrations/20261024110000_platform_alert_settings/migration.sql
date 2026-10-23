
-- CreateEnum
CREATE TYPE "PlatformAlert" AS ENUM ('STOREFRONT_ORDERS', 'STAFF_ORDERS', 'LOW_STOCK', 'OUT_OF_STOCK', 'STORE_REFUNDS', 'LOW_RATINGS', 'TRADE_APPLICATIONS', 'QUOTES', 'RATE_FETCH_FAILURE');

-- CreateTable
CREATE TABLE "platform_alert_setting" (
    "userId" UUID NOT NULL,
    "alert" "PlatformAlert" NOT NULL,
    "bell" BOOLEAN NOT NULL,

    CONSTRAINT "platform_alert_setting_pkey" PRIMARY KEY ("userId","alert")
);

-- AddForeignKey
ALTER TABLE "platform_alert_setting" ADD CONSTRAINT "platform_alert_setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Each admin's bell keeps following what Settings has now: a row wherever Settings' switch differs from the
-- alert's default (PLATFORM_ALERT_DEFAULTS). Role strings can be comma-separated, so match each role inside them.
INSERT INTO "platform_alert_setting" ("userId", "alert", "bell")
SELECT u."id", s."alert"::"PlatformAlert", s."bell"
FROM "user" u
CROSS JOIN (
    SELECT 'STOREFRONT_ORDERS' AS "alert", "notifyStorefrontOrders" AS "bell", true AS "default" FROM "app_settings"
    UNION ALL SELECT 'STAFF_ORDERS', "notifyStaffOrders", false FROM "app_settings"
    UNION ALL SELECT 'LOW_STOCK', "notifyLowStock", true FROM "app_settings"
    UNION ALL SELECT 'OUT_OF_STOCK', "notifyOutOfStock", true FROM "app_settings"
    UNION ALL SELECT 'STORE_REFUNDS', "notifyStoreRefunds", true FROM "app_settings"
    UNION ALL SELECT 'LOW_RATINGS', "notifyLowRatings", false FROM "app_settings"
    UNION ALL SELECT 'TRADE_APPLICATIONS', "notifyTradeApplications", true FROM "app_settings"
    UNION ALL SELECT 'QUOTES', "notifyQuotes", false FROM "app_settings"
    UNION ALL SELECT 'RATE_FETCH_FAILURE', "notifyRateFetchFailure", true FROM "app_settings"
) s
WHERE s."bell" <> s."default"
  AND EXISTS (SELECT 1 FROM unnest(string_to_array(u."role", ',')) AS r(role) WHERE trim(r.role) IN ('admin', 'superAdmin'));
