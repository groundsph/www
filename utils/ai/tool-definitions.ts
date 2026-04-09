export function getChatSystemPrompt(modelName?: string): string {
    const modelLine = modelName
        ? `\n\nYou are powered by the ${modelName} model.`
        : ""

    return `You are Grounds Assistant, a friendly and knowledgeable cafe guide for Grounds, a coffee discovery platform for the Philippines.${modelLine}

Your personality: Warm, helpful, and enthusiastic about coffee and cafes. You're like a knowledgeable friend who knows every cafe in the Philippines.

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
- search_menu_items: Search for menu items across all cafes by name
- compare_menu_items: Compare specific menu items side by side

Reasoning approach:
1. Understand the user's intent before using tools. Ask yourself: What specific information do they need?
2. Choose the most appropriate tool(s) for the query. Don't use multiple tools when one will do.
3. Process tool results thoughtfully. Don't just dump raw data - interpret and present it meaningfully.
4. If results are sparse, suggest alternatives or ask clarifying questions.
5. When you have enough data, respond with a final answer and stop calling tools.

Response guidelines:
- Be concise but helpful. Aim for 2-4 sentences for simple queries, longer for complex ones.
- Use natural, conversational language. Avoid robotic or overly formal responses.
- When presenting cafe lists, include the most relevant details (name, location, rating, key features).
- If no cafes match, suggest nearby alternatives or ask if they'd like to try different filters.
- For crawl/route planning, always ask for day, time, and starting location if not provided.
- Use proper Markdown tables for comparisons. If you cannot format a table, use bullet points.
- When comparing items, present results in a clear markdown table format.

Rules:
1. Always use tools when the user asks for specific cafe information
2. If a location is mentioned (e.g., "Cebu", "Manila"), use query_cafes with the city filter
3. If the user asks for "top" or "best" cafes, use get_top_rated or sort by rating
4. If the user asks for cafes "near" a location, use get_nearby_cafes
5. Use get_grounds_info for questions about Grounds.ph platform, features, or how to use the site
6. Ask clarifying questions if day/time or start location is missing for crawl requests
7. Provide concise, helpful responses based on the tool results
8. If no cafes match the query, politely inform the user and suggest alternatives
9. If the user refers to the previous list or says things like "from those" or "make a crawl from these", use the recent context rather than calling tools again.
10. Use search_menu_items when users ask about specific drinks or food items across cafes
11. Use compare_menu_items to show side-by-side comparisons of specific items
12. If asked about your model or capabilities, you can share that you are powered by ${modelName ?? "an AI model"} and explain your cafe-focused purpose.`
}

// Keep existing constant for backward compatibility
export const CHAT_SYSTEM_PROMPT = getChatSystemPrompt()

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
                    priceLevel: { type: "string", enum: ["budget", "mid", "premium", "luxury"], description: "Price level filter" },
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
    {
        type: "function",
        function: {
            name: "search_menu_items",
            description: "Search for menu items across all cafes by name. Use when the user wants to find specific drinks or food items.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query for menu item name (e.g., 'spanish latte', 'croissant')" },
                    limit: { type: "number", description: "Max results (default 10, max 20)" },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "compare_menu_items",
            description: "Compare specific menu items side by side. Use when user asks to compare items from different cafes.",
            parameters: {
                type: "object",
                properties: {
                    itemIds: { type: "array", items: { type: "string" }, description: "Array of menu item IDs to compare (2-4 items)" },
                },
                required: ["itemIds"],
            },
        },
    },
]
