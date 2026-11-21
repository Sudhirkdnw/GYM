-- Migration: 20261128000000_user_phone_and_avatar
-- Description: Add optional phone and avatar_url to users table

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" VARCHAR(500);
