import type { ReactNode } from "react"
import { cn } from "@/utils/cn"

interface SectionCardProps {
    title: string
    description?: string
    actions?: ReactNode
    children: ReactNode
    className?: string
}

export default function SectionCard({ title, description, actions, children, className }: SectionCardProps) {
    return (
        <section className={cn("rounded-xl border border-tertiary/50 bg-background p-5 shadow-sm", className)}>
            <div className='mb-4 flex items-start justify-between gap-4'>
                <div>
                    <h2 className='font-serif text-lg font-semibold text-text'>{title}</h2>
                    {description && <p className='mt-1 text-sm text-text/60'>{description}</p>}
                </div>
                {actions}
            </div>
            {children}
        </section>
    )
}
