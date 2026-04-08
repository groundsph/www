# Photo Upload Quality Audit & Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix blurry photo uploads from phones by eliminating double-compression, improving image processing pipeline, and ensuring proper quality at all breakpoints.

**Architecture:** Audit and fix the client-side image processing pipeline. The core issue is double lossy compression (cropper outputs JPEG 0.9, then `browser-image-compression` re-encodes again). Secondary issues include overly aggressive size limits for gallery/review photos, missing EXIF orientation handling in canvas operations, and lack of responsive image delivery for non-hero images.

**Tech Stack:** `browser-image-compression` v2.0.2, `react-easy-crop`, Canvas API, Cloudflare R2, Cloudflare Image Resizing

---

## Root Cause Analysis

### Primary Issue: Double Lossy Compression

The current pipeline compresses images **twice** with lossy encoders:

1. **`ImageCropper.tsx:70-81`** -- `canvas.toBlob(..., "image/jpeg", 0.9)` creates a lossy JPEG
2. **Callers then pass that JPEG through `browser-image-compression`** -- which re-encodes the already-lossy data

Affected flows:
- **Cover images** (`useCoverImageUpload.ts:111-142`): Cropper JPEG 0.9 -> `compressCoverImage()` WebP 0.85
- **Menu photos** (`MenuItemModal.tsx:130-156`): Cropper JPEG 0.9 -> `imageCompression()` WebP
- **Avatars** (`Profile.tsx:444-509`): Canvas JPEG 0.9 -> no second compression (this one is OK)
- **Badge stamps** (`ImageSection.tsx:140-169`): PNG, no lossy issue

Each re-encoding introduces generational loss. Phone photos with text, fine detail, or low light are most affected.

### Secondary Issues

1. **Gallery max 1024px** (`compressGalleryImage`): On phones with 2x/3x DPR, displaying a 1024px image at ~512px CSS looks soft on retina screens.
2. **Review images max 1200px** at 150KB WebP (`compressReviewImage`): Very aggressive for food/drink photos that users want to look crisp.
3. **Menu photos 800x800 at 150KB** (`MenuItemModal.tsx:141-146`): Small and heavily compressed; food photos lose detail.
4. **`checkAspectRatio` reads EXIF-rotated dimensions** but the canvas cropper may not handle EXIF rotation, causing crop misalignment on rotated phone photos.
5. **No `imageCompression` quality floor** -- `browser-image-compression` can degrade below `initialQuality` to meet `maxSizeMB`. Setting `alwaysResolve` to false would let us detect when quality drops too low.
6. **Cloudflare Image Resizing only on hero images** -- gallery/review/menu images miss out on responsive delivery and automatic AVIF/WebP.

---

### Task 1: Fix Double Compression in ImageCropper

**Problem:** `ImageCropper.tsx:70-81` outputs JPEG at 0.9 quality. Callers then re-compress this with `browser-image-compression`, causing generational loss.

**Fix:** Make `ImageCropper` output lossless PNG blobs instead of lossy JPEG. Let the downstream `browser-image-compression` handle all lossy encoding in one pass.

**Files:**
- Modify: `components/ui/ImageCropper.tsx:70-81`

**Step 1: Update canvas.toBlob to use PNG**

```tsx
// In ImageCropper.tsx, change the canvas.toBlob call:
canvas.toBlob(
    (blob) => {
        if (!blob) {
            console.error("Canvas is empty")
            return
        }
        onComplete(blob)
        setProcessing(false)
    },
    "image/png"  // Lossless intermediate format
)
```

**Step 2: Verify callers still work**

Callers convert the blob to `File` with their desired type before compression:
- `useCoverImageUpload.ts:113-119` -- creates `File([croppedBlob], "cover.webp", { type: "image/webp" })`
- `MenuItemModal.tsx:136-138` -- creates `File([croppedBlob], "menu-photo.webp", { type: "image/webp" })`
- `Profile.tsx:483-485` -- creates `File([blob], "avatar.jpg", { type: "image/jpeg" })`

These all pass through `browser-image-compression` which handles format conversion. No caller changes needed.

**Step 3: Test manually**

Upload a cover image via cafe editor. Verify the image is not blurry compared to before.

**Step 4: Commit**

```bash
git add components/ui/ImageCropper.tsx
git commit -m "fix: use lossless PNG output from cropper to prevent double compression"
```

---

### Task 2: Fix Double Compression in MenuItemModal

