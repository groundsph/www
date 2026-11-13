import { describe, it, expect, mock } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
import HeroLocationCheckIn from "@/components/checkin/HeroLocationCheckIn"

/**
 * The auto-open path: the presence gate flips `shouldPrompt` to true, and the
 * component must open the modal exactly once.
 */

const mockRecordVisit = mock(async () => ({
    success: true,
    visitCount: 1,
    isFirstVisit: true,
    milestone: null,
}))

// A cafe where the visitor has NOT checked in today.
mock.module("@/app/api/actions/profile", () => ({
    getTodayCheckIn: mock(async () => null),
    recordVisit: mockRecordVisit,
    getVisitCount: mock(async () => ({ count: 0 })),
    updateCheckIn: mock(async () => ({ success: true, visitCount: 1, isFirstVisit: false })),
}))

// Surface the modal's open state so the assertion can see it.
mock.module("@/components/checkin/GroupCheckInModal", () => ({
    default: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid='checkin-modal'>Check In</div> : null,
}))

mock.module("@/components/layout/AuthProvider", () => ({
    useAuth: () => ({ user: { id: "user-1" } }),
}))

mock.module("@/hooks/useHaptics", () => ({
    useHaptics: () => ({ trigger: mock(() => {}), cancel: mock(() => {}), isSupported: false }),
}))

mock.module("next/navigation", () => ({
    useRouter: () => ({ push: mock(() => {}) }),
}))

const CAFE = {
    id: "cafe-1",
    slug: "cafe-1",
    name: "Cafe One",
    thumbnail: "placeholder",
    distance: 40,
    address: "Somewhere",
    city: "Cebu City",
    lat: 10.33,
    lng: 123.9,
    priceLevel: "mid" as const,
    averageRating: 4.5,
    totalReviews: 10,
    operatingHours: null,
    hasWifi: true,
    hasSockets: false,
    hasAircon: true,
    isPetFriendly: false,
    hasOutdoorSeating: false,
    isWorkFriendly: true,
}

describe("HeroLocationCheckIn auto-open", () => {
    it("stays closed while the presence gate is not confident", () => {
        render(
            <HeroLocationCheckIn nearbyCafe={CAFE} shouldPrompt={false} />
        )
        expect(screen.queryByTestId("checkin-modal")).toBeNull()
    })

    it("opens once when the gate becomes confident, and reports it", async () => {
        const onPromptShown = mock(() => {})
        render(
            <HeroLocationCheckIn
                nearbyCafe={CAFE}
                shouldPrompt
                onPromptShown={onPromptShown}
            />
        )

        await waitFor(() => {
            expect(screen.getByTestId("checkin-modal")).toBeDefined()
        })
        expect(onPromptShown).toHaveBeenCalledTimes(1)
    })

    it("does not open when the visitor already checked in today", async () => {
        // Re-mock to report an existing visit for this cafe.
        mock.module("@/app/api/actions/profile", () => ({
            getTodayCheckIn: mock(async () => ({
                id: "visit-1",
                visitedAt: new Date().toISOString(),
                companions: [],
            })),
            recordVisit: mockRecordVisit,
            getVisitCount: mock(async () => ({ count: 1 })),
            updateCheckIn: mock(async () => ({ success: true, visitCount: 1, isFirstVisit: false })),
        }))

        const { unmount } = render(
            <HeroLocationCheckIn nearbyCafe={CAFE} shouldPrompt />
        )

        // Give the status refresh a chance to complete.
        await waitFor(() => {
            expect(screen.getByText(/Checked in today/i)).toBeDefined()
        })
        expect(screen.queryByTestId("checkin-modal")).toBeNull()
        unmount()
    })
})
