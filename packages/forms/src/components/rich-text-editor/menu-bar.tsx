import { type Editor } from "@tiptap/react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Italic,
  ListIcon,
  ListOrdered,
  Strikethrough,
} from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
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

function MenuButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: MenuButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            size="sm"
            disabled={disabled}
            aria-label={label}
            pressed={pressed}
            onPressedChange={onClick}
          >
            {children}
          </Toggle>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

const MenuBar = ({ editor }: Props) => {
  if (!editor) return null

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-x-0 border-t-0 border-input bg-card p-2">
      <TooltipProvider>
        <div className="flex flex-wrap gap-x-1">
          <MenuButton
            label="Bold"
            pressed={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold />
          </MenuButton>
          <MenuButton
            label="Italic"
            pressed={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </MenuButton>
          <MenuButton
            label="Strikethrough"
            pressed={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough />
          </MenuButton>
          <MenuButton
            label="Heading 1"
            pressed={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1Icon />
          </MenuButton>
          <MenuButton
            label="Heading 2"
            pressed={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2Icon />
          </MenuButton>
          <MenuButton
            label="Heading 3"
            pressed={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3Icon />
          </MenuButton>
          <MenuButton
            label="Bullet list"
            pressed={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <ListIcon />
          </MenuButton>
          <MenuButton
            label="Ordered list"
            pressed={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered />
          </MenuButton>
        </div>

        <div className="mx-2 h-6 w-px bg-border" />

        <div className="flex flex-wrap gap-x-1">
          <MenuButton
            label="Align left"
            pressed={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft />
          </MenuButton>
          <MenuButton
            label="Align center"
            pressed={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter />
          </MenuButton>
          <MenuButton
            label="Align right"
            pressed={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight />
          </MenuButton>
        </div>
      </TooltipProvider>
    </div>
  )
}

export default MenuBar
