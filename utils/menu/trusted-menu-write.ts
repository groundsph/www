import { getCurrentUser } from "@/lib/auth"
import { getStaffRole } from "@/utils/auth/staff-role"
import { isCafeOwner } from "@/utils/owner/cafe-ownership"

/**
 * The one answer to "may this caller write this Cafe's Menu directly?".
 *
 * True only for the Cafe's owner and for admins. A moderator is neither: their
 * powers are about reviewing other people's contributions, which is a different
 * question from being accountable for this Cafe's data.
 *
 * Ownership is re-derived here from stored Cafe data (`isCafeOwner`), never from
 * anything the caller sends, and the session is read server-side. Anything that
 * writes a Menu must ask this predicate rather than making its own exception.
 */
export async function canWriteMenuDirectly(cafeId: string): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false

    // An admin is staff by either role source: `profiles.role` is what the app's
    // admin surfaces read, and it is the one most real staff accounts carry.
    const { isAdmin } = await getStaffRole(user)
    if (isAdmin) return true

    return isCafeOwner(cafeId, user.id)
}
