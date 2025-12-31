
import { db } from "@/db"
import { sql } from "drizzle-orm"

async function setupProfileTrigger() {
    console.log("Setting up profile creation trigger...")

    try {
        // 1. Create the function
        await db.execute(sql`
            CREATE OR REPLACE FUNCTION public.handle_new_user()
            RETURNS TRIGGER AS $$
            DECLARE
                base_username text;
                new_username text;
                counter integer := 0;
            BEGIN
                -- Generate base username from email (or random if missing)
                IF NEW.email IS NOT NULL THEN
                    base_username := split_part(NEW.email, '@', 1);
                ELSE
                    base_username := 'user_' || substring(NEW.id::text, 1, 8);
                END IF;

                -- Sanitize username (alphanumeric + count)
                base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
                IF length(base_username) < 3 THEN
                    base_username := 'user_' || substring(NEW.id::text, 1, 8);
                END IF;
                
                new_username := base_username;

                -- Ensure uniqueness (simple loop)
                -- Note: In high concurrency, this could theoretically race, but acceptable for this scale.
                WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
                    counter := counter + 1;
                    new_username := base_username || counter;
                END LOOP;

                INSERT INTO public.profiles (
                    id,
                    username,
                    display_name,
                    avatar_url,
                    role,
                    is_supporter,
                    total_contribution,
                    profile_completed,
                    passport,
                    stats,
                    created_at,
                    updated_at
                )
                VALUES (
                    NEW.id,
                    new_username,
                    COALESCE(NEW.name, new_username),
                    NEW.image,
                    'user',
                    false,
                    0,
                    false,
                    jsonb_build_object(
                        'visited_ids', '[]'::jsonb,
                        'favorite_ids', '[]'::jsonb,
                        'wishlist_ids', '[]'::jsonb,
                        'favorite_region', ''
                    ),
                    jsonb_build_object(
                        'scout_rank', 'novice',
                        'total_photos', 0,
                        'total_reviews', 0,
                        'total_scouted', 0
                    ),
                    NEW.created_at,
                    NEW.updated_at
                )
                ON CONFLICT (id) DO NOTHING;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        `)

        // 2. Create the trigger
        await db.execute(sql`
            DROP TRIGGER IF EXISTS on_auth_user_created ON "user";
            CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON "user"
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
        `)

        console.log("Trigger 'on_auth_user_created' created successfully.")

        // 3. Backfill missing profiles
        console.log("Backfilling missing profiles...")
        // We can just manually invoke the logic for existing users who don't have profiles
        // Or simpler: Just insert for all users where id not in profiles

        await db.execute(sql`
            DO $$
            DECLARE
                r RECORD;
                base_username text;
                new_username text;
                counter integer;
            BEGIN
                FOR r IN 
                    SELECT u.* FROM "user" u 
                    LEFT JOIN profiles p ON u.id = p.id 
                    WHERE p.id IS NULL
                LOOP
                    -- Logic duplicated from trigger (simplified for loop context)
                    IF r.email IS NOT NULL THEN
                        base_username := split_part(r.email, '@', 1);
                    ELSE
                        base_username := 'user_' || substring(r.id::text, 1, 8);
                    END IF;
                    
                    base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
                    IF length(base_username) < 3 THEN
                        base_username := 'user_' || substring(r.id::text, 1, 8);
                    END IF;

                    new_username := base_username;
                    counter := 0;

                    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
                        counter := counter + 1;
                        new_username := base_username || counter;
                    END LOOP;

                    INSERT INTO public.profiles (
                        id,
                        username,
                        display_name,
                        avatar_url,
                        role,
                        is_supporter,
                        total_contribution,
                        profile_completed,
                        passport,
                        stats,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        r.id,
                        new_username,
                        COALESCE(r.name, new_username),
                        r.image,
                        'user',
                        false,
                        0,
                        false,
                        jsonb_build_object(
                            'visited_ids', '[]'::jsonb,
                            'favorite_ids', '[]'::jsonb,
                            'wishlist_ids', '[]'::jsonb,
                            'favorite_region', ''
                        ),
                        jsonb_build_object(
                            'scout_rank', 'novice',
                            'total_photos', 0,
                            'total_reviews', 0,
                            'total_scouted', 0
                        ),
                        r.created_at,
                        r.updated_at
                    );
                END LOOP;
            END $$;
        `)

        process.exit(0)
    } catch (error) {
        console.error("Error setting up trigger:", error)
        process.exit(1)
    }
}

setupProfileTrigger()
