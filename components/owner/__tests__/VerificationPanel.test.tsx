import { describe, it, expect, mock, afterEach } from "bun:test"
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react"

const getVerificationStatus = mock()
const submitVerificationRequest = mock()
const uploadOwnershipProofWithProgress = mock()

mock.module("@/app/api/actions/owner", () => ({
    getVerificationStatus,
    submitVerificationRequest,
}))

mock.module("@/utils/storage/client", () => ({
    uploadOwnershipProofWithProgress,
}))

import VerificationPanel from "@/components/owner/VerificationPanel"
import type { OwnerVerificationRequest } from "@/utils/types/owner"

function buildRequest(
    overrides: Partial<OwnerVerificationRequest> = {}
): OwnerVerificationRequest {
    return {
        id: "req1",
        cafe_id: "cafe1",
        user_id: "user1",
        verification_type: "document",
        proof_urls: ["https://cdn.example/proof.pdf"],
        notes: null,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        admin_notes: null,
        created_at: "2026-01-10T08:00:00.000Z",
        ...overrides,
    }
}

const PANEL_PROPS = { cafeId: "cafe1", cafeName: "Kapi Corner" }

describe("VerificationPanel — pending request", () => {
    afterEach(() => {
        cleanup()
        mock.clearAllMocks()
    })

    it("shows under review and hides the form", async () => {
        getVerificationStatus.mockResolvedValue(buildRequest({ status: "pending" }))

        const { container } = render(<VerificationPanel {...PANEL_PROPS} />)

        await waitFor(() => {
            expect(container.textContent).toContain("Under review")
        })

        expect(container.textContent).toContain("business document")
        expect(container.querySelector("form")).toBeNull()
        expect(container.querySelector("select")).toBeNull()
    })

    it("does not offer a submit button while a request is open", async () => {
        getVerificationStatus.mockResolvedValue(buildRequest({ status: "pending" }))

        const { container } = render(<VerificationPanel {...PANEL_PROPS} />)

        await waitFor(() => {
            expect(container.textContent).toContain("Under review")
        })

        const buttonLabels = Array.from(
            container.querySelectorAll("button")
        ).map((button) => button.textContent ?? "")

        expect(buttonLabels.join(" ")).not.toContain("Send ownership request")
    })
})

describe("VerificationPanel — rejected request", () => {
    afterEach(() => {
        cleanup()
        mock.clearAllMocks()
    })

    it("renders the admin's rejection reason", async () => {
        getVerificationStatus.mockResolvedValue(
            buildRequest({
                status: "rejected",
                admin_notes: "The permit you sent is expired.",
            })
        )

        const { container } = render(<VerificationPanel {...PANEL_PROPS} />)

        await waitFor(() => {
            expect(container.textContent).toContain(
                "The permit you sent is expired."
            )
        })

        expect(container.textContent).toContain("Reason from staff")
    })

    it("lets the owner resubmit", async () => {
        getVerificationStatus.mockResolvedValue(
            buildRequest({ status: "rejected", admin_notes: "Blurry scan." })
        )

        const { container } = render(<VerificationPanel {...PANEL_PROPS} />)

        await waitFor(() => {
            expect(container.querySelector("form")).toBeTruthy()
        })

        expect(container.querySelector("select")).toBeTruthy()
        expect(container.querySelector("input[type='file']")).toBeTruthy()
    })
})

describe("VerificationPanel — approved request", () => {
    afterEach(() => {
        cleanup()
        mock.clearAllMocks()
    })

    it("confirms the owner manages the cafe and hides the form", async () => {
        getVerificationStatus.mockResolvedValue(buildRequest({ status: "approved" }))

        const { container } = render(<VerificationPanel {...PANEL_PROPS} />)

        await waitFor(() => {
            expect(container.textContent).toContain("you now manage this cafe")
        })

        expect(container.textContent).toContain("Kapi Corner")
        expect(container.querySelector("form")).toBeNull()
    })
})

