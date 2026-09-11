-- ============================================================
-- Sri Manakula Vinayagar Devasthanam — Sessions Migration
-- Version: 1.3  |  Date: September 2026
-- ============================================================

-- Add sessions column to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS sessions JSONB NOT NULL DEFAULT '["Morning", "Evening", "All Day"]'::jsonb;
