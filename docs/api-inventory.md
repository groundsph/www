# GroundsPH — API Routes & Server Actions Inventory

> Generated: 2025-07-17
> Purpose: Complete inventory of all Next.js API routes and server actions for migration planning to Elysia.js.

---

## 1. API ROUTES (Next.js Route Handlers)

These 11 endpoints live in `app/api/**/route.ts` and will need to be ported to Elysia route handlers.

| # | Route | Method | Purpose | File |
|---|-------|--------|---------|------|
| 1 | `/api/auth/[...all]` | GET, POST | Better Auth catch-all — delegates all auth routes (sign-in, sign-up, session, etc.) to the Better Auth library | `app/api/auth/[...all]/route.ts` |
| 2 | `/api/auth/reset-password` | POST | Sends a password reset email via Better Auth's `forgetPassword` endpoint. Always returns success to prevent email enumeration | `app/api/auth/reset-password/route.ts` |
| 3 | `/api/analytics/page-view` | POST | Records a cafe page view. Accepts `cafeId`, `visitorId`, `deviceType`, `referrer`. Silently succeeds on error | `app/api/analytics/page-view/route.ts` |
| 4 | `/api/chat/stream` | POST | SSE (Server-Sent Events) streaming chat endpoint. Validates message, checks rate limits, moderates content, creates conversation, streams AI response, saves messages, returns remaining count | `app/api/chat/stream/route.ts` |
| 5 | `/api/chat-status` | GET | Returns `{ enabled: boolean }` — checks if chat feature is enabled via feature flags | `app/api/chat-status/route.ts` |
| 6 | `/api/cron/daily` | GET | Unified daily cron job. Requires `CRON_SECRET` in Authorization header. Runs 5 jobs sequentially: check subscriptions, expire vouchers, update hidden gems, run leaderboard snapshots, cleanup system logs | `app/api/cron/daily/route.ts` |
| 7 | `/api/discount/claim/[campaignId]` | GET | Redirects to `/profile/vouchers?claim={campaignId}` for the frontend claim flow | `app/api/discount/claim/[campaignId]/route.ts` |
| 8 | `/api/ocr/stream` | POST | SSE streaming OCR endpoint. Accepts `cafeId` and `imageBase64`. Sends image to AI, extracts menu items, deduplicates against existing items, returns parsed items via SSE | `app/api/ocr/stream/route.ts` |
| 9 | `/api/profile/[userId]` | GET | Fetches a user's public profile by userId. Returns profile data with owned cafe count. Returns 404 if not found | `app/api/profile/[userId]/route.ts` |
| 10 | `/api/storage/upload` | POST | Handles file uploads via multipart form data. Accepts `file`, `bucket`, `cafeId`. Validates file type/size per bucket. Uploads to configured storage provider (Supabase or R2) | `app/api/storage/upload/route.ts` |
| 11 | `/api/webhooks/kofi` | POST, GET | Ko-fi webhook handler. POST: receives Ko-fi payment notifications, verifies webhook token, records payment, updates supporter status, awards badges, sends Discord notification. GET: returns status message | `app/api/webhooks/kofi/route.ts` |

---

## 2. SERVER ACTIONS

All files with `"use server"` directive. These are RPC-style functions called directly from client components. For Elysia migration, they can be grouped into controllers by domain.

### 2.1 Auth & Security

**File: `app/api/actions/auth.ts`**

| Function | Description |
|----------|-------------|
| `getLinkedAccounts()` | Returns user's linked OAuth accounts |
| `hasPassword()` | Checks if user has a password set |
| `setPassword(password)` | Sets a password for the user |
| `userHasPasskey()` | Checks if user has a passkey registered |
| `userHasTOTP()` | Checks if user has TOTP configured |
| `getUserAuthMethods()` | Returns all available auth methods for the user |
| `verifyUserPassword(password)` | Verifies user's password for sensitive actions |
| `verifyUserTOTP(code)` | Verifies TOTP code for sensitive actions |

**File: `app/api/actions/action-confirmation.ts`**

| Function | Description |
|----------|-------------|
| `hasPasskeySetup()` | Checks if passkey is available for action confirmation |
| `hasTOTPSetup()` | Checks if TOTP is available for action confirmation |
| `hasPasswordSetup()` | Checks if password is available for action confirmation |
| `getUserConfirmationStatus()` | Returns all available confirmation methods |
| `verifyPasskeyForAction()` | Initiates passkey verification for a sensitive action |
| `completePasskeyVerification()` | Completes passkey verification flow |
| `verifyTOTPForAction(code)` | Verifies TOTP for a sensitive action |
| `verifyPasswordForAction(password)` | Verifies password for a sensitive action |
| `verifyActionConfirmation(method, credentials)` | Generic action confirmation verifier |
| `requireActionConfirmation(action, verificationResult)` | Enforces action confirmation before sensitive operations |

