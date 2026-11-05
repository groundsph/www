import { describe, it, expect, mock, afterEach, beforeEach } from "bun:test"
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react"

const approveVerification = mock()
const rejectVerification = mock()
const sendVerificationEmail = mock()
const getAllVerifications = mock()
const getOwnershipProofSignedUrl = mock()

mock.module("@/app/api/actions/admin", () => ({
    approveVerification,
    rejectVerification,
    sendVerificationEmail,
    getAllVerifications,
}))

mock.module("@/app/api/actions/claim", () => ({
    getOwnershipProofSignedUrl,
}))

import VerificationsQueue from "@/components/manage/VerificationsQueue"
import type { OwnerVerificationForAdmin } from "@/app/api/actions/admin"

function buildRequest(
    overrides: Partial<OwnerVerificationForAdmin> = {}
): OwnerVerificationForAdmin {
    return {
        id: "req-1",
        cafe_id: "cafe-1",
        user_id: "user-1",
        verification_type: "document",
        proof_urls: ["owners/proofs/business-permit.pdf"],
        notes: "Here is our DTI registration.",
        status: "pending",
        admin_notes: null,
        created_at: "2026-02-04T08:00:00.000Z",
        cafe: {
            id: "cafe-1",
            name: "Kape Ni Juan",
            slug: "kape-ni-juan",
            thumbnail: "",
            email: "hello@kapenijuan.ph",
        },
        user: {
            id: "user-1",
            username: "juandelacruz",
            display_name: "Juan Dela Cruz",
            avatar_url: null,
        },
        ...overrides,
    }
}

const ORIGINAL_OPEN = window.open

beforeEach(() => {
    // jsdom does not implement window.open
    window.open = mock(() => null) as unknown as typeof window.open
    approveVerification.mockResolvedValue({ success: true })
    rejectVerification.mockResolvedValue({ success: true })
    sendVerificationEmail.mockResolvedValue({ success: true })
    getAllVerifications.mockResolvedValue([])
    getOwnershipProofSignedUrl.mockResolvedValue({
        success: true,
        url: "https://cdn.example/signed",
    })
})

afterEach(() => {
    cleanup()
    window.open = ORIGINAL_OPEN
    mock.clearAllMocks()
})

describe("VerificationsQueue — pending requests", () => {
    it("renders the cafe, the requester and a human verification type", () => {
        const { container } = render(
            <VerificationsQueue initialRequests={[buildRequest()]} />
        )

        expect(container.textContent).toContain("Kape Ni Juan")
        expect(container.textContent).toContain("Juan Dela Cruz")
        expect(container.textContent).toContain("Business document")
        expect(container.textContent).toContain("Here is our DTI registration.")
    })

    it("says plainly when a request has no proof document", () => {
        const { container } = render(
            <VerificationsQueue
                initialRequests={[buildRequest({ proof_urls: [] })]}
            />
        )

        expect(container.textContent).toContain("No proof document is attached")
    })

    it("shows the empty state when nothing is pending", () => {
        const { container } = render(
            <VerificationsQueue initialRequests={[]} />
        )

        expect(container.textContent).toContain(
            "No ownership requests are waiting for review."
        )
    })
})

describe("VerificationsQueue — approving", () => {
    it("grants ownership through approveVerification and emails the owner", async () => {
        const { getByText, container } = render(
            <VerificationsQueue initialRequests={[buildRequest()]} />
        )

        fireEvent.click(getByText("Approve ownership"))

        await waitFor(() => {
            expect(approveVerification).toHaveBeenCalledTimes(1)
        })
        expect(approveVerification.mock.calls[0][0]).toBe("req-1")

        await waitFor(() => {
            expect(sendVerificationEmail).toHaveBeenCalledWith("req-1")
        })
        await waitFor(() => {
            expect(container.textContent).toContain(
                "Notification email sent to the requester."
            )
        })
    })

    it("surfaces a failed email as a separate outcome from the approval", async () => {
        sendVerificationEmail.mockResolvedValue({
            success: false,
            error: "Resend rejected the message",
        })

        const { getByText, container } = render(
            <VerificationsQueue initialRequests={[buildRequest()]} />
        )

        fireEvent.click(getByText("Approve ownership"))

        await waitFor(() => {
            expect(container.textContent).toContain("ownership granted")
        })
        expect(approveVerification).toHaveBeenCalledTimes(1)

        await waitFor(() => {
            expect(container.textContent).toContain(
                "the notification email failed: Resend rejected the message"
            )
        })
        // Approval stands on its own; the failure does not read as a rejection.
        expect(container.textContent).not.toContain("Rejected — ownership not")
        expect(getByText("Retry email")).toBeTruthy()
    })

    it("does not claim ownership was granted when approval fails", async () => {
        approveVerification.mockResolvedValue({
            success: false,
            error: "Request has already been processed",
        })

        const { getByText, container } = render(
            <VerificationsQueue initialRequests={[buildRequest()]} />
        )

        fireEvent.click(getByText("Approve ownership"))

        await waitFor(() => {
            expect(container.textContent).toContain(
                "Request has already been processed"
            )
        })
        expect(container.textContent).not.toContain("ownership granted")
        expect(sendVerificationEmail).not.toHaveBeenCalled()
    })
})

