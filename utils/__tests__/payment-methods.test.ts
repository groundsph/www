import { describe, it, expect } from "bun:test"
import {
    PAYMENT_METHODS,
    PAYMENT_METHOD_LABELS,
    normalizePaymentMethods,
    normalizePaymentMethod,
    serializePaymentMethods,
    formatPaymentMethods,
    addPaymentMethods,
    togglePaymentMethod,
} from "@/utils/payment-methods"

describe("payment method taxonomy", () => {
    it("exposes the canonical tokens in display order", () => {
        expect(PAYMENT_METHODS).toEqual([
            "cash",
            "card",
            "gcash",
            "maya",
            "qr_ph",
            "google_pay",
            "apple_pay",
        ])
    })

    it("has a label for every canonical token", () => {
        for (const token of PAYMENT_METHODS) {
            expect(PAYMENT_METHOD_LABELS[token]).toBeTruthy()
        }
    })
})

describe("normalizePaymentMethods", () => {
    it("merges credit and debit into card", () => {
        expect(normalizePaymentMethods("credit_card")).toEqual(["card"])
        expect(normalizePaymentMethods("debit_card")).toEqual(["card"])
    })

    it("folds both QR rails and the BPI free text into qr_ph", () => {
        expect(normalizePaymentMethods("qrph")).toEqual(["qr_ph"])
        expect(normalizePaymentMethods("bank_transfer")).toEqual(["qr_ph"])
        expect(normalizePaymentMethods("BPI")).toEqual(["qr_ph"])
    })

    it("collapses the duplicate card tokens without losing other methods", () => {
        expect(
            normalizePaymentMethods("cash, credit_card, debit_card, gcash")
        ).toEqual(["cash", "card", "gcash"])
    })

    it("collapses a real production row that lists both QR rails", () => {
        expect(
            normalizePaymentMethods("cash, credit_card, debit_card, qrph, bank_transfer, gcash")
        ).toEqual(["cash", "card", "qr_ph", "gcash"])
    })

    it("preserves first-occurrence order", () => {
        expect(
            normalizePaymentMethods("gcash, cash, maya")
        ).toEqual(["gcash", "cash", "maya"])
    })

    it("tolerates whitespace and inconsistent casing", () => {
        expect(normalizePaymentMethods("  cash ,  GCash  , Maya ")).toEqual([
            "cash",
            "gcash",
            "maya",
        ])
    })

    it("resolves natural free-text input an owner might type", () => {
        expect(normalizePaymentMethod("Credit Card")).toBe("card")
        expect(normalizePaymentMethod("Debit Card")).toBe("card")
        expect(normalizePaymentMethod("Bank Transfer")).toBe("qr_ph")
        expect(normalizePaymentMethod("QR Ph")).toBe("qr_ph")
        expect(normalizePaymentMethod("Google Pay")).toBe("google_pay")
        expect(normalizePaymentMethod("Apple Pay")).toBe("apple_pay")
        expect(normalizePaymentMethod("qr-ph")).toBe("qr_ph")
    })

    it("returns an empty list for empty input", () => {
        expect(normalizePaymentMethods("")).toEqual([])
        expect(normalizePaymentMethods(null)).toEqual([])
        expect(normalizePaymentMethods(undefined)).toEqual([])
        expect(normalizePaymentMethods(" , , ")).toEqual([])
    })

    it("keeps unknown custom values instead of dropping them", () => {
        expect(normalizePaymentMethods("Venmo")).toEqual(["venmo"])
        expect(normalizePaymentMethods("cash, Venmo")).toEqual([
            "cash",
            "venmo",
        ])
    })

    it("is idempotent, which the production backfill depends on", () => {
        const once = serializePaymentMethods(
            "cash, credit_card, debit_card, qrph, bank_transfer, BPI, gcash"
        )
        const twice = serializePaymentMethods(once)

        expect(twice).toBe(once)
        expect(once).toBe("cash, card, qr_ph, gcash")
    })
})

describe("serializePaymentMethods", () => {
    it("joins canonical tokens with a comma and space", () => {
        expect(serializePaymentMethods("cash,credit_card")).toBe("cash, card")
    })

    it("normalizes empty input to an empty string", () => {
        expect(serializePaymentMethods("")).toBe("")
        expect(serializePaymentMethods(null)).toBe("")
    })
})

describe("formatPaymentMethods", () => {
    it("renders canonical tokens as labels", () => {
        expect(formatPaymentMethods("cash, gcash")).toEqual(["Cash", "GCash"])
    })

    it("renders legacy tokens through the alias map", () => {
        expect(formatPaymentMethods("credit_card, debit_card")).toEqual([
            "Credit / Debit Card",
        ])
        expect(formatPaymentMethods("bank_transfer")).toEqual([
            "QR Ph / Bank Transfer",
        ])
    })

    it("labels the new wallet tokens", () => {
        expect(formatPaymentMethods("google_pay, apple_pay")).toEqual([
            "Google Pay",
            "Apple Pay",
        ])
    })

    it("title-cases unknown custom values", () => {
        expect(formatPaymentMethods("venmo")).toEqual(["Venmo"])
    })

    it("returns an empty list for nullish input", () => {
        expect(formatPaymentMethods(null)).toEqual([])
        expect(formatPaymentMethods(undefined)).toEqual([])
    })
})

/**
 * These mirror what the editor UI does on click. They live here rather than in
 * a jsdom render because several test files call `mock.module()` on shared
 * modules (`motion/react` among them), which leaks process-wide and makes any
 * component test that touches those imports order-dependent.
 */
describe("addPaymentMethods", () => {
    it("normalizes free-text entries onto canonical tokens", () => {
        expect(addPaymentMethods("cash", "Apple Pay, Venmo")).toBe(
            "cash, apple_pay, venmo"
        )
        expect(addPaymentMethods("cash", "Bank Transfer")).toBe("cash, qr_ph")
        expect(addPaymentMethods("cash", "Credit Card")).toBe("cash, card")
    })

    it("does not duplicate a method that is already stored", () => {
        expect(addPaymentMethods("cash, google_pay", "Google Pay")).toBe(
            "cash, google_pay"
        )
        expect(addPaymentMethods("cash, credit_card", "debit_card")).toBe(
            "cash, card"
        )
    })

    it("ignores blank entries", () => {
        expect(addPaymentMethods("cash", " , ")).toBe("cash")
    })
})

describe("togglePaymentMethod", () => {
    it("adds a method that is not present", () => {
        expect(togglePaymentMethod("cash", "google_pay")).toBe(
            "cash, google_pay"
        )
    })

    it("removes a method that is present", () => {
        expect(togglePaymentMethod("cash, maya", "maya")).toBe("cash")
    })

    it("drops both legacy card tokens in a single click", () => {
        expect(
            togglePaymentMethod("cash, credit_card, debit_card", "card")
        ).toBe("cash")
    })

    it("adds a Google Pay pill to a row stored with legacy tokens", () => {
        expect(
            togglePaymentMethod("cash, credit_card, debit_card, qrph", "google_pay")
        ).toBe("cash, card, qr_ph, google_pay")
    })

    it("emits only canonical tokens", () => {
        expect(togglePaymentMethod("bank_transfer", "apple_pay")).toBe(
            "qr_ph, apple_pay"
        )
    })
})
