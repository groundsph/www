import { describe, it, expect, beforeEach, mock } from "bun:test"

// Track mock calls
let mockListApiKeysCalls: unknown[] = []
let mockCreateApiKeyCalls: unknown[] = []
let mockDeleteApiKeyCalls: unknown[] = []

// Mock auth functions
let mockListApiKeysReturn: unknown[] = []
let mockCreateApiKeyReturn: { key: string } | null = null
let mockDeleteApiKeyError: Error | null = null
let mockCreateApiKeyError: Error | null = null
let mockListApiKeysError: Error | null = null

// Mock user session and profile
let mockSession: { user: { id: string } } | null = null
let mockUserRole: string | null = null

// Mock next/headers
mock.module("next/headers", () => ({
    headers: () =>
        Promise.resolve({
            get: () => null,
        }),
}))

// Mock auth
mock.module("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: () => Promise.resolve(mockSession),
            listApiKeys: (...args: unknown[]) => {
                mockListApiKeysCalls.push(args)
                if (mockListApiKeysError) {
                    return Promise.reject(mockListApiKeysError)
                }
                return Promise.resolve(mockListApiKeysReturn)
            },
            createApiKey: (...args: unknown[]) => {
                mockCreateApiKeyCalls.push(args)
                if (mockCreateApiKeyError) {
                    return Promise.reject(mockCreateApiKeyError)
                }
                return Promise.resolve(mockCreateApiKeyReturn)
            },
            deleteApiKey: (...args: unknown[]) => {
                mockDeleteApiKeyCalls.push(args)
                if (mockDeleteApiKeyError) {
                    return Promise.reject(mockDeleteApiKeyError)
                }
                return Promise.resolve(undefined)
            },
        },
    },
}))

// Create a proper Drizzle-like query builder mock for db
interface QueryBuilder {
    select: () => QueryBuilder
    from: () => QueryBuilder
    where: () => QueryBuilder
    limit: () => Promise<{ role: string | null }[]>
}

const createMockQueryBuilder = (): QueryBuilder => {
    const builder: QueryBuilder = {
        select: () => builder,
        from: () => builder,
        where: () => builder,
        limit: () => Promise.resolve([{ role: mockUserRole }]),
    }
    return builder
}

// Mock the database
mock.module("@/db", () => ({
    db: createMockQueryBuilder(),
}))

// Import the actual functions after mocking
const {
    listApiKeys,
    createApiKey,
    deleteApiKey,
} = await import("../api-keys")

