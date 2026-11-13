import { describe, it, expect, beforeEach } from "bun:test"
import {
    currentSession,
    evaluatePresence,
    hasAutoOpenedThisLoad,
    hasPromptedToday,
    isDismissed,
    markAutoOpenedThisLoad,
    markDismissed,
    markPrompted,
    phDayStartEpoch,
    walkMinutes,
    DWELL_MS,
    MAX_ACCURACY_METERS,
    DISMISSAL_TTL_MS,
    type PresenceSample,
    type PresenceSubject,
    type PresenceOptions,
    type StorageLike,
} from "@/utils/cafe-presence"

// A cafe at the corner of IT Park, Cebu.
const CAFE: PresenceSubject = {
    cafeId: "cafe-1",
    cafeLat: 10.3305,
    cafeLng: 123.9055,
}

const NOW = Date.UTC(2026, 1, 14, 6, 0, 0) // 14:00 PH time

function sample(overrides: Partial<PresenceSample> = {}): PresenceSample {
    return {
        lat: CAFE.cafeLat,
        lng: CAFE.cafeLng,
        accuracy: 15,
        timestamp: NOW - DWELL_MS,
        ...overrides,
    }
}

/** Two samples DWELL_MS apart, both on-site — the minimum convincing visit. */
function sitting(): PresenceSample[] {
    return [
        sample({ timestamp: NOW - DWELL_MS }),
        sample({ timestamp: NOW }),
    ]
}

function options(overrides: Partial<PresenceOptions> = {}): PresenceOptions {
    return {
        source: "gps",
        isEstimate: false,
        visible: true,
        autoOpenedThisLoad: false,
        now: NOW,
        storage: memoryStorage(),
        ...overrides,
    }
}

function memoryStorage(): StorageLike {
    const map = new Map<string, string>()
    return {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => void map.set(key, value),
        removeItem: (key) => void map.delete(key),
    }
}

describe("evaluatePresence", () => {
    it("prompts after a steady 90 second visit", () => {
        const decision = evaluatePresence(sitting(), CAFE, options())
        expect(decision.shouldPrompt).toBe(true)
        expect(decision.reason).toBeNull()
        expect(decision.sampleCount).toBe(2)
    })

    it("never prompts on an IP estimate", () => {
        expect(evaluatePresence(sitting(), CAFE, options({ source: "ip" })).reason).toBe("no-samples")
        expect(evaluatePresence(sitting(), CAFE, options({ isEstimate: true })).reason).toBe("no-samples")
    })

    it("never prompts from a background tab", () => {
        expect(evaluatePresence(sitting(), CAFE, options({ visible: false })).reason).toBe("not-long-enough")
    })

    it("rejects a single fix", () => {
        const decision = evaluatePresence([sample({ timestamp: NOW })], CAFE, options())
        expect(decision.shouldPrompt).toBe(false)
        expect(decision.reason).toBe("single-sample")
    })

    it("rejects an imprecise fix", () => {
        const samples = [sample({ timestamp: NOW - DWELL_MS, accuracy: 250 }), sample({ timestamp: NOW, accuracy: 250 })]
        const decision = evaluatePresence(samples, CAFE, options())
        expect(decision.shouldPrompt).toBe(false)
        expect(decision.reason).toBe("poor-accuracy")
        expect(MAX_ACCURACY_METERS).toBe(60)
    })

    it("rejects a cafe that is too far away", () => {
        // ~1.1km north of the cafe
        const far = sample({ lat: CAFE.cafeLat + 0.01, timestamp: NOW })
        const decision = evaluatePresence([sample({ timestamp: NOW - DWELL_MS }), far], CAFE, options())
        expect(decision.shouldPrompt).toBe(false)
        expect(decision.reason).toBe("too-far")
    })

    it("rejects someone walking past the cafe", () => {
        // Entered 40m south of the cafe, now 40m north: 80m of net displacement
        // inside the radius, which is a walk-by rather than a visit.
        const walking = [
            sample({ lat: CAFE.cafeLat - 0.00036, timestamp: NOW - DWELL_MS }),
            sample({ lat: CAFE.cafeLat + 0.00036, timestamp: NOW }),
        ]
        const decision = evaluatePresence(walking, CAFE, options())
        expect(decision.shouldPrompt).toBe(false)
        expect(decision.reason).toBe("moving")
    })

    it("rejects a visit that is too short", () => {
        const short = [
            sample({ timestamp: NOW - 20_000 }),
            sample({ timestamp: NOW }),
        ]
        const decision = evaluatePresence(short, CAFE, options())
        expect(decision.shouldPrompt).toBe(false)
        expect(decision.reason).toBe("not-long-enough")
        expect(decision.dwellMs).toBe(20_000)
    })

    it("rejects a second auto-open on the same page load", () => {
        expect(
            evaluatePresence(sitting(), CAFE, options({ autoOpenedThisLoad: true })).reason
        ).toBe("already-auto-opened")
    })

    it("rejects an auto-open when the page already used one", () => {
        const storage = memoryStorage()
        markAutoOpenedThisLoad(storage)
        expect(evaluatePresence(sitting(), CAFE, options({ storage })).reason).toBe(
            "already-auto-opened"
        )
    })

    it("rejects a cafe already offered today", () => {
        const storage = memoryStorage()
        markPrompted(storage, CAFE.cafeId, NOW - 60_000)
        expect(evaluatePresence(sitting(), CAFE, options({ storage })).reason).toBe(
            "already-prompted-today"
        )
    })

    it("offers the same cafe again the next Philippine day", () => {
        const storage = memoryStorage()
        markPrompted(storage, CAFE.cafeId, NOW - 60_000)
        // 24h later the prompt window has rolled over
        const tomorrow = NOW + 24 * 60 * 60 * 1000
        const decision = evaluatePresence(
            sitting().map((s) => ({ ...s, timestamp: s.timestamp + 24 * 60 * 60 * 1000 })),
            CAFE,
            options({ storage, now: tomorrow })
        )
        expect(decision.shouldPrompt).toBe(true)
    })

    it("honours a dismissal for a week", () => {
        const storage = memoryStorage()
        markDismissed(storage, CAFE.cafeId, NOW - 60_000)
        expect(evaluatePresence(sitting(), CAFE, options({ storage })).reason).toBe("dismissed")

        const later = NOW + DISMISSAL_TTL_MS + 1000
        const decision = evaluatePresence(
            sitting().map((s) => ({ ...s, timestamp: s.timestamp + DISMISSAL_TTL_MS })),
            CAFE,
            options({ storage, now: later })
        )
        expect(decision.shouldPrompt).toBe(true)
    })

    it("survives a missing storage implementation", () => {
        expect(evaluatePresence(sitting(), CAFE, options({ storage: null })).shouldPrompt).toBe(true)
    })
})

