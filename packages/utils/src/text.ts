export function capitalizeWord(value: string): string {
  const [firstLetter, ...remainingLetters] = value
  if (!firstLetter) return ""

  return `${firstLetter.toUpperCase()}${remainingLetters.join("").toLowerCase()}`
}
