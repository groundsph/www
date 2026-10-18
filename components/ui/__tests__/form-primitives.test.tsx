import { describe, it, expect } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import SectionCard from "@/components/ui/SectionCard"
import TextField from "@/components/ui/TextField"
import SelectField from "@/components/ui/SelectField"
import ToggleRow from "@/components/ui/ToggleRow"

describe("form primitives", () => {
    it("SectionCard renders its title, description and children", () => {
        const { container } = render(
            <SectionCard title='Basic info' description='Visible on the cafe page'>
                <span>child</span>
            </SectionCard>
        )
        expect(container.textContent).toContain("Basic info")
        expect(container.textContent).toContain("Visible on the cafe page")
        expect(container.textContent).toContain("child")
    })

    it("TextField reports changes and renders a hint", () => {
        const changes: string[] = []
        const { container } = render(
            <TextField label='Name' value='Kapi' hint='Shown in listings' onChange={(v) => changes.push(v)} />
        )

        expect(container.textContent).toContain("Shown in listings")
        fireEvent.change(container.querySelector("input")!, { target: { value: "Kapi & Co." } })
        expect(changes).toEqual(["Kapi & Co."])
    })

    it("TextField shows an error instead of a hint", () => {
        const { container } = render(
            <TextField label='Website' value='' hint='Optional' error='Must be a URL' onChange={() => {}} />
        )
        expect(container.textContent).toContain("Must be a URL")
        expect(container.textContent).not.toContain("Optional")
    })

    it("SelectField reports the chosen value", () => {
        const changes: string[] = []
        const { container } = render(
            <SelectField
                label='Price level'
                value='mid'
                options={[{ value: "budget", label: "Budget" }, { value: "mid", label: "Mid" }]}
                onChange={(v) => changes.push(v)}
            />
        )

        fireEvent.change(container.querySelector("select")!, { target: { value: "budget" } })
        expect(changes).toEqual(["budget"])
    })

    it("ToggleRow toggles", () => {
        const changes: boolean[] = []
        const { container } = render(
            <ToggleRow label='Has wifi' checked={false} onChange={(v) => changes.push(v)} />
        )

        fireEvent.click(container.querySelector("[role='switch']")!)
        expect(changes).toEqual([true])
    })
})