**File: `app/api/actions/api-keys.ts`**

| Function | Description |
|----------|-------------|
| `listApiKeys()` | Lists API keys for the current user (admin/moderator) |
| `createApiKey(name?, expiresAt?)` | Creates a new API key (max 3 per user) |
| `deleteApiKey(keyId)` | Deletes an API key |

---

### 2.2 Cafe Management

**File: `app/api/actions/cafe.ts`**

| Function | Description |
|----------|-------------|
| `getCafeBySlug(slug, options)` | Fetches a single cafe by slug with optional related data |
| `getDailyFeatured()` | Returns the daily featured cafe |
| `getLocationFeatured(city?, region?)` | Returns a featured cafe for a location |
| `getAllCafes(page, limit, filters)` | Paginated cafe listing with filters |
| `getReviewsByCafeId(cafeId)` | Returns all reviews for a cafe |
| `getReviewsByCafeIdPaginated(cafeId, page, limit)` | Paginated reviews for a cafe |
| `getPublishedCafeCount()` | Returns total count of published cafes |
| `searchCafesSimple(query)` | Simple cafe search |
| `searchCafesForBlog(query)` | Cafe search for blog post linking |
| `getCafesByIds(ids)` | Bulk fetch cafes by array of IDs |
| `getCafesBySlugs(slugs)` | Bulk fetch cafes by array of slugs |

**File: `app/api/actions/submit.ts`**

| Function | Description |
|----------|-------------|
| `submitCafe(formData, thumbnailUrl, galleryUrls, menuItems)` | Cafe submission with Zod validation, duplicate detection (name + proximity), slug generation, DB insert, Discord notification, contribution logging, menu item insertion |

**File: `app/api/actions/owner.ts`** (22 functions — largest action file)

| Function | Description |
|----------|-------------|
| `isOwnerOfCafe(cafeId)` | Checks if current user is owner of a cafe |
| `getCafeIdBySlug(slug)` | Resolves cafe ID from slug |
| `getOwnedCafes()` | Lists all cafes owned by the current user |
| `getCafeForOwnerManagement(cafeId)` | Fetches full cafe data for owner dashboard |
| `updateCafeAsOwner(cafeId, updates)` | Updates cafe details as owner |
| `deleteCafeImageAsOwner(cafeId, imageUrl)` | Deletes a cafe image |
| `updateCafeStory(cafeId, content)` | Updates the cafe's story/description |
| `submitVerificationRequest(form)` | Submits a cafe verification request |
| `getVerificationStatus(cafeId)` | Gets verification status for a cafe |
| `getCafeReviewsForOwner(cafeId)` | Gets all reviews for owner's cafe |
| `respondToReview(form)` | Owner responds to a review |
| `deleteReviewResponse(responseId)` | Deletes an owner's review response |
| `pinReview(reviewId, cafeId)` | Pins a review to the top |
| `unpinReview(reviewId, cafeId)` | Unpins a review |
| `getCafeMenuItems(cafeId)` | Gets all menu items for a cafe |
| `addMenuItem(cafeId, item)` | Adds a menu item |
| `updateMenuItem(itemId, updates)` | Updates a menu item |
| `deleteMenuItem(itemId)` | Deletes a menu item |
| `getOwnerResponseForReview(reviewId)` | Gets owner's response for a specific review |
| `getOwnerResponsesForCafe(cafeId)` | Gets all owner responses for a cafe |
| `setCafeBadgeStamp(cafeId, imageUrl)` | Sets a badge stamp image for the cafe |
| `removeCafeBadgeStamp(cafeId)` | Removes the badge stamp image |

**File: `app/api/actions/claim.ts`**

| Function | Description |
|----------|-------------|
| `getOwnershipProofSignedUrl(proofUrl)` | Generates a signed URL for viewing proof documents |
| `submitCafeClaim(cafeId, proofText, proofDocumentUrl?)` | Submits a cafe ownership claim |
| `getUserClaims()` | Gets all claims by the current user |
| `getUserClaimForCafe(cafeId)` | Gets user's claim for a specific cafe |
| `getPendingClaims()` | Lists all pending claims (admin) |
| `approveClaim(claimId, notes?)` | Approves a claim with email + Discord notification |
| `rejectClaim(claimId, notes?)` | Rejects a claim with email + Discord notification |

**File: `app/api/actions/cafe-edit-permission.ts`**

| Function | Description |
|----------|-------------|
| `getCafeEditPermission(cafeId)` | Checks if current user (admin/moderator) can edit a cafe, respecting moderator region scoping |

