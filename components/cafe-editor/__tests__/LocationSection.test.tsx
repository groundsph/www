import { describe, it, expect, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"

// Mock LocationPicker — it uses Leaflet which needs a real browser
mock.module("@/components/submit/LocationPicker", () => ({
    default: () => null,
}))

import LocationSection from "@/components/cafe-editor/LocationSection"
import type { LocationData } from "@/components/cafe-editor/LocationSection"

const defaultData: LocationData = {
    region: "",
    province: "",
    city_municipality: "",
    address_display: "",
    area: null,
    lat: null,
    lng: null,
}

describe("LocationSection", () => {
    describe("readOnlyLocation mode", () => {
        it("renders read-only text inputs when readOnlyLocation=true", () => {
            const onChange = mock()
            const { container } = render(
                <LocationSection
                    data={{
                        ...defaultData,
                        region: "NCR - National Capital Region",
                        province: "Metro Manila",
                        city_municipality: "Makati",
                    }}
                    onChange={onChange}
                    readOnlyLocation={true}
                />
            )

            // Should render read-only inputs (not selects)
            const inputs = container.querySelectorAll("input[readonly]")
            expect(inputs.length).toBeGreaterThanOrEqual(3)

            // Should display current values
            const regionInput = container.querySelector(
                "input[value='NCR - National Capital Region']"
            )
            expect(regionInput).toBeTruthy()
        })
    })

    describe("editable dropdown mode", () => {
        it("renders select dropdowns when readOnlyLocation=false", () => {
            const onChange = mock()
            const { container } = render(
                <LocationSection
                    data={defaultData}
                    onChange={onChange}
                    readOnlyLocation={false}
                />
            )

            const selects = container.querySelectorAll("select")
            expect(selects.length).toBe(3)

            const regionSelect = selects[0]
            expect(regionSelect.querySelectorAll("option").length).toBeGreaterThan(1)
        })

        it("calls onChange with region and resets province/city on region change", () => {
            const onChange = mock()
            const { container } = render(
                <LocationSection
                    data={defaultData}
                    onChange={onChange}
                    readOnlyLocation={false}
                />
            )

            const regionSelect = container.querySelectorAll("select")[0]
            fireEvent.change(regionSelect, {
                target: { value: "Region VII - Central Visayas" },
            })

            // Region set + province/city reset
            expect(onChange).toHaveBeenCalledWith("region", "Region VII - Central Visayas")
            expect(onChange).toHaveBeenCalledWith("province", "")
            expect(onChange).toHaveBeenCalledWith("city_municipality", "")
        })

        it("disables province when no region selected", () => {
            const onChange = mock()
            const { container } = render(
                <LocationSection
                    data={defaultData}
                    onChange={onChange}
                    readOnlyLocation={false}
                />
            )

            const provinceSelect = container.querySelectorAll("select")[1]
            expect(provinceSelect?.hasAttribute("disabled")).toBe(true)
        })

        it("calls onChange with province and resets city on province change", () => {
            const onChange = mock()
            const { container } = render(
                <LocationSection
                    data={{
                        ...defaultData,
                        region: "Region VII - Central Visayas",
                    }}
                    onChange={onChange}
                    readOnlyLocation={false}
                />
            )

            const provinceSelect = container.querySelectorAll("select")[1]
            fireEvent.change(provinceSelect, { target: { value: "Cebu" } })

            expect(onChange).toHaveBeenCalledWith("province", "Cebu")
            expect(onChange).toHaveBeenCalledWith("city_municipality", "")
        })

        it("calls onChange when city selected", () => {
            const onChange = mock()
            const { container } = render(
                <LocationSection
                    data={{
                        ...defaultData,
                        region: "NCR - National Capital Region",
                        province: "Metro Manila",
                    }}
                    onChange={onChange}
                    readOnlyLocation={false}
                />
            )

            const citySelect = container.querySelectorAll("select")[2]
            fireEvent.change(citySelect, { target: { value: "Makati" } })

            expect(onChange).toHaveBeenCalledWith("city_municipality", "Makati")
        })
    })
})
