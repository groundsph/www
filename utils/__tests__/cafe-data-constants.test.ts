import { describe, it, expect } from "bun:test"
import { PAYMENT_METHODS, STRAW_TYPES } from "@/utils/data/philippines"
import { DEFAULT_CAFE_SUBMISSION } from "@/utils/types/extra"

describe("cafe constants and defaults", () => {
    it("keeps payment method order and adds qrph", () => {
        expect(PAYMENT_METHODS).toEqual([
            "cash",
            "credit_card",
            "debit_card",
            "gcash",
            "maya",
            "qrph",
            "bank_transfer",
        ])
    })

    it("exposes straw types", () => {
        expect(STRAW_TYPES).toEqual([
            "plastic",
            "paper",
            "metal",
            "stalk",
            "other",
        ])
    })

    it("adds new defaults for halal and straw", () => {
        expect(DEFAULT_CAFE_SUBMISSION.is_halal_certified).toBe(false)
        expect(DEFAULT_CAFE_SUBMISSION.straw_type).toBe("")
        expect(DEFAULT_CAFE_SUBMISSION.straw_type_other).toBe("")
    })
})

