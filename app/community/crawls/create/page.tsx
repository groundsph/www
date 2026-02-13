import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import CrawlEditor from "@/components/crawls/CrawlEditor"

export default async function CreateCrawlPage() {
    const session = await auth.api.getSession({ headers: await headers() })
    
    if (!session?.user) {
        redirect("/auth/sign-in?callbackUrl=/community/crawls/create")
    }

    return (
        <CrawlEditor 
            crawl={{ title: "", items: [] }} 
            mode="create" 
        />
    )
}
