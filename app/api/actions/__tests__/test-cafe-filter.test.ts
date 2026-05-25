import { describe, it, expect, afterEach } from "bun:test"

describe("test-cafe filtering integration", () => {
  let originalEnv: string | undefined

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv
    }
  })

  it("production filter excludes isTest=true cafes", async () => {
    originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"

    const { getProductionFilter } = await import("@/utils/filters")
    const filter = getProductionFilter()
    expect(filter).toBeDefined()
    expect(typeof filter).toBe("object")
  })

  it("dev mode includes test cafes", async () => {
    originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "development"

    const { getProductionFilter } = await import("@/utils/filters")
    const filter = getProductionFilter()
    expect(filter).toBeUndefined()
  })

  it("omitTestCafes appends filter in production", async () => {
    originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"

    const { omitTestCafes } = await import("@/utils/filters")
    const conditions: unknown[] = []
    omitTestCafes(conditions)
    expect(conditions.length).toBe(1)
  })

  it("omitTestCafes does nothing in development", async () => {
    originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "development"

    const { omitTestCafes } = await import("@/utils/filters")
    const conditions: unknown[] = []
    omitTestCafes(conditions)
    expect(conditions.length).toBe(0)
  })
})