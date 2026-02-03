# Last Login Method Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the better-auth last-login plugin to track and display the last authentication method used by users (email, Google, Discord, passkey)

**Architecture:** The plugin stores the last login method in cookies (and optionally database). Server-side plugin intercepts auth events, client-side plugin provides methods to read the stored method. Auth page will display "Last used" badges on the corresponding login buttons.

**Tech Stack:** better-auth v1.4.10, Next.js 16, TypeScript, Drizzle ORM

---

## Prerequisites

- better-auth is already installed (v1.4.10)
- Auth system is configured in `/lib/auth.ts` and `/lib/auth-client.ts`
- Auth page is at `/app/auth/AuthPageClient.tsx`
- Database migrations are handled via drizzle-kit

---

## Task 1: Add Server-Side Plugin

**Files:**
- Modify: `/lib/auth.ts:1-65` (add import and plugin to plugins array)

**Step 1: Add import statement**

Add import at the top of the file:
```typescript
import { lastLoginMethod } from "better-auth/plugins"
```

**Step 2: Add plugin to plugins array**

Add `lastLoginMethod()` to the plugins array (around line 57-62):
```typescript
plugins: [
    admin({
        adminUserIds: process.env.ADMIN_USER_IDS?.split(",") || [],
    }),
    passkey(),
    lastLoginMethod() // Add this
]
```

**Step 3: Verify lint passes**

Run: `bun lint`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): add lastLoginMethod server plugin"
```

---

## Task 2: Add Client-Side Plugin

**Files:**
- Modify: `/lib/auth-client.ts:1-14` (add import and plugin)

**Step 1: Add import statement**

Add import at the top:
```typescript
import { lastLoginMethodClient } from "better-auth/client/plugins"
```

**Step 2: Add plugin to client config**

Update the plugins array:
```typescript
export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000",
    plugins: [passkeyClient(), adminClient(), lastLoginMethodClient()],
})
```

**Step 3: Verify lint passes**

Run: `bun lint`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/auth-client.ts
git commit -m "feat(auth): add lastLoginMethodClient plugin"
```

---

## Task 3: Update Auth Page to Display "Last Used" Badges

**Files:**
- Modify: `/app/auth/AuthPageClient.tsx:600-720` (passkey button and OAuth buttons)

**Step 1: Import the authClient at top of component (if not already imported)**

Already imported via context, but we need to use it directly. Check current imports around line 1-14.

**Step 2: Add helper to get last used method**

Add near the top of the component (after state declarations, around line 44):
```typescript
const lastMethod = authClient.getLastUsedLoginMethod()
```

**Step 3: Update Passkey button to show "Last used" badge**

Find the passkey button (around line 671-721) and update to show badge:

```tsx
<button
    onClick={async () => { /* existing handler */ }}
    disabled={isLoading || isPasskeyLoading}
    className='w-full py-3 bg-text/10 text-text font-semibold rounded-xl hover:bg-text/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
>
    {isPasskeyLoading ? (
        <>
            <div className='w-4 h-4 border-2 border-text/30 border-t-text rounded-full animate-spin' />
            Waiting for passkey...
        </>
    ) : (
        <>
            <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4' />
            </svg>
            <span>Sign in with Passkey</span>
            {lastMethod === "passkey" && (
                <span className='ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full'>
                    Last used
                </span>
            )}
        </>
    )}
</button>
```

**Step 4: Update Google button**

Find Google button (around line 733-782) and add badge:

```tsx
<button
    onClick={async () => { /* existing handler */ }}
    disabled={isLoading}
    className='w-full py-3 bg-text/10 text-text font-semibold rounded-xl hover:bg-text/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
>
    <svg viewBox='0 0 24 24' className='w-5 h-5' xmlns='http://www.w3.org/2000/svg'>
        {/* Google icon paths */}
    </svg>
    <span>Google</span>
    {lastMethod === "google" && (
        <span className='ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full'>
            Last used
        </span>
    )}
</button>
```

