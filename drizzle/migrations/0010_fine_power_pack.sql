CREATE TYPE "public"."mall_verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer DEFAULT 86400000,
	"rate_limit_max" integer DEFAULT 10,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "mall_cafe_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"verification_type" text NOT NULL,
	"proof_document_url" text,
	"contract_start_date" timestamp with time zone,
	"contract_end_date" timestamp with time zone,
	"linked_branch_id" uuid,
	"notes" text,
	"status" "mall_verification_status" DEFAULT 'pending',
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"before_value" jsonb,
	"after_value" jsonb,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cafes" ADD COLUMN "is_mall_cafe" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "cafes" ADD COLUMN "mall_verification_status" "mall_verification_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mall_cafe_verifications" ADD CONSTRAINT "mall_cafe_verifications_cafe_id_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mall_cafe_verifications" ADD CONSTRAINT "mall_cafe_verifications_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mall_cafe_verifications" ADD CONSTRAINT "mall_cafe_verifications_linked_branch_id_cafes_id_fk" FOREIGN KEY ("linked_branch_id") REFERENCES "public"."cafes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mall_cafe_verifications" ADD CONSTRAINT "mall_cafe_verifications_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX "apikey_userId_idx" ON "apikey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mall_cafe_verifications_cafe_id_idx" ON "mall_cafe_verifications" USING btree ("cafe_id");--> statement-breakpoint
CREATE INDEX "mall_cafe_verifications_status_idx" ON "mall_cafe_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mall_cafe_verifications_submitted_by_idx" ON "mall_cafe_verifications" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "system_logs_user_id_idx" ON "system_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "system_logs_entity_type_idx" ON "system_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "system_logs_created_at_idx" ON "system_logs" USING btree ("created_at");