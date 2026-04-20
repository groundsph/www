CREATE TYPE "public"."discount_campaign_status" AS ENUM('draft', 'active', 'paused', 'expired', 'archived');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed_amount', 'free_item');--> statement-breakpoint
CREATE TYPE "public"."voucher_status" AS ENUM('available', 'claimed', 'redeemed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "discount_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" real NOT NULL,
	"free_item_name" text,
	"free_item_description" text,
	"max_redemptions" integer NOT NULL,
	"current_redemptions" integer DEFAULT 0,
	"max_per_user" integer DEFAULT 1,
	"min_purchase_amount" real,
	"code_prefix" text DEFAULT 'GROUNDS',
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" "discount_campaign_status" DEFAULT 'draft',
	"is_public" boolean DEFAULT true,
	"qr_code_enabled" boolean DEFAULT true,
	"terms_and_conditions" text,
	"image_url" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discount_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"code" text NOT NULL,
	"user_id" uuid,
	"status" "voucher_status" DEFAULT 'available',
	"claimed_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"redeemed_by_cafe_id" uuid,
	"redemption_notes" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "discount_vouchers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "voucher_redemption_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid,
	"cafe_id" uuid NOT NULL,
	"redeemed_by" uuid NOT NULL,
	"code" text NOT NULL,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" real NOT NULL,
	"free_item_name" text,
	"redemption_method" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "discount_campaigns" ADD CONSTRAINT "discount_campaigns_cafe_id_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_campaigns" ADD CONSTRAINT "discount_campaigns_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_vouchers" ADD CONSTRAINT "discount_vouchers_campaign_id_discount_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."discount_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_vouchers" ADD CONSTRAINT "discount_vouchers_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_vouchers" ADD CONSTRAINT "discount_vouchers_redeemed_by_cafe_id_cafes_id_fk" FOREIGN KEY ("redeemed_by_cafe_id") REFERENCES "public"."cafes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemption_logs" ADD CONSTRAINT "voucher_redemption_logs_voucher_id_discount_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."discount_vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemption_logs" ADD CONSTRAINT "voucher_redemption_logs_campaign_id_discount_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."discount_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemption_logs" ADD CONSTRAINT "voucher_redemption_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemption_logs" ADD CONSTRAINT "voucher_redemption_logs_cafe_id_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemption_logs" ADD CONSTRAINT "voucher_redemption_logs_redeemed_by_profiles_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discount_campaigns_cafe_id_idx" ON "discount_campaigns" USING btree ("cafe_id");--> statement-breakpoint
CREATE INDEX "discount_campaigns_status_idx" ON "discount_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "discount_campaigns_start_date_idx" ON "discount_campaigns" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "discount_vouchers_code_idx" ON "discount_vouchers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "discount_vouchers_campaign_id_idx" ON "discount_vouchers" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "discount_vouchers_user_id_idx" ON "discount_vouchers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "discount_vouchers_status_idx" ON "discount_vouchers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voucher_redemption_logs_voucher_id_idx" ON "voucher_redemption_logs" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "voucher_redemption_logs_campaign_id_idx" ON "voucher_redemption_logs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "voucher_redemption_logs_user_id_idx" ON "voucher_redemption_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voucher_redemption_logs_cafe_id_idx" ON "voucher_redemption_logs" USING btree ("cafe_id");--> statement-breakpoint
CREATE INDEX "voucher_redemption_logs_created_at_idx" ON "voucher_redemption_logs" USING btree ("created_at");