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

- **10 messages per session**
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

- Verify AI environment variables are set
- Check browser console for JavaScript errors
- Ensure `components/chat/ChatWidget` is mounted in layout

### Model errors

- Verify `OPENAI_COMPATIBLE_MODEL` is set to a valid model ID
- Run `bun run llm:models` to list available models
- Check API key has access to the specified model
