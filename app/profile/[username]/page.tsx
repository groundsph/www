import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getProfileByUsername } from "@/app/api/actions/profile"
import PublicProfileClient from "./PublicProfileClient"

interface Props {
    params: Promise<{
        username: string
    }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { username } = await params
    const profile = await getProfileByUsername(username)

    if (!profile) {
        return {
            title: "Profile Not Found | Grounds",
        }
    }

    return {
        title: `${profile.display_name} (@${profile.username})`,
        description:
            profile.bio ||
            `Check out ${profile.display_name}'s coffee profile on Grounds.`,
        openGraph: {
            images: profile.avatar_url ? [profile.avatar_url] : [],
        },
    }
}

export default async function PublicProfilePage({ params }: Props) {
    const { username } = await params
    const profile = await getProfileByUsername(username)

    if (!profile) {
        notFound()
    }

    return <PublicProfileClient profile={profile} />
}
