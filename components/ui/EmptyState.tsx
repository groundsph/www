import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description?: string
    action?: ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className='rounded-xl border border-tertiary/50 bg-background py-16 text-center'>
            <Icon className='mx-auto mb-4 h-12 w-12 opacity-30' />
            <p className='font-medium text-text'>{title}</p>
            {description && <p className='mx-auto mt-1 max-w-sm text-sm text-text/60'>{description}</p>}
            {action && <div className='mt-4 flex justify-center'>{action}</div>}
        </div>
    )
}
