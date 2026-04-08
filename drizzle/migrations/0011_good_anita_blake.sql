ALTER TABLE "cafe_menu_items" ADD COLUMN "is_food" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "cafe_menu_items" ADD COLUMN "is_hot" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "cafe_menu_items" ADD COLUMN "is_cold" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "cafe_menu_items" ADD COLUMN "calories" integer;--> statement-breakpoint
ALTER TABLE "cafe_menu_items" ADD COLUMN "is_vegan" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "cafe_menu_items" ADD COLUMN "is_vegetarian" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "cafe_menu_items" ADD COLUMN "size_options" jsonb;--> statement-breakpoint
ALTER TABLE "cafe_menu_items" ADD COLUMN "last_updated_by" uuid;--> statement-breakpoint
ALTER TABLE "cafe_menu_items" ADD COLUMN "community_submitted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "cafe_menu_items" ADD CONSTRAINT "cafe_menu_items_last_updated_by_profiles_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;