import Image from "next/image"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { getCloudflareOptimizedUrl } from "@/utils/cloudflare-image"

interface CafeHeroImageProps {
    thumbnail: string
}

/**
 * Feature flag for Cloudflare Image Resizing
 * Set to true once Image Resizing is enabled in Cloudflare dashboard
 */
const USE_CLOUDFLARE_RESIZE = true

/**
 * Server Component for the hero background image
 * This renders on the server for faster LCP since it doesn't need client-side JS
 *
 * When Cloudflare Image Resizing is enabled:
 * - Images are transformed on-the-fly at Cloudflare edge
 * - Automatic WebP/AVIF format selection
 * - Optimized for full-width hero display
 */
export default function CafeHeroImage({ thumbnail }: CafeHeroImageProps) {
    const originalUrl = getCafeThumbnailUrl(thumbnail)

    // When Cloudflare resize is enabled, use optimized URL
    // We use 1920px width for hero images (covers most screens)
    const imageUrl = USE_CLOUDFLARE_RESIZE
        ? getCloudflareOptimizedUrl({
              src: originalUrl,
              width: 1920,
              quality: 80,
          })
        : originalUrl

    return (
        <div className='absolute w-full h-full bg-linear-to-r from-black/70 to-transparent select-none'>
            <Image
                src={imageUrl}
                alt=''
                fill
                className='object-cover object-center -z-1'
                draggable={false}
                priority
                fetchPriority='high'
                sizes='100vw'
                placeholder='blur'
                blurDataURL='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAAUDBAMAAAAAAAAAAAAAAAECAwQFESESBhMxQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABoRAAICAwAAAAAAAAAAAAAAAAECABEDITH/2gAMAwAAhEDEQA/ALS9cV6W3HuVPUYuT/qZSyH6k+AAFZdD/9k='
                // Disable Next.js image optimization when using Cloudflare
                unoptimized={USE_CLOUDFLARE_RESIZE}
            />
        </div>
    )
}
