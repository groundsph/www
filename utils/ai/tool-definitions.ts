export const CHAT_SYSTEM_PROMPT = `You are a helpful assistant for Grounds, a coffee discovery platform for the Philippines.

You have access to tools for querying cafe information. When a user asks about cafes, use the appropriate tool.

Available tools:
- query_cafes: Search and filter cafes by location, amenities, ratings, etc.
- get_cafe_by_slug: Get detailed information about a specific cafe by its slug
- compare_cafes: Compare two cafes side by side
- list_cities: List all cities with cafe counts
- get_nearby_cafes: Find cafes near a specific location
- get_top_rated: Get top rated cafes in a city
- get_cafe_reviews: Get recent reviews for a specific cafe
- get_cafe_menu: Get the menu for a specific cafe
- get_cafe_hours: Check a cafe's operating hours and current open/closed status
- search_blog_posts: Search blog posts about cafes and coffee
- get_upcoming_events: Get upcoming coffee events and meetups
- find_hidden_gems: Discover hidden gem cafes and lesser-known spots
- find_cafes_with_feature: Find cafes with specific combinations of amenities
- get_grounds_info: Return general information about Grounds.ph features and how to use the platform
- get_cafe_stats: Get aggregate statistics about cafes

Rules:
1. Always use tools when the user asks for specific cafe information
2. If a location is mentioned (e.g., "Cebu", "Manila"), use query_cafes with the city filter
3. If the user asks for "top" or "best" cafes, use get_top_rated or sort by rating
4. If the user asks for cafes "near" a location, use get_nearby_cafes
5. Use get_grounds_info for questions about Grounds.ph platform, features, or how to use the site
6. Ask clarifying questions if day/time or start location is missing for crawl requests
7. Provide concise, helpful responses based on the tool results
8. If no cafes match the query, politely inform the user
9. When you have enough data, respond with a final answer and do not call more tools.
10. If the user refers to the previous list or says things like "from those" or "make a crawl from these", use the recent context rather than calling tools again.
11. If you render tables, use proper Markdown tables with each row on its own line. If you cannot format a table, use bullet points instead.`

export interface ToolDefinition {
    type: "function"
    function: {
        name: string
        description: string
        parameters: object
    }
}