**File: `app/api/actions/suggestions.ts`**

| Function | Description |
|----------|-------------|
| `submitEditSuggestion(cafeId, changes, imageChanges?)` | Submits a community edit suggestion for a cafe |
| `getUserSuggestions(userId)` | Gets suggestions by a user |
| `getPendingSuggestions()` | Lists all pending suggestions (admin) |
| `getCafeSuggestions(cafeId)` | Gets all suggestions for a cafe |
| `approveSuggestion(suggestionId, applyChanges?)` | Approves a suggestion with email + Discord notification |
| `rejectSuggestion(suggestionId, adminNotes?)` | Rejects a suggestion with email + Discord notification |
| `getPendingSuggestionsCount()` | Returns count of pending suggestions |

---

### 2.3 Reviews

**File: `app/api/actions/review.ts`**

| Function | Description |
|----------|-------------|
| `createReview(cafeId, rating, comment, images)` | Creates a review with Discord notification, badge awarding, passport update |
| `updateReview(reviewId, rating, comment, images)` | Updates an existing review |
| `deleteReview(reviewId)` | Deletes a review |
| `getUserReviewForCafe(cafeId)` | Gets current user's review for a cafe |
| `toggleReviewLike(reviewId)` | Toggles like/unlike on a review |
| `reportReview(reviewId)` | Reports a review (auto-flags at 3 reports) |
| `getRecentReviews(limit)` | Returns recent reviews across all cafes |

---

### 2.4 Profile & Social

**File: `app/api/actions/profile.ts`**

| Function | Description |
|----------|-------------|
| `getFullProfileData(userId, viewerId?)` | Aggregates full profile data (user, stats, badges, collections, etc.) |
| `getPublicProfileData(profile, viewerId?)` | Returns public-facing profile data |
| `checkUsernameAvailability(username, excludeUserId?)` | Checks if a username is available |
| `getProfileWithBadges(userId)` | Returns profile with badge information |
| `getAllBadges()` | Returns all available badges |
| `updateProfile(userId, data)` | Updates user profile |
| `updatePrivacySettings(isPrivate)` | Updates privacy settings |
| `getPrivacySettings()` | Gets current privacy settings |
| `getCafesByIds(ids)` | Bulk fetch cafes by IDs |
| `getProfileByUsername(username, viewerId?)` | Fetches profile by username |
| `getUserReviews(userId, viewerId?)` | Gets reviews by a user |
| `toggleWishlist(cafeId)` | Toggles cafe in wishlist |
| `toggleVisited(cafeId)` | Toggles cafe as visited |
| `toggleFavorite(cafeId)` | Toggles cafe as favorite |
| `recordVisit(cafeId, companionIds?)` | Records a cafe visit with optional companion tagging |
| `getTodayCheckIn(cafeId)` | Gets today's check-in for a cafe |
| `updateCheckIn(cafeId, companionIds)` | Updates a check-in with companions |

**File: `app/api/actions/social.ts`**

| Function | Description |
|----------|-------------|
| `followUser(targetUserId)` | Follows a user (privacy-aware — may create follow request) |
| `unfollowUser(targetUserId)` | Unfollows a user |
| `getPendingFollowRequests()` | Lists pending follow requests |
| `getPendingFollowRequestCount()` | Returns count of pending follow requests |
| `acceptFollowRequest(requestId)` | Accepts a follow request |
| `declineFollowRequest(requestId)` | Declines a follow request |
| `hasPendingFollowRequest(targetUserId)` | Checks if there's a pending request to a user |
| `isFollowing(targetUserId)` | Checks if current user follows a target |
| `getFollowCounts(userId)` | Returns follower/following counts |
| `getFollowers(userId, limit, offset, viewerId?)` | Paginated followers list |
| `getFollowing(userId, limit, offset, viewerId?)` | Paginated following list |
| `getFollowedUsersCheckIns(limit)` | Gets check-ins from followed users |
| `groupCheckInsByCafe(checkIns)` | Groups check-ins by cafe for feed display |
| `getLandingFeedGroupedByCafe(limit)` | Landing page feed grouped by cafe |
| `searchUsers(query, limit)` | Searches users by name/username |
| `getFollowRelationship(targetUserId)` | Gets follow relationship status with a user |

---

### 2.5 Blog

**File: `app/api/actions/blog.ts`**

