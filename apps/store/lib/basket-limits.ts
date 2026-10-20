// The most of one thing a basket line holds, even where stock isn't tracked or is plentiful: an order holds its stock
// until it's paid or cancelled, so one visitor shouldn't be able to take a whole shelf off sale. A plain module, so the
// product page's quantity picker can use it too.
export const MAX_LINE_QUANTITY = 50
