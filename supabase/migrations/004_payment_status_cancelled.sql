-- Migration to add 'cancelled' to payment_status enum

-- Workaround: PostgreSQL doesn't allow ADD VALUE IF NOT EXISTS in a transaction block directly if we're not careful, but Supabase handles it if run via migration. We will run it directly.
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'cancelled';
