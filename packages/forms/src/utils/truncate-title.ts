const TITLE_MAX_LENGTH = 24

export function truncateTitle(title: string): string {
  if (title.length <= TITLE_MAX_LENGTH) return title
  return `${title.slice(0, TITLE_MAX_LENGTH - 1)}…`
}