**Problem:** `MenuItemModal.tsx:130-156` creates a File from the cropped blob, then runs `imageCompression()` on it. With Task 1, the cropper now outputs PNG, but the File is created as `image/webp` type. `browser-image-compression` will still re-encode. The real issue is that `initialQuality` is not set, so it may use a very low quality.

**Fix:** Add `initialQuality` to the compression options.

**Files:**
- Modify: `components/cafe-editor/MenuItemModal.tsx:140-146`

**Step 1: Add initialQuality to the compression options**

```tsx
// In MenuItemModal.tsx handleCropComplete:
const compressedBlob = await imageCompression(croppedFile, {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.85,  // Add this line
})
```

**Step 2: Test**

Upload a menu item photo. Compare quality to before.

**Step 3: Commit**

```bash
git add components/cafe-editor/MenuItemModal.tsx
git commit -m "fix: add initialQuality to menu photo compression"
```

---

### Task 3: Increase Gallery Image Resolution Limits

**Problem:** `compressGalleryImage` caps at 1024px. On retina displays (2x DPR), this looks blurry when displayed at 512px+ CSS.

**Fix:** Increase max dimension to 1920px and bump max size to 200KB.

**Files:**
- Modify: `utils/image-processing.ts:47-61`

**Step 1: Update compressGalleryImage**

```ts
export async function compressGalleryImage(file: File): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.2,        // Was 0.12 (120KB)
        maxWidthOrHeight: 1920, // Was 1024
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.85,   // Was 0.8
    })

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".webp",
        { type: "image/webp", lastModified: Date.now() }
    )
}
```

**Step 2: Update the comment at top of file**

```ts
// Line 6: Gallery images (cafe gallery): WebP, 200KB, 1920px
```

**Step 3: Test**

Upload a gallery image. Check it looks crisp on retina.

**Step 4: Commit**

```bash
git add utils/image-processing.ts
git commit -m "fix: increase gallery image resolution to 1920px for retina displays"
```

---

### Task 4: Increase Review Image Resolution and Quality

**Problem:** `compressReviewImage` caps at 1200px at 150KB. Review photos (food, drinks) should look crisp.

**Fix:** Increase to 1920px at 250KB with 0.85 quality.

**Files:**
- Modify: `utils/image-processing.ts:71-85`

**Step 1: Update compressReviewImage**

```ts
export async function compressReviewImage(file: File): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.25,       // Was 0.15 (150KB)
        maxWidthOrHeight: 1920, // Was 1200
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.85,   // Was 0.8
    })

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".webp",
        { type: "image/webp", lastModified: Date.now() }
    )
}
```

**Step 2: Update comment at top of file**

```ts
// Line 7: Review images: WebP, 250KB, 1920px
```

**Step 3: Test**

Upload a review with photos. Verify crispness.

**Step 4: Commit**

```bash
git add utils/image-processing.ts
git commit -m "fix: increase review image quality to 1920px at 250KB"
```

---

### Task 5: Increase Cover Image Quality

**Problem:** `compressCoverImage` uses 0.85 initialQuality at 250KB. For hero images, we can afford more headroom since Cloudflare Image Resizing handles responsive delivery.

**Fix:** Bump to 0.9 quality and 300KB.

**Files:**
- Modify: `utils/image-processing.ts:23-37`

**Step 1: Update compressCoverImage**

```ts
export async function compressCoverImage(file: File): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,        // Was 0.25
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.9,    // Was 0.85
    })

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".webp",
        { type: "image/webp", lastModified: Date.now() }
    )
}
```

**Step 2: Update comment**

```ts
// Line 5: Cover images (cafe thumbnails): WebP, 300KB, 1920px
```

**Step 3: Test**

Upload a cover image. Compare to before.

**Step 4: Commit**

```bash
git add utils/image-processing.ts
git commit -m "fix: increase cover image quality to 0.9 at 300KB"
```

---

### Task 6: Fix Avatar Upload -- Bypass compressAvatar, Use Direct Upload

**Problem:** `Profile.tsx:444-509` crops to AVATAR_SIZE, outputs JPEG 0.9, then uploads via `uploadAvatar()` WITHOUT calling `compressAvatar()`. The avatar upload path skips compression entirely. This is actually fine for quality, but the upload server action doesn't apply any compression either.

