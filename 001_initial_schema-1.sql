-- ============================================================
-- PIPTRAK — Supabase Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROFILES ─────────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific data
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'elite')),
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status   TEXT DEFAULT 'inactive',
  plan_expires_at       TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── ACCOUNTS ─────────────────────────────────────────────────
-- Prop firm challenge accounts
CREATE TABLE accounts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  firm          TEXT NOT NULL DEFAULT 'FTMO',
  account_size  NUMERIC(12,2) NOT NULL DEFAULT 10000,
  start_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'passed', 'failed', 'paused')),
  -- Broker connection
  metaapi_token     TEXT,
  metaapi_account_id TEXT,
  webhook_secret    TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRADES ───────────────────────────────────────────────────
CREATE TABLE trades (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pair        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  lots        NUMERIC(10,4) DEFAULT 0,
  entry       NUMERIC(12,5) DEFAULT 0,
  exit        NUMERIC(12,5) DEFAULT 0,
  pnl         NUMERIC(12,2) NOT NULL,
  trade_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT DEFAULT '',
  source      TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'metaapi', 'webhook')),
  external_id TEXT, -- broker's trade ID (prevent duplicates)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate broker trades
CREATE UNIQUE INDEX trades_external_id_account
  ON trades(account_id, external_id)
  WHERE external_id IS NOT NULL;

-- ── JOURNAL ENTRIES ───────────────────────────────────────────
CREATE TABLE journal_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id  UUID REFERENCES accounts(id) ON DELETE SET NULL,
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  mood        TEXT DEFAULT 'focused',
  notes       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entry_date)
);

-- ── ALERT PREFERENCES ────────────────────────────────────────
CREATE TABLE alert_preferences (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  daily_loss  BOOLEAN DEFAULT true,
  max_dd      BOOLEAN DEFAULT true,
  target_hit  BOOLEAN DEFAULT true,
  streak      BOOLEAN DEFAULT false,
  push        BOOLEAN DEFAULT true,
  email       BOOLEAN DEFAULT false,
  sms         BOOLEAN DEFAULT false,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create alert prefs on profile creation
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO alert_preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();

-- ── STRIPE EVENTS LOG ─────────────────────────────────────────
CREATE TABLE stripe_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  type        TEXT NOT NULL,
  data        JSONB,
  processed   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades           ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Accounts
CREATE POLICY "accounts_select_own" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert_own" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update_own" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounts_delete_own" ON accounts FOR DELETE USING (auth.uid() = user_id);

-- Trades
CREATE POLICY "trades_select_own" ON trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trades_insert_own" ON trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trades_update_own" ON trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "trades_delete_own" ON trades FOR DELETE USING (auth.uid() = user_id);

-- Journal
CREATE POLICY "journal_select_own" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "journal_insert_own" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "journal_update_own" ON journal_entries FOR UPDATE USING (auth.uid() = user_id);

-- Alerts
CREATE POLICY "alerts_select_own" ON alert_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "alerts_update_own" ON alert_preferences FOR UPDATE USING (auth.uid() = user_id);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX trades_account_id_idx ON trades(account_id);
CREATE INDEX trades_user_id_idx    ON trades(user_id);
CREATE INDEX trades_date_idx       ON trades(trade_date DESC);
CREATE INDEX accounts_user_id_idx  ON accounts(user_id);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON alert_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