| Function | Description |
|----------|-------------|
| `getPublishedBlogPosts(params)` | Paginated published blog posts |
| `getBlogPostBySlug(slug)` | Fetches a single blog post by slug |
| `autoSaveDraft(input)` | Auto-saves a blog draft |
| `getFeaturedPosts(limit)` | Returns featured blog posts |
| `incrementViewCount(postId)` | Increments blog post view count |
| `getAdminBlogPosts(params)` | Lists all blog posts for admin |
| `getWriterBlogPosts(params)` | Lists blog posts for a writer |
| `getWriterBlogPostById(id)` | Gets a specific post for writer editing |
| `getOwnerBlogPosts(cafeId)` | Lists blog posts for a cafe owner |
| `createBlogPost(input)` | Creates a blog post (role-based) |
| `updateBlogPost(postId, input)` | Updates a blog post |
| `deleteBlogPost(postId)` | Deletes a blog post |
| `publishBlogPost(postId)` | Publishes a blog post |
| `archiveBlogPost(postId)` | Archives a blog post |
| `approveBlogPost(postId)` | Approves a community blog post |
| `toggleFeatured(postId, featured)` | Toggles featured status |
| `createCommunityBlogPost(input)` | Creates a community blog post (pending moderation) |
| `getUserBlogPosts(params)` | Lists blog posts by a user |
| `getBlogPostById(postId)` | Fetches a blog post by ID |

**File: `app/api/actions/blog-report.ts`**

| Function | Description |
|----------|-------------|
| `reportBlogPost(input)` | Reports a blog post |
| `getBlogReports(filters)` | Lists blog reports (admin) |
| `getPendingBlogReportsCount()` | Returns count of pending blog reports |
| `resolveBlogReport(reportId, resolution, adminNotes?)` | Resolves a blog report |
| `archiveBlogPostForModeration(postId)` | Archives a post during moderation review |

---

### 2.6 Community (Collections, Crawls, Events)

**File: `app/api/actions/community.ts`**

| Function | Description |
|----------|-------------|
| `getPublicCollections(page, pageSize, sortBy, search?)` | Lists public collections |
| `searchUsers(query, limit)` | Searches users for community features |
| `getFeaturedUsers(limit)` | Returns featured users |
| `searchCommunityContent(query)` | Unified search across blogs, crawls, collections, events |

**File: `app/api/actions/collection.ts`**

| Function | Description |
|----------|-------------|
| `createCollection(data)` | Creates a cafe collection |
| `updateCollection(id, data)` | Updates a collection |
| `deleteCollection(id)` | Deletes a collection |
| `toggleLikeCollection(collectionId)` | Toggles like on a collection |
| `getCollectionBySlug(slug)` | Fetches a collection by slug |
| `getUserCollections(userId?)` | Lists collections by a user |
| `getCollectionForEdit(id)` | Gets collection data for editing |
| `addCafeToCollection(collectionId, cafeId, note?)` | Adds a cafe to a collection |
| `removeCafeFromCollection(collectionId, cafeId)` | Removes a cafe from a collection |
| `getCollectionsWithCafeStatus(cafeId)` | Gets collections that include a cafe |
| `searchCafesForCollection(query)` | Searches cafes for collection adding |
| `toggleSaveCollection(collectionId)` | Toggles save/bookmark on a collection |
| `getSavedCollections()` | Lists saved/bookmarked collections |

**File: `app/api/actions/cafe-crawls.ts`**

| Function | Description |
|----------|-------------|
| `createCafeCrawl(input)` | Creates a cafe crawl (multi-cafe route) |
| `getPublicCafeCrawls(page, pageSize, sortBy, search?)` | Lists public cafe crawls |
| `getCafeCrawlById(id)` | Fetches a crawl by ID |
| `getCafeCrawlBySlug(slug)` | Fetches a crawl by slug |
| `updateCafeCrawl(id, input)` | Updates a cafe crawl |
| `reorderCafeCrawl(id, input)` | Reorders cafes in a crawl |
| `toggleSaveCafeCrawl(crawlId)` | Toggles save/bookmark on a crawl |
| `toggleLikeCafeCrawl(crawlId)` | Toggles like on a crawl |
| `reportCafeCrawl(input)` | Reports a cafe crawl |
| `getSavedCafeCrawls()` | Lists saved/bookmarked crawls |
| `getUserCafeCrawls(userId?)` | Lists crawls by a user |
| `searchCafesForCrawl(query)` | Searches cafes for crawl creation |
| `searchCafeCrawls(query)` | Searches cafe crawls |
| `deleteCafeCrawl(id)` | Deletes a cafe crawl |

**File: `app/api/actions/events.ts`**

