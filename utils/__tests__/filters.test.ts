import { describe, it, expect, mock, afterEach } from "bun:test"
import { getProductionFilter, omitTestCafes } from "@/utils/filters"
import { cafes } from "@/db/schema"
import { eq, and, SQL } from "drizzle-orm"

describe("getProductionFilter", () => {
  afterEach(() => {
    // Reset NODE_ENV
  })

  it("returns isTest=false filter in production", () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    
    const filter = getProductionFilter()
    expect(filter).not.toBeUndefined()
    
    process.env.NODE_ENV = originalEnv
  })

  it("returns undefined in development", () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "development"
    
    const filter = getProductionFilter()
    expect(filter).toBeUndefined()
    
    process.env.NODE_ENV = originalEnv
  })

  it("returns undefined when NODE_ENV is not set", () => {
    const originalEnv = process.env.NODE_ENV
    delete (process.env as Record<string, string | undefined>).NODE_ENV
    
    const filter = getProductionFilter()
    expect(filter).toBeUndefined()
    
    process.env.NODE_ENV = originalEnv
  })
})

describe("omitTestCafes", () => {
  it("adds isTest=false to existing conditions array in production", () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"

    const conditions: (SQL | undefined)[] = [eq(cafes.isPublished, true)]
    const result = omitTestCafes(conditions)
    
    expect(result.length).toBe(2)
    
    process.env.NODE_ENV = originalEnv
  })

  it("does not modify conditions array in development", () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "development"

    const conditions: (SQL | undefined)[] = [eq(cafes.isPublished, true)]
    const before = conditions.length
    const result = omitTestCafes(conditions)
    
    expect(result.length).toBe(before)
    
    process.env.NODE_ENV = originalEnv
  })
})