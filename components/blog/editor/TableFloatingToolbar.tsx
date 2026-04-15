"use client"

import { Editor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import {
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    Trash2,
} from "lucide-react"

interface TableFloatingToolbarProps {
    editor: Editor | null
}

const ToolbarButton = ({
    onClick,
    title,
    children,
}: {
    onClick: () => void
    title: string
    children: React.ReactNode
}) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className="p-1.5 rounded-md bg-white text-text/70 hover:bg-primary hover:text-white shadow-sm border border-text/10 transition-colors"
    >
        {children}
    </button>
)

export default function TableFloatingToolbar({ editor }: TableFloatingToolbarProps) {
    if (!editor) return null

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={({ editor }: { editor: Editor }) => editor.isActive("table")}
            className="flex items-center gap-1 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg shadow-lg"
        >
            <span className="text-[10px] font-medium text-amber-700 mr-1 hidden sm:inline">Table</span>
            
            <div className="flex items-center gap-0.5">
                <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Above">
                    <ArrowUp className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row Below">
                    <ArrowDown className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Left">
                    <ArrowLeft className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column Right">
                    <ArrowRight className="w-3.5 h-3.5" />
                </ToolbarButton>
            </div>
            
            <div className="w-px h-4 bg-amber-200 mx-1" />
            
            <div className="flex items-center gap-0.5">
                <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
                    <span className="text-[10px] font-medium px-0.5">Row</span>
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
                    <span className="text-[10px] font-medium px-0.5">Col</span>
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
                    <Trash2 className="w-3.5 h-3.5" />
                </ToolbarButton>
            </div>
        </BubbleMenu>
    )
}
