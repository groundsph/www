alter table "public"."cafe_subscriptions" add column "proof_of_payment_url" text;
alter table "public"."cafe_subscriptions" add column "is_manual_payment" boolean default false;
alter table "public"."cafe_subscriptions" add column "payment_verified" boolean default false;
