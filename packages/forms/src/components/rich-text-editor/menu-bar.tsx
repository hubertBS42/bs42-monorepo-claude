import { type Editor } from "@tiptap/react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  Bold,
  ChevronDown,
  Columns3,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Italic,
  ListIcon,
  ListOrdered,
  Pilcrow,
  Rows3,
  Strikethrough,
  Table,
  Trash2,
  UnderlineIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Toggle } from "@workspace/ui/components/toggle"

interface Props {
  editor: Editor | null
}

interface MenuButtonProps {
  label: string
  pressed: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function MenuButton({ label, pressed, disabled, onClick, children }: MenuButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle size="sm" className="shrink-0 px-0" disabled={disabled} aria-label={label} pressed={pressed} onPressedChange={onClick}>
            {children}
          </Toggle>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

interface MenuChoice {
  value: string
  label: string
  icon: LucideIcon
}

interface MenuChoicesProps {
  label: string
  choices: MenuChoice[]
  value: string
  onChange: (value: string) => void
}

// A set of exclusive choices (text style, alignment) in one button showing the current one, so the bar fits a phone
function MenuChoices({ label, choices, value, onChange }: MenuChoicesProps) {
  const current = choices.find((choice) => choice.value === value) ?? choices[0]!
  const CurrentIcon = current.icon
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={<Button type="button" variant="ghost" size="sm" className="shrink-0 gap-0.5 px-1.5" aria-label={`${label}: ${current.label}`} />}
            />
          }
        >
          <CurrentIcon />
          <ChevronDown className="size-3 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(String(next))}>
          {choices.map(({ value: choiceValue, label: choiceLabel, icon: Icon }) => (
            <DropdownMenuRadioItem key={choiceValue} value={choiceValue} closeOnClick>
              <Icon />
              {choiceLabel}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const TEXT_STYLES: MenuChoice[] = [
  { value: "paragraph", label: "Normal text", icon: Pilcrow },
  { value: "1", label: "Heading 1", icon: Heading1Icon },
  { value: "2", label: "Heading 2", icon: Heading2Icon },
  { value: "3", label: "Heading 3", icon: Heading3Icon },
]

const ALIGNMENTS: MenuChoice[] = [
  { value: "left", label: "Align left", icon: AlignLeft },
  { value: "center", label: "Align center", icon: AlignCenter },
  { value: "right", label: "Align right", icon: AlignRight },
]

function Divider() {
  return <div className="mx-1 h-6 w-px shrink-0 bg-border" />
}

// One row that scrolls sideways when it doesn't fit (a phone, or a table's extra buttons). Clicks stay in the bar: the
// editor's box focuses the editor on click, which would close a menu as it opens (each button focuses it itself).
const MenuBar = ({ editor }: Props) => {
  if (!editor) return null

  const headingLevel = [1, 2, 3].find((level) => editor.isActive("heading", { level }))
  const textStyle = headingLevel ? String(headingLevel) : "paragraph"
  const alignment = ALIGNMENTS.find(({ value }) => editor.isActive({ textAlign: value }))?.value ?? "left"

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-t-lg border border-x-0 border-t-0 border-input bg-card p-2" onClick={(e) => e.stopPropagation()}>
      <TooltipProvider>
        <MenuChoices
          label="Text style"
          choices={TEXT_STYLES}
          value={textStyle}
          onChange={(value) => {
            const chain = editor.chain().focus()
            if (value === "paragraph") chain.setParagraph().run()
            else chain.setHeading({ level: Number(value) as 1 | 2 | 3 }).run()
          }}
        />

        <Divider />

        <MenuButton label="Bold" pressed={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold />
        </MenuButton>
        <MenuButton label="Italic" pressed={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic />
        </MenuButton>
        <MenuButton label="Underline" pressed={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon />
        </MenuButton>
        <MenuButton label="Strikethrough" pressed={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough />
        </MenuButton>

        <Divider />

        <MenuButton label="Bullet list" pressed={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <ListIcon />
        </MenuButton>
        <MenuButton label="Ordered list" pressed={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
        </MenuButton>
        <MenuChoices label="Alignment" choices={ALIGNMENTS} value={alignment} onChange={(value) => editor.chain().focus().setTextAlign(value).run()} />

        <Divider />

        <MenuButton
          label="Insert table"
          pressed={editor.isActive("table")}
          disabled={editor.isActive("table")}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <Table />
        </MenuButton>

        {editor.isActive("table") && (
          <>
            <MenuButton
              label="Add row below"
              pressed={false}
              disabled={!editor.can().addRowAfter()}
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <BetweenHorizontalEnd />
            </MenuButton>
            <MenuButton
              label="Add column right"
              pressed={false}
              disabled={!editor.can().addColumnAfter()}
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <BetweenVerticalEnd />
            </MenuButton>
            <MenuButton
              label="Delete row"
              pressed={false}
              disabled={!editor.can().deleteRow()}
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <Rows3 />
            </MenuButton>
            <MenuButton
              label="Delete column"
              pressed={false}
              disabled={!editor.can().deleteColumn()}
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <Columns3 />
            </MenuButton>
            <MenuButton label="Delete table" pressed={false} onClick={() => editor.chain().focus().deleteTable().run()}>
              <Trash2 />
            </MenuButton>
          </>
        )}
      </TooltipProvider>
    </div>
  )
}

export default MenuBar
