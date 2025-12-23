import { Metadata } from "next"
import ProfileClient from "./ProfileClient"

export const metadata: Metadata = {
    title: "Your Profile",
    description:
        "View and manage your Grounds profile, stats, passport, and badge collection.",
}

export default function ProfilePage() {
    return <ProfileClient />
}
