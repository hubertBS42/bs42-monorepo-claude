// Where installation is offered, with no imports, so client components can check an address with it.
// installation.ts loads the areas.

export interface InstallationAreaRow {
  region: string
  // Null for the whole region
  town: string | null
}

// Whether the installers work at an address: its whole region is covered, or its town is
export function installsIn(areas: InstallationAreaRow[], region: string, town: string) {
  return areas.some((area) => area.region === region && (area.town === null || area.town === town))
}

// "Greater Accra, Adum and Ahodwo": whole regions by name, and up to three towns of a region, else "parts of Ashanti".
// Null when there are none.
export function describeInstallationAreas(areas: InstallationAreaRow[]) {
  const regions = new Map<string, string[] | null>()
  for (const area of areas) {
    const towns = regions.get(area.region)
    if (towns === null) continue
    regions.set(area.region, area.town === null ? null : [...(towns ?? []), area.town])
  }
  const names = [...regions].flatMap(([region, towns]) => (towns === null ? [region] : towns.length <= 3 ? towns : [`parts of ${region}`]))
  if (!names.length) return null
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}