**Step 5: Update Discord button**

Find Discord button (around line 818-867) and add badge:

```tsx
<button
    onClick={async () => { /* existing handler */ }}
    disabled={isLoading}
    className='w-full py-3 bg-text/10 text-text font-semibold rounded-xl hover:bg-text/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
>
    <svg viewBox='0 0 24 24' className='w-5 h-5 fill-current' xmlns='http://www.w3.org/2000/svg'>
        {/* Discord icon path */}
    </svg>
    <span>Discord</span>
    {lastMethod === "discord" && (
        <span className='ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full'>
            Last used
        </span>
    )}
</button>
```

**Step 6: Update Email sign-in button**

Find email form submit button (around line 648-661) and add badge:

```tsx
<button
    type='submit'
    disabled={isLoading || (mode === "signup" && !acceptedTerms)}
    className='w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer'
>
    {isLoading
        ? "Loading..."
        : mode === "signin"
          ? "Sign in"
          : "Sign up"}
    {!isLoading && mode === "signin" && lastMethod === "email" && (
        <span className='ml-2 text-xs bg-white text-primary px-2 py-0.5 rounded-full'>
            Last used
        </span>
    )}
</button>
```

**Step 7: Verify lint passes**

Run: `bun lint`
Expected: No errors

**Step 8: Commit**

```bash
git add app/auth/AuthPageClient.tsx
git commit -m "feat(auth): display last used login method badges"
```

---

## Task 4: Test the Implementation

**Step 1: Start dev server**

Run: `bun dev`

**Step 2: Test email login**
1. Go to `/auth`
2. Sign in with email/password
3. Log out
4. Go back to `/auth`
5. Verify "Last used" badge appears on Email sign-in button

**Step 3: Test Google login**
1. Sign in with Google
2. Log out
3. Go back to `/auth`
4. Verify "Last used" badge appears on Google button

**Step 4: Test Discord login**
1. Sign in with Discord
2. Log out
3. Go back to `/auth`
4. Verify "Last used" badge appears on Discord button

**Step 5: Test Passkey login**
1. Sign in with Passkey
2. Log out
3. Go back to `/auth`
4. Verify "Last used" badge appears on Passkey button

**Step 6: Verify badge persists across sessions**
1. Close browser
2. Reopen and go to `/auth`
3. Verify "Last used" badge still shows

---

## Implementation Notes

### Methods Tracked
The plugin automatically tracks:
- `email` - Email/password sign in
- `google` - Google OAuth
- `discord` - Discord OAuth
- `passkey` - Passkey authentication

### Cookie Storage
The last login method is stored in a cookie named `better-auth.last_used_login_method` with:
- 30 day expiration
- HttpOnly: false (allows client-side JavaScript access)
- Same cookie settings as better-auth session cookies

### Database Storage (Optional)
If you want to persist last login method in the database for analytics:

1. Update `/lib/auth.ts` plugin config:
```typescript
lastLoginMethod({
    storeInDatabase: true
})
```

2. Run migration:
```bash
bunx @better-auth/cli migrate
```

3. The `lastLoginMethod` field will be added to the user table automatically.

### Custom Method Names
To customize the field name in database:
```typescript
lastLoginMethod({
    storeInDatabase: true,
    schema: {
        user: {
            lastLoginMethod: "last_auth_method"
        }
    }
})
```

---

## Success Criteria

- [ ] Server plugin is added to `/lib/auth.ts`
- [ ] Client plugin is added to `/lib/auth-client.ts`
- [ ] Auth page displays "Last used" badge on the last used login method
- [ ] Badge persists across browser sessions (30 days)
- [ ] Badge updates when user logs in with different method
- [ ] All auth methods work correctly (email, Google, Discord, passkey)
- [ ] No console errors
- [ ] Lint passes

---

## Related Documentation

- Better Auth Last Login Plugin: https://www.better-auth.com/docs/plugins/last-login-method
- Better Auth Plugins: https://www.better-auth.com/docs/concepts/plugins
