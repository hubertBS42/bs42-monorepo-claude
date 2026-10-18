// A category path ("Men / Shoes / Sneakers") with the parents muted, so the category itself stands out. Shared by
// the tables that show one (products, store listings).
export default function CategoryPath({ path }: { path: string }) {
  const segments = path.split(" / ")
  const leaf = segments.pop()
  return (
    <span className="text-sm">
      {segments.length > 0 && <span className="text-muted-foreground">{segments.join(" / ")} / </span>}
      {leaf}
    </span>
  )
}
