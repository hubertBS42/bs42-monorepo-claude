# @workspace/commerce

Order logic the console and the storefront share: pricing (`pricing`, pure), fulfilment rules and labels
(`order-status`, pure, safe in client components), the exchange rate orders are priced at (`exchange-rates`), stock
history (`stock-movements`), creating orders and changing their status (`order-writes`), customer order emails
(`order-emails`) and staff notifications (`notifications`).

Everything except `pricing` and `order-status` is `server-only`. Modules import each other relatively, so a script can
run them against the database (see CLAUDE.md, "Transaction logic worth testing").