**Current flow (already correct):**
1. Cropper -> JPEG 0.9 blob
2. `Profile.tsx` -> Canvas resize to AVATAR_SIZE (square) -> JPEG 0.9 blob
3. `uploadAvatar()` -> direct to R2

**No fix needed.** Avatar quality is already high. But we should verify `AVATAR_SIZE` is reasonable.

**Files:**
- Check: `components/profile/Profile.tsx` for AVATAR_SIZE constant

**Step 1: Verify AVATAR_SIZE value**

Check if AVATAR_SIZE is at least 200px. If it's 400px or more, it's fine.

**Step 2: If needed, document**

Add a comment noting avatar flow is intentionally single-pass.

---

### Task 7: Expand Cloudflare Image Resizing to Gallery and Review Images

**Problem:** Cloudflare Image Resizing is only used for hero images. Gallery and review images miss out on responsive delivery and automatic AVIF/WebP selection.

**Fix:** Create a generic `getOptimizedImageUrl` function and apply it to `<img>` tags for gallery/review images.

**Files:**
- Modify: `utils/cloudflare-image.ts`
- Modify: Gallery image rendering components (search for `<img` with gallery URLs)

**Step 1: Add generic optimization function to cloudflare-image.ts**

```ts
/**
 * Get an optimized image URL for any CDN image.
 * Falls back to original URL if not from CDN.
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

/**
 * Generate srcSet for responsive images of any size.
 */
export function getResponsiveSrcSet(
    src: string,
    widths: number[] = [480, 768, 1024, 1920],
    quality = 80
): string {
    if (!src.includes(CDN_DOMAIN)) {
        return ""
    }

    return widths
        .map((w) => `${getOptimizedImageUrl({ src, width: w, quality })} ${w}w`)
        .join(", ")
}
```

**Step 2: Find gallery image rendering locations**

Search for where gallery images are rendered with `<img>` or Next.js `<Image>` tags. Apply `srcSet` and `sizes` attributes.

**Step 3: Apply to gallery components**

For each gallery image rendering location, use:
```tsx
<img
    src={getOptimizedImageUrl(url, { width: 1024 })}
    srcSet={getResponsiveSrcSet(url, [480, 768, 1024])}
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
    ...
/>
```

**Step 4: Test**

View gallery images on mobile and desktop. Verify responsive loading.

**Step 5: Commit**

```bash
git add utils/cloudflare-image.ts
git commit -m "feat: expand Cloudflare Image Resizing to all image types"
```

---

### Task 8: Add EXIF Orientation Handling to ImageCropper

**Problem:** Phone photos often have EXIF rotation metadata. The canvas `drawImage` in `ImageCropper.tsx` may not respect EXIF, causing rotated crops on some phone photos.

**Fix:** Use `createImageBitmap` which handles EXIF orientation automatically, or explicitly read EXIF and apply rotation.

**Files:**
- Modify: `components/ui/ImageCropper.tsx:46-68`

**Step 1: Replace createImage with createImageBitmap for EXIF-aware rendering**

```tsx
const createCroppedImage = async () => {
    if (!croppedAreaPixels || !imageUrl) return

    setProcessing(true)

    try {
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const bitmap = await createImageBitmap(blob)

        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        if (!ctx) {
            throw new Error("No 2d context")
        }

        canvas.width = croppedAreaPixels.width
        canvas.height = croppedAreaPixels.height

        ctx.drawImage(
            bitmap,
            croppedAreaPixels.x,
            croppedAreaPixels.y,
            croppedAreaPixels.width,
            croppedAreaPixels.height,
            0,
            0,
            croppedAreaPixels.width,
            croppedAreaPixels.height
        )

        bitmap.close()

        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    console.error("Canvas is empty")
                    return
                }
                onComplete(blob)
                setProcessing(false)
            },
            "image/png"
        )
    } catch (e) {
        console.error(e)
        setProcessing(false)
    }
}
```

**Step 2: Remove unused createImage function** (lines 175-183)

**Step 3: Test**

Upload a photo taken in portrait mode on a phone. Verify crop orientation is correct.

**Step 4: Commit**

```bash
git add components/ui/ImageCropper.tsx
git commit -m "fix: use createImageBitmap for proper EXIF orientation in cropper"
```

---

### Task 9: Add EXIF Handling to checkAspectRatio

**Problem:** `checkAspectRatio` in `cafe-form.ts:55-70` loads images via `new Image()`. If the image has EXIF rotation, `img.width` and `img.height` may report the pre-rotation dimensions, causing incorrect aspect ratio detection.

