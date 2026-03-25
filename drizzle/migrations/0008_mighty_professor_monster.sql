CREATE TYPE "public"."crawl_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."inventory_item_status" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TYPE "public"."blog_status" ADD VALUE 'pending' BEFORE 'draft';--> statement-breakpoint
CREATE TABLE "chat_rate_limits" (
	"session_id" text PRIMARY KEY NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cafe_crawl_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_id" uuid NOT NULL,
	"cafe_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cafe_crawl_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cafe_crawl_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'pending',
	"admin_notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cafe_crawl_saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cafe_crawls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"cover_image" text,
	"status" "crawl_status" DEFAULT 'draft',
	"is_public" boolean DEFAULT true,
	"item_count" integer DEFAULT 0,
	"views_count" integer DEFAULT 0,
	"saves_count" integer DEFAULT 0,
	"likes_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "cafe_crawls_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collection_saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monthly_leaderboard_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"year_month" text NOT NULL,
	"region" text,
	"user_id" uuid,
	"cafe_id" uuid,
	"rank" integer NOT NULL,
	"score" integer NOT NULL,
	"visit_count" integer DEFAULT 0,
	"review_count" integer DEFAULT 0,
	"avg_rating" double precision,
	"likes_received" integer DEFAULT 0,
	"photo_count" integer DEFAULT 0,
	"verified_count" integer DEFAULT 0,
	"region_diversity" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "site_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"description" text,
	"category" text NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"warning_threshold" integer DEFAULT 0 NOT NULL,
	"expiry_date" timestamp with time zone,
	"cost_price" real,
	"last_restocked" timestamp with time zone,
	"link" text,
	"status" "inventory_item_status" DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_restock_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" real,
	"total_amount" real,
	"invoice_number" text,
	"proof_url" text,
	"supplier_name" text,
	"order_reference" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "llm_review" jsonb;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "images" text[];--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "tagged_cafe_ids" uuid[];--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "crawl_id" uuid;--> statement-breakpoint
ALTER TABLE "cafes" ADD COLUMN "straw_type" text;--> statement-breakpoint
ALTER TABLE "cafes" ADD COLUMN "straw_type_other" text;--> statement-breakpoint
ALTER TABLE "cafes" ADD COLUMN "is_halal_certified" boolean;--> statement-breakpoint
ALTER TABLE "cafes" ADD COLUMN "badge_stamp_url" text;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "saves_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_private" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "moderator_regions" text[];--> statement-breakpoint
ALTER TABLE "follow_requests" ADD CONSTRAINT "follow_requests_requester_id_profiles_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_requests" ADD CONSTRAINT "follow_requests_target_id_profiles_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_crawl_items" ADD CONSTRAINT "cafe_crawl_items_crawl_id_cafe_crawls_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."cafe_crawls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_crawl_items" ADD CONSTRAINT "cafe_crawl_items_cafe_id_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_crawl_likes" ADD CONSTRAINT "cafe_crawl_likes_crawl_id_cafe_crawls_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."cafe_crawls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_crawl_likes" ADD CONSTRAINT "cafe_crawl_likes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_crawl_reports" ADD CONSTRAINT "cafe_crawl_reports_crawl_id_cafe_crawls_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."cafe_crawls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_crawl_reports" ADD CONSTRAINT "cafe_crawl_reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_crawl_reports" ADD CONSTRAINT "cafe_crawl_reports_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_crawl_saves" ADD CONSTRAINT "cafe_crawl_saves_crawl_id_cafe_crawls_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."cafe_crawls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_crawl_saves" ADD CONSTRAINT "cafe_crawl_saves_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_crawls" ADD CONSTRAINT "cafe_crawls_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_saves" ADD CONSTRAINT "collection_saves_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_saves" ADD CONSTRAINT "collection_saves_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_leaderboard_snapshots" ADD CONSTRAINT "monthly_leaderboard_snapshots_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_leaderboard_snapshots" ADD CONSTRAINT "monthly_leaderboard_snapshots_cafe_id_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_cafe_id_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_restock_history" ADD CONSTRAINT "inventory_restock_history_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "follow_requests_requester_target_unique" ON "follow_requests" USING btree ("requester_id","target_id");--> statement-breakpoint
CREATE INDEX "follow_requests_target_status_idx" ON "follow_requests" USING btree ("target_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "crawl_likes_user_crawl_unique" ON "cafe_crawl_likes" USING btree ("user_id","crawl_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crawl_saves_user_crawl_unique" ON "cafe_crawl_saves" USING btree ("user_id","crawl_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cafe_crawls_slug_idx" ON "cafe_crawls" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_saves_user_collection_unique" ON "collection_saves" USING btree ("user_id","collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mls_type_year_month_idx" ON "monthly_leaderboard_snapshots" USING btree ("type","year_month","region","user_id","cafe_id");--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_crawl_id_cafe_crawls_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."cafe_crawls"("id") ON DELETE set null ON UPDATE no action;