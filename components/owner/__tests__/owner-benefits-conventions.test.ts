import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8")

const PAGE_FILES = [
    "components/owner/OwnerBenefits.tsx",
    "components/owner/OwnerScreenPreview.tsx",
    "components/owner/owner-benefits-content.ts",
    "app/for-owners/page.tsx",
]

describe("owner benefits page — styling conventions", () => {
    it("ships no client components", () => {
        for (const file of PAGE_FILES) {
            const source = read(file)
            expect(source.includes('"use client"')).toBe(false)
            expect(source.includes("'use client'")).toBe(false)
        }
    })

    it("uses Tailwind v4 gradient utilities only", () => {
        for (const file of PAGE_FILES) {
            expect(read(file).includes("bg-gradient-to-")).toBe(false)
        }
    })

    it("adds no dark mode variants", () => {
        for (const file of PAGE_FILES) {
            expect(read(file).includes("dark:")).toBe(false)
        }
    })

    it("never uses the low-contrast secondary token for text", () => {
        for (const file of PAGE_FILES) {
            expect(read(file).includes("text-secondary")).toBe(false)
        }
    })

    it("does not hand-roll cursor-pointer", () => {
        for (const file of PAGE_FILES) {
            expect(read(file).includes("cursor-pointer")).toBe(false)
        }
    })

    it("uses theme tokens rather than raw hex colours", () => {
        const hex = /#[0-9a-fA-F]{3,8}\b/
        for (const file of PAGE_FILES) {
            expect(hex.test(read(file))).toBe(false)
        }
    })

    it("declares neither dynamic nor revalidate on the route", () => {
        const source = read("app/for-owners/page.tsx")
        expect(source.includes("export const dynamic")).toBe(false)
        expect(source.includes("export const revalidate")).toBe(false)
    })

    it("reads no request state and no user data", () => {
        for (const file of PAGE_FILES) {
            const source = read(file)
            expect(source.includes("searchParams")).toBe(false)
            expect(source.includes("getCurrentUser")).toBe(false)
            expect(source.includes('from "@/lib/auth"')).toBe(false)
            expect(source.includes('from "@/db"')).toBe(false)
        }
    })

    it("loads photos through next/image only, from the cafe CDN", () => {
        for (const file of PAGE_FILES) {
            expect(read(file).includes("<img")).toBe(false)
        }

        const preview = read("components/owner/OwnerScreenPreview.tsx")
        expect(preview.includes('from "next/image"')).toBe(true)

        const remoteUrls = preview.match(/https:\/\/[^"'`\s]+/g) ?? []
        expect(remoteUrls.length).toBeGreaterThan(0)
        for (const url of remoteUrls) {
            expect(url.startsWith("https://cdn.grounds.ph/")).toBe(true)
        }
    })
})
