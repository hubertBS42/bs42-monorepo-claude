# @workspace/commerce

Order logic the console and the storefront share: pricing (`pricing`, pure), fulfilment rules and labels
(`order-status`, pure), the exchange rate orders are priced at (`exchange-rates`), stock
history (`stock-movements`), creating orders and changing their status (`order-writes`), customer order emails
(`order-emails`), staff notifications (`notifications`), what customers can see (`visibility`) and delivery fees (`delivery`, with the
rate lookup in `delivery-rates`).

`order-status` and `delivery-rates` are safe in client components (they import no values from Prisma's client);
everything else except `pricing` is `server-only`. Modules import each other relatively, so a script can
run them against the database (see CLAUDE.md, "Transaction logic worth testing").
