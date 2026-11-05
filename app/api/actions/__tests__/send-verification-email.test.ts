import { describe, it, expect, beforeEach, mock } from "bun:test"

type Row = Record<string, unknown>

let mockCurrentUser: { id: string } | null = { id: "admin-1" }
let mockRole = "admin"
/** Results handed out by consecutive `select()` calls, in order. */
let selectQueue: Row[][] = []
const sentEmails: { to: string; cafeName: string; cafeSlug: string; ownerName?: string }[] = []
let sendShouldFail = false

const makeSelectChain = () => {
    const chain: Record<string, unknown> = {
        from: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        groupBy: () => chain,
        limit: () => Promise.resolve(selectQueue.shift() ?? []),
        then: (
            resolve: (value: Row[]) => unknown,
            reject: (reason: unknown) => unknown
        ) => Promise.resolve(selectQueue.shift() ?? []).then(resolve, reject),
    }
    return chain
}

mock.module("next/headers", () => ({
    headers: () => Promise.resolve({ get: () => null }),
}))

mock.module("next/cache", () => ({
    revalidatePath: () => {},
    revalidateTag: () => {},
}))

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve(mockCurrentUser),
    auth: { api: {} },
}))

mock.module("@/utils/email", () => ({
    sendCafeApprovedEmail: () => Promise.resolve({ success: true }),
    sendCafeRejectedEmail: () => Promise.resolve({ success: true }),
    sendVerificationApprovedEmail: async (
        to: string,
        cafeName: string,
        cafeSlug: string,
        ownerName?: string
    ) => {
        sentEmails.push({ to, cafeName, cafeSlug, ownerName })
        return sendShouldFail
            ? { success: false, error: "resend rejected the message" }
            : { success: true, messageId: "msg-1" }
    },
}))

mock.module("@/utils/storage/actions", () => ({
    deleteCafeImagesAction: () => Promise.resolve({ success: true }),
    deleteSingleCafeImageAction: () => Promise.resolve({ success: true }),
    deleteReviewImagesAction: () => Promise.resolve({ success: true }),
    deleteBadgeImageAction: () => Promise.resolve({ success: true }),
    cleanupOrphanedImages: () => Promise.resolve({ success: true }),
    processAvatarDeletionQueue: () => Promise.resolve({ success: true }),
}))

mock.module("@/utils/badges/badge-logic", () => ({
    checkAndAwardBadges: () => Promise.resolve(),
}))

mock.module("@/utils/contribution-logging", () => ({
    logContribution: () => Promise.resolve(),
    getChangedFields: () => [],
    generateChangeSummary: () => "",
}))

mock.module("@/app/api/actions/system-logs", () => ({
    logSystemAction: () => Promise.resolve(),
}))

mock.module("@/db", () => ({
    db: {
        select: () => makeSelectChain(),
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
        insert: () => ({ values: () => Promise.resolve() }),
        delete: () => ({ where: () => Promise.resolve() }),
    },
}))

const { sendVerificationEmail } = await import("@/app/api/actions/admin")

describe("sendVerificationEmail", () => {
    beforeEach(() => {
        mockCurrentUser = { id: "admin-1" }
        mockRole = "admin"
        selectQueue = []
        sentEmails.length = 0
        sendShouldFail = false
    })

    it("sends to the requesting user's email and reports success", async () => {
        selectQueue = [
            [{ role: mockRole }],
            [
                {
                    id: "req-1",
                    userId: "user-1",
                    cafeName: "Kape Ni Juan",
                    cafeSlug: "kape-ni-juan",
                    ownerEmail: "owner@example.com",
                    ownerName: "Juan",
                },
            ],
        ]

        const result = await sendVerificationEmail("req-1")

        expect(result).toEqual({ success: true })
        expect(sentEmails.length).toBe(1)
        expect(sentEmails[0]).toEqual({
            to: "owner@example.com",
            cafeName: "Kape Ni Juan",
            cafeSlug: "kape-ni-juan",
            ownerName: "Juan",
        })
    })

    it("returns an error when the request has no recipient email", async () => {
        selectQueue = [
            [{ role: mockRole }],
            [
                {
                    id: "req-1",
                    userId: "user-1",
                    cafeName: "Kape Ni Juan",
                    cafeSlug: "kape-ni-juan",
                    ownerEmail: null,
                    ownerName: "Juan",
                },
            ],
        ]

        const result = await sendVerificationEmail("req-1")

        expect(result.success).toBe(false)
        expect(result.error).toBe("Requester has no email address on file")
        expect(sentEmails.length).toBe(0)
    })

    it("returns an error when the request does not exist", async () => {
        selectQueue = [[{ role: mockRole }], []]

        const result = await sendVerificationEmail("missing")

        expect(result.success).toBe(false)
        expect(result.error).toBe("Verification request not found")
        expect(sentEmails.length).toBe(0)
    })

    it("returns an error when the cafe is missing", async () => {
        selectQueue = [
            [{ role: mockRole }],
            [
                {
                    id: "req-1",
                    userId: "user-1",
                    cafeName: null,
                    cafeSlug: null,
                    ownerEmail: "owner@example.com",
                    ownerName: null,
                },
            ],
        ]

        const result = await sendVerificationEmail("req-1")

        expect(result.success).toBe(false)
        expect(result.error).toBe("Cafe for this verification request no longer exists")
        expect(sentEmails.length).toBe(0)
    })

    it("propagates a send failure instead of swallowing it", async () => {
        sendShouldFail = true
        selectQueue = [
            [{ role: mockRole }],
            [
                {
                    id: "req-1",
                    userId: "user-1",
                    cafeName: "Kape Ni Juan",
                    cafeSlug: "kape-ni-juan",
                    ownerEmail: "owner@example.com",
                    ownerName: "Juan",
                },
            ],
        ]

        const result = await sendVerificationEmail("req-1")

        expect(result.success).toBe(false)
        expect(result.error).toBe("resend rejected the message")
    })

    it("still rejects callers without an admin or moderator role", async () => {
        selectQueue = [[{ role: "user" }]]

        const result = await sendVerificationEmail("req-1")

        expect(result.success).toBe(false)
        expect(result.error).toBe("Unauthorized")
        expect(sentEmails.length).toBe(0)
    })
})
