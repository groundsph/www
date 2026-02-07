import { Metadata } from "next"
import SubmitPageContent from "@/components/submit/SubmitPage"

export const metadata: Metadata = {
    title: "Submit a Cafe",
    description: "Submit a new cafe to Grounds",
}

export default function SubmitPage() {
    return <SubmitPageContent />
}
