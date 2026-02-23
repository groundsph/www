import { describe, it, expect, mock, beforeEach } from "bun:test"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import HeroLocationCheckIn from "@/components/checkin/HeroLocationCheckIn"

describe("HeroLocationCheckIn", () => {
  let callCount = 0

  beforeEach(() => {
    callCount = 0
  })

  // Mock returns null on first call (no check-in yet), then returns check-in on subsequent calls
  const mockGetTodayCheckIn = mock(async () => {
    callCount++
    if (callCount === 1) {
      return null
    }
    return {
      id: "visit-1",
      visitedAt: new Date().toISOString(),
      companions: [],
    }
  })

  mock.module("@/app/api/actions/profile", () => ({
    getTodayCheckIn: mockGetTodayCheckIn,
    recordVisit: mock(async () => ({ success: true, visitCount: 1, isFirstVisit: true })),
    getVisitCount: mock(async () => ({ count: 2 })),
    updateCheckIn: mock(async () => ({ success: true, visitCount: 2, isFirstVisit: false })),
  }))

  mock.module("@/components/checkin/GroupCheckInModal", () => ({
    default: () => null,
  }))

  mock.module("@/components/layout/AuthProvider", () => ({
    useAuth: () => ({ user: { id: "user-1" } }),
  }))

  mock.module("next/navigation", () => ({
    useRouter: () => ({ push: mock(() => {}) }),
  }))

  it("refreshes visit status before opening modal", async () => {
    mockGetTodayCheckIn.mockClear()
    
    render(
      <HeroLocationCheckIn
        nearbyCafe={{ id: "cafe-1", slug: "cafe-1", name: "Cafe One", distance: 100, latitude: 0, longitude: 0 }}
      />
    )

    // Wait for initial mount - button should show (no check-in yet)
    await waitFor(() => {
      expect(screen.getByText("Check In")).toBeDefined()
    })

    // Click Check In button - this should trigger a refresh
    fireEvent.click(screen.getByText("Check In"))

    // Wait for the refresh to complete (at least 2 calls: mount + click)
    await waitFor(() => {
      expect(mockGetTodayCheckIn.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    // After refresh finds existing check-in, UI should show "Checked in today"
    await waitFor(() => {
      expect(screen.getByText(/Checked in today/i)).toBeDefined()
    })
  })
})
