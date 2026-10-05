import { createElement, type ReactNode } from "react"
import { common, createLowlight } from "lowlight"
import { Code2 } from "lucide-react"

const lowlight = createLowlight(common)

interface HastNode {
    type: string
    value?: string
    tagName?: string
    properties?: Record<string, unknown>
    children?: HastNode[]
}

function normalizeClassName(value: unknown): string | undefined {
    if (Array.isArray(value)) return value.join(" ")
    if (typeof value === "string") return value
    return undefined
}

/** Render a lowlight/hast tree as React elements. */
function renderHast(node: HastNode, key: string): ReactNode {
    if (node.type === "text") return node.value ?? ""
    if (node.type !== "element" || !node.tagName) return null

    const properties = node.properties ?? {}
    const props: Record<string, unknown> = { key }

    for (const [name, value] of Object.entries(properties)) {
        if (name === "className") {
            props.className = normalizeClassName(value)
        } else if (typeof value === "string" || typeof value === "number") {
            props[name] = value
        }
    }

    return createElement(
        node.tagName,
        props,
        (node.children ?? []).map((child, index) =>
            renderHast(child, `${key}-${index}`)
        )
    )
}

interface CodeBlockViewProps {
    code: string
    language: string
}

/** Syntax-highlighted read-only code block. */
export default function CodeBlockView({ code, language }: CodeBlockViewProps) {
    const registered =
        language && language !== "text" && lowlight.registered(language)

    let highlighted: ReactNode = code
    if (registered) {
        try {
            const tree = lowlight.highlight(language, code) as unknown as HastNode
            highlighted = (tree.children ?? []).map((child, index) =>
                renderHast(child, `h-${index}`)
            )
        } catch {
            highlighted = code
        }
    }

    return (
        <figure className="my-6 overflow-hidden rounded-2xl border border-text/10 bg-secondary/15">
            <figcaption className="flex items-center gap-2 border-b border-text/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-text/50">
                <Code2 className="w-3.5 h-3.5" />
                {language || "text"}
            </figcaption>
            <pre className="overflow-x-auto p-4 text-sm">
                <code className="font-mono text-text/90">{highlighted}</code>
            </pre>
        </figure>
    )
}
