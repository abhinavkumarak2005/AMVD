-- ============================================================
-- Sri Manakula Vinayagar Devasthanam — Database Schema
-- Version: 1.0  |  Date: September 2026
-- Run this in Supabase SQL Editor (Settings → SQL Editor)
-- ============================================================

-- ── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('devotee', 'staff', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'pending_payment', 'pending_approval', 'confirmed',
    'rejected', 'cancelled', 'refunded', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('initiated', 'success', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE notice_type AS ENUM ('banner', 'popup', 'dashboard', 'service');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE calendar_status AS ENUM ('open', 'blocked', 'partial');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE exemption_status AS ENUM ('pending', 'contacted', 'certificate_sent', 'complete');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 1. Users ────────────────────────────────────────────────
-- Mirrors Supabase Auth. Created via DB trigger on auth.users insert.
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  phone           TEXT,
  email           TEXT UNIQUE,
  role            user_role NOT NULL DEFAULT 'devotee',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create user profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, full_name, phone, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 2. Services ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,
  session_type      TEXT NOT NULL,           -- 'morning', 'evening', 'all_day', 'session_1_2_3'
  max_persons       INTEGER NOT NULL DEFAULT 5,
  advance_days      INTEGER NOT NULL DEFAULT 3,
  price_rupees      INTEGER NOT NULL DEFAULT 100,  -- INR rupees (NOT paise)
  slot_capacity     INTEGER NOT NULL DEFAULT 2,     -- default capacity per slot
  is_active         BOOLEAN NOT NULL DEFAULT true,
  conflict_group    TEXT,                           -- e.g. 'kaapu_kavasam'
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  post_booking_info TEXT,                           -- shown after booking
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Slot Inventory ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS slot_inventory (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id       UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  session          TEXT NOT NULL,
  total_capacity   INTEGER NOT NULL DEFAULT 2,    -- editable by admin
  confirmed_count  INTEGER NOT NULL DEFAULT 0,
  pending_count    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (service_id, date, session),
  CONSTRAINT positive_counts CHECK (confirmed_count >= 0 AND pending_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_slot_inventory_service_date ON slot_inventory(service_id, date, session);

-- ── 4. Booking Holds (10-min window) ───────────────────────
CREATE TABLE IF NOT EXISTS booking_holds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id   UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  session      TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  is_released  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holds_expires ON booking_holds(expires_at) WHERE NOT is_released;
CREATE INDEX IF NOT EXISTS idx_holds_user ON booking_holds(user_id);

-- ── 5. Bookings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        TEXT UNIQUE NOT NULL,              -- e.g. SMV-20260920-0042
  user_id          UUID NOT NULL REFERENCES users(id),
  service_id       UUID NOT NULL REFERENCES services(id),
  hold_id          UUID REFERENCES booking_holds(id),
  date             DATE NOT NULL,
  session          TEXT NOT NULL,
  num_persons      INTEGER NOT NULL DEFAULT 1,
  amount_rupees    INTEGER NOT NULL,                   -- INR rupees
  status           booking_status NOT NULL DEFAULT 'pending_payment',
  rejection_reason TEXT,
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_service_date ON bookings(service_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Auto-generate booking reference
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(reference, '-', 3) AS INTEGER)), 0) + 1
    INTO seq_num
    FROM bookings
    WHERE reference LIKE 'SMV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%';
  NEW.reference := 'SMV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_booking_reference ON bookings;
CREATE TRIGGER set_booking_reference
  BEFORE INSERT ON bookings
  FOR EACH ROW WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION generate_booking_reference();

-- ── 6. Booking Persons ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_persons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  star        TEXT,       -- Nakshatra
  gothram     TEXT,
  sort_order  INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_booking_persons_booking ON booking_persons(booking_id);

-- ── 7. Payments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID REFERENCES bookings(id),
  ehundi_id       UUID,                          -- set for donation payments
  user_id         UUID NOT NULL REFERENCES users(id),
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  razorpay_refund_id  TEXT,
  amount_rupees   INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  status          payment_status NOT NULL DEFAULT 'initiated',
  method          TEXT,                          -- card, upi, netbanking
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 8. E-Undiyal Transactions ───────────────────────────────
CREATE TABLE IF NOT EXISTS e_undiyal_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           TEXT UNIQUE NOT NULL,      -- SMV-D-20260920-0001
  user_id             UUID NOT NULL REFERENCES users(id),
  amount_rupees       INTEGER NOT NULL,
  status              payment_status NOT NULL DEFAULT 'initiated',
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  razorpay_refund_id  TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ehundi_user ON e_undiyal_transactions(user_id, created_at DESC);

-- ── 9. Calendar Dates ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_dates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                    DATE NOT NULL UNIQUE,
  status                  calendar_status NOT NULL DEFAULT 'open',
  blocked_service_ids     UUID[] DEFAULT '{}',
  allowed_service_ids     UUID[] DEFAULT '{}',     -- for 'partial' status
  override_conflict_rules BOOLEAN NOT NULL DEFAULT false,
  special_instructions    TEXT,                     -- shown to devotees
  internal_notes          TEXT,                     -- admin only
  created_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 10. Conflict Rules ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS conflict_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type       TEXT NOT NULL,              -- 'mutual_exclusive', 'requires_approval'
  service_a_id    UUID REFERENCES services(id) ON DELETE CASCADE,
  service_b_id    UUID REFERENCES services(id) ON DELETE CASCADE,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 11. Notices ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  type         notice_type NOT NULL DEFAULT 'banner',
  priority     INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 12. Tax Exemptions (80G) ────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_exemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  booking_id      UUID REFERENCES bookings(id),
  ehundi_id       UUID REFERENCES e_undiyal_transactions(id),
  amount_rupees   INTEGER NOT NULL,
  status          exemption_status NOT NULL DEFAULT 'pending',
  pan_number      TEXT,
  address         TEXT,
  notes           TEXT,
  handled_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 13. Audit Logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_undiyal_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_exemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

-- ── users RLS ────────────────────────────────────────────────
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can view all users" ON users FOR SELECT
  USING (get_my_role() IN ('admin', 'super_admin'));
CREATE POLICY "Super admin can update roles" ON users FOR UPDATE
  USING (get_my_role() = 'super_admin');

-- ── services RLS ─────────────────────────────────────────────
CREATE POLICY "Public can read active services" ON services FOR SELECT
  USING (is_active = true);
CREATE POLICY "Admins can manage services" ON services FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ── slot_inventory RLS ───────────────────────────────────────
CREATE POLICY "Public can read slot inventory" ON slot_inventory FOR SELECT
  USING (true);

-- ── bookings RLS ─────────────────────────────────────────────
CREATE POLICY "Users see own bookings" ON bookings FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Admins see all bookings" ON bookings FOR SELECT
  USING (get_my_role() IN ('admin', 'super_admin', 'staff'));
CREATE POLICY "Admins update bookings" ON bookings FOR UPDATE
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ── e_undiyal RLS ────────────────────────────────────────────
CREATE POLICY "Users see own donations" ON e_undiyal_transactions FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Admins see all donations" ON e_undiyal_transactions FOR SELECT
  USING (get_my_role() IN ('admin', 'super_admin', 'staff'));

-- ── tax_exemptions RLS ───────────────────────────────────────
CREATE POLICY "Users see own requests" ON tax_exemptions FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Admins manage exemptions" ON tax_exemptions FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ── notices RLS ──────────────────────────────────────────────
CREATE POLICY "Public reads active notices" ON notices FOR SELECT
  USING (is_active = true AND published_at <= now() AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "Admins manage notices" ON notices FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ── audit_logs RLS ───────────────────────────────────────────
CREATE POLICY "Admins read audit logs" ON audit_logs FOR SELECT
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ── Ensure Web API Permissions ───────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
