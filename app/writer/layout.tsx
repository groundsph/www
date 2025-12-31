import { redirect } from "next/navigation"
import { getUserRole } from "@/app/api/actions/admin"

export const metadata = {
    title: "Writer Dashboard",
    description: "Manage your blog posts",
}

export default async function WriterLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const role = await getUserRole()

    if (role !== "writer" && role !== "admin") {
        redirect("/")
    }

    return (
        <main className='w-full px-4 py-8 [&_button]:cursor-pointer'>
            {children}
        </main>
    )
}
