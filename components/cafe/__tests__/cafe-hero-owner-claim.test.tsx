import { describe, it, expect, mock } from "bun:test"
import React from "react"
import { render } from "@testing-library/react"

// Mock next/image to avoid DOM prop warnings
interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string
    alt: string
    fill?: boolean
    sizes?: string
    priority?: boolean
    blurDataURL?: string
}

mock.module("next/image", () => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    default: ({ src, alt, fill, sizes, priority, blurDataURL, ...rest }: ImageProps) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} {...rest} />
    ),
}))

import CafeHero from "@/components/cafe/CafeHero"
import { CafeWithRatings } from "@/utils/types/extra"

const baseCafe: CafeWithRatings = {
    id: "1",
    name: "Test Cafe",
    slug: "test-cafe",
    description: "A test cafe",
    address_display: "123 Test St",
    city_municipality: "Test City",
    province: "Test Province",
    region: "Test Region",
    area: null,
    lat: 14.0,
    lng: 121.0,
    thumbnail: "/test.jpg",
    gallery: null,
    operating_hours: [],
    socials: [],
    is_active: true,
    is_published: true,
    is_verified: false,
    is_claimed: false,
    owner_ids: null,
    contributor_id: null,
    price_level: "mid",
    coffee_style: "classic",
    has_wifi: false,
    has_smoking: false,
    has_sockets: false,
    has_parking: false,
    has_aircon: false,
    is_pet_friendly: false,
    has_outdoor_seating: false,
    has_indoor_seating: false,
    has_restroom: false,
    has_bidet: false,
    has_non_dairy: false,
    has_decaf: false,
    is_work_friendly: false,
    serves_food: false,
    is_hidden_gem: false,
    finding_hint: null,
    is_chain: false,
    is_halal_certified: false,
    straw_type: null,
    straw_type_other: null,
    badge_stamp_url: null,
    brew_methods: null,
    created_at: null,
    updated_at: null,
    email: null,
    featured_until: null,
    milk_options: null,
    payment_methods: null,
    phone: null,
    roaster: null,
    specialty: null,
    tags: null,
    website_url: null,
    average_rating: null,
    total_reviews: null,
}

const baseProps = {
    user: { id: "user-1" },
    isVisited: false,
    isFavorite: false,
    isInWishlist: false,
    onToggleVisited: () => {},
    onToggleFavorite: () => {},
    onToggleWishlist: () => {},
    onOpenClaim: () => {},
}

describe("CafeHero claim button", () => {
    it("shows claim button when not claimed and no owners", () => {
        const { queryByText } = render(
            <CafeHero
                cafe={{ ...baseCafe, is_claimed: false, owner_ids: null }}
                {...baseProps}
            />
        )
        expect(queryByText(/Own this cafe/i)).toBeTruthy()
    })

    it("shows claim button when owner_ids is empty array", () => {
        const { queryByText } = render(
            <CafeHero
                cafe={{ ...baseCafe, is_claimed: false, owner_ids: [] }}
                {...baseProps}
            />
        )
        expect(queryByText(/Own this cafe/i)).toBeTruthy()
    })

    it("hides claim button when cafe has owners", () => {
        const { queryByText } = render(
            <CafeHero
                cafe={{
                    ...baseCafe,
                    is_claimed: false,
                    owner_ids: ["user-1"],
                }}
                {...baseProps}
            />
        )
        expect(queryByText(/Own this cafe/i)).toBeNull()
    })

    it("hides claim button when already claimed", () => {
        const { queryByText } = render(
            <CafeHero
                cafe={{
                    ...baseCafe,
                    is_claimed: true,
                    owner_ids: ["user-1"],
                }}
                {...baseProps}
            />
        )
        expect(queryByText(/Own this cafe/i)).toBeNull()
    })

    it("hides claim button when already claimed even without owners", () => {
        const { queryByText } = render(
            <CafeHero
                cafe={{
                    ...baseCafe,
                    is_claimed: true,
                    owner_ids: [],
                }}
                {...baseProps}
            />
        )
        expect(queryByText(/Own this cafe/i)).toBeNull()
    })

    it("hides claim button when no user", () => {
        const { queryByRole } = render(
            <CafeHero
                cafe={{ ...baseCafe, is_claimed: false, owner_ids: null }}
                {...baseProps}
                user={null}
            />
        )
        // Scoped to the claim *button*: logged-out visitors now get a
        // "See what you get" link in the same slot (see the suite below).
        expect(queryByRole("button", { name: /Own this cafe\? Claim it/i })).toBeNull()
    })

    it("hides claim button when no onOpenClaim handler", () => {
        const { queryByText } = render(
            <CafeHero
                cafe={{ ...baseCafe, is_claimed: false, owner_ids: null }}
                {...baseProps}
                onOpenClaim={undefined}
            />
        )
        expect(queryByText(/Own this cafe/i)).toBeNull()
    })
})

describe("CafeHero — anonymous owner entry point", () => {
    it("shows a benefits link to a logged-out visitor on an unclaimed cafe", () => {
        const { container } = render(
            <CafeHero {...baseProps} user={null} cafe={{ ...baseCafe, is_claimed: false }} />
        )
        const link = container.querySelector('a[href="/for-owners"]')
        expect(link).toBeTruthy()
    })

    it("still hides the claim button when logged out", () => {
        const { container } = render(
            <CafeHero {...baseProps} user={null} cafe={{ ...baseCafe, is_claimed: false }} />
        )
        expect(container.textContent).not.toContain("Own this cafe? Claim it")
    })

    it("does not show the benefits link on an already-claimed cafe", () => {
        const { container } = render(
            <CafeHero {...baseProps} user={null} cafe={{ ...baseCafe, is_claimed: true }} />
        )
        expect(container.querySelector('a[href="/for-owners"]')).toBeNull()
    })
})
