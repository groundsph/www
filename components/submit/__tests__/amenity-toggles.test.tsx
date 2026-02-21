import { describe, it, expect } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import AmenityToggles from "@/components/submit/AmenityToggles"

describe("AmenityToggles", () => {
    it("toggles Halal Certified", () => {
        const onChange = (key: string, value: boolean) => {
            expect(key).toBe("is_halal_certified")
            expect(value).toBe(true)
        }
        const { getByText } = render(
            <AmenityToggles values={{ is_halal_certified: false }} onChange={onChange} />
        )
        fireEvent.click(getByText("Halal Certified"))
    })
})
