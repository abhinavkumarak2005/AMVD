-- Migration 008: Support anonymous donations
-- Drops the NOT NULL constraint on user_id in e_undiyal_transactions

ALTER TABLE public.e_undiyal_transactions ALTER COLUMN user_id DROP NOT NULL;
