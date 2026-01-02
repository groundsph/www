import Image from "next/image"
import { getCafeThumbnailUrl } from "@/utils/extras"

interface CafeHeroImageProps {
    thumbnail: string
}

/**
 * Server Component for the hero background image
 * This renders on the server for faster LCP since it doesn't need client-side JS
 */
export default function CafeHeroImage({ thumbnail }: CafeHeroImageProps) {
    return (
        <div className='absolute w-full h-full bg-linear-to-r from-black/70 to-transparent select-none'>
            <Image
                src={getCafeThumbnailUrl(thumbnail)}
                alt=''
                fill
                className='object-cover object-center -z-1'
                draggable={false}
                priority
                fetchPriority='high'
                sizes='100vw'
                placeholder='blur'
                blurDataURL='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAAUDBAMAAAAAAAAAAAAAAAECAwQFESESBhMxQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABoRAAICAwAAAAAAAAAAAAAAAAECABEDITH/2gAMAwAAhEDEQA/ALS9cV6W3HuVPUYuT/qZSyH6k+AAFZdD/9k='
            />
        </div>
    )
}