describe("currentSession", () => {
    it("drops samples from before the visitor left the radius", () => {
        const samples = [
            sample({ lat: CAFE.cafeLat + 0.01, timestamp: NOW - 200_000 }),
            sample({ timestamp: NOW - DWELL_MS }),
            sample({ timestamp: NOW }),
        ]
        expect(currentSession(samples, CAFE)).toHaveLength(2)
    })

    it("skips imprecise samples without breaking continuity", () => {
        const samples = [
            sample({ timestamp: NOW - DWELL_MS }),
            sample({ accuracy: 200, timestamp: NOW - 45_000 }),
            sample({ timestamp: NOW }),
        ]
        const session = currentSession(samples, CAFE)
        expect(session).toHaveLength(2)
        expect(session.every((s) => s.accuracy <= MAX_ACCURACY_METERS)).toBe(true)
    })
})

describe("suppression ledger", () => {
    let storage: StorageLike

    beforeEach(() => {
        storage = memoryStorage()
    })

    it("treats an empty ledger as unblocked", () => {
        expect(hasPromptedToday(storage, "cafe-1", NOW)).toBe(false)
        expect(isDismissed(storage, "cafe-1", NOW)).toBe(false)
        expect(hasAutoOpenedThisLoad(storage)).toBe(false)
    })

    it("scopes prompted state per cafe", () => {
        markPrompted(storage, "cafe-1", NOW)
        expect(hasPromptedToday(storage, "cafe-1", NOW)).toBe(true)
        expect(hasPromptedToday(storage, "cafe-2", NOW)).toBe(false)
    })
})

describe("phDayStartEpoch", () => {
    it("returns midnight Philippine time in real epoch ms", () => {
        // 2026-02-14T06:00:00Z is 14:00 in PH, so PH midnight is 16:00Z the day before.
        expect(new Date(phDayStartEpoch(NOW)).toISOString()).toBe("2026-02-13T16:00:00.000Z")
    })
})

describe("walkMinutes", () => {
    it("rounds up to at least a minute", () => {
        expect(walkMinutes(0)).toBe(1)
        expect(walkMinutes(40)).toBe(1)
        expect(walkMinutes(160)).toBe(2)
        expect(walkMinutes(900)).toBe(11)
    })
})
