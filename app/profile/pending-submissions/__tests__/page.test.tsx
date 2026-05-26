import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"
import { render, screen, cleanup } from "@testing-library/react"

const mockGetCurrentUser = mock(() =>
    Promise.resolve({ id: "test-user-1", name: "Test User" }),
)
const mockGetUserPendingSubmissions = mock(() =>
    Promise.resolve([
        {
            id: "1",
            name: "Test Cafe",
            slug: "test-cafe",
            thumbnail: null,
            created_at: "2026-01-15T10:00:00.000Z",
            city_municipality: "Makati",
            province: "Metro Manila",
        },
    ]),
)

mock.module("@/lib/auth", () => ({
    getCurrentUser: mockGetCurrentUser,
}))

mock.module("next/navigation", () => ({
    redirect: (url: string) => {
        throw new Error(`REDIRECT:${url}`)
    },
}))

mock.module("@/app/api/actions/cafe", () => ({
    getUserPendingSubmissions: mockGetUserPendingSubmissions,
}))

mock.module("next/image", () => ({
    default: () => null,
}))

mock.module("next/link", () => ({
    default: ({ children }: { children: any }) => children,
}))

// eslint-disable-next-line @typescript-eslint/no-unused-vars
mock.module("@/utils/extras", () => ({
    getCafeThumbnailUrl: (thumbnail: string) => (thumbnail === "placeholder" ? "placeholder.jpg" : thumbnail),
}))

import PendingSubmissionsPage from "@/app/profile/pending-submissions/page"

describe("Pending Submissions page", () => {
    beforeEach(() => {
        mockGetCurrentUser.mockClear()
        mockGetUserPendingSubmissions.mockClear()
    })

    afterEach(() => {
        cleanup()
    })

    it("renders submissions list with cafe details", async () => {
        mockGetCurrentUser.mockImplementation(() =>
            Promise.resolve({ id: "test-user-1" }),
        )
        mockGetUserPendingSubmissions.mockImplementation(() =>
            Promise.resolve([
                {
                    id: "1",
                    name: "Test Cafe",
                    slug: "test-cafe",
                    thumbnail: "thumb1.jpg",
                    created_at: "2026-01-15T10:00:00.000Z",
                    city_municipality: "Makati",
                    province: "Metro Manila",
                },
            ]),
        )

        const element = await PendingSubmissionsPage()
        render(element)

        expect(screen.getByText("Test Cafe")).toBeTruthy()
        expect(screen.getByText("Makati, Metro Manila")).toBeTruthy()
        expect(screen.getByText("Pending Review")).toBeTruthy()
        expect(screen.getByText(/2026/i)).toBeTruthy()
    })

    it("shows empty state when no submissions", async () => {
        mockGetCurrentUser.mockImplementation(() =>
            Promise.resolve({ id: "test-user-1" }),
        )
        mockGetUserPendingSubmissions.mockImplementation(() =>
            Promise.resolve([]),
        )

        const element = await PendingSubmissionsPage()
        render(element)

        expect(screen.getByText("No pending submissions")).toBeTruthy()
        expect(screen.getByText("Submit a Cafe")).toBeTruthy()
    })

    it("redirects when not authenticated", async () => {
        mockGetCurrentUser.mockImplementation(() => Promise.resolve(null))

        let caught: Error | null = null
        try {
            await PendingSubmissionsPage()
        } catch (e) {
            caught = e as Error
        }

        expect(caught).not.toBeNull()
        expect(caught?.message).toContain("REDIRECT:/login")
    })
})
