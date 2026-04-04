"use client"

import { X } from "lucide-react"

interface ShortcutHelpModalProps {
    isOpen: boolean
    onClose: () => void
}

const SHORTCUTS = [
    { keys: "Ctrl+B", action: "Bold" },
    { keys: "Ctrl+I", action: "Italic" },
    { keys: "Ctrl+Shift+X", action: "Strikethrough" },
    { keys: "Ctrl+E", action: "Inline code" },
    { keys: "Ctrl+K", action: "Insert/edit link" },
    { keys: "Ctrl+Alt+1", action: "Heading 1" },
    { keys: "Ctrl+Alt+2", action: "Heading 2" },
    { keys: "Ctrl+Alt+3", action: "Heading 3" },
    { keys: "Ctrl+Shift+B", action: "Bullet list" },
    { keys: "Ctrl+Shift+O", action: "Ordered list" },
    { keys: "Ctrl+Shift+T", action: "Task list" },
    { keys: "Ctrl+Shift+Q", action: "Blockquote" },
    { keys: "Ctrl+Alt+C", action: "Code block" },
]

export default function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-background rounded-2xl shadow-xl border border-text/10 w-full max-w-md mx-4 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-text/10">
                    <h3 className="font-serif font-bold text-lg text-text">Keyboard Shortcuts</h3>
                    <button onClick={onClose} className="p-1 hover:bg-text/5 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-text/60" />
                    </button>
                </div>
                <div className="p-4 space-y-2">
                    {SHORTCUTS.map(({ keys, action }) => (
                        <div key={keys} className="flex items-center justify-between py-1.5">
                            <span className="text-sm text-text/70">{action}</span>
                            <kbd className="px-2 py-1 bg-text/5 border border-text/10 rounded-md text-xs font-mono text-text/60">
                                {keys}
                            </kbd>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