| Function | Description |
|----------|-------------|
| `getEvents(filters, page, pageSize)` | Lists events with filters |
| `getEvent(id)` | Fetches a single event by ID |
| `getUpcomingEvents(limit)` | Returns upcoming events |
| `getEventsForMonth(year, month, filters)` | Returns events for a specific month |
| `getLocalEvents(city?, region?, limit)` | Returns local events |
| `getNationalEvents(limit)` | Returns national events |
| `createEvent(input)` | Creates an event |
| `updateEvent(eventId, input)` | Updates an event |
| `deleteEvent(eventId)` | Deletes an event |
| `publishEvent(eventId)` | Publishes an event |
| `cancelEvent(eventId)` | Cancels an event |
| `getAdminEvents(page, pageSize)` | Lists all events for admin |
| `getCafeEvents(cafeId)` | Lists events for a cafe |
| `submitCommunityEvent(input)` | Submits a community event (auto-publishes for privileged users) |
| `getPendingEvents()` | Lists pending events (admin) |
| `approveCommunityEvent(eventId)` | Approves a community event with email + Discord notification |
| `rejectCommunityEvent(eventId, reason?)` | Rejects a community event with email + Discord notification |

---

### 2.7 Menu & OCR

**File: `app/api/actions/menu-ocr.ts`**

| Function | Description |
|----------|-------------|
| `normalizeName(name)` | Normalizes menu item names for comparison |
| `levenshteinDistance(a, b)` | Calculates Levenshtein distance between two strings |
| `isSimilarName(a, b)` | Checks if two menu item names are similar |
| `deduplicateMenuItems(newItems, existingItems)` | Deduplicates OCR results against existing items |
| `scanMenuImage(cafeId, imageBase64)` | Sends image to AI for menu extraction |
| `saveOcrMenuItems(cafeId, items)` | Saves OCR-extracted menu items to DB |

**File: `app/api/actions/menu-suggestions.ts`**

| Function | Description |
|----------|-------------|
| `submitMenuItemSuggestion(cafeId, type, data, targetItemId?)` | Submits a suggestion to add/edit/remove a menu item |
| `getMenuItemSuggestionsForCafe(cafeId)` | Lists menu suggestions for a cafe |
| `getPendingMenuItemSuggestions()` | Lists all pending menu suggestions (admin) |
| `getPendingMenuItemSuggestionsCount(cafeId)` | Returns count of pending suggestions for a cafe |
| `approveMenuItemSuggestion(suggestionId)` | Approves a menu suggestion |
| `rejectMenuItemSuggestion(suggestionId, adminNotes?)` | Rejects a menu suggestion |

**File: `app/api/actions/menu-comparison.ts`**

| Function | Description |
|----------|-------------|
| `searchMenuItemsAction(query, limit)` | Searches menu items across cafes for price comparison |

**File: `app/api/actions/price-level.ts`**

| Function | Description |
|----------|-------------|
| `recalculatePriceLevel(cafeId)` | Recalculates a cafe's price level based on menu item prices |

---

### 2.8 Discounts & Vouchers

**File: `app/api/actions/discount.ts`**

| Function | Description |
|----------|-------------|
| `getCampaignsForCafe(cafeId, filters?)` | Lists discount campaigns for a cafe |
| `getCampaignById(campaignId)` | Fetches a campaign by ID |
| `createCampaign(cafeId, input)` | Creates a discount campaign |
| `updateCampaign(campaignId, input)` | Updates a campaign |
| `deleteCampaign(campaignId)` | Deletes a campaign |
| `generateVouchers(input)` | Generates voucher codes for a campaign |
| `issueVoucherToUser(input)` | Issues a voucher directly to a user |
| `getPublicCampaignsForCafe(cafeId)` | Lists publicly visible campaigns for a cafe |
| `claimVoucher(input)` | Claims a voucher by code |
| `claimVoucherFromCampaign(input)` | Claims a voucher from a campaign |
| `redeemVoucher(input)` | Redeems a voucher (owner action) |
| `getUserVouchers()` | Lists current user's vouchers |
| `getCampaignVouchers(campaignId, page, pageSize)` | Lists vouchers for a campaign |
| `lookupVoucherByCode(code)` | Looks up a voucher by its unique code |
| `cancelVoucher(voucherId)` | Cancels a voucher |
| `getRedemptionLogs(campaignId, page, pageSize)` | Lists redemption logs for a campaign |
| `getOwnerCampaigns()` | Lists campaigns for the current owner |

---

### 2.9 Inventory

**File: `app/api/actions/inventory.ts`**