export const CHAT_TOOLS: ToolDefinition[] = [
    {
        type: "function",
        function: {
            name: "query_cafes",
            description: "Search and filter cafes by location, amenities, ratings, and other criteria",
            parameters: {
                type: "object",
                properties: {
                    city: { type: "string", description: "City or municipality name" },
                    province: { type: "string", description: "Province name" },
                    region: { type: "string", description: "Region name" },
                    area: { type: "string", description: "Area or neighborhood" },
                    limit: { type: "number", description: "Maximum number of results (max 50)" },
                    offset: { type: "number", description: "Offset for pagination" },
                    sortBy: { type: "string", enum: ["rating", "distance", "recent", "reviews"], description: "Sort order" },
                    hasWifi: { type: "boolean", description: "Filter for cafes with WiFi" },
                    hasSockets: { type: "boolean", description: "Filter for cafes with power sockets" },
                    hasAircon: { type: "boolean", description: "Filter for cafes with air conditioning" },
                    isPetFriendly: { type: "boolean", description: "Filter for pet-friendly cafes" },
                    isWorkFriendly: { type: "boolean", description: "Filter for work-friendly cafes" },
                    servesFood: { type: "boolean", description: "Filter for cafes that serve food" },
                    hasOutdoorSeating: { type: "boolean", description: "Filter for cafes with outdoor seating" },
                    priceLevel: { type: "string", enum: ["low", "medium", "high"], description: "Price level filter" },
                    coffeeStyle: { type: "string", enum: ["classic", "artisan"], description: "Coffee style filter" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_cafe_by_slug",
            description: "Get detailed information about a specific cafe by its slug identifier",
            parameters: {
                type: "object",
                properties: {
                    slug: { type: "string", description: "The cafe's unique slug identifier" },
                },
                required: ["slug"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "compare_cafes",
            description: "Compare two cafes side by side",
            parameters: {
                type: "object",
                properties: {
                    slugA: { type: "string", description: "Slug of the first cafe" },
                    slugB: { type: "string", description: "Slug of the second cafe" },
                },
                required: ["slugA", "slugB"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_cities",
            description: "List all cities with their cafe counts, ordered by count descending",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "get_nearby_cafes",
            description: "Find cafes near a specific geographic location",
            parameters: {
                type: "object",
                properties: {
                    lat: { type: "number", description: "Latitude coordinate" },
                    lng: { type: "number", description: "Longitude coordinate" },
                    radiusKm: { type: "number", description: "Search radius in kilometers (max 50)" },
                },
                required: ["lat", "lng", "radiusKm"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_top_rated",
            description: "Get top rated cafes in a specific city",
            parameters: {
                type: "object",
                properties: {
                    city: { type: "string", description: "City name" },
                    limit: { type: "number", description: "Number of cafes to return (default 10)" },
                },
                required: ["city"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_grounds_info",
            description: "Return general information about Grounds.ph features and how to use the platform",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "get_cafe_reviews",
            description: "Get recent reviews for a specific cafe. Returns the latest reviews with ratings, comments, and author info.",
            parameters: {
                type: "object",
                properties: {
                    slug: { type: "string", description: "The cafe's unique slug identifier" },
                    limit: { type: "number", description: "Number of reviews to return (default 5, max 20)" },
                },
                required: ["slug"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_cafe_menu",
            description: "Get the menu for a specific cafe. Returns items with names, descriptions, categories, and prices.",
            parameters: {
                type: "object",
                properties: {
                    slug: { type: "string", description: "The cafe's unique slug identifier" },
                    category: { type: "string", description: "Filter by menu category (e.g., 'Coffee', 'Pastry', 'Food')" },
                },
                required: ["slug"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_cafe_hours",
            description: "Check a cafe's operating hours and whether it's currently open. Returns the full weekly schedule and current open/closed status.",
            parameters: {
                type: "object",
                properties: {
                    slug: { type: "string", description: "The cafe's unique slug identifier" },
                },
                required: ["slug"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_blog_posts",
            description: "Search blog posts about cafes, coffee, and the Philippine coffee scene. Returns articles with titles, excerpts, and metadata.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query for blog posts" },
                    limit: { type: "number", description: "Number of results to return (default 5, max 20)" },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_upcoming_events",
            description: "Get upcoming coffee events, meetups, and happenings. Can filter by city.",
            parameters: {
                type: "object",
                properties: {
                    city: { type: "string", description: "Filter events by city (optional)" },
                    limit: { type: "number", description: "Number of events to return (default 10)" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "find_hidden_gems",
            description: "Discover hidden gem cafes -- lesser-known spots that are highly rated. Can filter by city.",
            parameters: {
                type: "object",
                properties: {
                    city: { type: "string", description: "Filter hidden gems by city (optional)" },
                    limit: { type: "number", description: "Number of results (default 10)" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "find_cafes_with_feature",
            description: "Find cafes that have a specific combination of features/amenities. Use when the user asks for multiple amenity requirements at once.",
            parameters: {
                type: "object",
                properties: {
                    city: { type: "string", description: "City to search in (optional)" },
                    province: { type: "string", description: "Province to search in (optional)" },
                    features: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of features to search for. Available: wifi, sockets, aircon, pet friendly, work friendly, food, outdoor, parking, halal, decaf, non-dairy",
                    },
                    limit: { type: "number", description: "Max results (default 20)" },
                },
                required: ["features"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_cafe_stats",
            description: "Get aggregate statistics about cafes -- total counts, average ratings, feature breakdowns. Can be scoped to a city.",
            parameters: {
                type: "object",
                properties: {
                    city: { type: "string", description: "Get stats for a specific city (optional, defaults to all)" },
                },
            },
        },
    },
]