**Fix:** Use `createImageBitmap` for EXIF-aware dimension reading.

**Files:**
- Modify: `utils/hooks/cafe-form.ts:55-70`

**Step 1: Rewrite checkAspectRatio with createImageBitmap**

```ts
export const checkAspectRatio = async (file: File): Promise<boolean> => {
    const bitmap = await createImageBitmap(file)
    const aspect = bitmap.width / bitmap.height
    bitmap.close()
    return Math.abs(aspect - 16 / 9) < 0.05
}
```

**Step 2: Test**

Upload a portrait-mode phone photo as a cover. Verify it correctly detects non-16:9 and opens the cropper.

**Step 3: Commit**

```bash
git add utils/hooks/cafe-form.ts
git commit -m "fix: use createImageBitmap in checkAspectRatio for EXIF-aware detection"
```

---

### Task 10: Add Quality Floor Guard to Compression Functions

**Problem:** `browser-image-compression` can reduce quality below `initialQuality` to meet `maxSizeMB`. For very detailed photos, this can drop quality to 0.3-0.5, causing severe blurriness.

**Fix:** Add a post-compression size check. If the output is smaller than a minimum threshold (indicating heavy quality loss), warn in console or increase maxSizeMB.

**Files:**
- Modify: `utils/image-processing.ts`

**Step 1: Add a helper to check compression result quality**

```ts
/**
 * Warn if an image was compressed too aggressively.
 * browser-image-compression can drop quality below initialQuality to meet size targets.
 */
function logCompressionResult(originalSize: number, compressedSize: number, label: string) {
    const ratio = compressedSize / originalSize
    if (ratio < 0.1) {
        console.warn(
            `[ImageCompression] ${label}: Heavy compression (${(ratio * 100).toFixed(1)}% of original). ` +
            `Original: ${formatFileSize(originalSize)}, Compressed: ${formatFileSize(compressedSize)}. ` +
            `Consider increasing maxSizeMB.`
        )
    }
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
```

**Step 2: Add logging to each compression function**

For each function, after compression:
```ts
logCompressionResult(file.size, compressed.size, "coverImage")
```

**Step 3: Test**

Upload a very large/detailed photo. Check console for warnings.

**Step 4: Commit**

```bash
git add utils/image-processing.ts
git commit -m "feat: add compression quality floor warnings to image processing"
```

---

### Task 11: Increase Menu Photo Limits

**Problem:** Menu photos are capped at 800x800 and 150KB. Food photography needs more detail.

**Fix:** Increase to 1200px and 200KB with 0.85 quality.

**Files:**
- Modify: `components/cafe-editor/MenuItemModal.tsx:140-146`

**Step 1: Update compression options**

```tsx
const compressedBlob = await imageCompression(croppedFile, {
    maxSizeMB: 0.2,          // Was 0.15
    maxWidthOrHeight: 1200,   // Was 800
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.85,
})
```

**Step 2: Test**

Upload a menu item photo. Check detail quality.

**Step 3: Commit**

```bash
git add components/cafe-editor/MenuItemModal.tsx
git commit -m "fix: increase menu photo resolution to 1200px at 200KB"
```

---

### Task 12: Update Bucket Size Limits for Higher Quality Uploads

**Problem:** With increased compression sizes, we need to verify R2 bucket max file size configs still work.

**Files:**
- Check: `utils/storage/types.ts:137-198` (BUCKET_CONFIGS)

**Step 1: Verify bucket limits**

Current limits:
- `cafes`: 5MB (images max ~300KB after compression -- fine)
- `reviews`: 5MB (images max ~250KB after compression -- fine)
- `avatars`: 2MB (max ~100KB after compression -- fine)
- `menu-photos`: 2MB (max ~200KB after compression -- fine)
- `blogs`: 10MB (fine)
- `events`: 5MB (fine)

No changes needed. All compressed sizes are well within limits.

**Step 2: Document findings**

No code changes required.

---

### Task 13: Write Tests for Image Processing

**Files:**
- Create: `utils/__tests__/image-processing.test.ts`

**Step 1: Write test for compression function signatures and type validation**

