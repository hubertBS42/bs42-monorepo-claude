// Where a product shown in the console links to: in a store's workspace, that store's listing of it; in the platform's,
// the catalogue product
export const listingHref = (listingId: string) => `/store/listings/${listingId}/edit`
export const catalogueProductHref = (productId: string) => `/catalogue/products/${productId}/edit`
