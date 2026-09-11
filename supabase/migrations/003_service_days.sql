-- ============================================================
-- Sri Manakula Vinayagar Devasthanam — Service Days Migration
-- Version: 1.2  |  Date: September 2026
-- ============================================================

-- Add available_days column to services table
-- 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
ALTER TABLE services ADD COLUMN IF NOT EXISTS available_days JSONB NOT NULL DEFAULT '[0, 1, 2, 3, 4, 5, 6]'::jsonb;
