-- Migration: Make order snapshots required and backfill existing orders

-- 1) Backfill from users where userId is present
-- (1) Only backfill missing emails from users
UPDATE "orders" o
SET "userEmail" = u.email
FROM "users" u
WHERE o."userId" = u.id
  AND o."userEmail" IS NULL;

-- (2) Backfill userName only when missing or empty; convert empty-generated names to NULL
UPDATE "orders" o
SET "userName" = NULLIF(TRIM(CONCAT(COALESCE(u."firstName", ''), ' ', COALESCE(u."lastName", ''))), '')
FROM "users" u
WHERE o."userId" = u.id
  AND (o."userName" IS NULL OR o."userName" = '');

-- 2) For any remaining rows without snapshots, set sensible defaults
UPDATE "orders"
SET "userEmail" = COALESCE("userEmail", 'unknown@example.com'),
    "userName" = COALESCE("userName", 'Unknown')
WHERE "userEmail" IS NULL OR "userName" IS NULL;

-- 3) Enforce NOT NULL at the database level
ALTER TABLE "orders" ALTER COLUMN "userEmail" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "userName" SET NOT NULL;
