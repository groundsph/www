import { describe, it, expect, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

// Mock external dependencies
mock.module("@/components/layout/NotificationProvider", () => ({
    useNotification: () => ({ addNotification: mock() }),
}))
mock.module("next/navigation", () => ({
    useRouter: () => ({ push: mock(), refresh: mock() }),
}))
mock.module("next/image", () => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    default: (_props: { src: string; alt: string }) => {
        return null
    },
}))
mock.module("next/link", () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
}))
mock.module("@/components/submit/LocationPicker", () => ({
    default: () => null,
}))
mock.module("prismjs", () => ({}))
mock.module("lowlight", () => ({
    common: [],
    createLowlight: () => ({ register: () => {}, _grammars: {} }),
}))
mock.module("@tiptap/extension-code-block-lowlight", () => ({
    default: { configure: () => ({}) },
}))
mock.module("@/utils/email", () => ({
    sendCafeApprovedEmail: () => {},
    sendCafeRejectedEmail: () => {},
    sendSuggestionApprovedEmail: () => {},
    sendSuggestionRejectedEmail: () => {},
    sendEventApprovedEmail: () => {},
    sendEventRejectedEmail: () => {},
    sendPasswordResetEmail: () => {},
    sendClaimApprovedEmail: () => {},
    sendClaimRejectedEmail: () => {},
    sendContactEmail: () => {},
}))
mock.module("@/app/api/actions/admin", () => ({
    approveCafe: () => Promise.resolve(),
    rejectCafe: () => Promise.resolve(),
    updateCafe: mock(() => Promise.resolve({ success: true })),
    unpublishCafe: () => Promise.resolve(),
    deleteCafe: () => Promise.resolve(),
    upsertCafeStory: () => Promise.resolve(),
    deleteCafeStory: () => Promise.resolve(),
    adminDeleteCafeImage: () => Promise.resolve(),
    updateCafeImages: () => Promise.resolve({ success: true }),
    searchUsersForOwner: () => Promise.resolve([]),
    getOwnerProfiles: () => Promise.resolve([]),
}))

import { updateCafe } from "@/app/api/actions/admin"
import CafeEditor from "@/components/manage/CafeEditor"
import type { CafeWithRatings } from "@/utils/types/extra"

const mockCafe: CafeWithRatings = {
    id: "cafe1",
    name: "Test Cafe",
    slug: "test-cafe",
    description: "A test cafe",
    thumbnail: "test-thumb.jpg",
    gallery: [],
    address_display: "123 Test St",
    area: null,
    region: "NCR - National Capital Region",
    province: "Metro Manila",
    city_municipality: "Makati",
    lat: 14.5547,
    lng: 121.0244,
    price_level: "mid",
    coffee_style: null,
    roaster: null,
    brew_methods: null,
    specialty: null,
    milk_options: null,
    operating_hours: null,
    socials: null,
    phone: null,
    email: null,
    website_url: null,
    payment_methods: null,
    is_published: true,
    is_active: true,
    is_verified: false,
    is_claimed: false,
    is_hidden_gem: false,
    hidden_gem_since: null,
    hidden_gem_last_evaluated_period: null,
    hidden_gem_graduated_at: null,
    is_chain: false,
    is_test: false,
    is_mall_cafe: false,
    mall_verification_status: "pending",
    finding_hint: null,
    badge_stamp_url: null,
    owner_ids: null,
    contributor_id: null,
    contributor: null,
    has_wifi: false,
    has_smoking: false,
    has_sockets: false,
    has_parking: false,
    has_aircon: false,
    has_outdoor_seating: false,
    has_indoor_seating: false,
    has_restroom: false,
    has_bidet: false,
    has_non_dairy: false,
    has_decaf: false,
    serves_food: false,
    is_pet_friendly: false,
    is_work_friendly: false,
    is_halal_certified: false,
    straw_type: null,
    straw_type_other: null,
    featured_until: null,
    search_vector: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    rating_stats: null,
    story: null,
} as unknown as CafeWithRatings

describe("CafeEditor — location editing", () => {
    it("renders LocationSection with readOnlyLocation=false", () => {
        const { container } = render(
            <CafeEditor cafe={mockCafe} menuItems={[]} />
        )

        // Component should render without error
        expect(container.innerHTML).toContain("Test Cafe")
    })
})

describe("CafeEditor — description", () => {
    /**
     * Regression: the description input swallowed edits once the value reached
     * the 300-char limit, and `cafe.description || undefined` dropped the key
     * from the payload, so a save reported success without writing new text.
     */
    const descriptionField = (container: HTMLElement) =>
        container.querySelector(
            "textarea[placeholder='Tell us about this cafe...']"
        ) as HTMLTextAreaElement

    const save = (getByRole: (role: string, options: { name: RegExp }) => HTMLElement) =>
        fireEvent.click(getByRole("button", { name: /Save changes/i }))

    const lastPayload = () => {
        const updateCafeMock = updateCafe as unknown as ReturnType<typeof mock>
        expect(updateCafeMock).toHaveBeenCalled()
        const [, payload] = updateCafeMock.mock.calls[0] as [
            string,
            Record<string, unknown>,
        ]
        return payload
    }

    const reset = () => {
        ;(updateCafe as unknown as ReturnType<typeof mock>).mockClear()
    }

    it("sends edited description text in the update payload", () => {
        reset()
        const { container, getByRole } = render(
            <CafeEditor cafe={mockCafe} menuItems={[]} />
        )

        fireEvent.change(descriptionField(container), {
            target: { value: "A brand new description." },
        })
        save(getByRole)

        expect(lastPayload().description).toBe("A brand new description.")
    })

    it("clamps input at the limit instead of dropping the edit", () => {
        reset()
        const { container, getByRole } = render(
            <CafeEditor cafe={mockCafe} menuItems={[]} />
        )

        fireEvent.change(descriptionField(container), {
            target: { value: "x".repeat(400) },
        })
        save(getByRole)

        expect(lastPayload().description).toBe("x".repeat(300))
    })

    it("sends null so a cleared description is actually removed", () => {
        reset()
        const { container, getByRole } = render(
            <CafeEditor cafe={mockCafe} menuItems={[]} />
        )

        fireEvent.change(descriptionField(container), {
            target: { value: "" },
        })
        save(getByRole)

        expect(lastPayload().description).toBeNull()
    })
})
