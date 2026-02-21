import { describe, it, expect } from "bun:test"
import { render } from "@testing-library/react"
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
    price_level: "medium",
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
    membership_tier: null,
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
        const { queryByText } = render(
            <CafeHero
                cafe={{ ...baseCafe, is_claimed: false, owner_ids: null }}
                {...baseProps}
                user={null}
            />
        )
        expect(queryByText(/Own this cafe/i)).toBeNull()
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
