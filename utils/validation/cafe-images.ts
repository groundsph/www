import { z } from "zod"

/**
 * Maximum number of gallery images a cafe may have. Enforced on the client
 * (upload queue) and here, so a crafted request cannot exceed it.
 */
export const MAX_CAFE_GALLERY = 12

/**
 * A public cafe asset URL. The folder segment is the uploader's user id for
 * legacy uploads and the cafe id for newer ones, so only the bucket folder,
 * the uuid segment and the image extension are required.
 */
const CAFE_ASSET_PATTERN = /^https?:\/\/[^/\s]+\/cafes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/?#\s]+\.(?:jpe?g|png|webp|avif|gif)$/i

export const cafeImageUrlSchema = z
    .string()
    .max(500)
    .refine((value) => CAFE_ASSET_PATTERN.test(value), {
        message: "Not a cafe image URL",
    })

export const cafeImagesPatchSchema = z
    .object({
        thumbnail: z.union([cafeImageUrlSchema, z.null()]).optional(),
        gallery: z.array(cafeImageUrlSchema).max(MAX_CAFE_GALLERY).optional(),
    })
    .strict()
    .refine(
        (patch) => patch.thumbnail !== undefined || patch.gallery !== undefined,
        { message: "Nothing to update" }
    )

export interface CafeImagesPatch {
    thumbnail?: string | null
    gallery?: string[]
}

export function parseCafeImagesPatch(
    input: unknown
): { ok: true; value: CafeImagesPatch } | { ok: false; error: string } {
    const parsed = cafeImagesPatchSchema.safeParse(input)
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid image update" }
    }
    return { ok: true, value: parsed.data }
}
