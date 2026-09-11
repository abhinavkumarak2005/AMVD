CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default 80G limit
INSERT INTO system_settings (key, value)
VALUES ('80g_minimum_amount', '10000'::jsonb)
ON CONFLICT (key) DO NOTHING;
