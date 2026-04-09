# AI Chat Documentation

The Grounds platform includes an AI-powered chat assistant that helps users discover cafes, compare locations, and answer questions about amenities, ratings, and reviews.

## Overview

The AI chat feature provides a floating chat widget where users can ask natural language questions like:

- "Top 5 cafes in Cebu near each other"
- "Pet-friendly cafes with outdoor seating in Manila"
- "Best artisan coffee in Makati under medium price"
- "Cafes near 10.3157, 123.8854 within 2km"
- "Compare Good Cup vs Tightrope"
- "What cities have the most cafes?"

## Chat Availability Toggle

The AI chat can be disabled via environment variable or admin toggle.

### Environment Variable

| Variable | Description | Values |
|----------|-------------|--------|
| `CHAT_ENABLED` | Optional override to disable chat | `"true"` (default), `"false"` or `"0"` |

When `CHAT_ENABLED` is set to `"false"` or `"0"`, the chat widget is completely disabled regardless of the database setting.

### Admin Toggle

Admins can control chat availability at runtime via `/manage/system/settings` under the **Settings** tab. This updates a flag in the database without requiring a deployment.

### Precedence Rules

Chat availability is determined in this order:

1. **Environment variable** (`CHAT_ENABLED`) - Takes highest priority
2. **Database flag** - Checked if no env var override
3. **Default** - Chat is enabled if neither is set

```
CHAT_ENABLED env var → Database flag → Default (enabled)
```

### Usage

**Disable chat temporarily** (admin):
- Go to `/manage/system/settings`
- Toggle off
- No restart needed

**Disable chat permanently** (deployment):
- Set `CHAT_ENABLED=false` in `.env.local`
- Redeploy

**Emergency shutdown** (immediate):
- Set `CHAT_ENABLED=0` and restart
- Overrides admin toggle

## Environment Variables

### Required for AI Features

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_COMPATIBLE_BASE_URL` | Base URL of your OpenAI-compatible API | `https://api.openai.com/v1` |
| `OPENAI_COMPATIBLE_API_KEY` | API key for authentication | `sk-...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_COMPATIBLE_MODEL` | Model used for chat completions | `gpt-4o-mini` |
| `OPENAI_COMPATIBLE_EXCERPT_MODEL` | Model used for blog excerpt generation | `gpt-4` |
| `BLOG_CHECK_MODEL` | Model used for blog content moderation | `gpt-4` |

## Rate Limiting

To prevent abuse and manage costs, the AI chat enforces rate limits per user session.

### Limits

- **30 messages per session**
- **7-day rolling window** - After 7 days from the first message, the counter resets

### How It Works

1. Each user session has a unique session ID
2. The session ID is stored in an httpOnly cookie for anonymous users
3. Authenticated users use their Better Auth user ID as the session ID
4. Usage is tracked in the database (`chat_rate_limits` table)
5. When the limit is reached, users see: "Rate limit exceeded. Please try again later."
6. The remaining message count is displayed in the chat UI

### Session Types

**Authenticated Users:**
- Session ID = Better Auth user ID
- Rate limit persists across devices
- Logging in on a new device shares the same quota

**Anonymous Users:**
- Session ID = Random UUID stored in httpOnly cookie
- Rate limit is device/browser specific
- Clearing cookies resets the session (starts fresh with 10 messages)

## Architecture

### Components

```
┌─────────────────┐
│  ChatWidget     │  Floating button (bottom-right)
│  (Client)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ChatWindow     │  Chat panel with messages
│  (Client)       │
└────────┬────────┘
         │ sendChatMessage()
         ▼
┌─────────────────┐
│  sendChatMessage│  Server action
│  (Server)       │  - Validates input
└────────┬────────┘  - Checks rate limit
         │            - Calls AI with tools
         ▼            - Returns response
┌─────────────────┐
│  runChatWithTools│ AI tool-calling loop
│  (Server)       │  - Executes cafe queries
└────────┬────────┘  - Formats responses
         │
         ▼
┌─────────────────┐
│  Cafe Query     │  Deterministic DB queries
│  Tools          │  - Filter by location
└─────────────────┘  - Sort by rating
                     - Geo-proximity search
```

