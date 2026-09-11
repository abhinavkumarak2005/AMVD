-- ============================================================
-- Sri Manakula Vinayagar Devasthanam — Seed Data
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ── 10 Services (all ₹100 default, capacity 2) ──────────────
INSERT INTO services (name, category, session_type, max_persons, advance_days, price_rupees, slot_capacity, conflict_group, requires_approval, sort_order)
VALUES
  -- 1. Moolavar Abishegam (special: 10 families × 3 persons)
  ('Moolavar Abishegam',              'Abhisegam',      'morning',        3,   3, 100, 10,  NULL,             false, 1),

  -- 2. Ganapathy Homam (5 advance days, may conflict with chariot)
  ('Ganapathy Homam',                 'Homam',          'morning',        5,   5, 100,  2, NULL,             true,  2),

  -- 3 & 4. Kaapu (mutually exclusive with Kavasam)
  ('Moolavar Sandhana Kaapu',         'Kaapu',          'morning',        5,   3, 100,  2, 'kaapu_kavasam',  false, 3),
  ('Moolavar Vennai Kaapu',           'Kaapu',          'morning',        5,   3, 100,  2, 'kaapu_kavasam',  false, 4),

  -- 5. Kavasam (mutually exclusive with Kaapu)
  ('Kavasam (All events)',             'Kavasam',        'all_day',        5,   3, 100,  2, 'kaapu_kavasam',  false, 5),

  -- 6 & 7. Chariots (1 per session — capacity enforced below)
  ('Gold Chariot',                    'Chariot',        'morning_evening', 5,  3, 100,  1,  NULL,             false, 6),
  ('Silver Chariot',                  'Chariot',        'morning_evening', 5,  3, 100,  1,  NULL,             false, 7),

  -- 8. Thirukalyanam (blocks morning chariot — enforced by conflict_rules)
  ('Urchavar Thirukalyanam',          'Thirukalyanam',  'morning',        5,   3, 100,  2,  NULL,             false, 8),

  -- 9 & 10. Annadhanam
  ('Annadhanam Prasadha Thonnai',     'Annadhanam',     'session_1_2_3',  5,   3, 100,  2,  NULL,             false, 9),
  ('Annadhanam Meals',                'Annadhanam',     'single_session', 1,   3, 100,  2,  NULL,             false, 10)
ON CONFLICT DO NOTHING;

-- ── Conflict Rules ───────────────────────────────────────────
-- Kaapu ↔ Kavasam mutual exclusivity
DO $$
DECLARE
  sandhana_kaapu_id UUID;
  vennai_kaapu_id   UUID;
  kavasam_id        UUID;
  homam_id          UUID;
  gold_chariot_id   UUID;
  silver_chariot_id UUID;
  thirukalyanam_id  UUID;
BEGIN
  SELECT id INTO sandhana_kaapu_id  FROM services WHERE name = 'Moolavar Sandhana Kaapu';
  SELECT id INTO vennai_kaapu_id    FROM services WHERE name = 'Moolavar Vennai Kaapu';
  SELECT id INTO kavasam_id         FROM services WHERE name = 'Kavasam (All events)';
  SELECT id INTO homam_id           FROM services WHERE name = 'Ganapathy Homam';
  SELECT id INTO gold_chariot_id    FROM services WHERE name = 'Gold Chariot';
  SELECT id INTO silver_chariot_id  FROM services WHERE name = 'Silver Chariot';
  SELECT id INTO thirukalyanam_id   FROM services WHERE name = 'Urchavar Thirukalyanam';

  -- Kaapu ↔ Kavasam
  INSERT INTO conflict_rules (rule_type, service_a_id, service_b_id, description)
  VALUES
    ('mutual_exclusive', sandhana_kaapu_id, kavasam_id, 'Sandhana Kaapu and Kavasam cannot be booked on same date'),
    ('mutual_exclusive', vennai_kaapu_id,   kavasam_id, 'Vennai Kaapu and Kavasam cannot be booked on same date'),
    -- Thirukalyanam blocks morning Gold Chariot
    ('mutual_exclusive', thirukalyanam_id, gold_chariot_id, 'Thirukalyanam and Gold Chariot cannot be on same morning session'),
    -- Homam + Chariot requires admin approval
    ('requires_approval', homam_id, gold_chariot_id,   'Ganapathy Homam on same day as Gold Chariot requires admin approval'),
    ('requires_approval', homam_id, silver_chariot_id, 'Ganapathy Homam on same day as Silver Chariot requires admin approval')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── Sample Welcome Notice ────────────────────────────────────
INSERT INTO notices (title, body, type, priority, is_active, expires_at)
VALUES (
  'Temple Online Booking Now Live',
  'You can now book Pooja services online. Slots are limited. Book at least 3 days in advance.',
  'banner',
  1,
  true,
  now() + interval '30 days'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Post-Run Instructions
-- ============================================================
-- 1. After running this seed, set your super admin role:
--    UPDATE users SET role = 'super_admin' WHERE email = 'your-email@domain.com';
--
-- 2. Verify services were created:
--    SELECT id, name, price_rupees, slot_capacity FROM services ORDER BY sort_order;
--
-- 3. Adjust prices in admin CMS when ready (all start at ₹100)
-- ============================================================
