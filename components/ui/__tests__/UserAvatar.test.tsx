import { describe, it, expect, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string
    alt: string
    fill?: boolean
    sizes?: string
    priority?: boolean
    onError?: () => void
}

mock.module("next/image", () => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    default: ({ src, alt, onError, fill, sizes, priority, ...rest }: ImageProps) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} onError={onError} {...rest} />
    ),
}))

import { UserAvatar } from "../UserAvatar"

describe("UserAvatar", () => {
    it("renders the provided src when valid", () => {
        const { container } = render(
            <UserAvatar src="/avatar.jpg" alt="User avatar" size={48} />
        )
        const img = container.querySelector("img")
        expect(img).toBeTruthy()
        expect(img?.getAttribute("src")).toBe("/avatar.jpg")
        expect(img?.getAttribute("alt")).toBe("User avatar")
    })

    it("renders initials fallback when src is null", () => {
        const { container } = render(
            <UserAvatar src={null} alt="Adrian Bonpin" size={48} />
        )
        // Should render a div with initials, not an image
        const fallbackDiv = container.querySelector("[role='img']")
        expect(fallbackDiv).toBeTruthy()
        expect(fallbackDiv?.getAttribute("aria-label")).toBe("Adrian Bonpin")
        // Should contain initials text
        const span = fallbackDiv?.querySelector("span")
        expect(span?.textContent).toBe("AB")
    })

    it("renders initials fallback when src is undefined", () => {
        const { container } = render(
            <UserAvatar src={undefined} alt="Jane Doe" size={48} />
        )
        const fallbackDiv = container.querySelector("[role='img']")
        expect(fallbackDiv).toBeTruthy()
        const span = fallbackDiv?.querySelector("span")
        expect(span?.textContent).toBe("JD")
    })

    it("falls back to initials when the image errors (onError fires)", () => {
        const { container } = render(
            <UserAvatar src="/avatar.jpg" alt="Test User" size={48} />
        )
        const img = container.querySelector("img")
        expect(img).toBeTruthy()
        expect(img?.getAttribute("src")).toBe("/avatar.jpg")

        // Simulate error
        fireEvent.error(img!)

        // After error, should show initials fallback
        const fallbackDiv = container.querySelector("[role='img']")
        expect(fallbackDiv).toBeTruthy()
        const span = fallbackDiv?.querySelector("span")
        expect(span?.textContent).toBe("TU")
    })

    it("applies size to the wrapper div", () => {
        const { container } = render(
            <UserAvatar src="/avatar.jpg" alt="User avatar" size={64} />
        )
        const wrapper = container.firstChild as HTMLElement
        expect(wrapper).toBeTruthy()
        expect(wrapper.style.width).toBe("64px")
        expect(wrapper.style.height).toBe("64px")
    })

    it("uses fallbackName for initials when provided", () => {
        const { container } = render(
            <UserAvatar src={null} alt="Display Name" size={48} fallbackName="Override Name" />
        )
        const fallbackDiv = container.querySelector("[role='img']")
        const span = fallbackDiv?.querySelector("span")
        expect(span?.textContent).toBe("ON")
    })

    it("applies a deterministic background color", () => {
        const { container: c1 } = render(
            <UserAvatar src={null} alt="Adrian" size={48} />
        )
        const { container: c2 } = render(
            <UserAvatar src={null} alt="Adrian" size={48} />
        )
        const div1 = c1.querySelector("[role='img']") as HTMLElement
        const div2 = c2.querySelector("[role='img']") as HTMLElement
        expect(div1.style.backgroundColor).toBeTruthy()
        expect(div1.style.backgroundColor).toBe(div2.style.backgroundColor)
    })
})
