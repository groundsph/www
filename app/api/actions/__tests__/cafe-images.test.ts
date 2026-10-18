import { describe, it, expect } from "bun:test"

const adminSource = await Bun.file("app/api/actions/admin.ts").text()
const ownerSource = await Bun.file("app/api/actions/owner.ts").text()

describe("updateCafeImages (admin)", () => {
    it("is exported", () => {
        expect(/export async function updateCafeImages\(/.test(adminSource)).toBe(true)
    })

    it("validates the patch and revalidates the preview", () => {
        const body = adminSource.slice(adminSource.indexOf("export async function updateCafeImages("))
        expect(body).toContain("parseCafeImagesPatch")
        expect(body).toContain('revalidatePath("/manage/preview/[id]"')
    })

    it("logs the change against the cafe id", () => {
        const body = adminSource.slice(adminSource.indexOf("export async function updateCafeImages("))
        expect(body).toContain('logSystemAction(\n            "update",\n            "cafe",\n            cafeId,')
    })

    it("accepts a null thumbnail in updateCafe's payload type", () => {
        expect(/thumbnail: string \| null/.test(adminSource)).toBe(true)
    })
})

describe("updateCafeImagesAsOwner (owner)", () => {
    it("is exported and ownership-checked", () => {
        const body = ownerSource.slice(ownerSource.indexOf("export async function updateCafeImagesAsOwner("))
        expect(body.length).toBeGreaterThan(0)
        expect(body).toContain("isOwnerOfCafe(cafeId)")
    })

    it("accepts thumbnail and gallery in the owner update type", () => {
        const typeBlock = ownerSource.slice(
            ownerSource.indexOf("export async function updateCafeAsOwner("),
        )
        expect(typeBlock.slice(0, 3000)).toContain("thumbnail: string | null")
        expect(typeBlock.slice(0, 3000)).toContain("gallery: string[]")
    })
})
