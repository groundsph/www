import { describe, it, expect, afterEach } from "bun:test"
import {
    getTestCafeFilter,
    omitTestCafes,
    publicCafeConditions,
    shouldShowTestCafes,
} from "@/utils/filters"

/**
 * The gate is inverted on purpose: test cafes are hidden by default and only a
 * development build shows them. These tests therefore assert the *default* is
 * hidden for every other environment, including `test` and an unset NODE_ENV —
 * the two cases the old implementation let through.
 */

const originalNodeEnv = process.env.NODE_ENV

function setNodeEnv(value: string | undefined) {
    if (value === undefined) {
        delete (process.env as Record<string, string | undefined>).NODE_ENV
    } else {
        process.env.NODE_ENV = value
    }
}

afterEach(() => {
    setNodeEnv(originalNodeEnv)
})

describe("shouldShowTestCafes", () => {
    it("is true only in a development build", () => {
        setNodeEnv("development")
        expect(shouldShowTestCafes()).toBe(true)
    })

    it("is false in production", () => {
        setNodeEnv("production")
        expect(shouldShowTestCafes()).toBe(false)
    })

    it("is false when NODE_ENV is unset", () => {
        setNodeEnv(undefined)
        expect(shouldShowTestCafes()).toBe(false)
    })

    it("is false under the test runner", () => {
        setNodeEnv("test")
        expect(shouldShowTestCafes()).toBe(false)
    })
})

describe("getTestCafeFilter", () => {
    it("returns a predicate outside development", () => {
        for (const env of ["production", "test", undefined]) {
            setNodeEnv(env)
            expect(getTestCafeFilter()).toBeDefined()
        }
    })

    it("returns undefined in development", () => {
        setNodeEnv("development")
        expect(getTestCafeFilter()).toBeUndefined()
    })
})

describe("omitTestCafes", () => {
    it("appends exactly one condition outside development", () => {
        setNodeEnv("production")
        expect(omitTestCafes([])).toHaveLength(1)
    })

    it("is a no-op in development", () => {
        setNodeEnv("development")
        expect(omitTestCafes([])).toHaveLength(0)
    })

    it("keeps the conditions it was given", () => {
        setNodeEnv("production")
        const existing = omitTestCafes([])
        const marker = existing[0]
        const result = omitTestCafes(existing)
        expect(result).toHaveLength(2)
        expect(result[0]).toBe(marker)
    })
})

describe("publicCafeConditions", () => {
    it("hides test, draft and deactivated cafes by default", () => {
        setNodeEnv("production")
        expect(publicCafeConditions()).toHaveLength(3)
    })

    it("hides test cafes under the test runner", () => {
        setNodeEnv("test")
        expect(publicCafeConditions()).toHaveLength(3)
    })

    it("drops the test predicate in development but keeps draft filtering", () => {
        setNodeEnv("development")
        expect(publicCafeConditions()).toHaveLength(2)
    })

    it("relaxes draft filtering for owner and admin surfaces", () => {
        setNodeEnv("production")
        expect(publicCafeConditions({ includeDrafts: true })).toHaveLength(1)
    })

    it("relaxes test filtering for internal tooling", () => {
        setNodeEnv("production")
        expect(publicCafeConditions({ includeTest: true })).toHaveLength(2)
    })

    it("returns nothing when fully relaxed", () => {
        setNodeEnv("production")
        expect(
            publicCafeConditions({ includeDrafts: true, includeTest: true })
        ).toHaveLength(0)
    })

    it("returns a fresh array per call so callers cannot corrupt each other", () => {
        setNodeEnv("production")
        const first = publicCafeConditions()
        first.push(undefined)
        expect(publicCafeConditions()).toHaveLength(3)
    })
})