### Database Schema

The rate limiting uses a dedicated table:

```sql
CREATE TABLE chat_rate_limits (
    session_id TEXT PRIMARY KEY,
    used_count INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### Available Tools

The AI assistant has access to these cafe query tools:

| Tool | Description |
|------|-------------|
| `query_cafes` | Search and filter cafes by location, amenities, ratings |
| `get_cafe_by_slug` | Get detailed info about a specific cafe |
| `compare_cafes` | Compare two cafes side by side |
| `list_cities` | List all cities with cafe counts |
| `get_nearby_cafes` | Find cafes near specific coordinates |
| `get_top_rated` | Get top-rated cafes in a city |

### Query Parameters

The `query_cafes` tool supports:

**Location:**
- `city` - City or municipality name
- `province` - Province name
- `region` - Region name
- `area` - Area or neighborhood
- `nearLatLng` - Coordinates for proximity search
- `radiusKm` - Search radius in kilometers

**Filtering:**
- `hasWifi`, `hasSockets`, `hasAircon`
- `isPetFriendly`, `isWorkFriendly`
- `servesFood`, `hasOutdoorSeating`
- `priceLevel` - low, medium, high
- `coffeeStyle` - classic, artisan
- `isHiddenGem`, `isChain`

**Sorting:**
- `sortBy` - rating, distance, recent, reviews
- `limit` - Maximum results (default 10)

## Security Considerations

1. **Read-only access** - Cafe query tools only perform SELECT operations
2. **No PII exposure** - Tools don't return user data, reviews, or sensitive information
3. **Input validation** - All inputs validated with Zod schemas
4. **Rate limiting** - Prevents abuse and manages costs
5. **Timeout handling** - AI calls timeout after 30 seconds
6. **Error boundaries** - Failed tool calls return safe fallback responses

## Configuration Example

Add to `.env.local`:

```bash
# Required for AI chat
OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
OPENAI_COMPATIBLE_API_KEY=sk-your-api-key-here

# Optional: Override default chat model
OPENAI_COMPATIBLE_MODEL=gpt-4o

# Optional: Blog AI features
OPENAI_COMPATIBLE_EXCERPT_MODEL=gpt-4
BLOG_CHECK_MODEL=gpt-4
```

## Testing

Run the chat-specific tests:

```bash
# Test rate limiting
bun test utils/__tests__/chat-rate-limit.test.ts

# Test chat types/schemas
bun test utils/__tests__/chat-types.test.ts

# Test session handling
bun test utils/__tests__/chat-session.test.ts

# Test AI tools
bun test utils/ai/__tests__/chat-tools.test.ts