describe("API Key Actions", () => {
    beforeEach(() => {
        // Reset all mocks and state
        mockListApiKeysCalls = []
        mockCreateApiKeyCalls = []
        mockDeleteApiKeyCalls = []
        mockListApiKeysReturn = []
        mockCreateApiKeyReturn = { key: "test-key-123" }
        mockDeleteApiKeyError = null
        mockCreateApiKeyError = null
        mockListApiKeysError = null
        mockSession = null
        mockUserRole = null
    })

    describe("listApiKeys", () => {
        it("returns error for unauthorized user (not logged in)", async () => {
            mockSession = null

            const result = await listApiKeys()

            expect(result.success).toBe(false)
            expect(result.error).toBe("Not authorized")
        })

        it("returns error for regular user (non-admin/moderator)", async () => {
            mockSession = { user: { id: "user123" } }
            mockUserRole = "user"

            const result = await listApiKeys()

            expect(result.success).toBe(false)
            expect(result.error).toBe("Not authorized")
        })

        it("returns list of API keys for admin user", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"
            mockListApiKeysReturn = [
                {
                    id: "key1",
                    name: "Test Key 1",
                    prefix: "pk_test_",
                    createdAt: new Date("2024-01-01"),
                    expiresAt: null,
                },
                {
                    id: "key2",
                    name: "Test Key 2",
                    prefix: "pk_live_",
                    createdAt: new Date("2024-01-15"),
                    expiresAt: new Date("2025-01-15"),
                },
            ]

            const result = await listApiKeys()

            expect(result.success).toBe(true)
            expect(result.data?.keys).toHaveLength(2)
            expect(result.data?.keys?.[0].id).toBe("key1")
            expect(result.data?.keys?.[0].name).toBe("Test Key 1")
            expect(result.data?.keys?.[0].prefix).toBe("pk_test_")
            expect(result.data?.keys?.[1].id).toBe("key2")
        })

        it("returns list of API keys for moderator user", async () => {
            mockSession = { user: { id: "mod123" } }
            mockUserRole = "moderator"
            mockListApiKeysReturn = [
                {
                    id: "key3",
                    name: "Moderator Key",
                    prefix: "pk_mod_",
                    createdAt: new Date("2024-02-01"),
                    expiresAt: null,
                },
            ]

            const result = await listApiKeys()

            expect(result.success).toBe(true)
            expect(result.data?.keys).toHaveLength(1)
            expect(result.data?.keys?.[0].name).toBe("Moderator Key")
        })

        it("returns empty array when user has no API keys", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"
            mockListApiKeysReturn = []

            const result = await listApiKeys()

            expect(result.success).toBe(true)
            expect(result.data?.keys).toEqual([])
        })

        it("handles errors gracefully when listApiKeys fails", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"
            mockListApiKeysError = new Error("Database error")

            const consoleSpy = mock(console.error, () => {})
            const result = await listApiKeys()
            consoleSpy.mockRestore()

            expect(result.success).toBe(false)
            expect(result.error).toBe("Failed to list API keys")
        })
    })

    describe("createApiKey", () => {
        it("returns error for unauthorized user", async () => {
            mockSession = null

            const result = await createApiKey("Test Key")

            expect(result.success).toBe(false)
            expect(result.error).toBe("Not authorized")
        })

        it("returns error when user has max keys (3)", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"
            mockListApiKeysReturn = [
                { id: "key1", name: "Key 1" },
                { id: "key2", name: "Key 2" },
                { id: "key3", name: "Key 3" },
            ]

            const result = await createApiKey("Test Key")

            expect(result.success).toBe(false)
            expect(result.error).toBe("Maximum of 3 API keys allowed")
        })

        it("creates key successfully with name", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"
            mockListApiKeysReturn = [{ id: "key1", name: "Existing Key" }]
            mockCreateApiKeyReturn = { key: "new-key-value-123" }

            const result = await createApiKey("My New Key")

            expect(result.success).toBe(true)
            expect(result.data?.key).toBe("new-key-value-123")
            expect(mockCreateApiKeyCalls).toHaveLength(1)
            const callArgs = mockCreateApiKeyCalls[0] as [{ body: { name: string } }]
            expect(callArgs[0].body.name).toBe("My New Key")
        })

        it("creates key successfully without name", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"
            mockListApiKeysReturn = []
            mockCreateApiKeyReturn = { key: "unnamed-key-456" }

            const result = await createApiKey()

            expect(result.success).toBe(true)
            expect(result.data?.key).toBe("unnamed-key-456")
            const callArgs = mockCreateApiKeyCalls[0] as [{ body: { name?: string } }]
            expect(callArgs[0].body.name).toBeUndefined()
        })

        it("creates key with expiration date", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"
            mockListApiKeysReturn = []
            mockCreateApiKeyReturn = { key: "expiring-key-789" }

            const expirationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
            const result = await createApiKey("Expiring Key", expirationDate)

            expect(result.success).toBe(true)
            const callArgs = mockCreateApiKeyCalls[0] as [{ body: { expiresIn?: number } }]
            expect(callArgs[0].body.expiresIn).toBeDefined()
            // Should be approximately 7 days in seconds (604800)
            expect(callArgs[0].body.expiresIn).toBeGreaterThan(604700)
            expect(callArgs[0].body.expiresIn).toBeLessThan(604900)
        })

        it("creates key with name and expiration", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"
            mockListApiKeysReturn = [{ id: "key1", name: "Existing Key" }]
            mockCreateApiKeyReturn = { key: "full-key-abc" }

            const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            const result = await createApiKey("Named Expiring Key", expirationDate)

            expect(result.success).toBe(true)
            const callArgs = mockCreateApiKeyCalls[0] as [{ body: { name: string; expiresIn?: number } }]
            expect(callArgs[0].body.name).toBe("Named Expiring Key")
            expect(callArgs[0].body.expiresIn).toBeDefined()
        })

        it("handles errors gracefully when createApiKey fails", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"
            mockListApiKeysReturn = []
            mockCreateApiKeyError = new Error("Creation failed")

            const consoleSpy = mock(console.error, () => {})
            const result = await createApiKey("Test")
            consoleSpy.mockRestore()

            expect(result.success).toBe(false)
            expect(result.error).toBe("Failed to create API key")
        })
    })

    describe("deleteApiKey", () => {
        it("returns error for unauthorized user (not logged in)", async () => {
            mockSession = null

            const result = await deleteApiKey("key-to-delete")

            expect(result.success).toBe(false)
            expect(result.error).toBe("Not authorized")
        })

        it("returns error for regular user", async () => {
            mockSession = { user: { id: "user123" } }
            mockUserRole = "user"

            const result = await deleteApiKey("key-to-delete")

            expect(result.success).toBe(false)
            expect(result.error).toBe("Not authorized")
        })

        it("deletes key successfully for admin user", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"

            const result = await deleteApiKey("key-123")

            expect(result.success).toBe(true)
            expect(mockDeleteApiKeyCalls).toHaveLength(1)
            const callArgs = mockDeleteApiKeyCalls[0] as [{ body: { keyId: string } }]
            expect(callArgs[0].body.keyId).toBe("key-123")
        })

        it("deletes key successfully for moderator user", async () => {
            mockSession = { user: { id: "mod123" } }
            mockUserRole = "moderator"

            const result = await deleteApiKey("key-456")

            expect(result.success).toBe(true)
            const callArgs = mockDeleteApiKeyCalls[0] as [{ body: { keyId: string } }]
            expect(callArgs[0].body.keyId).toBe("key-456")
        })

        it("handles errors gracefully when deleteApiKey fails", async () => {
            mockSession = { user: { id: "admin123" } }
            mockUserRole = "admin"
            mockDeleteApiKeyError = new Error("Deletion failed")

            const consoleSpy = mock(console.error, () => {})
            const result = await deleteApiKey("key-123")
            consoleSpy.mockRestore()

            expect(result.success).toBe(false)
            expect(result.error).toBe("Failed to delete API key")
        })
    })
})
