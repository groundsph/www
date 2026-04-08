/**
 * Cloudflare Image Resizing loader
 * 
 * This transforms images via Cloudflare's Image Resizing service:
 * - Automatic WebP/AVIF format selection
 * - Responsive sizing
 * - Edge caching (transformed images cached indefinitely)
 * 
 * Hero images use getHeroImageSrcSet() with widths [640, 1024, 1920]
 * Gallery/review images use getResponsiveSrcSet() with widths [480, 768, 1024, 1920]
 * 
 * Usage is limited to stay within free tier limits (5k/month)
 */

interface CloudflareImageParams {
    src: string
    width: number
    quality?: number
}

const CDN_DOMAIN = "cdn.grounds.ph"

/**
 * Transform an image URL to use Cloudflare Image Resizing
 * Only works with images from cdn.grounds.ph
 */
export function getCloudflareOptimizedUrl({
    src,
    width,
    quality = 80,
}: CloudflareImageParams): string {
    // Skip if not from our CDN
    if (!src.includes(CDN_DOMAIN)) {
        return src
    }

    // Extract path from URL
    let path: string
    try {
        const url = new URL(src)
        path = url.pathname
    } catch {
        // If not a valid URL, assume it's already a path
        path = src.startsWith("/") ? src : `/${src}`
    }

    // Build Cloudflare Image Resizing URL
    // Format: /cdn-cgi/image/width=X,quality=Y,format=auto/path
    const params = [
        `width=${width}`,
        `quality=${quality}`,
        `format=auto`, // Auto-selects WebP/AVIF based on browser
        `fit=cover`,
    ].join(",")

    return `https://${CDN_DOMAIN}/cdn-cgi/image/${params}${path}`
}

/**
 * Generate srcSet for responsive hero images
 * Uses 3 breakpoints to minimize transformations while covering common viewports
 */
export function getHeroImageSrcSet(src: string, quality = 80): string {
    // Skip if not from our CDN
    if (!src.includes(CDN_DOMAIN)) {
        return ""
    }

    const widths = [640, 1024, 1920] // mobile, tablet, desktop

    return widths
        .map((w) => `${getCloudflareOptimizedUrl({ src, width: w, quality })} ${w}w`)
        .join(", ")
}

/**
 * Calculate estimated monthly transformations
 * 
 * Per cafe: 3 hero sizes (640, 1024, 1920)
 * Cached indefinitely, so each unique cafe/size combo counts once
 * 
 * Example: 500 cafes × 3 sizes = 1,500 transformations (one-time)
 */

export function getOptimizedImageUrl(
    src: string,
    options: { width?: number; quality?: number; fit?: string } = {}
): string {
    const { width, quality = 80, fit = "cover" } = options

    if (!src.includes(CDN_DOMAIN)) {
        return src
    }

    let path: string
    try {
        const url = new URL(src)
        path = url.pathname
    } catch {
        path = src.startsWith("/") ? src : `/${src}`
    }

    const params = [
        width ? `width=${width}` : null,
        `quality=${quality}`,
        `format=auto`,
        `fit=${fit}`,
    ].filter(Boolean).join(",")

    return `https://${CDN_DOMAIN}/cdn-cgi/image/${params}${path}`
}

export function getResponsiveSrcSet(
    src: string,
    widths: number[] = [480, 768, 1024, 1920],
    quality = 80
): string {
    if (!src.includes(CDN_DOMAIN)) {
        return ""
    }

    return widths
        .map((w) => `${getOptimizedImageUrl(src, { width: w, quality })} ${w}w`)
        .join(", ")
}
