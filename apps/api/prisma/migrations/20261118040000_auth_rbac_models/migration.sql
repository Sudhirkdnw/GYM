-- AlterEnum: Add new values to user_role
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'GYM_OWNER';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'GYM_ADMIN';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'RECEPTIONIST';

-- AlterEnum: Add SUSPENDED to user_status
ALTER TYPE "user_status" ADD VALUE IF NOT EXISTS 'SUSPENDED';

-- AlterTable: users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ;

-- CreateTable: refresh_tokens
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "family" UUID NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "replaced_by_token_hash" VARCHAR(255),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "user_agent" VARCHAR(500),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user_id" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_family" ON "refresh_tokens"("family");

-- CreateTable: password_reset_tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_reset_tokens_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_password_reset_user_id" ON "password_reset_tokens"("user_id");

-- CreateTable: email_verification_tokens
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_verification_tokens_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_email_verification_user_id" ON "email_verification_tokens"("user_id");