```ts
import { describe, it, expect } from "bun:test"

describe("Image Processing", () => {
    describe("compression function exports", () => {
        it("should export all compression functions", async () => {
            const mod = await import("@/utils/image-processing")
            expect(typeof mod.compressCoverImage).toBe("function")
            expect(typeof mod.compressGalleryImage).toBe("function")
            expect(typeof mod.compressReviewImage).toBe("function")
            expect(typeof mod.compressBlogCover).toBe("function")
            expect(typeof mod.compressEventCover).toBe("function")
            expect(typeof mod.compressCollectionCover).toBe("function")
            expect(typeof mod.compressAvatar).toBe("function")
        })

        it("should have compressEventCover as alias of compressBlogCover", async () => {
            const mod = await import("@/utils/image-processing")
            expect(mod.compressEventCover).toBe(mod.compressBlogCover)
        })
    })
})
```

**Step 2: Run tests**

```bash
bun test utils/__tests__/image-processing.test.ts
```

**Step 3: Commit**

```bash
git add utils/__tests__/image-processing.test.ts
git commit -m "test: add image processing function export tests"
```

---

### Task 14: Write Tests for checkAspectRatio

**Files:**
- Create: `utils/__tests__/check-aspect-ratio.test.ts`

**Step 1: Write test**

```ts
import { describe, it, expect } from "bun:test"
import { checkAspectRatio } from "@/utils/hooks/cafe-form"

describe("checkAspectRatio", () => {
    it("should be a function", () => {
        expect(typeof checkAspectRatio).toBe("function")
    })

    it("should return a promise", () => {
        // Can't easily test with real images in JSDOM,
        // but we can verify the function signature
        const mockFile = new File([""], "test.jpg", { type: "image/jpeg" })
        const result = checkAspectRatio(mockFile)
        expect(result).toBeInstanceOf(Promise)
    })
})
```

**Step 2: Run tests**

```bash
bun test utils/__tests__/check-aspect-ratio.test.ts
```

**Step 3: Commit**

```bash
git add utils/__tests__/check-aspect-ratio.test.ts
git commit -m "test: add checkAspectRatio function signature tests"
```

---

### Task 15: Run Full Lint Check

**Step 1: Run lint**

```bash
bun lint
```

**Step 2: Fix any issues**

**Step 3: Commit fixes if needed**

---

## Summary of Changes

| Area | Before | After | Impact |
|------|--------|-------|--------|
| **Double compression** | JPEG 0.9 -> WebP 0.85 | PNG lossless -> WebP 0.85 | Eliminates generational loss |
| **Gallery resolution** | 1024px / 120KB / 0.8 | 1920px / 200KB / 0.85 | Retina-crisp on all screens |
| **Review resolution** | 1200px / 150KB / 0.8 | 1920px / 250KB / 0.85 | Crisp food/drink photos |
| **Cover quality** | 250KB / 0.85 | 300KB / 0.9 | Sharper hero images |
| **Menu photos** | 800px / 150KB | 1200px / 200KB / 0.85 | Better food detail |
| **EXIF handling** | `new Image()` (unreliable) | `createImageBitmap` (correct) | Fixes rotated crops |
| **Compression guard** | None | Console warnings at <10% ratio | Early detection of quality loss |
| **Responsive delivery** | Hero only | All CDN images | AVIF/WebP + responsive srcSet |

## Additional Suggestions (Future)

1. **Server-side compression with Sharp** -- Move compression to a server action using `sharp` for consistent, high-quality results regardless of browser capabilities. Would also allow progressive JPEG encoding.

2. **Blurhash/LQIP placeholders** -- Generate blurhash or Low Quality Image Placeholders during upload for instant loading while full images load. Libraries: `blurhash`, `lqip-modern`.

3. **WebP fallback** -- Add `<picture>` elements with JPEG fallback for browsers that don't support WebP. `browser-image-compression` outputs WebP; older Safari versions may not render them.

4. **Image upload progress indicators** -- Already implemented for some flows (`uploadWithProgress`). Extend to all upload paths for better UX on slow connections.

5. **EXIF stripping** -- Strip EXIF data (GPS coordinates, device info) from uploaded images for privacy. `browser-image-compression` does this by default, but verify it works with all upload paths.

6. **Batch upload optimization** -- Gallery uploads process files sequentially. Consider parallel uploads with concurrency limit (e.g., 3 at a time) for faster multi-image uploads.

7. **Image format auto-detection** -- Detect if the source image is already WebP/AVIF and preserve the format instead of re-encoding to JPEG/WebP.

8. **Progressive image loading** -- Use `loading="lazy"` and progressive JPEG/WebP for below-the-fold images.


