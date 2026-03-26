ALTER TYPE "public"."blog_status" ADD VALUE 'rejected' BEFORE 'archived';--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"read" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "rejected_by" uuid;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_userId_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_rejected_by_profiles_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;