| Function | Description |
|----------|-------------|
| `getInventoryItems(cafeId, filters?)` | Lists inventory items for a cafe |
| `getInventoryStats(cafeId)` | Returns inventory stats (total items, low stock, valuation) |
| `createInventoryItem(cafeId, input)` | Creates an inventory item |
| `updateInventoryItem(itemId, input)` | Updates an inventory item |
| `softDeleteInventoryItem(itemId)` | Soft-deletes an inventory item |
| `restoreInventoryItem(itemId)` | Restores a soft-deleted item |
| `deleteInventoryItem(itemId)` | Permanently deletes an inventory item |
| `adjustInventoryStock(itemId, input)` | Adjusts stock quantity |
| `restockInventoryItem(itemId, input)` | Records a restock event |
| `getRestockHistory(itemId)` | Returns restock history for an item |
| `buildInventoryCsv(items)` | Builds CSV content from inventory items |
| `exportInventoryToCSV(cafeId, filters?)` | Exports inventory to CSV file |

---

### 2.10 Analytics

**File: `app/api/actions/analytics.ts`**

| Function | Description |
|----------|-------------|
| `getCafeAnalytics(cafeId, days?)` | Returns cafe analytics for owners (views, visitors, device breakdown, top referrers) |

**File: `app/api/actions/site-analytics.ts`**

| Function | Description |
|----------|-------------|
| `getSiteAnalytics(days?)` | Site-wide analytics (admin only) |
| `getCafeAnalyticsSummary()` | Per-cafe analytics summary with trends |

---

### 2.11 Admin & Moderation

**File: `app/api/actions/admin.ts`**

| Function | Description |
|----------|-------------|
| `updateUserActivityStats(userId)` | Calculates activity points and scout rank |
| `getLeaderboardSnapshotStatus(months)` | Checks leaderboard snapshot coverage |
| `backfillAllMissingLeaderboardSnapshots(months)` | Backfills missing leaderboard snapshots |
| `isAdmin()` | Checks if current user is admin |
| `getUserRole()` | Returns current user's role |
| `getPendingCafes()` | Lists cafes pending approval |
| `approveCafe(cafeId)` | Approves a cafe submission |
| `rejectCafe(cafeId, reason?)` | Rejects a cafe submission |
| `deleteCafe(cafeId)` | Deletes a cafe |
| `getCafeById(cafeId)` | Fetches a cafe by ID |
| `updateCafe(cafeId, updates)` | Updates cafe details (admin) |
| `bulkMarkAsChain(cafeIds, isChain)` | Bulk marks cafes as chain/non-chain |
| `adminDeleteCafeImage(imageUrl)` | Deletes a cafe image (admin) |
| `getPublishedCafes()` | Lists all published cafes |
| `getPaginatedCafes(params)` | Paginated cafe listing with filters |
| `getCafeFilterOptions()` | Returns available filter options for cafes |
| `unpublishCafe(cafeId)` | Unpublishes a cafe |
| `getCafeStory(cafeId)` | Gets a cafe's story |
| `upsertCafeStory(cafeId, content)` | Creates or updates a cafe story |
| `deleteCafeStory(cafeId)` | Deletes a cafe story |

**File: `app/api/actions/admin-stats.ts`**

| Function | Description |
|----------|-------------|
| `getSystemStats()` | System statistics (user count, DB size, storage usage, business metrics) |

**File: `app/api/actions/admin/feature-flags.ts`**

| Function | Description |
|----------|-------------|
| `getChatEnabledFlag()` | Gets the chat enabled feature flag |
| `setChatEnabled(enabled)` | Sets the chat enabled feature flag |

**File: `app/api/actions/moderation.ts`**

| Function | Description |
|----------|-------------|
| `getPendingCommunityPosts(page, pageSize)` | Lists pending community blog posts |
| `rejectBlogPost(postId, reason)` | Rejects a community blog post with reason |
| `getModerationStats()` | Returns moderation stats (pending/approved/rejected counts) |

---

### 2.12 Notifications

**File: `app/api/actions/user-notifications.ts`**

| Function | Description |
|----------|-------------|
| `createNotification(input)` | Creates an in-app notification |
| `getUserNotifications(userId, limit)` | Lists notifications for a user |
| `markNotificationRead(notificationId)` | Marks a single notification as read |
| `markAllNotificationsRead()` | Marks all notifications as read |
| `getUnreadCount()` | Returns unread notification count |

**File: `app/api/actions/notify.ts`**

| Function | Description |
|----------|-------------|
| `notifyDiscord(name, location, submitter?)` | Sends cafe submission notification to Discord |
| `notifyDiscordReviewReport(reviewId, cafeInfo, reportCount, reporterName?)` | Sends review report notification to Discord |
| `notifyDiscordEditSuggestion(cafeInfo, suggestedFields, submitterName?)` | Sends edit suggestion notification to Discord |
| `notifyDiscordCafeClaim(cafeInfo, claimantName, proofSummary)` | Sends cafe claim notification to Discord |
| `notifyDiscordBlogReport(blogInfo, reason, reporterName?)` | Sends blog report notification to Discord |
| `notifyDiscordEventSubmission(eventInfo, submitterName?)` | Sends event submission notification to Discord |
| `notifyDiscordCritical(title, description, errorContext)` | Sends critical error alert to Discord (rate-limited) |