describe("VerificationPanel — badge honesty", () => {
    afterEach(() => {
        cleanup()
        mock.clearAllMocks()
    })

    it("denies that ownership verification grants a badge", async () => {
        getVerificationStatus.mockResolvedValue(null)

        const { container } = render(<VerificationPanel {...PANEL_PROPS} />)

        await waitFor(() => {
            expect(container.querySelector("form")).toBeTruthy()
        })

        const text = (container.textContent ?? "").toLowerCase()

        expect(text).toContain(
            "approving ownership does not add a verified badge"
        )
        expect(text).toContain("granted separately by groundsph staff")
        // The phrase may only appear inside the negation, never as a promise.
        expect(text).not.toContain("get a verified badge")
        expect(text).not.toContain("earn a verified badge")
        expect(text).not.toContain("unlock a verified badge")
    })

    it("keeps the disclaimer on the pending state too", async () => {
        getVerificationStatus.mockResolvedValue(buildRequest({ status: "pending" }))

        const { container } = render(<VerificationPanel {...PANEL_PROPS} />)

        await waitFor(() => {
            expect(container.textContent).toContain("Under review")
        })

        expect((container.textContent ?? "").toLowerCase()).toContain(
            "does not add a verified badge"
        )
    })
})

describe("VerificationPanel — submission", () => {
    afterEach(() => {
        cleanup()
        mock.clearAllMocks()
    })

    it("uploads the proof and sends its URL with the request", async () => {
        getVerificationStatus.mockResolvedValue(null)
        uploadOwnershipProofWithProgress.mockResolvedValue({
            success: true,
            url: "https://cdn.grounds.ph/ownership-proofs/permit.pdf",
        })
        submitVerificationRequest.mockResolvedValue({ success: true })

        const { container } = render(<VerificationPanel {...PANEL_PROPS} />)

        await waitFor(() => {
            expect(container.querySelector("form")).toBeTruthy()
        })

        const select = container.querySelector("select")!
        fireEvent.change(select, { target: { value: "social_proof" } })

        const fileInput = container.querySelector("input[type='file']") as HTMLInputElement
        const file = new File(["proof"], "permit.pdf", {
            type: "application/pdf",
        })
        Object.defineProperty(fileInput, "files", {
            value: [file],
            configurable: true,
        })
        fireEvent.change(fileInput, { target: { files: [file] } })

        fireEvent.change(container.querySelector("textarea")!, {
            target: { value: "We run the Cebu branch." },
        })

        const form = container.querySelector("form")!
        fireEvent.submit(form)

        await waitFor(() => {
            expect(submitVerificationRequest).toHaveBeenCalled()
        })

        expect(uploadOwnershipProofWithProgress).toHaveBeenCalledWith(
            file,
            expect.anything()
        )
        expect(submitVerificationRequest).toHaveBeenCalledWith({
            cafe_id: "cafe1",
            verification_type: "social_proof",
            proof_urls: ["https://cdn.grounds.ph/ownership-proofs/permit.pdf"],
            notes: "We run the Cebu branch.",
        })
    })

    it("surfaces the action error instead of claiming success", async () => {
        getVerificationStatus.mockResolvedValue(null)
        uploadOwnershipProofWithProgress.mockResolvedValue({
            success: true,
            url: "https://cdn.grounds.ph/ownership-proofs/permit.pdf",
        })
        submitVerificationRequest.mockResolvedValue({
            success: false,
            error: "You already have a pending verification request for this cafe",
        })

        const { container } = render(<VerificationPanel {...PANEL_PROPS} />)

        await waitFor(() => {
            expect(container.querySelector("form")).toBeTruthy()
        })

        const fileInput = container.querySelector("input[type='file']") as HTMLInputElement
        const file = new File(["proof"], "permit.pdf", {
            type: "application/pdf",
        })
        Object.defineProperty(fileInput, "files", {
            value: [file],
            configurable: true,
        })
        fireEvent.change(fileInput, { target: { files: [file] } })

        fireEvent.submit(container.querySelector("form")!)

        await waitFor(() => {
            expect(container.textContent).toContain(
                "You already have a pending verification request for this cafe"
            )
        })

        expect(container.textContent).not.toContain("Request sent")
    })

    it("will not submit without a proof file", async () => {
        getVerificationStatus.mockResolvedValue(null)

        const { container } = render(<VerificationPanel {...PANEL_PROPS} />)

        await waitFor(() => {
            expect(container.querySelector("form")).toBeTruthy()
        })

        fireEvent.submit(container.querySelector("form")!)

        await waitFor(() => {
            expect(container.textContent).toContain(
                "Attach one supporting file"
            )
        })

        expect(submitVerificationRequest).not.toHaveBeenCalled()
    })
})
