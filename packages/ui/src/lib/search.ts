// Text as searches compare it: without spaces, in lower case
export const squashText = (text: string) => text.replace(/\s/g, "").toLowerCase()

// Lists filtered in the browser match as the server's searches do: ignoring spaces and case, so "4 x 4" finds "4x4"
export const matchesSearch = (text: string, search: string) => squashText(text).includes(squashText(search))