---

### 2.13 Search & Location

**File: `app/api/actions/search.ts`**

| Function | Description |
|----------|-------------|
| `searchCafesAndUsers(query)` | Searches cafes and users |
| `globalSearch(query, userLat?, userLng?)` | Unified global search across cafes, users, blogs, crawls, collections, events, menu items (supports `@` for users, `#` for menu items, `>` for quick actions) |

**File: `app/api/actions/location.ts`**

| Function | Description |
|----------|-------------|
| `getLocationFromIP()` | Returns geolocation data from the client's IP |
| `extractCoordsFromGoogleMapsUrl(inputUrl)` | Extracts lat/lng coordinates from a Google Maps URL |
| `reverseGeocodeAndMatch(lat, lng)` | Reverse geocodes coordinates via Nominatim and matches to known locations |

**File: `app/api/actions/nearby.ts`**

| Function | Description |
|----------|-------------|
| `getNearbyCafes(lat, lng, limit, radiusInMeters)` | Finds cafes within a radius using Haversine distance with bounding box optimization |

**File: `app/api/actions/map.ts`**

| Function | Description |
|----------|-------------|
| `getCafesInBounds(bounds)` | Fetches published cafes within map viewport bounds with optional filters (chains, 24/7, halal) |

---

### 2.14 Other Actions

**File: `app/api/actions/contact.ts`**

| Function | Description |
|----------|-------------|
| `sendContactEmail(data)` | Validates and sends a contact form email via Resend with React Email template |

**File: `app/api/actions/contributions.ts`**

| Function | Description |
|----------|-------------|
| `getCafeContributions(cafeId, limit)` | Lists contributions (submissions, suggestions) for a cafe |
| `getUserContributions(userId, limit)` | Lists contributions by a user |

**File: `app/api/actions/hidden-gems.ts`**

| Function | Description |
|----------|-------------|
| `evaluateHiddenGems()` | Monthly evaluation of hidden gem cafes, graduation based on unique visitor threshold |
| `getHiddenGemStats(cafeId)` | Returns hidden gem statistics for a cafe |

**File: `app/api/actions/leaderboard.ts`**

| Function | Description |
|----------|-------------|
| `getCafeMonthlyLeaderboard(region?, limit?, yearMonth?)` | Monthly cafe leaderboard — live aggregation for current month, snapshot-based for past months |

**File: `app/api/actions/mall-cafe.ts`**

| Function | Description |
|----------|-------------|
| `submitMallCafeVerification(input)` | Submits a mall cafe verification with proof documents |
| `getPendingMallVerifications()` | Lists pending mall verifications (admin) |
| `approveMallCafeVerification(verificationId, adminNotes?)` | Approves a mall cafe verification |
| `rejectMallCafeVerification(verificationId, adminNotes?)` | Rejects a mall cafe verification |
| `getMallVerificationProofUrl(documentUrl)` | Generates a signed URL for viewing proof documents |
| `searchBranchCafes(query)` | Searches for branch cafes to link |
| `getMallVerificationByCafeId(cafeId)` | Gets mall verification status for a cafe |

**File: `app/api/actions/report.ts`**