# Test server action
bun test app/api/actions/__tests__/chat-actions.test.ts
```

## Troubleshooting

### Chat returns "Rate limit exceeded"

- Check remaining messages in the UI
- Wait for the 7-day window to reset
- For testing: clear browser cookies (anonymous users) or check database directly

### AI responses are slow

- Check `OPENAI_COMPATIBLE_BASE_URL` latency
- Consider using a closer API endpoint
- Tool calls may require multiple database queries

### Chat widget not appearing

- Check `CHAT_ENABLED` is not set to `false` or `0`
- Verify the admin toggle at `/manage/system/settings` is enabled
- Verify AI environment variables are set
- Check browser console for JavaScript errors
- Ensure `components/chat/ChatWidget` is mounted in layout

### Model errors

- Verify `OPENAI_COMPATIBLE_MODEL` is set to a valid model ID
- Run `bun run llm:models` to list available models
- Check API key has access to the specified model

## Chat Guardrails and Safety

The chat system includes content moderation to prevent abuse:

### Implemented Guardrails

- **Prompt injection detection**: Blocks attempts to override system instructions
- **Content filtering**: Detects malicious patterns (scripts, code injection)
- **Input sanitization**: Removes HTML tags, limits message length to 1000 characters
- **Rate limiting**: Prevents spam via session-based limits

### Usage

Guardrails are automatically applied to all chat messages before processing. Blocked messages return a user-friendly error without consuming rate limit quota.

## Cafe Cards in Chat

When the AI returns cafe search results, they are displayed as horizontal scrolling cards:

- **Visual cards**: Show thumbnail, name, location, rating
- **Halal badge**: Displayed on certified cafes
- **Click-through**: Navigate to cafe detail page
- **Animations**: Smooth entrance with motion effects

## Chat Response Structure

The chat API returns a structured JSON response that includes both the conversational message and rich cafe data for rendering cards.

### Response Schema

```typescript
interface ChatResponse {
    success: boolean
    message: string
    remaining: number
    cafes?: CafeCard[]
    cardContext?: CardContext
}
```

### Cafe Card Schema

Each cafe in the `cafes` array includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique cafe identifier (UUID) |
| `slug` | `string` | URL-friendly identifier for navigation |
| `title` | `string` | Cafe name |
| `coverImageUrl` | `string` | Thumbnail image URL |
| `filters` | `string[]` | Amenity badges (e.g., "WiFi", "Power sockets", "Outdoor seating") |
| `flags` | `string[]` | Certification flags (e.g., "Halal") |
| `custom` | `string` | Context label displayed on the card (e.g., "Near you", "Top rated") |

### Card Context Schema

The `cardContext` provides metadata for the card carousel header:

| Field | Type | Description |
|-------|------|-------------|
| `queryType` | `"nearby" \| "top_rated" \| "search"` | Type of query performed |
| `title` | `string` | Carousel header title |
| `custom` | `string` | Short label for individual cards |

### Query Type Mappings

| Query Type | Context Title | Card Custom Label | Use Case |
|------------|---------------|-------------------|----------|
| `nearby` | "Near you" | "Near you" | Proximity-based searches |
| `top_rated` | "Top rated" | "Top rated" | Best-rated cafes in area |
| `search` | "Search results" | "Result" | General search/filter results |

### Example Response

```json
{
  "success": true,
  "message": "I found 3 great cafes near you!",
  "remaining": 9,
  "cafes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "slug": "kape-lokal",
      "title": "Kape Lokal",
      "coverImageUrl": "https://example.com/cafe-thumb.jpg",
      "filters": ["WiFi", "Power sockets", "Pet friendly"],
      "flags": ["Halal"],
      "custom": "Near you"
    }
  ],
  "cardContext": {
    "queryType": "nearby",
    "title": "Near you",
    "custom": "Near you"
  }
}
```

### Implementation Notes

- Cards render in a horizontal scroll carousel
- Clicking a card navigates to `/cafe/{slug}`
- The `remaining` field shows rate limit quota for the session
- Context is optional for non-cafe queries (returns `success: true` with just a message)

## Structured Tool Responses

The chat system now returns structured data alongside text responses:

```typescript
interface ChatResponse {
    message: string
    cafes?: CafeWithRatings[]  // For cafe queries
    remaining: number          // Rate limit remaining
}
```

This enables rich UI experiences like the cafe card carousel.

## Crawl Drafts in Chat

When a user asks for a crawl/route, the chat response may include a `crawlDraft` payload.

```json
{
  "crawlDraft": {
    "title": "Cebu Coffee Crawl",
    "description": "A short crawl curated from your request.",
    "isPublic": false,
    "items": [
      {
        "cafeId": "...",
        "name": "Cafe Uno",
        "slug": "cafe-uno",
        "thumbnail": null,
        "cityMunicipality": "Cebu City",
        "region": "Central Visayas",
        "lat": 10.3157,
        "lng": 123.8854,
        "sortOrder": 0,
        "note": null
      }
    ]
  }
}
```

The chat UI renders a crawl preview card and provides a "Save Crawl" button that opens `/community/crawls/create?draft=chat` with the draft prefilled and set to private.
