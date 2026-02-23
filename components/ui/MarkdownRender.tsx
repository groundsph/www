import Markdown from "react-markdown"

export default function MarkdownRender({
    content,
    compact = false,
}: {
    content: string
    compact?: boolean
}) {
    const base = `
        w-full h-max
        [&_p]:mb-4 [&_p:empty]:h-6 [&_p:last-child]:mb-0
        [&_h1]:text-3xl [&_h1]:md:text-4xl [&_h1]:lg:text-5xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6
        [&_h2]:text-2xl [&_h2]:md:text-3xl [&_h2]:lg:text-4xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5
        [&_h3]:text-xl [&_h3]:md:text-2xl [&_h3]:lg:text-3xl [&_h3]:font-medium [&_h3]:mb-2 [&_h3]:mt-4
        [&_h4]:text-lg [&_h4]:md:text-xl [&_h4]:lg:text-2xl [&_h4]:font-medium [&_h4]:mb-2 [&_h4]:mt-3
        [&_h5]:text-base [&_h5]:md:text-lg [&_h5]:lg:text-xl [&_h5]:font-medium [&_h5]:mb-1 [&_h5]:mt-2
        [&_h6]:text-sm [&_h6]:md:text-base [&_h6]:lg:text-lg [&_h6]:font-medium [&_h6]:mb-1 [&_h6]:mt-2
        [&_ul]:list-disc [&_ul]:list-inside [&_ul]:mb-4
        [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:mb-4
        [&_ul_ul]:pl-6 [&_ol_ol]:pl-6 [&_ul_ol]:pl-6 [&_ol_ul]:pl-6
        [&_li]:mb-1
        [&_a]:text-primary [&_a:hover]:text-primary/80 [&_a]:hover:underline [&_a]:transition-colors
        [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:bg-muted/30
        [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
        [&_pre]:bg-secondary/20 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0
        [&_hr]:border-border [&_hr]:my-6
        [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
        [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:bg-muted [&_th]:font-semibold [&_th]:text-left
        [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2
        [&_strong]:font-bold
        [&_em]:italic
        [&_img]:rounded-lg [&_img]:my-4 [&_img]:max-w-full
    `

    const compactClasses = compact
        ? `
            [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-2 [&_h1]:mt-3
            [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-2
            [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mb-1 [&_h3]:mt-2
            [&_h4]:text-xs [&_h4]:font-medium [&_h4]:mb-1 [&_h4]:mt-1
            [&_p]:mb-2 [&_p]:text-sm
            [&_ul]:mb-2
            [&_ol]:mb-2
            [&_li]:text-sm
            [&_blockquote]:my-2 [&_blockquote]:text-sm
            [&_pre]:my-2 [&_pre]:p-2
            [&_code]:text-xs
            [&_table]:my-2
            [&_th]:px-2 [&_th]:py-1 [&_th]:text-xs
            [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs
        `
        : ""

    return (
        <div className={`${base} ${compactClasses}`}>
            <Markdown>{content}</Markdown>
        </div>
    )
}
