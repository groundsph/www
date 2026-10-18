import { cn } from "@/utils/cn"

interface SkeletonProps {
    className?: string
}

export default function Skeleton({ className }: SkeletonProps) {
    return <div className={cn("animate-pulse rounded-lg bg-text/10", className)} aria-hidden='true' />
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
    return (
        <div className='space-y-3'>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className='rounded-xl border border-tertiary/50 bg-background p-4'>
                    <Skeleton className='h-4 w-1/3' />
                    <Skeleton className='mt-2 h-3 w-2/3' />
                </div>
            ))}
        </div>
    )
}
