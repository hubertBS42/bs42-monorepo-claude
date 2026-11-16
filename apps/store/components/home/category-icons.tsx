import Link from "next/link"
import { LayoutGrid } from "lucide-react"

export interface CategoryIcon {
  id: string
  name: string
  href: string
  // A product photo from the category (getCategoryPhotos)
  photo: string | null
}

// Phones only: the categories under each top-level one as round photos in two rows that scroll sideways, a quicker way
// in than the tall "Shop by category" cards below. Photos sit on white in both themes, as on the product cards.
export function CategoryIcons({ icons }: { icons: CategoryIcon[] }) {
  return (
    // The header's menu is "Categories"
    <nav aria-label="Browse categories">
      {/* Half the icons a row, filled row by row, so each row reads in menu order (and so does a screen reader) */}
      <ul
        className="-mx-4 grid gap-x-1 gap-y-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ gridTemplateColumns: `repeat(${Math.ceil(icons.length / 2)}, 5.25rem)` }}
      >
        {icons.map((icon) => (
          <li key={icon.id}>
            <Link href={icon.href} className="group flex flex-col items-center gap-1.5 text-center">
              <span className="flex size-16 items-center justify-center overflow-hidden rounded-full border bg-white transition-shadow group-hover:shadow-md">
                {icon.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
                  <img src={icon.photo} alt="" loading="lazy" className="size-full object-contain p-2" />
                ) : (
                  <LayoutGrid className="size-6 text-primary/50" aria-hidden />
                )}
              </span>
              <span className="line-clamp-2 text-xs leading-tight">{icon.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