describe("VerificationsQueue — rejecting", () => {
    it("blocks rejection without a reason", async () => {
        const { getByText, getByRole, container } = render(
            <VerificationsQueue initialRequests={[buildRequest()]} />
        )

        fireEvent.click(getByText("Reject"))
        fireEvent.click(getByRole("button", { name: "Reject request" }))

        await waitFor(() => {
            expect(container.textContent).toContain(
                "A rejection reason is required"
            )
        })
        expect(rejectVerification).not.toHaveBeenCalled()
    })

    it("sends the reason to rejectVerification", async () => {
        const { getByText, getByPlaceholderText, container } = render(
            <VerificationsQueue initialRequests={[buildRequest()]} />
        )

        fireEvent.click(getByText("Reject"))
        fireEvent.change(
            getByPlaceholderText(/Explain what was missing/i),
            { target: { value: "The permit shows a different owner" } }
        )
        fireEvent.click(getByText("Reject request"))

        await waitFor(() => {
            expect(rejectVerification).toHaveBeenCalledWith(
                "req-1",
                "The permit shows a different owner"
            )
        })
        await waitFor(() => {
            expect(container.textContent).toContain("Rejected — ownership not")
        })
        expect(approveVerification).not.toHaveBeenCalled()
    })
})

describe("VerificationsQueue — private proof documents", () => {
    it("resolves a signed URL on demand instead of using the raw proof URL", async () => {
        const { getByText } = render(
            <VerificationsQueue initialRequests={[buildRequest()]} />
        )

        expect(getOwnershipProofSignedUrl).not.toHaveBeenCalled()

        fireEvent.click(getByText("View proof"))

        await waitFor(() => {
            expect(getOwnershipProofSignedUrl).toHaveBeenCalledWith(
                "owners/proofs/business-permit.pdf"
            )
        })
        await waitFor(() => {
            expect(window.open).toHaveBeenCalled()
        })
        expect(String(window.open.mock.calls[0][0])).toBe(
            "https://cdn.example/signed"
        )
    })

    it("reports a failure to sign the proof URL", async () => {
        getOwnershipProofSignedUrl.mockResolvedValue({
            success: false,
            error: "Not authorized",
        })

        const { getByText, container } = render(
            <VerificationsQueue initialRequests={[buildRequest()]} />
        )

        fireEvent.click(getByText("View proof"))

        await waitFor(() => {
            expect(container.textContent).toContain("Not authorized")
        })
        expect(window.open).not.toHaveBeenCalled()
    })
})

describe("VerificationsQueue — status filter", () => {
    it("loads the selected status through getAllVerifications", async () => {
        getAllVerifications.mockResolvedValue([
            buildRequest({
                id: "req-2",
                status: "rejected",
                admin_notes: "The document was expired",
                cafe: {
                    id: "cafe-2",
                    name: "Silangan Brew",
                    slug: "silangan-brew",
                    thumbnail: "",
                    email: null,
                },
            }),
        ])

        const { getByText, container } = render(
            <VerificationsQueue initialRequests={[buildRequest()]} />
        )

        fireEvent.click(getByText("Rejected"))

        await waitFor(() => {
            expect(getAllVerifications).toHaveBeenCalledWith("rejected")
        })
        await waitFor(() => {
            expect(container.textContent).toContain("Silangan Brew")
        })
        expect(container.textContent).toContain("The document was expired")
    })

    it("loads every status when All is selected", async () => {
        const { getByText } = render(
            <VerificationsQueue initialRequests={[buildRequest()]} />
        )

        fireEvent.click(getByText("All"))

        await waitFor(() => {
            expect(getAllVerifications).toHaveBeenCalledWith()
        })
    })
})
