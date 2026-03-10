import { describe, it, expect, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string
    alt: string
    onError?: () => void
}

mock.module("next/image", () => ({
    default: ({ src, alt, onError, ...rest }: ImageProps) => (
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

    it("renders /icon.png when src is null", () => {
        const { container } = render(
            <UserAvatar src={null} alt="User avatar" size={48} />
        )
        const img = container.querySelector("img")
        expect(img).toBeTruthy()
        expect(img?.getAttribute("src")).toBe("/icon.png")
        expect(img?.getAttribute("alt")).toBe("Default avatar")
    })

    it("renders /icon.png when src is undefined", () => {
        const { container } = render(
            <UserAvatar src={undefined} alt="User avatar" size={48} />
        )
        const img = container.querySelector("img")
        expect(img).toBeTruthy()
        expect(img?.getAttribute("src")).toBe("/icon.png")
        expect(img?.getAttribute("alt")).toBe("Default avatar")
    })

    it("falls back to /icon.png when the image errors (onError fires)", () => {
        const { container } = render(
            <UserAvatar src="/avatar.jpg" alt="User avatar" size={48} />
        )
        const img = container.querySelector("img")
        expect(img).toBeTruthy()
        expect(img?.getAttribute("src")).toBe("/avatar.jpg")

        // Simulate error
        fireEvent.error(img!)

        // After error, should show fallback
        const fallbackImg = container.querySelector("img")
        expect(fallbackImg).toBeTruthy()
        expect(fallbackImg?.getAttribute("src")).toBe("/icon.png")
        expect(fallbackImg?.getAttribute("alt")).toBe("Default avatar")
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
})
