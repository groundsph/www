import { describe, it, expect, mock } from "bun:test"
import { render } from "@testing-library/react"

// Mocks
mock.module("next/navigation", () => ({
    useRouter: () => ({ push: mock() }),
}))
mock.module("next/image", () => ({
    default: ({ src, alt }: { src: string; alt: string }) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt={alt} />
    },
}))
mock.module("next/link", () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
}))
mock.module("@/components/submit/LocationPicker", () => ({
    default: () => null,
}))
mock.module("@/components/layout/NotificationProvider", () => ({
    useNotification: () => ({ addNotification: mock() }),
}))

import CafeEdit from "@/components/owner/CafeEdit"
import type { CafeWithRatings } from "@/utils/types/extra"

const mockCafe = {
    id: "cafe1",
    name: "Owner Cafe",
    slug: "owner-cafe",
    description: null,
    thumbnail: "thumb.jpg",
    gallery: [],
    address_display: "456 Owner St",
    area: null,
    region: "Region VII - Central Visayas",
    province: "Cebu",
    city_municipality: "Cebu City",
    lat: 10.3157,
    lng: 123.8854,
    price_level: "premium",
    is_published: true,
    is_active: true,
    is_verified: false,
    is_claimed: false,
    is_hidden_gem: false,
    is_chain: false,
    is_test: false,
    is_mall_cafe: false,
    mall_verification_status: "pending",
    hidden_gem_since: null,
    hidden_gem_last_evaluated_period: null,
    hidden_gem_graduated_at: null,
    finding_hint: null,
    badge_stamp_url: null,
    owner_ids: null,
    contributor_id: null,
    contributor: null,
    has_wifi: true,
    has_smoking: false,
    has_sockets: true,
    has_parking: false,
    has_aircon: true,
    has_outdoor_seating: false,
    has_indoor_seating: true,
    has_restroom: true,
    has_bidet: false,
    has_non_dairy: true,
    has_decaf: false,
    serves_food: true,
    is_pet_friendly: false,
    is_work_friendly: true,
    is_halal_certified: false,
    straw_type: null,
    straw_type_other: null,
    coffee_style: null,
    roaster: null,
    brew_methods: null,
    specialty: null,
    milk_options: null,
    tags: null,
    operating_hours: null,
    socials: null,
    phone: null,
    email: null,
    website_url: null,
    payment_methods: null,
    featured_until: null,
    search_vector: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    rating_stats: null,
    story: null,
} as unknown as CafeWithRatings

describe("CafeEdit — location editing", () => {
    it("renders with location section", () => {
        const { container } = render(
            <CafeEdit cafe={mockCafe} menuItems={[]} />
        )

        expect(container.innerHTML).toContain("Owner Cafe")
    })
})