| Function | Description |
|----------|-------------|
| `submitCafeReport(cafeId, reason, details?)` | Reports a cafe (closed/doesn't exist/other), auto-hides at threshold of 5 reports |

**File: `app/api/actions/system-logs.ts`**

| Function | Description |
|----------|-------------|
| `logSystemAction(action, entityType, entityId, beforeValue?, afterValue?, metadata?)` | Logs an admin action to the audit log |
| `getSystemLogs(filters, page, pageSize)` | Queries system logs with filters |
| `getSystemLogStats(days?)` | Returns system log statistics |
| `exportSystemLogsCSV(filters?)` | Exports system logs to CSV |

**File: `app/api/actions/claim-supporter.ts`**

| Function | Description |
|----------|-------------|
| `claimSupporterStatus(kofiEmail)` | Links a Ko-fi payment to a user account by email, calculates expiry, awards badges |

**File: `app/api/actions/ai.ts`**

| Function | Description |
|----------|-------------|
| `listModelsAction()` | Lists available AI models |
| `generateExcerptAction(content)` | Generates a blog post excerpt using AI |

**File: `app/api/actions/badges.ts`**

| Function | Description |
|----------|-------------|
| `getBadgeByName(name)` | Looks up a badge by name |

**File: `app/api/actions/chat-history.ts`**

| Function | Description |
|----------|-------------|
| `createConversation(sessionId)` | Creates a new chat conversation |
| `saveMessage(conversationId, role, content, toolCalls?, toolCallId?)` | Saves a chat message |
| `endConversation(conversationId)` | Marks a conversation as ended |

**File: `app/api/actions/chat-feedback.ts`**

| Function | Description |
|----------|-------------|
| `submitChatFeedback(messageId, rating, comment?)` | Submits feedback on an AI chat response (rating: 1 or -1) |

---

### 2.15 Utility Server Actions (outside `app/api/actions/`)

These are server actions located in `utils/` that are called from components.

**File: `utils/storage/actions.ts`**

| Function | Description |
|----------|-------------|
| (various) | File upload, single/bulk image deletion, orphaned image cleanup, avatar deletion queue processing |

**File: `utils/badges/badge-logic.ts`**

| Function | Description |
|----------|-------------|
| `checkAndAwardBadges(userId, triggers)` | Checks and awards badges based on triggers (reviews, visits, geographic coverage, supporter status, scout activity) |

**File: `utils/ai/chat-stream.ts`**

| Function | Description |
|----------|-------------|
| `runChatStream({ message, sessionId, conversationId, context, history, onChunk, onMessage })` | Executes AI chat stream — runs cafe queries, builds responses, handles tool calls, streams chunks |

**File: `utils/chat-session.ts`**

| Function | Description |
|----------|-------------|
| `getOrCreateChatSessionId(existingSessionId)` | Gets or creates a chat session ID |
| `getChatSessionId()` | Gets the current chat session ID from cookies |

---

## 3. SUMMARY

| Category | Count |
|----------|-------|
| **API Routes (route.ts)** | **11** |
| **Server Action files** | **47** |
| **Total exported functions** | **~180+** |

### Domain Breakdown by Function Count

| Domain | Functions | Key Files |
|--------|-----------|-----------|
| Cafe Management | ~40+ | `cafe.ts`, `owner.ts`, `submit.ts`, `claim.ts`, `suggestions.ts` |
| Profile & Social | ~20+ | `profile.ts`, `social.ts` |
| Blog | ~19 | `blog.ts`, `blog-report.ts` |
| Discounts & Vouchers | ~17 | `discount.ts` |
| Community (Collections/Crawls/Events) | ~30+ | `collection.ts`, `cafe-crawls.ts`, `events.ts`, `community.ts` |
| Admin & Moderation | ~25+ | `admin.ts`, `admin-stats.ts`, `moderation.ts`, `feature-flags.ts` |
| Menu & OCR | ~10 | `menu-ocr.ts`, `menu-suggestions.ts`, `menu-comparison.ts`, `price-level.ts` |
| Inventory | ~12 | `inventory.ts` |
| Auth & Security | ~13 | `auth.ts`, `action-confirmation.ts`, `api-keys.ts` |
| Reviews | ~7 | `review.ts` |
| Search & Location | ~7 | `search.ts`, `location.ts`, `nearby.ts`, `map.ts` |
| Analytics | ~3 | `analytics.ts`, `site-analytics.ts` |
| Notifications | ~12 | `user-notifications.ts`, `notify.ts` |
| Other | ~12 | `contact.ts`, `contributions.ts`, `hidden-gems.ts`, `leaderboard.ts`, `mall-cafe.ts`, `report.ts`, `system-logs.ts`, `claim-supporter.ts`, `ai.ts`, `badges.ts`, `chat-history.ts`, `chat-feedback.ts` |
| Utility (utils/) | ~4 | `storage/actions.ts`, `badges/badge-logic.ts`, `ai/chat-stream.ts`, `chat-session.ts` |

### Migration Notes for Elysia.js

1. **API Routes** → Elysia route handlers (straightforward — each route.ts becomes an Elysia handler)
2. **Server Actions** → Elysia controllers grouped by domain. Each action file maps to a controller:
   - `cafe.ts` + `owner.ts` + `submit.ts` + `claim.ts` + `suggestions.ts` → `cafe.controller.ts`
   - `profile.ts` + `social.ts` → `profile.controller.ts`
   - `blog.ts` + `blog-report.ts` → `blog.controller.ts`
   - etc.
3. **Auth** → Better Auth has its own Elysia plugin (`@better-auth/elysia`) — use that instead of reimplementing
4. **SSE endpoints** (`/api/chat/stream`, `/api/ocr/stream`) → Elysia supports SSE natively
5. **Cron** → Elysia has a cron plugin or use an external scheduler
6. **Webhooks** → Standard POST handlers in Elysia
7. **File upload** → Elysia supports multipart form data via `@elysiajs/eden` or native `body` parsing