import { describe, it } from "bun:test"

describe("Follow Request Flow", () => {
    describe("Private Profile Follow", () => {
        it.todo("creates follow request when following private profile")
        it.todo("returns requiresApproval: true for private profiles")
        it.todo("does not create user_follows entry until approved")
    })

    describe("Public Profile Follow", () => {
        it.todo("creates direct follow for public profiles")
        it.todo("returns requiresApproval: false for public profiles")
    })

    describe("Accept Follow Request", () => {
        it.todo("creates user_follows entry when accepted")
        it.todo("updates request status to accepted")
        it.todo("only target user can accept their own requests")
    })

    describe("Decline Follow Request", () => {
        it.todo("updates request status to declined")
        it.todo("allows re-requesting after decline")
    })

    describe("Privacy Settings", () => {
        it.todo("allows user to toggle privacy on/off")
        it.todo("existing followers retain access when going private")
    })

    describe("Content Access", () => {
        it.todo("restricts profile content for non-followers on private profiles")
        it.todo("shows full content after follow is approved")
    })
})
